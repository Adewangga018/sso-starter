using Microsoft.EntityFrameworkCore;
using SsoBackend.Data;
using SsoBackend.Models.Dto;
using SsoBackend.Models.Office;

namespace SsoBackend.Services;

// My Office (persuratan). Alur inti mengikuti DOF: buat surat (draft) -> kirim ke reviewer ->
// approver -> disetujui -> distribusi. Master perusahaan/grup tidak dipakai; distribusi
// mentarget pegawai dari data SDM (GcsDbContext). Skema office dikelola manual (raw SQL),
// EF hanya baca/tulis.
public class OfficeService
{
    // SP & ASP dihitung sebagai satu kelompok "SP" di dashboard (sisanya Non-SP).
    private static readonly string[] JenisSp = ["SP", "ASP"];
    private static readonly string[] SifatValid = ["Rahasia", "Terbatas", "Biasa"];
    private static readonly string[] CepatValid = ["Biasa", "Segera", "Sangat Segera"];

    private readonly ApplicationDbContext _db;
    private readonly GcsDbContext _gcs;
    private readonly InovasiDbContext _grading;   // schema grading: penempatan/jabatan/unit/pegawai_tkno
    private readonly PosisiResolver _posisi;

    public OfficeService(ApplicationDbContext db, GcsDbContext gcs, InovasiDbContext grading, PosisiResolver posisi)
    {
        _db = db;
        _gcs = gcs;
        _grading = grading;
        _posisi = posisi;
    }

    // ---- Master kode surat ----

    // Kosakata jenis surat: office.ref_jenis_surat, disalin dari master SMP (DBSMP.dbo.
    // TB_SURAT_JENIS) lewat docs/office-jenis-surat-lokal.sql. Awalnya kode ini membaca
    // DBSMP langsung lintas-database, tapi login aplikasi produksi tidak pernah diberi izin
    // SELECT di sana sehingga tiap pembacaan jenis surat (Inbox, Daftar Surat, dst) gagal
    // dengan error permission -> 500. Disalin lokal supaya menu-menu itu tidak lagi
    // bergantung pada izin lintas-database. Hanya baris aktif yang boleh dipilih di form.
    private IQueryable<RefJenisSurat> JenisAktif =>
        _db.RefJenisSurat.AsNoTracking().Where(x => x.Aktif);

    // Peta kode -> nama untuk SELURUH baris (termasuk nonaktif), supaya surat lama yang
    // memakai jenis yang kini dinonaktifkan tetap tampil namanya di daftar & detail.
    private Task<Dictionary<string, string>> PetaNamaJenisAsync() =>
        _db.RefJenisSurat.AsNoTracking()
            .ToDictionaryAsync(j => j.Kode, j => j.Nama);

    // Isi seluruh dropdown form Buat Surat sekaligus, plus tebakan bagian pembuat.
    public async Task<OfficeReferensiDto> ReferensiAsync(string nik)
    {
        var jenis = await JenisAktif
            .OrderBy(x => x.Urutan)
            .Select(x => new RefJenisSuratDto(x.Kode, x.Nama)).ToListAsync();
        var bagian = await _db.RefBagian.AsNoTracking().Where(x => x.Aktif)
            .OrderBy(x => x.Urutan).ThenBy(x => x.Kode)
            .Select(x => new RefBagianDto(x.Kode, x.Nama)).ToListAsync();
        var klasifikasi = await _db.RefKlasifikasi.AsNoTracking().Where(x => x.Aktif)
            .OrderBy(x => x.Kode)
            .Select(x => new RefKlasifikasiDto(x.Kode, x.Kelompok, x.Masalah)).ToListAsync();

        return new OfficeReferensiDto(jenis, bagian, klasifikasi, await TebakBagianAsync(nik));
    }

    // Tebak kode bagian pembuat dari data organisasi di schema grading. Dicocokkan
    // berjenjang lewat office.ref_bagian_unit: nama BAGIAN dulu (paling spesifik),
    // lalu DEPARTEMEN, lalu KOMPARTEMEN. Null bila unitnya belum terpetakan —
    // pembuat tinggal memilih sendiri di form.
    public async Task<string?> TebakBagianAsync(string nik)
    {
        var kandidat = new List<string>();

        // Pegawai organik: penempatan aktif -> jabatan (nama bagian) -> unit (departemen).
        var organik = await (
            from p in _grading.Penempatan.AsNoTracking()
            where p.IdKaryawan == nik && p.Status == "Aktif"
            join j in _grading.Jabatan.AsNoTracking() on p.IdJabatan equals j.IdJabatan
            select new { j.NamaJabatan, j.IdUnit }).FirstOrDefaultAsync();
        if (organik is not null)
        {
            kandidat.Add(organik.NamaJabatan);
            if (organik.IdUnit is int idUnit)
            {
                // Telusuri ke atas: departemen -> kompartemen -> direktorat.
                var unit = await _grading.UnitOrganisasi.AsNoTracking()
                    .FirstOrDefaultAsync(u => u.IdUnit == idUnit);
                while (unit is not null)
                {
                    kandidat.Add(unit.Nama);
                    if (unit.IdUnitInduk is not int induk) break;
                    unit = await _grading.UnitOrganisasi.AsNoTracking().FirstOrDefaultAsync(u => u.IdUnit == induk);
                }
            }
        }

        // Pegawai TKNO: nama bagian tersimpan langsung, departemen/kompartemen lewat ID.
        var tkno = await _grading.PegawaiTkno.AsNoTracking().FirstOrDefaultAsync(t => t.IdKaryawan == nik);
        if (tkno is not null)
        {
            if (!string.IsNullOrWhiteSpace(tkno.Bagian)) kandidat.Add(tkno.Bagian);
            foreach (var idUnit in new[] { tkno.IdDepartemen, tkno.IdKompartemen })
            {
                if (idUnit is not int id) continue;
                var nama = await _grading.UnitOrganisasi.AsNoTracking()
                    .Where(u => u.IdUnit == id).Select(u => u.Nama).FirstOrDefaultAsync();
                if (!string.IsNullOrWhiteSpace(nama)) kandidat.Add(nama);
            }
        }

        if (kandidat.Count == 0)
        {
            return null;
        }
        // Ambil peta sekali, lalu cocokkan mengikuti urutan kandidat (spesifik -> umum).
        var peta = await _db.RefBagianUnit.AsNoTracking()
            .Where(m => kandidat.Contains(m.NamaUnit))
            .ToDictionaryAsync(m => m.NamaUnit, m => m.KodeBagian);
        foreach (var nm in kandidat)
        {
            if (peta.TryGetValue(nm, out var kode)) return kode;
        }
        return null;
    }

    // Nomor surat GCS: {urut:00000}/{bagian}/{klasifikasi}/{jenis}/{tahun}.
    // Nomor urut diambil atomik lewat office.sp_ambil_nomor_urut — satu deret untuk
    // seluruh perusahaan, reset tiap tahun (WIB). Segmen yang belum terisi ditulis "-"
    // supaya jumlah ruas nomor selalu sama dan mudah diurai kembali.
    private async Task<string> BuatNomorAsync(Surat s, DateTime nowUtc)
    {
        var tahun = nowUtc.AddHours(7).Year;

        var pUrut = new Microsoft.Data.SqlClient.SqlParameter
        {
            ParameterName = "@urut",
            SqlDbType = System.Data.SqlDbType.Int,
            Direction = System.Data.ParameterDirection.Output,
        };
        await _db.Database.ExecuteSqlRawAsync(
            "EXEC office.sp_ambil_nomor_urut @tahun, @urut OUTPUT",
            new Microsoft.Data.SqlClient.SqlParameter("@tahun", tahun), pUrut);
        var urut = pUrut.Value is int n ? n : 0;

        var bagian = string.IsNullOrWhiteSpace(s.KodeBagian) ? "-" : s.KodeBagian;
        var klas = string.IsNullOrWhiteSpace(s.KodeKlasifikasi) ? "-" : s.KodeKlasifikasi;
        return $"{urut:D5}/{bagian}/{klas}/{s.Jenis}/{tahun}";
    }

    // Pencarian pegawai untuk memilih penanggung jawab / tujuan distribusi.
    public async Task<IReadOnlyList<OfficePegawaiDto>> CariPegawaiAsync(string q)
    {
        var term = (q ?? string.Empty).Trim();
        if (term.Length < 2)
        {
            return [];
        }
        var rows = await _gcs.PegawaiSdm
            .Where(p => p.data_aktif == "Aktif" && (p.nama!.Contains(term) || p.Nik.Contains(term)))
            .OrderBy(p => p.nama)
            .Take(20)
            .Select(p => new { p.Nik, p.nama, p.nm_jabatan, Unit = p.UNIT_KERJA ?? p.BAGIAN })
            .ToListAsync();

        var posisi = await _posisi.ResolveManyAsync(rows.Select(r => r.Nik).ToList());
        return rows.Select(r => new OfficePegawaiDto(
            r.Nik, r.nama ?? r.Nik,
            PosisiResolver.NamaJabatanTerbaik(posisi.GetValueOrDefault(r.Nik), r.nm_jabatan),
            r.Unit)).ToList();
    }

    public async Task<(bool Ok, string? Error, long Id)> CreateAsync(string nik, string? nama, CreateSuratRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Judul))
        {
            return (false, "Judul surat wajib diisi.", 0);
        }
        // Jenis wajib salah satu kode aktif di master SMP — tidak ada nilai cadangan diam-diam,
        // karena kode ikut merakit nomor surat dan salah kode berarti nomor yang salah.
        if (string.IsNullOrWhiteSpace(req.Jenis) || !await JenisAktif.AnyAsync(x => x.Kode == req.Jenis))
        {
            return (false, "Jenis surat tidak dikenali atau sudah tidak aktif.", 0);
        }
        var jenis = req.Jenis;
        var sifat = SifatValid.Contains(req.Sifat) ? req.Sifat : "Biasa";
        var cepat = CepatValid.Contains(req.Kecepatan) ? req.Kecepatan : "Biasa";

        // Kode bagian & klasifikasi wajib cocok master — nomor surat dirakit dari keduanya.
        string? kodeBagian = null;
        if (!string.IsNullOrWhiteSpace(req.KodeBagian))
        {
            if (!await _db.RefBagian.AnyAsync(b => b.Kode == req.KodeBagian && b.Aktif))
            {
                return (false, "Kode bagian tidak dikenali.", 0);
            }
            kodeBagian = req.KodeBagian;
        }
        else
        {
            // Kosong -> pakai tebakan dari data organisasi pembuat.
            kodeBagian = await TebakBagianAsync(nik);
        }

        string? kodeKlas = null;
        string? uraianKlas = null;
        if (!string.IsNullOrWhiteSpace(req.KodeKlasifikasi))
        {
            var k = await _db.RefKlasifikasi.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Kode == req.KodeKlasifikasi && x.Aktif);
            if (k is null)
            {
                return (false, "Kode klasifikasi tidak dikenali.", 0);
            }
            kodeKlas = k.Kode;
            uraianKlas = k.Masalah;
        }

        var pjs = (req.PenanggungJawab ?? []).Where(p => !string.IsNullOrWhiteSpace(p.Nik)).ToList();
        var dist = (req.Distribusi ?? []).Where(d => !string.IsNullOrWhiteSpace(d.Nik)).ToList();

        if (req.KirimKeReviewer)
        {
            if (!pjs.Any(p => p.Peran == "Reviewer"))
            {
                return (false, "Minimal satu Reviewer wajib dipilih sebelum dikirim.", 0);
            }
            if (!pjs.Any(p => p.Peran == "Approver"))
            {
                return (false, "Minimal satu Approver wajib dipilih sebelum dikirim.", 0);
            }
        }

        var now = DateTime.UtcNow;
        var surat = new Surat
        {
            Jenis = jenis,
            KodeBagian = kodeBagian,
            KodeKlasifikasi = kodeKlas,
            Klasifikasi = uraianKlas,
            Sifat = sifat,
            Kecepatan = cepat,
            Judul = req.Judul.Trim(),
            Keterangan = string.IsNullOrWhiteSpace(req.Keterangan) ? null : req.Keterangan.Trim(),
            Isi = string.IsNullOrWhiteSpace(req.Isi) ? null : req.Isi,
            Status = req.KirimKeReviewer ? "Menunggu Review" : "Draft",
            PembuatNik = nik,
            PembuatNama = nama,
            TanggalSurat = req.TanggalSurat,
            BerlakuMulai = req.BerlakuMulai,
            BerlakuSampai = req.BerlakuSampai,
            DibuatPada = now,
            DiperbaruiPada = now,
        };

        foreach (var p in pjs)
        {
            surat.PenanggungJawab.Add(new SuratPj
            {
                Peran = p.Peran is "Reviewer" or "Approver" or "Signer" ? p.Peran : "Reviewer",
                Urutan = p.Urutan,
                Nik = p.Nik,
                Nama = p.Nama,
                Jabatan = p.Jabatan,
                Status = "Menunggu",
            });
        }
        foreach (var d in dist)
        {
            surat.Distribusi.Add(new SuratDistribusi
            {
                Tipe = d.Tipe == "CC" ? "CC" : "Tujuan",
                Nik = d.Nik,
                Nama = d.Nama,
                Jabatan = d.Jabatan,
            });
        }
        surat.Riwayat.Add(new SuratRiwayat { Aksi = "Dibuat", OlehNik = nik, OlehNama = nama, Tgl = now });
        if (req.KirimKeReviewer)
        {
            surat.Riwayat.Add(new SuratRiwayat { Aksi = "Dikirim ke Review", OlehNik = nik, OlehNama = nama, Tgl = now });
        }

        _db.Surat.Add(surat);
        await _db.SaveChangesAsync();

        // Notifikasi menyusul setelah simpan pertama karena butuh Id surat yang
        // baru terisi identity. Draft belum memberitahu siapa pun.
        if (req.KirimKeReviewer)
        {
            await NotifTahapAsync(surat, "Reviewer", nik, nama, now);
            await _db.SaveChangesAsync();
        }
        return (true, null, surat.Id);
    }

    // Surat milik saya (pembuat). Filter status opsional.
    public async Task<IReadOnlyList<SuratListItemDto>> ListAsync(string nik, string? status)
    {
        var q = _db.Surat.AsNoTracking().Where(s => s.PembuatNik == nik);
        if (!string.IsNullOrWhiteSpace(status))
        {
            q = q.Where(s => s.Status == status);
        }
        // Nama jenis ada di database lain (DBSMP), jadi tidak bisa ikut di-JOIN dalam kueri
        // ini — dipetakan di memori dari master yang ukurannya kecil.
        var nama = await PetaNamaJenisAsync();
        var rows = await q
            .OrderByDescending(s => s.Id)
            .Select(s => new
            {
                s.Id, s.Nomor, s.Jenis, s.Sifat, s.Kecepatan, s.Judul, s.Status, s.TanggalSurat, s.DibuatPada,
            })
            .ToListAsync();
        return rows.Select(s => new SuratListItemDto(
            s.Id, s.Nomor, s.Jenis, nama.GetValueOrDefault(s.Jenis),
            s.Sifat, s.Kecepatan, s.Judul, s.Status, s.TanggalSurat, s.DibuatPada)).ToList();
    }

    public async Task<SuratDetailDto?> DetailAsync(long id, string nik)
    {
        var s = await _db.Surat.AsNoTracking()
            .Include(x => x.PenanggungJawab)
            .Include(x => x.Distribusi)
            .Include(x => x.Lampiran)
            .Include(x => x.Riwayat)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (s is null)
        {
            return null;
        }
        // Boleh melihat: pembuat, penanggung jawab, atau tujuan/CC.
        var boleh = s.PembuatNik == nik
            || s.PenanggungJawab.Any(p => p.Nik == nik)
            || s.Distribusi.Any(d => d.Nik == nik);
        if (!boleh)
        {
            return null;
        }

        // Giliran user ini bertindak? (reviewer saat Menunggu Review, approver saat Menunggu Approval).
        string? aksiPeran = null;
        if (s.Status == "Menunggu Review" && s.PenanggungJawab.Any(p => p.Peran == "Reviewer" && p.Nik == nik && p.Status == "Menunggu"))
        {
            aksiPeran = "Reviewer";
        }
        else if (s.Status == "Menunggu Approval" && s.PenanggungJawab.Any(p => p.Peran == "Approver" && p.Nik == nik && p.Status == "Menunggu"))
        {
            aksiPeran = "Approver";
        }

        // Nama panjang kode surat, agar halaman detail tidak menampilkan kode telanjang.
        var jenisNama = await _db.RefJenisSurat.AsNoTracking()
            .Where(j => j.Kode == s.Jenis).Select(j => j.Nama).FirstOrDefaultAsync();
        var bagianNama = s.KodeBagian is null ? null : await _db.RefBagian.AsNoTracking()
            .Where(b => b.Kode == s.KodeBagian).Select(b => b.Nama).FirstOrDefaultAsync();

        // Tindak lanjut hanya untuk penerima surat yang sudah final — bukan pembuat
        // atau penanggung jawab, yang punya jalur aksinya sendiri.
        var bolehTindakLanjut = s.Status == "Disetujui" && s.Distribusi.Any(d => d.Nik == nik);

        return new SuratDetailDto(
            s.Id, s.Nomor, s.Jenis, jenisNama,
            s.KodeBagian, bagianNama,
            s.KodeKlasifikasi, s.Klasifikasi, s.Sifat, s.Kecepatan,
            s.Judul, s.Keterangan, s.Isi, s.Status, s.PembuatNik, s.PembuatNama,
            s.TanggalSurat, s.BerlakuMulai, s.BerlakuSampai, s.DibuatPada,
            IsPembuat: s.PembuatNik == nik,
            AksiPeran: aksiPeran,
            BolehTindakLanjut: bolehTindakLanjut,
            PenanggungJawab: s.PenanggungJawab.OrderBy(p => p.Peran).ThenBy(p => p.Urutan)
                .Select(p => new SuratPjDto(p.Id, p.Peran, p.Urutan, p.Nik, p.Nama, p.Jabatan, p.Status, p.Komentar, p.Tgl)).ToList(),
            Distribusi: s.Distribusi.Select(d => new SuratDistribusiDto(d.Id, d.Tipe, d.Nik, d.Nama, d.Jabatan)).ToList(),
            Lampiran: s.Lampiran.Select(l => new SuratLampiranDto(l.Id, l.NamaFile, l.Ukuran, l.Tipe)).ToList(),
            Riwayat: s.Riwayat.OrderByDescending(r => r.Id).Select(r => new SuratRiwayatDto(r.Id, r.Aksi, r.OlehNama, r.Catatan, r.Tgl)).ToList());
    }

    // Surat yang menunggu tindakan saya. peran = "Reviewer" (stage Menunggu Review) atau
    // "Approver" (stage Menunggu Approval).
    public async Task<IReadOnlyList<SuratListItemDto>> ListTugasAsync(string nik, string peran)
    {
        var stage = peran == "Approver" ? "Menunggu Approval" : "Menunggu Review";
        var target = peran == "Approver" ? "Approver" : "Reviewer";
        var nama = await PetaNamaJenisAsync();
        var rows = await _db.Surat.AsNoTracking()
            .Where(s => s.Status == stage
                && s.PenanggungJawab.Any(p => p.Peran == target && p.Nik == nik && p.Status == "Menunggu"))
            .OrderByDescending(s => s.Id)
            .Select(s => new
            {
                s.Id, s.Nomor, s.Jenis, s.Sifat, s.Kecepatan, s.Judul, s.Status, s.TanggalSurat, s.DibuatPada,
            })
            .ToListAsync();
        return rows.Select(s => new SuratListItemDto(
            s.Id, s.Nomor, s.Jenis, nama.GetValueOrDefault(s.Jenis),
            s.Sifat, s.Kecepatan, s.Judul, s.Status, s.TanggalSurat, s.DibuatPada)).ToList();
    }

    // Aksi reviewer/approver: Setujui | Tolak | Revisi. Menggerakkan status surat bila
    // seluruh penanggung jawab pada tahap itu telah menyetujui.
    public async Task<(bool Ok, string? Error)> ActPengesahanAsync(long id, string nik, string? nama, string aksi, string? komentar)
    {
        if (aksi is not ("Setujui" or "Tolak" or "Revisi"))
        {
            return (false, "Aksi tidak dikenal.");
        }

        // Distribusi ikut dimuat: bila aksi ini membuat surat terbit, tujuan & tembusannya
        // langsung diberi notifikasi dalam transaksi yang sama.
        var s = await _db.Surat
            .Include(x => x.PenanggungJawab)
            .Include(x => x.Distribusi)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (s is null)
        {
            return (false, "Surat tidak ditemukan.");
        }

        // Tentukan tahap berjalan dari status surat.
        string peranTahap;
        if (s.Status == "Menunggu Review") peranTahap = "Reviewer";
        else if (s.Status == "Menunggu Approval") peranTahap = "Approver";
        else return (false, "Surat tidak sedang menunggu tindakan Anda.");

        var baris = s.PenanggungJawab.FirstOrDefault(p => p.Peran == peranTahap && p.Nik == nik && p.Status == "Menunggu");
        if (baris is null)
        {
            return (false, "Bukan giliran Anda atau Anda sudah menindak surat ini.");
        }

        var now = DateTime.UtcNow;
        baris.Komentar = string.IsNullOrWhiteSpace(komentar) ? null : komentar.Trim();
        baris.Tgl = now;
        s.DiperbaruiPada = now;

        string riwayatAksi;
        if (aksi == "Tolak")
        {
            baris.Status = "Ditolak";
            s.Status = "Ditolak";
            riwayatAksi = $"Ditolak oleh {peranTahap}";
            AntreNotifikasi([s.PembuatNik], "Surat anda ditolak", s.Id, nik, nama, await JabatanAsync(nik), now);
        }
        else if (aksi == "Revisi")
        {
            baris.Status = "Revisi";
            s.Status = "Revisi";
            riwayatAksi = $"Diminta revisi oleh {peranTahap}";
            AntreNotifikasi([s.PembuatNik], "Surat anda diminta revisi", s.Id, nik, nama, await JabatanAsync(nik), now);
        }
        else // Setujui
        {
            baris.Status = "Disetujui";
            var semuaTahap = s.PenanggungJawab.Where(p => p.Peran == peranTahap).ToList();
            if (semuaTahap.All(p => p.Status == "Disetujui"))
            {
                if (peranTahap == "Reviewer")
                {
                    // Seluruh reviewer setuju -> lanjut ke approver (atau langsung disetujui bila tak ada approver).
                    s.Status = s.PenanggungJawab.Any(p => p.Peran == "Approver") ? "Menunggu Approval" : "Disetujui";
                }
                else
                {
                    s.Status = "Disetujui";
                }
                riwayatAksi = $"Disetujui seluruh {peranTahap}";

                // Estafet berpindah: beri tahu pemegang tongkat berikutnya.
                if (s.Status == "Menunggu Approval")
                {
                    await NotifTahapAsync(s, "Approver", nik, nama, now);
                }
            }
            else
            {
                riwayatAksi = $"Disetujui oleh {peranTahap}";
            }
        }

        // Surat terbit -> seluruh tujuan & tembusan diberi tahu.
        if (s.Status == "Disetujui")
        {
            await NotifSuratTerbitAsync(s, now);
        }

        // Penomoran otomatis saat surat final disetujui — nomor urut baru hanya
        // terpakai bila surat benar-benar terbit, sehingga deret tidak berlubang
        // karena draf atau surat yang ditolak.
        if (s.Status == "Disetujui" && string.IsNullOrWhiteSpace(s.Nomor))
        {
            s.Nomor = await BuatNomorAsync(s, now);
        }

        _db.SuratRiwayat.Add(new SuratRiwayat { IdSurat = s.Id, Aksi = riwayatAksi, OlehNik = nik, OlehNama = nama, Catatan = baris.Komentar, Tgl = now });
        await _db.SaveChangesAsync();
        return (true, null);
    }

    // ---- Notifikasi ----
    // Pemberitahuan dibuat di titik-titik alur surat lalu masuk ke menu Notifikasi.
    // Semua helper di bawah hanya menumpuk entitas ke change tracker; pemanggilnya
    // yang menyimpan, supaya notifikasi ikut satu transaksi dengan perubahan surat
    // dan tidak pernah terkirim untuk perubahan yang gagal disimpan.

    public const string FilterSemua = "all";
    public const string FilterDibaca = "read";
    public const string FilterBelumDibaca = "unread";

    public static string NormalisasiFilterNotif(string? filter) => filter switch
    {
        FilterDibaca => FilterDibaca,
        FilterBelumDibaca => FilterBelumDibaca,
        _ => FilterSemua,
    };

    // Jabatan pemicu tidak tersimpan di office.surat, jadi diambil dari data SDM
    // saat notifikasi dibuat lalu dibekukan — arsipnya tetap terbaca meski yang
    // bersangkutan pindah jabatan.
    private async Task<string?> JabatanAsync(string? nik)
    {
        if (string.IsNullOrWhiteSpace(nik))
        {
            return null;
        }
        var posisi = await _posisi.ResolveAsync(nik);
        var legacy = await _gcs.PegawaiSdm.AsNoTracking()
            .Where(p => p.Nik == nik).Select(p => p.nm_jabatan).FirstOrDefaultAsync();
        return PosisiResolver.NamaJabatanTerbaik(posisi, legacy);
    }

    private void AntreNotifikasi(
        IEnumerable<string> penerima, string judul, long idSurat,
        string? olehNik, string? olehNama, string? olehJabatan, DateTime now)
    {
        // Pemicu tidak perlu diberi tahu atas aksinya sendiri; duplikat penerima dibuang.
        foreach (var target in penerima
            .Where(n => !string.IsNullOrWhiteSpace(n) && n != olehNik)
            .Distinct())
        {
            _db.Notifikasi.Add(new Notifikasi
            {
                Nik = target,
                Judul = judul,
                IdSurat = idSurat,
                OlehNik = olehNik,
                OlehNama = olehNama,
                OlehJabatan = olehJabatan,
                DibuatPada = now,
            });
        }
    }

    // Notifikasi untuk penanggung jawab tahap yang sedang berjalan.
    private async Task NotifTahapAsync(Surat s, string peran, string? olehNik, string? olehNama, DateTime now)
    {
        var target = s.PenanggungJawab
            .Where(p => p.Peran == peran && p.Status == "Menunggu")
            .Select(p => p.Nik).ToList();
        if (target.Count == 0)
        {
            return;
        }
        var judul = peran == "Approver" ? "Ada surat menunggu approval anda" : "Ada surat menunggu review anda";
        AntreNotifikasi(target, judul, s.Id, olehNik, olehNama, await JabatanAsync(olehNik), now);
    }

    // Notifikasi ke seluruh tujuan & tembusan saat surat terbit.
    private async Task NotifSuratTerbitAsync(Surat s, DateTime now)
    {
        var target = s.Distribusi.Select(d => d.Nik).ToList();
        if (target.Count == 0)
        {
            return;
        }
        AntreNotifikasi(target, "Ada surat baru untuk anda", s.Id,
            s.PembuatNik, s.PembuatNama, await JabatanAsync(s.PembuatNik), now);
    }

    public async Task<NotifikasiResponseDto> NotifikasiAsync(string nik, string? filter)
    {
        var f = NormalisasiFilterNotif(filter);
        var milikSaya = _db.Notifikasi.AsNoTracking().Where(n => n.Nik == nik);

        var semua = await milikSaya.CountAsync();
        var dibaca = await milikSaya.CountAsync(n => n.DibacaPada != null);
        var counts = new NotifikasiCountsDto(semua, dibaca, semua - dibaca);

        var q = f switch
        {
            FilterDibaca => milikSaya.Where(n => n.DibacaPada != null),
            FilterBelumDibaca => milikSaya.Where(n => n.DibacaPada == null),
            _ => milikSaya,
        };
        var items = await q
            .OrderByDescending(n => n.DibuatPada).ThenByDescending(n => n.Id)
            .Select(n => new NotifikasiItemDto(
                n.Id, n.Judul, n.IdSurat, n.OlehNik, n.OlehNama, n.OlehJabatan,
                n.DibuatPada, n.DibacaPada != null))
            .ToListAsync();

        return new NotifikasiResponseDto(f, counts, items);
    }

    // Tandai satu notifikasi terbaca. Dipanggil saat notifikasinya dibuka.
    public async Task<bool> TandaiNotifikasiAsync(long id, string nik)
    {
        var n = await _db.Notifikasi.FirstOrDefaultAsync(x => x.Id == id && x.Nik == nik);
        if (n is null)
        {
            return false;
        }
        if (n.DibacaPada is null)
        {
            n.DibacaPada = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }
        return true;
    }

    // Tombol "Tandai Sudah Dibaca" — mengosongkan seluruh sisa yang belum dibaca.
    public async Task<int> TandaiSemuaNotifikasiAsync(string nik)
    {
        var now = DateTime.UtcNow;
        return await _db.Notifikasi
            .Where(n => n.Nik == nik && n.DibacaPada == null)
            .ExecuteUpdateAsync(u => u.SetProperty(n => n.DibacaPada, now));
    }

    // Angka badge sidebar: surat masuk yang belum dibuka + notifikasi belum dibaca.
    public async Task<OfficeBadgeDto> BadgeAsync(string nik)
    {
        var inbox = await _db.Surat.AsNoTracking()
            .CountAsync(s => s.Status == "Disetujui"
                && s.Distribusi.Any(d => d.Nik == nik)
                && !_db.SuratDibaca.Any(x => x.IdSurat == s.Id && x.Nik == nik));
        var notif = await _db.Notifikasi.AsNoTracking().CountAsync(n => n.Nik == nik && n.DibacaPada == null);
        return new OfficeBadgeDto(inbox, notif);
    }

    // ---- Kotak masuk ----
    // Menu Inbox meniru DOF: satu daftar surat yang melibatkan saya, dipilah ke lima tab.
    // "Belum Dibaca"/"Dibaca" memotret surat FINAL yang ditujukan/ditembuskan ke saya
    // (sumbu status baca), sedangkan "Dalam Proses"/"Selesai"/"Dibatalkan" memotret posisi
    // surat pada alurnya (sumbu status surat) — persis seperti DOF, kedua sumbu itu memang
    // beririsan: satu surat Disetujui muncul di "Selesai" sekaligus di salah satu tab baca.
    public const string TabBelumDibaca = "belum-dibaca";
    public const string TabDibaca = "dibaca";
    public const string TabDalamProses = "dalam-proses";
    public const string TabSelesai = "selesai";
    public const string TabDibatalkan = "dibatalkan";

    private static readonly string[] StatusProses = ["Menunggu Review", "Diverifikasi", "Menunggu Approval", "Revisi"];
    private static readonly string[] StatusBatal = ["Batal", "Ditolak"];

    public static string NormalisasiTab(string? tab) => tab switch
    {
        TabDibaca => TabDibaca,
        TabDalamProses => TabDalamProses,
        TabSelesai => TabSelesai,
        TabDibatalkan => TabDibatalkan,
        _ => TabBelumDibaca,
    };

    // hanyaCc = menu "Inbox CC Otomatis": batasi ke surat yang saya terima sebagai TEMBUSAN
    // (surat_distribusi.tipe = 'CC') saja. Keterlibatan sebagai tujuan langsung maupun
    // penanggung jawab sengaja tidak ikut, supaya menu ini benar-benar hanya berisi tembusan.
    public async Task<InboxResponseDto> InboxAsync(string nik, string? tab, bool hanyaCc = false)
    {
        var t = NormalisasiTab(tab);

        // Surat yang menyangkut saya: sebagai tujuan/CC, atau sebagai penanggung jawab.
        // Surat yang saya buat sendiri tidak masuk sini — itu ranah menu Daftar Surat.
        var terkait = hanyaCc
            ? _db.Surat.AsNoTracking()
                .Where(s => s.Distribusi.Any(d => d.Nik == nik && d.Tipe == "CC"))
            : _db.Surat.AsNoTracking()
                .Where(s => s.Distribusi.Any(d => d.Nik == nik) || s.PenanggungJawab.Any(p => p.Nik == nik));
        // Surat masuk sesungguhnya: sudah final DAN saya penerimanya.
        var masuk = hanyaCc
            ? terkait.Where(s => s.Status == "Disetujui")
            : terkait.Where(s => s.Status == "Disetujui" && s.Distribusi.Any(d => d.Nik == nik));

        var counts = new InboxCountsDto(
            BelumDibaca: await masuk.CountAsync(s => !_db.SuratDibaca.Any(x => x.IdSurat == s.Id && x.Nik == nik)),
            Dibaca: await masuk.CountAsync(s => _db.SuratDibaca.Any(x => x.IdSurat == s.Id && x.Nik == nik)),
            DalamProses: await terkait.CountAsync(s => StatusProses.Contains(s.Status)),
            Selesai: await terkait.CountAsync(s => s.Status == "Disetujui"),
            Dibatalkan: await terkait.CountAsync(s => StatusBatal.Contains(s.Status)));

        var q = t switch
        {
            TabBelumDibaca => masuk.Where(s => !_db.SuratDibaca.Any(x => x.IdSurat == s.Id && x.Nik == nik)),
            TabDibaca => masuk.Where(s => _db.SuratDibaca.Any(x => x.IdSurat == s.Id && x.Nik == nik)),
            TabDalamProses => terkait.Where(s => StatusProses.Contains(s.Status)),
            TabSelesai => terkait.Where(s => s.Status == "Disetujui"),
            _ => terkait.Where(s => StatusBatal.Contains(s.Status)),
        };

        var rows = await q
            .OrderByDescending(s => s.Id)
            .Select(s => new
            {
                s.Id,
                s.Nomor,
                s.Jenis,
                s.Judul,
                s.Status,
                s.TanggalSurat,
                s.DibuatPada,
                s.PembuatNama,
                // Approver terakhir (urutan tertinggi) — kolom "Approver" pada tabel DOF.
                Approver = s.PenanggungJawab.Where(p => p.Peran == "Approver")
                    .OrderByDescending(p => p.Urutan).Select(p => p.Nama).FirstOrDefault(),
                // Bila surat tanpa approver, kolom itu diisi reviewer terakhir.
                Reviewer = s.PenanggungJawab.Where(p => p.Peran == "Reviewer")
                    .OrderByDescending(p => p.Urutan).Select(p => p.Nama).FirstOrDefault(),
                // Urut menurun agar "Tujuan" menang atas "CC" bila saya tercatat sebagai keduanya.
                TipeDistribusi = s.Distribusi.Where(d => d.Nik == nik)
                    .OrderByDescending(d => d.Tipe).Select(d => d.Tipe).FirstOrDefault(),
                PeranPj = s.PenanggungJawab.Where(p => p.Nik == nik)
                    .OrderBy(p => p.Peran).Select(p => p.Peran).FirstOrDefault(),
                Dibaca = _db.SuratDibaca.Any(x => x.IdSurat == s.Id && x.Nik == nik),
            })
            .ToListAsync();

        // Master jenis kecil — diambil sekali lalu dipetakan di memori (beda database).
        var namaJenis = await PetaNamaJenisAsync();

        var items = rows.Select(r =>
        {
            // Di menu CC Otomatis seluruh baris memang tembusan; kalau saya kebetulan juga
            // tercatat sebagai tujuan langsung, jangan sampai barisnya berubah jadi "Tujuan".
            var peran = hanyaCc ? "CC" : (r.TipeDistribusi ?? r.PeranPj ?? "Tujuan");
            var pengirim = string.IsNullOrWhiteSpace(r.PembuatNama) ? "-" : r.PembuatNama;
            var keterangan = peran switch
            {
                "CC" => $"CC dari : {pengirim}",
                "Reviewer" => r.Status == "Menunggu Review" ? "Menunggu review Anda" : "Anda sebagai reviewer",
                "Approver" => r.Status == "Menunggu Approval" ? "Menunggu approval Anda" : "Anda sebagai approver",
                _ => $"Surat dari : {pengirim}",
            };
            return new InboxItemDto(
                r.Id, r.Nomor, r.Jenis, namaJenis.GetValueOrDefault(r.Jenis),
                r.Judul, r.Status, r.TanggalSurat, r.DibuatPada,
                r.PembuatNama, r.Approver ?? r.Reviewer, peran, keterangan, r.Dibaca);
        }).ToList();

        return new InboxResponseDto(t, counts, items);
    }

    // ---- Tindak lanjut (disposisi) ----

    public async Task<IReadOnlyList<SuratTindakLanjutDto>> TindakLanjutAsync(long id, string nik)
    {
        if (!await BolehLihatAsync(id, nik))
        {
            return [];
        }
        return await _db.SuratTindakLanjut.AsNoTracking()
            .Where(t => t.IdSurat == id)
            .OrderByDescending(t => t.Tgl).ThenByDescending(t => t.Id)
            .Select(t => new SuratTindakLanjutDto(
                t.Id, t.Tgl, t.Keterangan, t.DariNama ?? t.DariNik, t.UntukNama ?? t.UntukNik,
                t.Catatan, t.NamaLampiran, t.Ukuran))
            .ToListAsync();
    }

    private static readonly string[] KeteranganTlValid = ["Diteruskan", "Disposisi", "Tanggapan", "Selesai"];

    // Catat tindak lanjut. Penerima yang meneruskan surat otomatis menambah tujuan
    // distribusi baru, supaya surat itu muncul di kotak masuk orang yang dituju.
    public async Task<(bool Ok, string? Error, long Id)> TambahTindakLanjutAsync(
        long id, string nik, string? nama, SuratTindakLanjutRequest req)
    {
        var s = await _db.Surat.AsNoTracking()
            .Include(x => x.Distribusi)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (s is null)
        {
            return (false, "Surat tidak ditemukan.", 0);
        }
        if (s.Status != "Disetujui")
        {
            return (false, "Tindak lanjut hanya untuk surat yang sudah disetujui.", 0);
        }
        if (!s.Distribusi.Any(d => d.Nik == nik))
        {
            return (false, "Hanya penerima surat yang dapat menindaklanjuti.", 0);
        }
        var ket = KeteranganTlValid.Contains(req.Keterangan) ? req.Keterangan : "Diteruskan";
        if (ket is "Diteruskan" or "Disposisi" && string.IsNullOrWhiteSpace(req.UntukNik))
        {
            return (false, "Pilih pegawai tujuan tindak lanjut.", 0);
        }

        var now = DateTime.UtcNow;
        var tl = new SuratTindakLanjut
        {
            IdSurat = id,
            Keterangan = ket,
            DariNik = nik,
            DariNama = nama,
            UntukNik = string.IsNullOrWhiteSpace(req.UntukNik) ? null : req.UntukNik,
            UntukNama = string.IsNullOrWhiteSpace(req.UntukNama) ? null : req.UntukNama,
            Catatan = string.IsNullOrWhiteSpace(req.Catatan) ? null : req.Catatan.Trim(),
            Tgl = now,
        };
        _db.SuratTindakLanjut.Add(tl);

        // Yang dituju perlu bisa membuka suratnya — daftarkan sebagai tujuan bila belum ada.
        if (tl.UntukNik is not null && !s.Distribusi.Any(d => d.Nik == tl.UntukNik))
        {
            _db.SuratDistribusi.Add(new SuratDistribusi
            {
                IdSurat = id, Tipe = "Tujuan", Nik = tl.UntukNik, Nama = tl.UntukNama,
            });
        }

        var tujuanTeks = tl.UntukNama ?? tl.UntukNik;
        _db.SuratRiwayat.Add(new SuratRiwayat
        {
            IdSurat = id,
            Aksi = tujuanTeks is null ? ket : $"{ket} ke {tujuanTeks}",
            OlehNik = nik, OlehNama = nama, Catatan = tl.Catatan, Tgl = now,
        });

        if (tl.UntukNik is not null)
        {
            AntreNotifikasi([tl.UntukNik], $"Ada surat {ket.ToLowerInvariant()} untuk anda", id,
                nik, nama, await JabatanAsync(nik), now);
        }

        await _db.SaveChangesAsync();
        return (true, null, tl.Id);
    }

    // ---- Hirarki alur surat ----

    // Rantai persetujuan (drafter -> reviewer berjenjang -> approver berjenjang) diikuti
    // daftar penerima, seperti diagram Hirarki di DOF.
    public async Task<HirarkiDto?> HirarkiAsync(long id, string nik)
    {
        var s = await _db.Surat.AsNoTracking()
            .Include(x => x.PenanggungJawab)
            .Include(x => x.Distribusi)
            .Include(x => x.Riwayat)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (s is null || !BolehLihat(s, nik))
        {
            return null;
        }

        var nodes = new List<HirarkiNodeDto>
        {
            new("Drafter", 0, s.PembuatNik, s.PembuatNama, null, "Dibuat", s.DibuatPada),
        };
        foreach (var peran in new[] { "Reviewer", "Approver", "Signer" })
        {
            var urut = 0;
            foreach (var p in s.PenanggungJawab.Where(p => p.Peran == peran).OrderBy(p => p.Urutan).ThenBy(p => p.Id))
            {
                nodes.Add(new HirarkiNodeDto(peran, ++urut, p.Nik, p.Nama, p.Jabatan, p.Status, p.Tgl));
            }
        }
        foreach (var d in s.Distribusi.OrderBy(d => d.Tipe == "CC" ? 1 : 0).ThenBy(d => d.Id))
        {
            nodes.Add(new HirarkiNodeDto(d.Tipe, 0, d.Nik, d.Nama, d.Jabatan, s.Status, null));
        }
        return new HirarkiDto(nodes);
    }

    // Tandai surat sudah dibaca oleh penerimanya. Dipanggil saat detail surat dibuka; hanya
    // berlaku bagi tujuan/CC (pembuat & penanggung jawab tidak punya status baca).
    public async Task TandaiDibacaAsync(long id, string nik)
    {
        var penerima = await _db.SuratDistribusi.AsNoTracking().AnyAsync(d => d.IdSurat == id && d.Nik == nik);
        if (!penerima)
        {
            return;
        }
        var sudah = await _db.SuratDibaca.AsNoTracking().AnyAsync(x => x.IdSurat == id && x.Nik == nik);
        if (sudah)
        {
            return;
        }
        _db.SuratDibaca.Add(new SuratDibaca { IdSurat = id, Nik = nik, DibacaPada = DateTime.UtcNow });
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Balapan dua tab/perangkat menabrak primary key — status bacanya toh sudah tercatat.
        }
    }

    // ---- Dashboard ----

    // Statistik dashboard My Office. Semua angka diturunkan dari data nyata di skema office;
    // tidak ada nilai tetap. Tahun disaring memakai batas WIB (UTC+7) atas DibuatPada yang
    // tersimpan dalam UTC, sehingga surat yang dibuat 31 Des malam WIB tidak lompat tahun.
    public async Task<OfficeDashboardDto> DashboardAsync(string nik, int? tahun)
    {
        var nowWib = DateTime.UtcNow.AddHours(7);

        var tahunTersedia = await _db.Surat.AsNoTracking()
            .Where(s => s.PembuatNik == nik)
            .Select(s => s.DibuatPada.AddHours(7).Year)
            .Distinct()
            .ToListAsync();
        if (!tahunTersedia.Contains(nowWib.Year))
        {
            tahunTersedia.Add(nowWib.Year);
        }
        tahunTersedia.Sort((a, b) => b.CompareTo(a));

        // Tahun yang diminta harus punya data (atau tahun berjalan); selain itu pakai yang terbaru.
        var thn = tahun is int t && tahunTersedia.Contains(t) ? t : tahunTersedia[0];
        var mulai = new DateTime(thn, 1, 1, 0, 0, 0, DateTimeKind.Unspecified).AddHours(-7);
        var selesai = new DateTime(thn + 1, 1, 1, 0, 0, 0, DateTimeKind.Unspecified).AddHours(-7);

        // Satu proyeksi ringkas untuk seluruh kartu tahun terpilih - surat per pegawai
        // jumlahnya kecil, jadi rata-rata durasi dihitung di memori agar mudah dibaca.
        var rows = await _db.Surat.AsNoTracking()
            .Where(s => s.PembuatNik == nik && s.DibuatPada >= mulai && s.DibuatPada < selesai)
            .Select(s => new
            {
                s.Jenis,
                s.Status,
                s.DibuatPada,
                s.DiperbaruiPada,
                AdaLampiran = s.Lampiran.Any(),
                // Pengiriman terakhir ke review (surat yang direvisi bisa dikirim ulang).
                DikirimReview = s.Riwayat.Where(r => r.Aksi == "Dikirim ke Review").Max(r => (DateTime?)r.Tgl),
                ReviewSelesai = s.PenanggungJawab.Where(p => p.Peran == "Reviewer" && p.Tgl != null).Max(p => p.Tgl),
                ApproveSelesai = s.PenanggungJawab.Where(p => p.Peran == "Approver" && p.Tgl != null).Max(p => p.Tgl),
            })
            .ToListAsync();

        // Rata-rata durasi: hanya surat yang benar-benar punya kedua ujung waktunya.
        var durPenyetujuan = rows
            .Where(r => r.Status == "Disetujui" && r.DiperbaruiPada > r.DibuatPada)
            .Select(r => (r.DiperbaruiPada - r.DibuatPada).TotalMinutes).ToList();
        var durReview = rows
            .Where(r => r.DikirimReview != null && r.ReviewSelesai != null && r.ReviewSelesai > r.DikirimReview)
            .Select(r => (r.ReviewSelesai!.Value - r.DikirimReview!.Value).TotalMinutes).ToList();
        // Tahap approval dimulai saat reviewer terakhir menyetujui (status -> Menunggu Approval).
        var durApprove = rows
            .Where(r => r.ReviewSelesai != null && r.ApproveSelesai != null && r.ApproveSelesai > r.ReviewSelesai)
            .Select(r => (r.ApproveSelesai!.Value - r.ReviewSelesai!.Value).TotalMinutes).ToList();

        static int RataMenit(List<double> v) => v.Count == 0 ? 0 : (int)Math.Round(v.Average());

        // "Belum upload" = sudah final (Disetujui) tetapi berkas tanda tangan belum dilampirkan.
        var belum = rows.Where(r => r.Status == "Disetujui" && !r.AdaLampiran).ToList();

        // Kartu SP berakhir memakai catatan "*" DOF: seluruh tahun, bukan tahun terpilih.
        var hariIni = DateOnly.FromDateTime(nowWib);
        var batas3Bulan = hariIni.AddMonths(3);
        var spBerakhir = await _db.Surat.AsNoTracking()
            .Where(s => s.PembuatNik == nik
                && JenisSp.Contains(s.Jenis)
                && s.Status != "Batal"
                && s.BerlakuSampai != null
                && s.BerlakuSampai >= hariIni
                && s.BerlakuSampai <= batas3Bulan)
            .Select(s => new { AdaLampiran = s.Lampiran.Any() })
            .ToListAsync();

        // Bawahan langsung dari vw_web_sdm_approval (baris urut terkecil = atasan langsung).
        var nikSubordinat = await _gcs.SdmApproval.AsNoTracking()
            .Where(a => a.KodeAtasan == nik && a.KodePegawai != nik)
            .Select(a => a.KodePegawai)
            .Distinct()
            .ToListAsync();
        var totalSubordinat = nikSubordinat.Count == 0 ? 0 : await _db.Surat.AsNoTracking()
            .CountAsync(s => nikSubordinat.Contains(s.PembuatNik)
                && s.DibuatPada >= mulai && s.DibuatPada < selesai);

        // Antrean tindakan saya bersifat "saat ini" - tidak disaring tahun.
        var menungguReview = await _db.Surat.AsNoTracking()
            .CountAsync(s => s.Status == "Menunggu Review"
                && s.PenanggungJawab.Any(p => p.Peran == "Reviewer" && p.Nik == nik && p.Status == "Menunggu"));
        var menungguApprove = await _db.Surat.AsNoTracking()
            .CountAsync(s => s.Status == "Menunggu Approval"
                && s.PenanggungJawab.Any(p => p.Peran == "Approver" && p.Nik == nik && p.Status == "Menunggu"));

        return new OfficeDashboardDto(
            Tahun: thn,
            TahunTersedia: tahunTersedia,
            MenitPenyetujuan: RataMenit(durPenyetujuan),
            MenitReview: RataMenit(durReview),
            MenitApprove: RataMenit(durApprove),
            SampelPenyetujuan: durPenyetujuan.Count,
            SampelReview: durReview.Count,
            SampelApprove: durApprove.Count,
            BelumUpload: belum.Count,
            BelumUploadNonSp: belum.Count(r => !JenisSp.Contains(r.Jenis)),
            BelumUploadSp: belum.Count(r => JenisSp.Contains(r.Jenis)),
            SpBerakhir: spBerakhir.Count,
            SpBerakhirSudahUpload: spBerakhir.Count(r => r.AdaLampiran),
            SpBerakhirBelumUpload: spBerakhir.Count(r => !r.AdaLampiran),
            TotalSurat: rows.Count,
            TotalSuratSubordinat: totalSubordinat,
            MenungguApprove: menungguApprove,
            SuratSirkuler: rows.Count(r => r.Jenis == "Sirkuler"),
            MenungguReview: menungguReview);
    }

    // ---- Lampiran ----

    private async Task<bool> BolehLihatAsync(long id, string nik)
    {
        var s = await _db.Surat.AsNoTracking()
            .Include(x => x.PenanggungJawab)
            .Include(x => x.Distribusi)
            .FirstOrDefaultAsync(x => x.Id == id);
        return s is not null && BolehLihat(s, nik);
    }

    // Jejak akses dokumen di tab Riwayat, seperti DOF ("Melihat dokumen" /
    // "Mengunduh dokumen"). Melihat dicatat maksimal SEKALI PER HARI (WIB) per
    // pegawai — halaman detail dimuat ulang tiap aksi, dan mencatat tiap pemuatan
    // hanya akan menenggelamkan jejak yang benar-benar berarti. Unduhan selalu dicatat.
    public async Task CatatAksesAsync(long id, string nik, string? nama, string aksi)
    {
        if (aksi == "Melihat dokumen")
        {
            var awalHariUtc = DateTime.UtcNow.AddHours(7).Date.AddHours(-7);
            var sudah = await _db.SuratRiwayat.AsNoTracking().AnyAsync(
                r => r.IdSurat == id && r.OlehNik == nik && r.Aksi == aksi && r.Tgl >= awalHariUtc);
            if (sudah)
            {
                return;
            }
        }
        _db.SuratRiwayat.Add(new SuratRiwayat
        {
            IdSurat = id, Aksi = aksi, OlehNik = nik, OlehNama = nama, Tgl = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();
    }

    private static bool BolehLihat(Surat s, string nik) =>
        s.PembuatNik == nik || s.PenanggungJawab.Any(p => p.Nik == nik) || s.Distribusi.Any(d => d.Nik == nik);

    // Cek apakah pembuat boleh mengubah lampiran (hanya saat Draft/Revisi).
    public async Task<(bool Ok, string? Error)> BolehEditLampiranAsync(long id, string nik)
    {
        var s = await _db.Surat.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (s is null) return (false, "Surat tidak ditemukan.");
        if (s.PembuatNik != nik) return (false, "Hanya pembuat surat yang bisa mengubah lampiran.");
        if (s.Status is not ("Draft" or "Revisi")) return (false, "Lampiran hanya bisa diubah saat surat Draft/Revisi.");
        return (true, null);
    }

    public async Task<(bool Ok, string? Error, SuratLampiranDto? Dto)> TambahLampiranAsync(
        long id, string nik, string namaFile, string path, long ukuran, string? tipe)
    {
        var (ok, error) = await BolehEditLampiranAsync(id, nik);
        if (!ok) return (false, error, null);

        var l = new SuratLampiran
        {
            IdSurat = id, NamaFile = namaFile, Path = path, Ukuran = ukuran, Tipe = tipe,
            DibuatPada = DateTime.UtcNow,
        };
        _db.SuratLampiran.Add(l);
        await _db.SaveChangesAsync();
        return (true, null, new SuratLampiranDto(l.Id, l.NamaFile, l.Ukuran, l.Tipe));
    }

    // Ambil info lampiran untuk diunduh (akses: pembuat/PJ/distribusi). Return path relatif + nama + tipe.
    public async Task<(string Path, string Nama, string? Tipe)?> AmbilLampiranAsync(long id, long lampId, string nik)
    {
        var lamp = await _db.SuratLampiran.AsNoTracking().FirstOrDefaultAsync(l => l.Id == lampId && l.IdSurat == id);
        if (lamp is null) return null;
        var s = await _db.Surat.AsNoTracking()
            .Include(x => x.PenanggungJawab).Include(x => x.Distribusi)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (s is null || !BolehLihat(s, nik)) return null;
        return (lamp.Path, lamp.NamaFile, lamp.Tipe);
    }

    public async Task<(bool Ok, string? Error, string? Path)> HapusLampiranAsync(long id, long lampId, string nik)
    {
        var (ok, error) = await BolehEditLampiranAsync(id, nik);
        if (!ok) return (false, error, null);
        var l = await _db.SuratLampiran.FirstOrDefaultAsync(x => x.Id == lampId && x.IdSurat == id);
        if (l is null) return (false, "Lampiran tidak ditemukan.", null);
        var path = l.Path;
        _db.SuratLampiran.Remove(l);
        await _db.SaveChangesAsync();
        return (true, null, path);
    }

    // Kirim draft ke reviewer (Draft/Revisi -> Menunggu Review). Hanya pembuat.
    public async Task<(bool Ok, string? Error)> KirimReviewAsync(long id, string nik, string? nama)
    {
        var s = await _db.Surat.Include(x => x.PenanggungJawab).FirstOrDefaultAsync(x => x.Id == id);
        if (s is null)
        {
            return (false, "Surat tidak ditemukan.");
        }
        if (s.PembuatNik != nik)
        {
            return (false, "Hanya pembuat surat yang bisa mengirim.");
        }
        if (s.Status is not ("Draft" or "Revisi"))
        {
            return (false, "Surat sudah diajukan.");
        }
        if (!s.PenanggungJawab.Any(p => p.Peran == "Reviewer") || !s.PenanggungJawab.Any(p => p.Peran == "Approver"))
        {
            return (false, "Reviewer dan Approver wajib ditetapkan sebelum dikirim.");
        }
        var now = DateTime.UtcNow;
        s.Status = "Menunggu Review";
        s.DiperbaruiPada = now;
        _db.SuratRiwayat.Add(new SuratRiwayat { IdSurat = s.Id, Aksi = "Dikirim ke Review", OlehNik = nik, OlehNama = nama, Tgl = now });
        await NotifTahapAsync(s, "Reviewer", nik, nama, now);
        await _db.SaveChangesAsync();
        return (true, null);
    }

    // Batalkan surat (Draft/Revisi -> Batal). Hanya pembuat.
    public async Task<(bool Ok, string? Error)> BatalkanAsync(long id, string nik, string? nama)
    {
        var s = await _db.Surat.FirstOrDefaultAsync(x => x.Id == id);
        if (s is null)
        {
            return (false, "Surat tidak ditemukan.");
        }
        if (s.PembuatNik != nik)
        {
            return (false, "Hanya pembuat surat yang bisa membatalkan.");
        }
        if (s.Status is not ("Draft" or "Revisi"))
        {
            return (false, "Hanya surat Draft/Revisi yang bisa dibatalkan.");
        }
        var now = DateTime.UtcNow;
        s.Status = "Batal";
        s.DiperbaruiPada = now;
        _db.SuratRiwayat.Add(new SuratRiwayat { IdSurat = s.Id, Aksi = "Dibatalkan", OlehNik = nik, OlehNama = nama, Tgl = now });
        await _db.SaveChangesAsync();
        return (true, null);
    }
}

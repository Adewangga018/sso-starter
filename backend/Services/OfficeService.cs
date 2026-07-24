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
    private static readonly string[] JenisValid = ["Surat", "SP", "ASP", "Memo"];
    private static readonly string[] SifatValid = ["Rahasia", "Terbatas", "Biasa"];
    private static readonly string[] CepatValid = ["Biasa", "Segera", "Sangat Segera"];

    private readonly ApplicationDbContext _db;
    private readonly GcsDbContext _gcs;

    public OfficeService(ApplicationDbContext db, GcsDbContext gcs)
    {
        _db = db;
        _gcs = gcs;
    }

    // Pencarian pegawai untuk memilih penanggung jawab / tujuan distribusi.
    public async Task<IReadOnlyList<OfficePegawaiDto>> CariPegawaiAsync(string q)
    {
        var term = (q ?? string.Empty).Trim();
        if (term.Length < 2)
        {
            return [];
        }
        return await _gcs.PegawaiSdm
            .Where(p => p.data_aktif == "Aktif" && (p.nama!.Contains(term) || p.Nik.Contains(term)))
            .OrderBy(p => p.nama)
            .Take(20)
            .Select(p => new OfficePegawaiDto(p.Nik, p.nama ?? p.Nik, p.nm_jabatan, p.UNIT_KERJA ?? p.BAGIAN))
            .ToListAsync();
    }

    public async Task<(bool Ok, string? Error, long Id)> CreateAsync(string nik, string? nama, CreateSuratRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Judul))
        {
            return (false, "Judul surat wajib diisi.", 0);
        }
        var jenis = JenisValid.Contains(req.Jenis) ? req.Jenis : "Surat";
        var sifat = SifatValid.Contains(req.Sifat) ? req.Sifat : "Biasa";
        var cepat = CepatValid.Contains(req.Kecepatan) ? req.Kecepatan : "Biasa";

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
            Klasifikasi = string.IsNullOrWhiteSpace(req.Klasifikasi) ? null : req.Klasifikasi.Trim(),
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
        return await q
            .OrderByDescending(s => s.Id)
            .Select(s => new SuratListItemDto(
                s.Id, s.Nomor, s.Jenis, s.Sifat, s.Kecepatan, s.Judul, s.Status, s.TanggalSurat, s.DibuatPada))
            .ToListAsync();
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

        return new SuratDetailDto(
            s.Id, s.Nomor, s.Jenis, s.Klasifikasi, s.Sifat, s.Kecepatan,
            s.Judul, s.Keterangan, s.Isi, s.Status, s.PembuatNik, s.PembuatNama,
            s.TanggalSurat, s.BerlakuMulai, s.BerlakuSampai, s.DibuatPada,
            IsPembuat: s.PembuatNik == nik,
            AksiPeran: aksiPeran,
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
        return await _db.Surat.AsNoTracking()
            .Where(s => s.Status == stage
                && s.PenanggungJawab.Any(p => p.Peran == target && p.Nik == nik && p.Status == "Menunggu"))
            .OrderByDescending(s => s.Id)
            .Select(s => new SuratListItemDto(
                s.Id, s.Nomor, s.Jenis, s.Sifat, s.Kecepatan, s.Judul, s.Status, s.TanggalSurat, s.DibuatPada))
            .ToListAsync();
    }

    // Aksi reviewer/approver: Setujui | Tolak | Revisi. Menggerakkan status surat bila
    // seluruh penanggung jawab pada tahap itu telah menyetujui.
    public async Task<(bool Ok, string? Error)> ActPengesahanAsync(long id, string nik, string? nama, string aksi, string? komentar)
    {
        if (aksi is not ("Setujui" or "Tolak" or "Revisi"))
        {
            return (false, "Aksi tidak dikenal.");
        }

        var s = await _db.Surat.Include(x => x.PenanggungJawab).FirstOrDefaultAsync(x => x.Id == id);
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
        }
        else if (aksi == "Revisi")
        {
            baris.Status = "Revisi";
            s.Status = "Revisi";
            riwayatAksi = $"Diminta revisi oleh {peranTahap}";
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
            }
            else
            {
                riwayatAksi = $"Disetujui oleh {peranTahap}";
            }
        }

        // Penomoran otomatis saat surat final disetujui (placeholder sederhana & unik;
        // format korporat bisa diganti kemudian). Contoh: 0007/OFC/2026.
        if (s.Status == "Disetujui" && string.IsNullOrWhiteSpace(s.Nomor))
        {
            var tahunWib = now.AddHours(7).Year;
            s.Nomor = $"{s.Id:D4}/OFC/{tahunWib}";
        }

        _db.SuratRiwayat.Add(new SuratRiwayat { IdSurat = s.Id, Aksi = riwayatAksi, OlehNik = nik, OlehNama = nama, Catatan = baris.Komentar, Tgl = now });
        await _db.SaveChangesAsync();
        return (true, null);
    }

    // Kotak masuk: surat FINAL (Disetujui) yang saya menjadi tujuan/CC-nya.
    public async Task<IReadOnlyList<SuratListItemDto>> InboxAsync(string nik)
    {
        return await _db.Surat.AsNoTracking()
            .Where(s => s.Status == "Disetujui" && s.Distribusi.Any(d => d.Nik == nik))
            .OrderByDescending(s => s.Id)
            .Select(s => new SuratListItemDto(
                s.Id, s.Nomor, s.Jenis, s.Sifat, s.Kecepatan, s.Judul, s.Status, s.TanggalSurat, s.DibuatPada))
            .ToListAsync();
    }

    // ---- Lampiran ----

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

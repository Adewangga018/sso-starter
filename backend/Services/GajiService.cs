using System.Data;
using Microsoft.EntityFrameworkCore;
using SsoBackend.Data;
using SsoBackend.Models.Dto;

namespace SsoBackend.Services;

// Slip Gaji MyGCS. Nominal komponen basis JG_PG berasal dari gaji.tarif (matriks
// JG x PG x tahun); komponen Karyawan_Periode dari gaji.slip_detail (input manual).
// JG diambil dari jabatan aktif (grading.jabatan.jg), PG dari grading.person_grade
// (baris tahun_berlaku terbaru <= tahun periode). Selama tarif belum dikonfigurasi,
// seluruh nominal = 0 dan slip menampilkan banner "belum diisi".
public class GajiService
{
    private readonly ApplicationDbContext _db;
    private readonly GcsDbContext _gcs;
    private readonly PosisiResolver _posisi;

    public GajiService(ApplicationDbContext db, GcsDbContext gcs, PosisiResolver posisi)
    {
        _db = db;
        _gcs = gcs;
        _posisi = posisi;
    }

    private static readonly string[] BulanId =
        { "", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
          "Agustus", "September", "Oktober", "November", "Desember" };

    private static readonly string[] UrutanPendapatan =
        { "Gaji Pokok", "Tunjangan Tetap", "Tunjangan Tidak Tetap", "Tunjangan Lain" };
    private static readonly string[] UrutanPotongan =
        { "Potongan Tetap", "Potongan Tidak Tetap" };

    // Label Band KHUSUS Payroll/Slip Gaji (bukan nama jabatan spt "Direksi"/"General
    // Manager" yang dipakai PosisiResolver di seluruh app) - Angka romawi supaya beda
    // dari label tingkatan generik lain. Band 0 tetap angka biasa (bukan "0" romawi).
    private static readonly IReadOnlyDictionary<int, string> BandLabel = new Dictionary<int, string>
    {
        [0] = "Band 0", [1] = "Band I", [2] = "Band II", [3] = "Band III",
        [4] = "Band IV", [5] = "Band V", [6] = "Band VI",
    };

    public async Task<GajiSlipDto> GetSlipAsync(string nik, string nama, int tahun, int bulan)
    {
        var (jg, band, jabatan) = await ResolveJabatanAsync(nik);
        var pg = await ResolvePgAsync(nik, tahun);
        var tingkatan = band is int bv0 && BandLabel.TryGetValue(bv0, out var bl0) ? bl0 : null;

        var komponen = await _db.GajiKomponen.AsNoTracking()
            .Where(k => k.Aktif)
            .OrderBy(k => k.Urutan)
            .ToListAsync();

        // Tarif untuk sel (JG, PG, tahun) - hanya bila JG & PG diketahui.
        var tarif = new Dictionary<int, decimal>();
        if (jg is int jgv && pg is int pgv)
        {
            byte jgb = (byte)jgv, pgb = (byte)pgv;
            short th = (short)tahun;
            tarif = await _db.GajiTarif.AsNoTracking()
                .Where(t => t.Jg == jgb && t.Pg == pgb && t.TahunBerlaku == th)
                .ToDictionaryAsync(t => t.IdKomponen, t => t.Nominal);
        }

        // Slip tersimpan (kalau sudah digenerate) -> nominal manual (Karyawan_Periode),
        // termasuk Potongan Presensi yang kini komponen tersendiri. Status slip menentukan
        // apakah GajiBersih ditampilkan sbg final atau "Estimasi THP" (lihat GajiSlipDto.Final).
        var manual = new Dictionary<int, decimal>();
        var sudahFinal = false;
        var periode = await _db.GajiPeriode.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Tahun == (short)tahun && p.Bulan == (byte)bulan);
        if (periode is not null)
        {
            var slip = await _db.GajiSlip.AsNoTracking()
                .FirstOrDefaultAsync(s => s.IdPeriode == periode.IdPeriode && s.IdKaryawan == nik);
            if (slip is not null)
            {
                manual = await _db.GajiSlipDetail.AsNoTracking()
                    .Where(d => d.IdSlip == slip.IdSlip)
                    .ToDictionaryAsync(d => d.IdKomponen, d => d.Nominal);
                sudahFinal = slip.Status == "Final";
            }
        }

        // Tarif satu-dimensi (Band | JG | PG) untuk komponen "Pendapatan Dasar" - satu
        // nilai per pegawai (bukan matriks JG x PG). Nilai relevan = band/jg/pg pegawai ybs.
        var tarifTunggal = new Dictionary<int, decimal>();
        var nilaiRelevan = new List<short>();
        if (band is int bv) nilaiRelevan.Add((short)bv);
        if (jg is int jgv2) nilaiRelevan.Add((short)jgv2);
        if (pg is int pgv2) nilaiRelevan.Add((short)pgv2);
        if (nilaiRelevan.Count > 0)
        {
            short th2 = (short)tahun;
            var rows = await _db.GajiTarifTunggal.AsNoTracking()
                .Where(t => t.TahunBerlaku == th2 && nilaiRelevan.Contains(t.Nilai))
                .ToListAsync();
            foreach (var k in komponen)
            {
                int? nilaiPegawai = k.Basis switch { "Band" => band, "JG" => jg, "PG" => pg, _ => null };
                if (nilaiPegawai is int np)
                {
                    var match = rows.FirstOrDefault(r => r.IdKomponen == k.IdKomponen && r.Nilai == np);
                    if (match is not null) tarifTunggal[k.IdKomponen] = match.Nominal;
                }
            }
        }

        // "Pendapatan Dasar" = jumlah komponen TIPE PENDAPATAN yang basis Band/JG/PG
        // (Gaji Pokok, Tunjangan Jabatan/Perumahan/Pangan/Angkutan) - dasar hitung
        // komponen berbasis rumus (mis. Tunjangan BPJS Kesehatan). HARUS dibatasi
        // Tipe=="Pendapatan": ada juga POTONGAN berbasis Band/JG/PG (mis. Potongan
        // DPLK per Band) yang TIDAK boleh ikut menaikkan basis rumus ini. Dihitung
        // dari manual/tarifTunggal langsung (bukan lewat Nominal()) supaya urutan
        // resolusi tidak melingkar.
        decimal NominalDasar(Models.Gaji.GajiKomponen k) =>
            manual.TryGetValue(k.IdKomponen, out var m) ? m
            : tarifTunggal.TryGetValue(k.IdKomponen, out var tt) ? tt
            : 0m;
        var pendapatanDasarTotal = komponen
            .Where(k => k.Tipe == "Pendapatan" && k.Basis is "Band" or "JG" or "PG")
            .Sum(NominalDasar);

        // Komponen berbasis rumus: nominal = Persen% x MIN(Pendapatan Dasar, Batas).
        // Batas null = tanpa batas atas.
        var formula = new Dictionary<int, decimal>();
        foreach (var k in komponen.Where(k => k.Basis == "PendapatanDasar"))
        {
            var persen = k.FormulaPersen ?? 0m;
            var basisHitung = k.FormulaBatas is decimal batas ? Math.Min(pendapatanDasarTotal, batas) : pendapatanDasarTotal;
            formula[k.IdKomponen] = Math.Round(basisHitung * persen / 100m, 0, MidpointRounding.AwayFromZero);
        }

        // Komponen basis 'Flat': satu nominal sama untuk semua karyawan.
        var flat = komponen.Where(k => k.Basis == "Flat")
            .ToDictionary(k => k.IdKomponen, k => k.NilaiFlat ?? 0m);

        decimal Nominal(int id, string basis) =>
            manual.TryGetValue(id, out var m) ? m
            : basis == "JG_PG" && tarif.TryGetValue(id, out var t) ? t
            : (basis is "Band" or "JG" or "PG") && tarifTunggal.TryGetValue(id, out var tt) ? tt
            : basis == "PendapatanDasar" && formula.TryGetValue(id, out var f) ? f
            : basis == "Flat" && flat.TryGetValue(id, out var fl) ? fl
            : 0m;

        var pendapatan = BuildGrup(komponen, "Pendapatan", UrutanPendapatan, Nominal);
        var potongan = BuildGrup(komponen, "Potongan", UrutanPotongan, Nominal);

        var totalPendapatan = pendapatan.Sum(g => g.Subtotal);
        var totalPotongan = potongan.Sum(g => g.Subtotal);
        var gajiBersih = totalPendapatan - totalPotongan;
        var belumDiisi = totalPendapatan == 0 && totalPotongan == 0;

        return new GajiSlipDto(
            tahun, bulan, BulanId[bulan], nama, jabatan, tingkatan, band, jg, pg,
            pendapatan, potongan, totalPendapatan, totalPotongan, gajiBersih,
            belumDiisi, null, sudahFinal);
    }

    private static List<GajiGrupDto> BuildGrup(
        IReadOnlyList<Models.Gaji.GajiKomponen> komponen,
        string tipe,
        string[] urutanKategori,
        Func<int, string, decimal> nominal)
    {
        var grup = new List<GajiGrupDto>();
        foreach (var kategori in urutanKategori)
        {
            var items = komponen
                .Where(k => k.Tipe == tipe && k.Kategori == kategori)
                .Select(k => new GajiBarisDto(
                    k.Kode, k.Nama, nominal(k.IdKomponen, k.Basis),
                    k.Opsional, k.KenaPotonganTerlambat, k.Basis, k.Keterangan,
                    k.GrupKode, k.GrupLabel, k.MasukTotal))
                .ToList();
            if (items.Count == 0) continue;
            // Subtotal hanya menjumlah baris MasukTotal=true - komponen informasi
            // (mis. kontribusi BPJS TK perusahaan) tetap tampil tapi tak menaikkan
            // Subtotal kategori maupun Total Pendapatan/Potongan/Gaji Bersih.
            grup.Add(new GajiGrupDto(kategori, items, items.Where(i => i.MasukTotal).Sum(i => i.Nominal)));
        }
        return grup;
    }

    // (JG, band, nama_jabatan) dari penempatan aktif. JG bisa NULL (Direksi).
    private async Task<(int? Jg, int? Band, string? Jabatan)> ResolveJabatanAsync(string nik)
    {
        var conn = _db.Database.GetDbConnection();
        var mustClose = conn.State != ConnectionState.Open;
        if (mustClose) await conn.OpenAsync();
        try
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                SELECT TOP 1 j.jg, j.id_band, j.nama_jabatan
                FROM grading.penempatan p
                JOIN grading.jabatan j ON j.id_jabatan = p.id_jabatan
                WHERE p.id_karyawan = @nik AND p.status = 'Aktif'";
            AddParam(cmd, "@nik", nik);
            await using var r = await cmd.ExecuteReaderAsync();
            if (await r.ReadAsync())
            {
                int? jg = r.IsDBNull(0) ? null : Convert.ToInt32(r.GetValue(0));
                int? band = r.IsDBNull(1) ? null : Convert.ToInt32(r.GetValue(1));
                string? jabatan = r.IsDBNull(2) ? null : r.GetString(2);
                return (jg, band, jabatan);
            }
            return (null, null, null);
        }
        finally
        {
            if (mustClose) await conn.CloseAsync();
        }
    }

    // PG berlaku: baris person_grade dengan tahun_berlaku terbaru <= tahun periode.
    private async Task<int?> ResolvePgAsync(string nik, int tahun)
    {
        var conn = _db.Database.GetDbConnection();
        var mustClose = conn.State != ConnectionState.Open;
        if (mustClose) await conn.OpenAsync();
        try
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                SELECT TOP 1 pg
                FROM grading.person_grade
                WHERE id_karyawan = @nik AND tahun_berlaku <= @tahun
                ORDER BY tahun_berlaku DESC";
            AddParam(cmd, "@nik", nik);
            AddParam(cmd, "@tahun", tahun);
            var val = await cmd.ExecuteScalarAsync();
            return val is null || val is DBNull ? null : Convert.ToInt32(val);
        }
        finally
        {
            if (mustClose) await conn.CloseAsync();
        }
    }

    private static void AddParam(System.Data.Common.DbCommand cmd, string name, object value)
    {
        var p = cmd.CreateParameter();
        p.ParameterName = name;
        p.Value = value;
        cmd.Parameters.Add(p);
    }

    // ===================== Admin Modul SDM: konfigurasi tarif =====================

    // Pilihan JG (dari grading.job_grade) & PG. PG dibuat kontinu dari nilai terendah
    // yang ada s/d minimal 21 (skala PG sampai 21, sejajar JG) agar tiap sel dapat diisi.
    public async Task<GajiGradeOpsiDto> GetGradeOpsiAsync()
    {
        var jg = await ReadIntsAsync("SELECT jg FROM grading.job_grade ORDER BY jg");
        var pgAda = await ReadIntsAsync("SELECT DISTINCT pg FROM grading.person_grade ORDER BY pg");
        var pgMin = pgAda.Count > 0 ? pgAda.Min() : 7;
        var pgMax = Math.Max(21, pgAda.Count > 0 ? pgAda.Max() : 21);
        var pg = Enumerable.Range(pgMin, pgMax - pgMin + 1).ToList();
        return new GajiGradeOpsiDto(jg, pg);
    }

    // Daftar komponen basis JG_PG + nominal pada sel (tahun, jg, pg).
    public async Task<GajiTarifSelDto> GetTarifSelAsync(int tahun, int jg, int pg)
    {
        var komponen = await _db.GajiKomponen.AsNoTracking()
            .Where(k => k.Aktif && k.Basis == "JG_PG")
            .OrderBy(k => k.Urutan)
            .ToListAsync();

        byte jgb = (byte)jg, pgb = (byte)pg; short th = (short)tahun;
        var tarif = await _db.GajiTarif.AsNoTracking()
            .Where(t => t.Jg == jgb && t.Pg == pgb && t.TahunBerlaku == th)
            .ToDictionaryAsync(t => t.IdKomponen, t => t.Nominal);

        var items = komponen.Select(k => new GajiKomponenTarifDto(
            k.IdKomponen, k.Kode, k.Nama, k.Tipe, k.Kategori,
            tarif.TryGetValue(k.IdKomponen, out var n) ? n : 0m,
            k.GrupKode, k.GrupLabel)).ToList();
        return new GajiTarifSelDto(tahun, jg, pg, items);
    }

    // Upsert nominal komponen untuk satu sel (tahun, jg, pg).
    public async Task SimpanTarifSelAsync(SimpanTarifRequest req)
    {
        byte jgb = (byte)req.Jg, pgb = (byte)req.Pg; short th = (short)req.Tahun;
        var existing = await _db.GajiTarif
            .Where(t => t.Jg == jgb && t.Pg == pgb && t.TahunBerlaku == th)
            .ToListAsync();

        foreach (var item in req.Items)
        {
            var row = existing.FirstOrDefault(t => t.IdKomponen == item.IdKomponen);
            if (row is null)
            {
                _db.GajiTarif.Add(new Models.Gaji.GajiTarif
                {
                    IdKomponen = item.IdKomponen, Jg = jgb, Pg = pgb,
                    TahunBerlaku = th, Nominal = item.Nominal,
                });
            }
            else
            {
                row.Nominal = item.Nominal;
            }
        }
        await _db.SaveChangesAsync();
    }

    // ===================== Admin Modul SDM: Pendapatan Dasar (tarif satu dimensi) =====================
    // Komponen dgn basis Band|JG|PG (Gaji Pokok, Tunjangan Jabatan/Perumahan/Pangan/
    // Angkutan): admin input SATU nominal per nilai Band/JG/PG, bukan per sel JG x PG.
    // Generik: komponen lain yg suatu saat dipindah ke basis ini otomatis ikut tampil di sini.
    // (Label Band dipakai di sini = BandLabel di atas, sama dgn yg dipakai slip.)

    // Tipe="Pendapatan": Gaji Pokok/Tunjangan Jabatan/Perumahan/Pangan/Angkutan.
    public Task<PendapatanDasarDto> GetPendapatanDasarAsync(int tahun) => GetTarifTunggalAsync(tahun, "Pendapatan");

    // Tipe="Potongan": mis. Potongan DPLK per Band. Sama mekanisme, kolom Tipe berbeda -
    // dipisah dari Pendapatan Dasar supaya tidak salah kaprah ikut menaikkan basis rumus
    // Tunjangan BPJS Kesehatan (lihat GetSlipAsync).
    public Task<PendapatanDasarDto> GetPotonganTunggalAsync(int tahun) => GetTarifTunggalAsync(tahun, "Potongan");

    private async Task<PendapatanDasarDto> GetTarifTunggalAsync(int tahun, string tipe)
    {
        var komponen = await _db.GajiKomponen.AsNoTracking()
            .Where(k => k.Aktif && k.Tipe == tipe && (k.Basis == "Band" || k.Basis == "JG" || k.Basis == "PG"))
            .OrderBy(k => k.Urutan)
            .ToListAsync();

        var opsi = await GetGradeOpsiAsync();
        short th = (short)tahun;
        var ids = komponen.Select(k => k.IdKomponen).ToList();
        var tarif = ids.Count == 0 ? new List<Models.Gaji.GajiTarifTunggal>() : await _db.GajiTarifTunggal.AsNoTracking()
            .Where(t => t.TahunBerlaku == th && ids.Contains(t.IdKomponen))
            .ToListAsync();

        var hasil = komponen.Select(k =>
        {
            IReadOnlyList<int> nilaiRange = k.Basis switch
            {
                "Band" => BandLabel.Keys.OrderBy(x => x).ToList(),
                "JG" => opsi.Jg,
                "PG" => opsi.Pg,
                _ => Array.Empty<int>(),
            };
            var baris = nilaiRange.Select(n =>
            {
                var nominal = tarif.FirstOrDefault(t => t.IdKomponen == k.IdKomponen && t.Nilai == n)?.Nominal ?? 0m;
                var label = k.Basis == "Band" ? (BandLabel.TryGetValue(n, out var bl) ? bl : $"Band {n}") : $"{k.Basis} {n}";
                return new TarifTunggalNilaiDto(n, label, nominal);
            }).ToList();
            return new TarifTunggalKomponenDto(k.IdKomponen, k.Kode, k.Nama, k.Basis, baris);
        }).ToList();

        return new PendapatanDasarDto(tahun, hasil);
    }

    public Task<(bool Ok, string? Error)> SimpanPendapatanDasarAsync(SimpanPendapatanDasarRequest req) =>
        SimpanTarifTunggalAsync(req, "Pendapatan", "Komponen yang dikirim bukan komponen Pendapatan Dasar (basis Band/JG/PG).");

    public Task<(bool Ok, string? Error)> SimpanPotonganTunggalAsync(SimpanPendapatanDasarRequest req) =>
        SimpanTarifTunggalAsync(req, "Potongan", "Komponen yang dikirim bukan komponen Potongan per Band/JG/PG.");

    private async Task<(bool Ok, string? Error)> SimpanTarifTunggalAsync(SimpanPendapatanDasarRequest req, string tipe, string errMsg)
    {
        // Proteksi: hanya boleh menyimpan utk komponen TIPE yang sesuai & MEMANG berbasis Band/JG/PG.
        var idsValid = (await _db.GajiKomponen.AsNoTracking()
            .Where(k => k.Tipe == tipe && (k.Basis == "Band" || k.Basis == "JG" || k.Basis == "PG"))
            .Select(k => k.IdKomponen).ToListAsync()).ToHashSet();
        if (req.Items.Any(i => !idsValid.Contains(i.IdKomponen)))
            return (false, errMsg);

        short th = (short)req.Tahun;
        var existing = await _db.GajiTarifTunggal
            .Where(t => t.TahunBerlaku == th)
            .ToListAsync();

        foreach (var item in req.Items)
        {
            var row = existing.FirstOrDefault(t => t.IdKomponen == item.IdKomponen && t.Nilai == item.Nilai);
            if (row is null)
            {
                _db.GajiTarifTunggal.Add(new Models.Gaji.GajiTarifTunggal
                {
                    IdKomponen = item.IdKomponen, Nilai = (short)item.Nilai,
                    TahunBerlaku = th, Nominal = item.Nominal,
                });
            }
            else
            {
                row.Nominal = item.Nominal;
            }
        }
        await _db.SaveChangesAsync();
        return (true, null);
    }

    // ===================== Admin Modul SDM: parameter rumus (basis 'PendapatanDasar') ====
    // Generik: komponen apa pun yang dipindah ke basis 'PendapatanDasar' otomatis tampil
    // di sini. TIDAK per-tahun (parameter rumus berlaku sampai diubah admin lagi).
    public async Task<FormulaListDto> GetFormulaAsync()
    {
        var komponen = await _db.GajiKomponen.AsNoTracking()
            .Where(k => k.Aktif && k.Basis == "PendapatanDasar")
            .OrderBy(k => k.Urutan)
            .Select(k => new FormulaKomponenDto(k.IdKomponen, k.Kode, k.Nama, k.FormulaPersen, k.FormulaBatas, k.Keterangan))
            .ToListAsync();
        return new FormulaListDto(komponen);
    }

    public async Task<(bool Ok, string? Error)> SimpanFormulaAsync(SimpanFormulaRequest req)
    {
        var valid = (await _db.GajiKomponen.AsNoTracking()
            .Where(k => k.Basis == "PendapatanDasar")
            .Select(k => k.IdKomponen).ToListAsync()).ToHashSet();
        if (req.Items.Any(i => !valid.Contains(i.IdKomponen)))
            return (false, "Komponen yang dikirim bukan komponen berbasis rumus Pendapatan Dasar.");
        if (req.Items.Any(i => i.Persen < 0 || i.Persen > 100))
            return (false, "Persentase harus antara 0 dan 100.");

        var rows = await _db.GajiKomponen
            .Where(k => req.Items.Select(i => i.IdKomponen).Contains(k.IdKomponen))
            .ToListAsync();
        foreach (var item in req.Items)
        {
            var row = rows.First(k => k.IdKomponen == item.IdKomponen);
            row.FormulaPersen = item.Persen;
            row.FormulaBatas = item.Batas;
        }
        await _db.SaveChangesAsync();
        return (true, null);
    }

    // ===================== Admin Modul SDM: nilai flat (basis 'Flat') =====================
    // Komponen yang nilainya SAMA untuk semua karyawan (mis. Iuran IKGCS, Simpanan Wajib
    // KKCS/K3PG). Generik: komponen apa pun berbasis 'Flat' otomatis tampil di sini.
    public async Task<FlatListDto> GetFlatAsync()
    {
        var komponen = await _db.GajiKomponen.AsNoTracking()
            .Where(k => k.Aktif && k.Basis == "Flat")
            .OrderBy(k => k.Urutan)
            .Select(k => new FlatKomponenDto(k.IdKomponen, k.Kode, k.Nama, k.NilaiFlat ?? 0m, k.Keterangan))
            .ToListAsync();
        return new FlatListDto(komponen);
    }

    public async Task<(bool Ok, string? Error)> SimpanFlatAsync(SimpanFlatRequest req)
    {
        var valid = (await _db.GajiKomponen.AsNoTracking()
            .Where(k => k.Basis == "Flat")
            .Select(k => k.IdKomponen).ToListAsync()).ToHashSet();
        if (req.Items.Any(i => !valid.Contains(i.IdKomponen)))
            return (false, "Komponen yang dikirim bukan komponen basis Flat.");

        var rows = await _db.GajiKomponen
            .Where(k => req.Items.Select(i => i.IdKomponen).Contains(k.IdKomponen))
            .ToListAsync();
        foreach (var item in req.Items)
        {
            rows.First(k => k.IdKomponen == item.IdKomponen).NilaiFlat = item.Nilai;
        }
        await _db.SaveChangesAsync();
        return (true, null);
    }

    // ===================== Admin Modul SDM: nominal manual per karyawan =====================
    // Komponen basis 'Karyawan_Periode' (Lembur, RIT, Uang Makan Dinas, Tunjangan PTS,
    // Potongan Presensi, K3PG, KKCS, BMT, Angsuran, KSPPS, dst) - nilainya beda tiap orang,
    // diinput manual per (karyawan, tahun, bulan). Ini yang membuat gaji.periode/gaji.slip/
    // gaji.slip_detail terisi (dibuat otomatis di sini bila belum ada).

    // q kosong/1 huruf -> daftar default (100 pegawai aktif pertama, urut nama) supaya
    // halaman Manual per Karyawan sudah menampilkan pegawai TANPA harus mengetik cari
    // dulu; q >=2 huruf -> filter nama/NIK spt biasa.
    public async Task<IReadOnlyList<GajiPegawaiPickerDto>> CariPegawaiAsync(string? q)
    {
        var term = (q ?? string.Empty).Trim();
        // Sementara khusus tenaga kerja organik (Tetap) - Kontrak/InternShip/Borongan/dst
        // belum di-onboard sbg pengguna MyGCS, jadi tak boleh muncul sbg pilihan (2026-08-13).
        var query = _gcs.PegawaiSdm.AsNoTracking().Where(p => p.data_aktif == "Aktif" && p.jenis_pegawai == "Tetap");
        if (term.Length >= 2) query = query.Where(p => p.nama!.Contains(term) || p.Nik.Contains(term));
        var rows = await query
            .OrderBy(p => p.nama)
            .Take(100)
            .Select(p => new { p.Nik, p.nama, p.nm_jabatan, Unit = p.UNIT_KERJA ?? p.BAGIAN })
            .ToListAsync();

        // Jabatan struktural (grading) kalau ada, jatuh ke legacy dibersihkan - sama
        // sumber kebenaran dgn yg tampil di header (lihat PosisiResolver.NamaJabatanTerbaik).
        var posisi = await _posisi.ResolveManyAsync(rows.Select(r => r.Nik).ToList());
        return rows.Select(r => new GajiPegawaiPickerDto(
            r.Nik, r.nama ?? r.Nik,
            PosisiResolver.NamaJabatanTerbaik(posisi.GetValueOrDefault(r.Nik), r.nm_jabatan),
            r.Unit,
            posisi.GetValueOrDefault(r.Nik)?.Band is not null)).ToList();
    }

    public async Task<(bool Ok, string? Error, GajiManualDto? Data)> GetManualAsync(string nik, int tahun, int bulan)
    {
        var pegawai = await _gcs.PegawaiSdm.AsNoTracking().FirstOrDefaultAsync(p => p.Nik == nik);
        if (pegawai is null) return (false, "Pegawai tidak ditemukan.", null);

        var komponen = await _db.GajiKomponen.AsNoTracking()
            .Where(k => k.Aktif && k.Basis == "Karyawan_Periode")
            .OrderBy(k => k.Urutan)
            .ToListAsync();

        var manual = new Dictionary<int, decimal>();
        var status = "Draft";
        var periode = await _db.GajiPeriode.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Tahun == (short)tahun && p.Bulan == (byte)bulan);
        if (periode is not null)
        {
            var slip = await _db.GajiSlip.AsNoTracking()
                .FirstOrDefaultAsync(s => s.IdPeriode == periode.IdPeriode && s.IdKaryawan == nik);
            if (slip is not null)
            {
                manual = await _db.GajiSlipDetail.AsNoTracking()
                    .Where(d => d.IdSlip == slip.IdSlip)
                    .ToDictionaryAsync(d => d.IdKomponen, d => d.Nominal);
                status = slip.Status;
            }
        }

        var items = komponen.Select(k => new GajiManualKomponenDto(
            k.IdKomponen, k.Kode, k.Nama, k.Tipe, k.Kategori,
            manual.TryGetValue(k.IdKomponen, out var n) ? n : 0m,
            k.GrupKode, k.GrupLabel)).ToList();

        return (true, null, new GajiManualDto(nik, pegawai.nama ?? nik, tahun, bulan, items, status));
    }

    // Tandai slip gaji satu pegawai/periode sbg selesai (Final, dianggap "posting" - potongan
    // sudah lengkap diinput) atau dibuka kembali (Draft). Slip/periode dibuat kalau belum ada
    // (mis. admin langsung posting tanpa pernah mengisi komponen manual apa pun).
    public async Task<(bool Ok, string? Error)> SetStatusSlipAsync(SetStatusGajiRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Nik)) return (false, "NIK wajib diisi.");
        if (req.Bulan < 1 || req.Bulan > 12) return (false, "Bulan tidak valid.");

        var pegawai = await _gcs.PegawaiSdm.AsNoTracking().FirstOrDefaultAsync(p => p.Nik == req.Nik);
        if (pegawai is null) return (false, "Pegawai tidak ditemukan.");

        short th = (short)req.Tahun; byte bl = (byte)req.Bulan;
        var periode = await _db.GajiPeriode.FirstOrDefaultAsync(p => p.Tahun == th && p.Bulan == bl);
        if (periode is null)
        {
            periode = new Models.Gaji.GajiPeriode { Tahun = th, Bulan = bl, Status = "Draft", DibuatPada = DateTime.UtcNow };
            _db.GajiPeriode.Add(periode);
            await _db.SaveChangesAsync();
        }

        var slip = await _db.GajiSlip.FirstOrDefaultAsync(s => s.IdPeriode == periode.IdPeriode && s.IdKaryawan == req.Nik);
        if (slip is null)
        {
            var (jg, band, jabatan) = await ResolveJabatanAsync(req.Nik);
            var pg = await ResolvePgAsync(req.Nik, req.Tahun);
            slip = new Models.Gaji.GajiSlip
            {
                IdPeriode = periode.IdPeriode, IdKaryawan = req.Nik, Nama = pegawai.nama ?? req.Nik,
                Jg = jg is int jgv ? (byte)jgv : null, Pg = pg is int pgv ? (byte)pgv : null,
                IdBand = band is int bv ? (byte)bv : null,
                Tingkatan = band is int bv1 && BandLabel.TryGetValue(bv1, out var bl1) ? bl1 : null,
                Jabatan = jabatan, Status = "Draft", DibuatPada = DateTime.UtcNow,
            };
            _db.GajiSlip.Add(slip);
        }

        slip.Status = req.Final ? "Final" : "Draft";
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> SimpanManualAsync(SimpanGajiManualRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Nik)) return (false, "NIK wajib diisi.");
        if (req.Bulan < 1 || req.Bulan > 12) return (false, "Bulan tidak valid.");

        var validIds = (await _db.GajiKomponen.AsNoTracking()
            .Where(k => k.Basis == "Karyawan_Periode")
            .Select(k => k.IdKomponen).ToListAsync()).ToHashSet();
        if (req.Items.Any(i => !validIds.Contains(i.IdKomponen)))
            return (false, "Komponen yang dikirim bukan komponen manual per karyawan (basis Karyawan_Periode).");

        var pegawai = await _gcs.PegawaiSdm.AsNoTracking().FirstOrDefaultAsync(p => p.Nik == req.Nik);
        if (pegawai is null) return (false, "Pegawai tidak ditemukan.");

        short th = (short)req.Tahun; byte bl = (byte)req.Bulan;
        var periode = await _db.GajiPeriode.FirstOrDefaultAsync(p => p.Tahun == th && p.Bulan == bl);
        if (periode is null)
        {
            periode = new Models.Gaji.GajiPeriode { Tahun = th, Bulan = bl, Status = "Draft", DibuatPada = DateTime.UtcNow };
            _db.GajiPeriode.Add(periode);
            await _db.SaveChangesAsync();
        }

        var slip = await _db.GajiSlip.FirstOrDefaultAsync(s => s.IdPeriode == periode.IdPeriode && s.IdKaryawan == req.Nik);
        if (slip is null)
        {
            var (jg, band, jabatan) = await ResolveJabatanAsync(req.Nik);
            var pg = await ResolvePgAsync(req.Nik, req.Tahun);
            slip = new Models.Gaji.GajiSlip
            {
                IdPeriode = periode.IdPeriode, IdKaryawan = req.Nik, Nama = pegawai.nama ?? req.Nik,
                Jg = jg is int jgv ? (byte)jgv : null, Pg = pg is int pgv ? (byte)pgv : null,
                IdBand = band is int bv ? (byte)bv : null,
                Tingkatan = band is int bv1 && BandLabel.TryGetValue(bv1, out var bl1) ? bl1 : null,
                Jabatan = jabatan, Status = "Draft", DibuatPada = DateTime.UtcNow,
            };
            _db.GajiSlip.Add(slip);
            await _db.SaveChangesAsync();
        }

        var existing = await _db.GajiSlipDetail.Where(d => d.IdSlip == slip.IdSlip).ToListAsync();
        foreach (var item in req.Items)
        {
            var row = existing.FirstOrDefault(d => d.IdKomponen == item.IdKomponen);
            if (row is null)
            {
                _db.GajiSlipDetail.Add(new Models.Gaji.GajiSlipDetail
                {
                    IdSlip = slip.IdSlip, IdKomponen = item.IdKomponen, Nominal = item.Nominal,
                });
            }
            else
            {
                row.Nominal = item.Nominal;
            }
        }
        await _db.SaveChangesAsync();
        return (true, null);
    }

    // ===================== Potongan Presensi: hitung dari Absensi + Surat Ijin =====================
    // Nota Dinas 0188/08/ND Potongan Absen 2018. Jadwal kerja standar (dipakai HANYA untuk
    // mendeteksi Datang Terlambat/Pulang Lebih Awal TANPA surat ijin, dibandingkan CheckIn/
    // CheckOut aktual) - satu jadwal seragam, dikonfirmasi user, Senin-Jumat.
    private static readonly TimeOnly JamMasukStandar = new(7, 0);
    private static readonly TimeOnly JamPulangStandar = new(16, 0);

    // Preview (TIDAK menyimpan apa pun) - Admin Payroll mereview hasil ini di halaman Manual
    // per Karyawan sebelum menekan Simpan (yang memakai jalur admin/manual biasa).
    public async Task<(bool Ok, string? Error, PotonganPresensiDto? Data)> HitungPotonganPresensiAsync(
        string nik, int tahun, int bulan)
    {
        var pegawai = await _gcs.PegawaiSdm.AsNoTracking().FirstOrDefaultAsync(p => p.Nik == nik);
        if (pegawai is null) return (false, "Pegawai tidak ditemukan.", null);

        var (_, band, _) = await ResolveJabatanAsync(nik);
        if (band is not int bandValue)
            return (false, "Jabatan/Band pegawai belum ditempatkan di sistem grading - tidak bisa menghitung nominal Tunjangan Pangan/Angkutan.", null);

        var awal = new DateOnly(tahun, bulan, 1);
        var akhir = awal.AddMonths(1).AddDays(-1);
        var awalDt = awal.ToDateTime(TimeOnly.MinValue);
        var akhirDt = akhir.ToDateTime(TimeOnly.MaxValue);

        // Jangan pindai tanggal yang BELUM TERJADI (hari ini WIB dst.) sebagai "Tidak Masuk
        // Kerja" - absensinya memang belum ada krn harinya belum berlangsung, bukan pelanggaran.
        // Hanya relevan utk periode BERJALAN (bulan ini); periode yg sudah lewat tak terpengaruh
        // krn akhir bulan itu otomatis <= hari ini.
        var todayWib = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        var batasPindai = akhir < todayWib ? akhir : todayWib;
        string? peringatanPeriode = awal > todayWib
            ? "Periode ini belum dimulai - belum ada data absensi utk dihitung."
            : batasPindai < akhir
                ? $"Periode masih berjalan - dihitung s/d {batasPindai:dd-MM-yyyy} (hari ini), belum sampai akhir bulan."
                : null;

        // Nominal Tunjangan Pangan/Angkutan (Band pegawai, tahun periode) - dasar Rupiah
        // dari persentase yang dihitung nanti.
        var idPangan = await _db.GajiKomponen.AsNoTracking()
            .Where(k => k.Kode == "TJ_PANGAN").Select(k => (int?)k.IdKomponen).FirstOrDefaultAsync();
        var idAngkutan = await _db.GajiKomponen.AsNoTracking()
            .Where(k => k.Kode == "TJ_ANGKUTAN").Select(k => (int?)k.IdKomponen).FirstOrDefaultAsync();
        short th = (short)tahun; short bandS = (short)bandValue;
        var nominalPangan = idPangan is int ip
            ? await _db.GajiTarifTunggal.AsNoTracking()
                .Where(t => t.IdKomponen == ip && t.Nilai == bandS && t.TahunBerlaku == th)
                .Select(t => (decimal?)t.Nominal).FirstOrDefaultAsync() ?? 0m
            : 0m;
        var nominalAngkutan = idAngkutan is int ia
            ? await _db.GajiTarifTunggal.AsNoTracking()
                .Where(t => t.IdKomponen == ia && t.Nilai == bandS && t.TahunBerlaku == th)
                .Select(t => (decimal?)t.Nominal).FirstOrDefaultAsync() ?? 0m
            : 0m;

        // Hari libur (kecualikan dari "hari kerja"): akhir pekan + Cuti Nasional/Bersama.
        var liburSet = new HashSet<DateOnly>();
        foreach (var n in await _db.CutiNasional.AsNoTracking()
            .Where(n => n.TglMulai <= akhir && n.TglSelesai >= awal).ToListAsync())
            for (var d = n.TglMulai; d <= n.TglSelesai; d = d.AddDays(1)) if (d >= awal && d <= akhir) liburSet.Add(d);
        foreach (var b in await _db.CutiBersama.AsNoTracking()
            .Where(b => b.TglMulai <= akhir && b.TglSelesai >= awal).ToListAsync())
            for (var d = b.TglMulai; d <= b.TglSelesai; d = d.AddDays(1)) if (d >= awal && d <= akhir) liburSet.Add(d);

        // Cuti disetujui -> dikecualikan (bukan "tidak masuk kerja").
        var cutiSet = new HashSet<DateOnly>();
        foreach (var c in await _db.CutiPengajuan.AsNoTracking()
            .Where(c => c.IdKaryawan == nik && c.Status == "Disetujui" && c.TglMulai <= akhir && c.TglSelesai >= awal)
            .ToListAsync())
            for (var d = c.TglMulai; d <= c.TglSelesai; d = d.AddDays(1)) if (d >= awal && d <= akhir) cutiSet.Add(d);

        // SPPD/dinas disetujui -> dikecualikan. Status "approved" yang sah = approval.pengajuan
        // (bukan kolom status di WebSdmSppd - lihat catatan ApprovalService.PutusanAsync).
        var approvalSppd = await _db.ApprovalPengajuan.AsNoTracking()
            .Where(a => a.Jenis == "SPPD" && a.IdKaryawan == nik && a.Status == "Disetujui")
            .ToListAsync();
        var sppdIds = approvalSppd
            .Select(a => int.TryParse(a.RefId, out var rid) ? rid : (int?)null)
            .Where(x => x.HasValue).Select(x => x!.Value).ToHashSet();
        var sppdSet = new HashSet<DateOnly>();
        if (sppdIds.Count > 0)
        {
            foreach (var s in await _gcs.WebSdmSppd.AsNoTracking()
                .Where(s => sppdIds.Contains(s.id) && s.tgl_berangkat <= akhirDt && s.tgl_pulang >= awalDt)
                .ToListAsync())
            {
                for (var d = DateOnly.FromDateTime(s.tgl_berangkat); d <= DateOnly.FromDateTime(s.tgl_pulang); d = d.AddDays(1))
                    if (d >= awal && d <= akhir) sppdSet.Add(d);
            }
        }

        // Surat Ijin DISETUJUI (approval.pengajuan jenis "Izin", status "Disetujui") yang
        // overlap bulan ini - "Ada Surat Ijin" dalam Nota Dinas = harus sudah disetujui manager.
        var approvalIzin = await _db.ApprovalPengajuan.AsNoTracking()
            .Where(a => a.Jenis == "Izin" && a.IdKaryawan == nik && a.Status == "Disetujui")
            .ToListAsync();
        var izinIdsDisetujui = approvalIzin
            .Select(a => decimal.TryParse(a.RefId, out var rid) ? rid : (decimal?)null)
            .Where(x => x.HasValue).Select(x => x!.Value).ToHashSet();
        var izinRows = izinIdsDisetujui.Count == 0 ? new List<Models.Gcs.WebSdmSuratIjin>() : await _gcs.WebSdmSuratIjin.AsNoTracking()
            .Where(s => izinIdsDisetujui.Contains(s.id) && s.tgl_ijin <= akhirDt && (s.tgl_ijin_sd ?? s.tgl_ijin) >= awalDt)
            .ToListAsync();

        // Absensi kamera (db_mygcs) - satu baris per Type ("in"/"out"), digabung per tanggal.
        var kameraByDate = (await _db.Attendances.AsNoTracking()
            .Where(a => a.KodePegawai == nik && a.Tanggal >= awal && a.Tanggal <= akhir)
            .ToListAsync())
            .GroupBy(a => a.Tanggal)
            .ToDictionary(g => g.Key, g => (
                CheckIn: g.Where(x => x.CheckIn != null).OrderBy(x => x.CheckIn).Select(x => x.CheckIn).FirstOrDefault(),
                CheckOut: g.Where(x => x.CheckOut != null).OrderByDescending(x => x.CheckOut).Select(x => x.CheckOut).FirstOrDefault()));

        // Absensi resmi SDM (view GCS) - fallback bila tanggal itu tak ada baris kamera. View
        // legacy ini kadang punya >1 baris per tanggal (mis. beberapa scan fingerprint) - ambil
        // check-in TERAWAL & check-out TERAKHIR per tanggal (sama pola dgn merge kamera di atas),
        // BUKAN baris pertama apa adanya (yang bisa kebetulan baris "in=out sama persis").
        var sdmByDate = (await _gcs.AbsensiLog.AsNoTracking()
            .Where(a => a.KodePegawai == nik && a.Tanggal >= awalDt && a.Tanggal <= akhirDt)
            .ToListAsync())
            .GroupBy(a => DateOnly.FromDateTime(a.Tanggal))
            .ToDictionary(g => g.Key, g => (
                CheckIn: g.Where(x => x.CheckIn != null).OrderBy(x => x.CheckIn).Select(x => x.CheckIn).FirstOrDefault(),
                CheckOut: g.Where(x => x.CheckOut != null).OrderByDescending(x => x.CheckOut).Select(x => x.CheckOut).FirstOrDefault()));

        var kejadian = new List<PresensiKejadianDto>();
        decimal persenTp = 0, persenTa = 0;

        for (var d = awal; d <= batasPindai; d = d.AddDays(1))
        {
            if (d.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday) continue;
            if (liburSet.Contains(d) || cutiSet.Contains(d) || sppdSet.Contains(d)) continue;

            var izinHariIni = izinRows.Where(s =>
                DateOnly.FromDateTime(s.tgl_ijin) <= d && DateOnly.FromDateTime(s.tgl_ijin_sd ?? s.tgl_ijin) >= d).ToList();
            if (izinHariIni.Any(s => s.jenis_ijin == "Sakit")) continue;

            string? checkIn = null, checkOut = null;
            if (kameraByDate.TryGetValue(d, out var kam)) { checkIn = kam.CheckIn; checkOut = kam.CheckOut; }
            if (checkIn is null && checkOut is null && sdmByDate.TryGetValue(d, out var sdm))
            {
                checkIn = sdm.CheckIn; checkOut = sdm.CheckOut;
            }

            if (checkIn is null && checkOut is null)
            {
                TambahKejadian(kejadian, ref persenTp, ref persenTa, d, "Tidak Masuk Kerja",
                    izinHariIni.Any(s => s.jenis_ijin == "Tidak Masuk Kerja"), null);
            }
            else if (checkIn is null)
            {
                TambahKejadian(kejadian, ref persenTp, ref persenTa, d, "Tidak Clocking In",
                    izinHariIni.Any(s => s.jenis_ijin == "Tidak Clocking In"), null);
            }
            else if (checkOut is null)
            {
                TambahKejadian(kejadian, ref persenTp, ref persenTa, d, "Tidak Clocking Out",
                    izinHariIni.Any(s => s.jenis_ijin == "Tidak Clocking Out"), null);
            }
            else
            {
                var izinTerlambat = izinHariIni.FirstOrDefault(s => s.jenis_ijin is "Datang Terlambat" or "Pulang Lebih Awal" or "Meninggalkan Pekerjaan");
                if (izinTerlambat is not null)
                {
                    var jam = (decimal)(izinTerlambat.tgl_ijin_sd ?? izinTerlambat.tgl_ijin).Subtract(izinTerlambat.tgl_ijin).TotalHours;
                    TambahKejadian(kejadian, ref persenTp, ref persenTa, d, izinTerlambat.jenis_ijin, true, jam);
                }
                else if (TimeOnly.TryParse(checkIn, out var jamMasuk) && TimeOnly.TryParse(checkOut, out var jamPulang))
                {
                    if (jamMasuk > JamMasukStandar)
                    {
                        var jam = (decimal)(jamMasuk - JamMasukStandar).TotalHours;
                        TambahKejadian(kejadian, ref persenTp, ref persenTa, d, "Datang Terlambat", false, jam);
                    }
                    if (jamPulang < JamPulangStandar)
                    {
                        var jam = (decimal)(JamPulangStandar - jamPulang).TotalHours;
                        TambahKejadian(kejadian, ref persenTp, ref persenTa, d, "Pulang Lebih Awal", false, jam);
                    }
                }
            }
        }

        persenTp = Math.Min(persenTp, 100m);
        persenTa = Math.Min(persenTa, 100m);
        var nominalTp = Math.Round(nominalPangan * persenTp / 100m, 0, MidpointRounding.AwayFromZero);
        var nominalTa = Math.Round(nominalAngkutan * persenTa / 100m, 0, MidpointRounding.AwayFromZero);

        return (true, null, new PotonganPresensiDto(
            nik, pegawai.nama ?? nik, tahun, bulan,
            persenTp, persenTa, nominalTp, nominalTa, nominalTp + nominalTa,
            kejadian, peringatanPeriode));
    }

    // Tabel persentase Nota Dinas 0188/08/ND 2018 (TP=Tunjangan Pangan, TA=Tunjangan Angkutan).
    private static void TambahKejadian(
        List<PresensiKejadianDto> kejadian, ref decimal persenTp, ref decimal persenTa,
        DateOnly tanggal, string jenis, bool adaIjin, decimal? jamHilang)
    {
        var (tp, ta) = RatePersen(jenis, adaIjin, jamHilang);
        kejadian.Add(new PresensiKejadianDto(tanggal, jenis, adaIjin, jamHilang, tp, ta));
        persenTp += tp;
        persenTa += ta;
    }

    private static (decimal Tp, decimal Ta) RatePersen(string jenis, bool adaIjin, decimal? jamHilang)
    {
        switch (jenis)
        {
            case "Datang Terlambat":
            case "Pulang Lebih Awal":
            case "Meninggalkan Pekerjaan":
                var jam = jamHilang ?? 0m;
                var bucket = jam switch { < 1 => 0, < 2 => 1, < 4 => 2, _ => 3 };
                return adaIjin
                    ? bucket switch { 0 => (0m, 2m), 1 => (0m, 3m), 2 => (0m, 4m), _ => (0m, 5m) }
                    : bucket switch { 0 => (5m, 5m), 1 => (10m, 5m), 2 => (10m, 10m), _ => (20m, 10m) };
            case "Tidak Clocking In":
            case "Tidak Clocking Out":
                return adaIjin ? (0m, 5m) : (20m, 10m);
            case "Tidak Masuk Kerja":
                return adaIjin ? (5m, 5m) : (20m, 20m);
            default:
                return (0m, 0m);
        }
    }

    // ============== Lembur Biasa & Lembur Pengganti: hitung dari SPL disetujui ==============
    // Rumus BERTINGKAT (Jam I-IV) dipakai bersama oleh dua jenis lembur - lihat
    // HitungLemburBiasaAsync (khusus Band V/VI, SPL jenis "Biasa") & HitungLemburPenggantiAsync
    // (tanpa batas Band, SPL jenis "Mengganti" - security yg menggantikan rekan jaga; rumus
    // dikonfirmasi user PERSIS sama dgn Lembur Biasa). Tarif = Gaji Pokok (Band pegawai) / 173.
    // Periode gaji (Tahun/Bulan) berarti siklus 16 (bulan sebelumnya) s/d 15 (bulan berjalan) -
    // dikonfirmasi user, dipakai konsisten di sini (BUKAN kalender 1-akhir bulan).
    private static readonly TimeOnly LemburJamI = new(16, 0);
    private static readonly TimeOnly LemburJamII = new(17, 0);
    private const decimal LemburJamKerjaMax = 45m;
    private static readonly int[] LemburBandBerlaku = [5, 6];

    // Preview (TIDAK menyimpan apa pun) - Admin Payroll mereview hasil ini sebelum Simpan
    // (jalur admin/manual biasa, komponen LEMBUR_BIASA basis Karyawan_Periode).
    public Task<(bool Ok, string? Error, LemburBiasaDto? Data)> HitungLemburBiasaAsync(string nik, int tahun, int bulan) =>
        HitungLemburBertingkatAsync(nik, tahun, bulan, "Biasa", LemburBandBerlaku,
            "Formula Lembur Biasa saat ini hanya berlaku untuk Band V dan Band VI.");

    // Lembur Pengganti (security yang menggantikan rekan jaga): SPL jenis "Mengganti",
    // rumus PERSIS sama dgn Lembur Biasa (dikonfirmasi user) - TANPA batasan Band, sistem
    // tidak memvalidasi apakah pegawai benar dari Security atau durasi 12 jam (dikonfirmasi
    // user: bukan validasi ketat, cuma konteks shift jaga) - admin Payroll yang menilai SPL
    // mana yang sah sebelum menyetujui.
    public Task<(bool Ok, string? Error, LemburBiasaDto? Data)> HitungLemburPenggantiAsync(string nik, int tahun, int bulan) =>
        HitungLemburBertingkatAsync(nik, tahun, bulan, "Mengganti", null, null);

    private async Task<(bool Ok, string? Error, LemburBiasaDto? Data)> HitungLemburBertingkatAsync(
        string nik, int tahun, int bulan, string jenisSpl, int[]? bandBerlaku, string? peringatanBand)
    {
        var pegawai = await _gcs.PegawaiSdm.AsNoTracking().FirstOrDefaultAsync(p => p.Nik == nik);
        if (pegawai is null) return (false, "Pegawai tidak ditemukan.", null);

        var (_, band, _) = await ResolveJabatanAsync(nik);

        if (band is not int bandValue)
        {
            return (true, null, new LemburBiasaDto(
                nik, pegawai.nama ?? nik, tahun, bulan, band, 0m, 0m, false, 0m,
                Array.Empty<LemburBiasaKejadianDto>(),
                "Jabatan/Band pegawai belum ditempatkan di sistem grading - tidak bisa menghitung tarif dari Gaji Pokok."));
        }
        if (bandBerlaku is not null && !bandBerlaku.Contains(bandValue))
        {
            return (true, null, new LemburBiasaDto(
                nik, pegawai.nama ?? nik, tahun, bulan, band, 0m, 0m, false, 0m,
                Array.Empty<LemburBiasaKejadianDto>(), peringatanBand));
        }

        // Periode 16 - 15: "bulan" = bulan tanggal 15-nya (akhir periode).
        var akhir = new DateOnly(tahun, bulan, 15);
        var awal = akhir.AddMonths(-1).AddDays(1);
        var awalDt = awal.ToDateTime(TimeOnly.MinValue);
        var akhirDt = akhir.ToDateTime(TimeOnly.MaxValue);

        var idGapok = await _db.GajiKomponen.AsNoTracking()
            .Where(k => k.Kode == "GAPOK").Select(k => (int?)k.IdKomponen).FirstOrDefaultAsync();
        short bandS = (short)bandValue;
        var gajiPokok = idGapok is int ig
            ? await _db.GajiTarifTunggal.AsNoTracking()
                .Where(t => t.IdKomponen == ig && t.Nilai == bandS && t.TahunBerlaku == (short)tahun)
                .Select(t => (decimal?)t.Nominal).FirstOrDefaultAsync() ?? 0m
            : 0m;
        var tarif = Math.Round(gajiPokok / 173m, 2, MidpointRounding.AwayFromZero);

        // Hari libur (dipakai menentukan tipe hari tiap kejadian): akhir pekan + Cuti
        // Nasional/Bersama, pola sama dgn HitungPotonganPresensiAsync.
        var liburSet = new HashSet<DateOnly>();
        foreach (var n in await _db.CutiNasional.AsNoTracking()
            .Where(n => n.TglMulai <= akhir && n.TglSelesai >= awal).ToListAsync())
            for (var d = n.TglMulai; d <= n.TglSelesai; d = d.AddDays(1)) if (d >= awal && d <= akhir) liburSet.Add(d);
        foreach (var b in await _db.CutiBersama.AsNoTracking()
            .Where(b => b.TglMulai <= akhir && b.TglSelesai >= awal).ToListAsync())
            for (var d = b.TglMulai; d <= b.TglSelesai; d = d.AddDays(1)) if (d >= awal && d <= akhir) liburSet.Add(d);

        // SPL (jenisSpl: "Biasa" utk Lembur Biasa, "Mengganti" utk Lembur Pengganti) yang
        // sudah DISETUJUI (approval.pengajuan) dan overlap periode ini.
        var approvalLembur = await _db.ApprovalPengajuan.AsNoTracking()
            .Where(a => a.Jenis == "Lembur" && a.IdKaryawan == nik && a.Status == "Disetujui")
            .ToListAsync();
        var idDisetujui = approvalLembur
            .Select(a => decimal.TryParse(a.RefId, out var rid) ? rid : (decimal?)null)
            .Where(x => x.HasValue).Select(x => x!.Value).ToHashSet();
        var splRows = idDisetujui.Count == 0 ? new List<Models.Gcs.WebSdmSpl>() : (await _gcs.WebSdmSpl.AsNoTracking()
            .Where(s => idDisetujui.Contains(s.id) && s.jenis_spl == jenisSpl && s.tgl_spl >= awalDt && s.tgl_spl <= akhirDt)
            .ToListAsync())
            .OrderBy(s => s.tgl_spl).ToList();

        var kejadian = new List<LemburBiasaKejadianDto>();
        decimal totalJamDibayar = 0;
        var dibatasi = false;

        foreach (var spl in splRows)
        {
            var tanggal = DateOnly.FromDateTime(spl.tgl_spl);
            var isLibur = tanggal.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday || liburSet.Contains(tanggal);
            var tipeHari = isLibur ? "Hari Libur" : "Hari Kerja";

            decimal jamI = 0, jamII = 0, jamIII = 0, jamIV = 0;

            if (!isLibur)
            {
                // Lembur hari kerja hanya dihitung sejak jam 16:00 (jam kerja normal
                // 07:00-16:00, lihat Potongan Presensi) - bagian sebelum itu diabaikan.
                var mulaiEfektif = spl.tgl_spl < tanggal.ToDateTime(LemburJamI) ? tanggal.ToDateTime(LemburJamI) : spl.tgl_spl;
                if (mulaiEfektif < spl.tgl_spl2)
                {
                    var batas17 = tanggal.ToDateTime(LemburJamII);
                    var akhirJamI = spl.tgl_spl2 < batas17 ? spl.tgl_spl2 : batas17;
                    jamI = (decimal)Math.Max(0, (akhirJamI - mulaiEfektif).TotalHours);
                    if (spl.tgl_spl2 > batas17)
                    {
                        var mulaiJamII = mulaiEfektif > batas17 ? mulaiEfektif : batas17;
                        jamII = (decimal)Math.Max(0, (spl.tgl_spl2 - mulaiJamII).TotalHours);
                    }
                }
            }
            else
            {
                // Hari libur: 7 jam pertama = Jam II; jam ke-8 istirahat wajib TAK dibayar
                // (dikurangi, tak masuk nominal/cap); jam ke-9 = Jam III (maks 1 jam); jam
                // ke-10 dst = Jam IV (tak terbatas). "Jam berapapun" -> tanpa clip ke jendela waktu.
                var totalJam = (decimal)Math.Max(0, (spl.tgl_spl2 - spl.tgl_spl).TotalHours);
                jamII = Math.Min(totalJam, 7m);
                var sisa = totalJam - jamII;
                var istirahat = Math.Min(sisa, 1m);
                sisa -= istirahat;
                jamIII = Math.Min(sisa, 1m);
                sisa -= jamIII;
                jamIV = sisa;
            }

            var jamDibayarEvent = jamI + jamII + jamIII + jamIV;
            var terpotong = false;

            // Batas 45 jam/periode - dihitung TERPISAH per jenisSpl (mis. Lembur Biasa &
            // Lembur Pengganti masing2 kuota 45 jam sendiri, BELUM digabung jadi satu kuota
            // "seluruh lembur"; Crash Program malah tanpa batas sama sekali - lihat method
            // masing2). Kalau kejadian ini melewati batas, potong dari segmen tarif
            // TERTINGGI dulu (Jam IV -> I).
            var sisaKuota = LemburJamKerjaMax - totalJamDibayar;
            if (sisaKuota <= 0)
            {
                jamI = jamII = jamIII = jamIV = 0; jamDibayarEvent = 0; terpotong = true;
            }
            else if (jamDibayarEvent > sisaKuota)
            {
                var potong = jamDibayarEvent - sisaKuota;
                var potIV = Math.Min(jamIV, potong); jamIV -= potIV; potong -= potIV;
                var potIII = Math.Min(jamIII, potong); jamIII -= potIII; potong -= potIII;
                var potII = Math.Min(jamII, potong); jamII -= potII; potong -= potII;
                var potI = Math.Min(jamI, potong); jamI -= potI; potong -= potI;
                jamDibayarEvent = jamI + jamII + jamIII + jamIV;
                terpotong = true;
            }

            if (terpotong) dibatasi = true;
            totalJamDibayar += jamDibayarEvent;

            var nominalEvent = Math.Round(tarif * (jamI * 1.5m + jamII * 2m + jamIII * 3m + jamIV * 4m), 0, MidpointRounding.AwayFromZero);
            kejadian.Add(new LemburBiasaKejadianDto(
                tanggal, tipeHari, spl.jam_mulai ?? "", spl.jam_selesai ?? "",
                jamI, jamII, jamIII, jamIV, jamDibayarEvent, nominalEvent, terpotong));
        }

        var total = kejadian.Sum(k => k.Nominal);
        return (true, null, new LemburBiasaDto(
            nik, pegawai.nama ?? nik, tahun, bulan, bandValue, tarif,
            totalJamDibayar, dibatasi, total, kejadian, null));
    }

    // ===================== Lembur Crash Program: hitung dari SPL "Crash Program" =====================
    // Khusus Band I-IV. Tarif = Gaji Pokok (Band pegawai) / 173, SAMA rumus dgn Lembur Biasa
    // (dikonfirmasi user). "Jam mati" - TANPA pengali tarif (beda dari Lembur Biasa yg
    // bertingkat Jam I-IV), TANPA batas 45 jam/periode. Tetap wajib SPL "Crash Program"
    // yang sudah Disetujui - sama mekanisme dgn Lembur Biasa, tak ada syarat tambahan.
    private static readonly int[] LemburCrashBandBerlaku = [1, 2, 3, 4];

    // Preview (TIDAK menyimpan apa pun) - Admin Payroll mereview hasil ini sebelum Simpan
    // (jalur admin/manual biasa, komponen LEMBUR_CRASH basis Karyawan_Periode).
    public async Task<(bool Ok, string? Error, LemburCrashDto? Data)> HitungLemburCrashAsync(
        string nik, int tahun, int bulan)
    {
        var pegawai = await _gcs.PegawaiSdm.AsNoTracking().FirstOrDefaultAsync(p => p.Nik == nik);
        if (pegawai is null) return (false, "Pegawai tidak ditemukan.", null);

        var (_, band, _) = await ResolveJabatanAsync(nik);

        if (band is not int bandValue || !LemburCrashBandBerlaku.Contains(bandValue))
        {
            return (true, null, new LemburCrashDto(
                nik, pegawai.nama ?? nik, tahun, bulan, band, 0m, 0m, 0m,
                Array.Empty<LemburCrashKejadianDto>(),
                "Formula Lembur Crash Program saat ini hanya berlaku untuk Band I s/d Band IV."));
        }

        // Periode 16 - 15 (sama dgn Lembur Biasa & komponen lain).
        var akhir = new DateOnly(tahun, bulan, 15);
        var awal = akhir.AddMonths(-1).AddDays(1);
        var awalDt = awal.ToDateTime(TimeOnly.MinValue);
        var akhirDt = akhir.ToDateTime(TimeOnly.MaxValue);

        var idGapok = await _db.GajiKomponen.AsNoTracking()
            .Where(k => k.Kode == "GAPOK").Select(k => (int?)k.IdKomponen).FirstOrDefaultAsync();
        short bandS = (short)bandValue;
        var gajiPokok = idGapok is int ig
            ? await _db.GajiTarifTunggal.AsNoTracking()
                .Where(t => t.IdKomponen == ig && t.Nilai == bandS && t.TahunBerlaku == (short)tahun)
                .Select(t => (decimal?)t.Nominal).FirstOrDefaultAsync() ?? 0m
            : 0m;
        var tarif = Math.Round(gajiPokok / 173m, 2, MidpointRounding.AwayFromZero);

        var approvalLembur = await _db.ApprovalPengajuan.AsNoTracking()
            .Where(a => a.Jenis == "Lembur" && a.IdKaryawan == nik && a.Status == "Disetujui")
            .ToListAsync();
        var idDisetujui = approvalLembur
            .Select(a => decimal.TryParse(a.RefId, out var rid) ? rid : (decimal?)null)
            .Where(x => x.HasValue).Select(x => x!.Value).ToHashSet();
        var splRows = idDisetujui.Count == 0 ? new List<Models.Gcs.WebSdmSpl>() : (await _gcs.WebSdmSpl.AsNoTracking()
            .Where(s => idDisetujui.Contains(s.id) && s.jenis_spl == "Crash Program" && s.tgl_spl >= awalDt && s.tgl_spl <= akhirDt)
            .ToListAsync())
            .OrderBy(s => s.tgl_spl).ToList();

        var kejadian = new List<LemburCrashKejadianDto>();
        foreach (var spl in splRows)
        {
            var jam = (decimal)Math.Max(0, (spl.tgl_spl2 - spl.tgl_spl).TotalHours);
            var nominal = Math.Round(jam * tarif, 0, MidpointRounding.AwayFromZero);
            kejadian.Add(new LemburCrashKejadianDto(
                DateOnly.FromDateTime(spl.tgl_spl), spl.jam_mulai ?? "", spl.jam_selesai ?? "", jam, nominal));
        }

        var totalJam = kejadian.Sum(k => k.Jam);
        var total = kejadian.Sum(k => k.Nominal);
        return (true, null, new LemburCrashDto(
            nik, pegawai.nama ?? nik, tahun, bulan, bandValue, tarif, totalJam, total, kejadian, null));
    }

    // ===================== Tarif SPPD per Band (admin) =====================
    // Dipakai (1) nominal komponen SPPD sendiri dan (2) basis formula Uang Makan Dinas
    // rentang 75-150km. Komponen TJ_SPPD basis-nya 'Karyawan_Periode' (bukan 'Band') -
    // jadi TIDAK muncul di panel generik Pendapatan Dasar/Potongan Tunggal (yang cuma
    // menampilkan komponen basis Band/JG/PG). Endpoint SENDIRI, reuse tabel
    // gaji.tarif_tunggal (id_komponen milik TJ_SPPD, nilai=band) tanpa bergantung pada
    // kolom basis komponen.
    public async Task<TarifSppdDto> GetTarifSppdAsync(int tahun)
    {
        var idSppd = await _db.GajiKomponen.AsNoTracking()
            .Where(k => k.Kode == "TJ_SPPD").Select(k => (int?)k.IdKomponen).FirstOrDefaultAsync();
        if (idSppd is not int ids) return new TarifSppdDto(tahun, Array.Empty<TarifTunggalNilaiDto>());

        short th = (short)tahun;
        var rows = await _db.GajiTarifTunggal.AsNoTracking()
            .Where(t => t.IdKomponen == ids && t.TahunBerlaku == th)
            .ToListAsync();
        var nilai = BandLabel.Keys.OrderBy(x => x)
            .Select(n => new TarifTunggalNilaiDto(n, BandLabel[n], rows.FirstOrDefault(r => r.Nilai == n)?.Nominal ?? 0m))
            .ToList();
        return new TarifSppdDto(tahun, nilai);
    }

    public async Task<(bool Ok, string? Error)> SimpanTarifSppdAsync(SimpanTarifSppdRequest req)
    {
        var komponen = await _db.GajiKomponen.FirstOrDefaultAsync(k => k.Kode == "TJ_SPPD");
        if (komponen is null) return (false, "Komponen SPPD belum tersedia - jalankan migrasi terbaru.");

        short th = (short)req.Tahun;
        var existing = await _db.GajiTarifTunggal
            .Where(t => t.IdKomponen == komponen.IdKomponen && t.TahunBerlaku == th)
            .ToListAsync();
        foreach (var item in req.Items)
        {
            var row = existing.FirstOrDefault(e => e.Nilai == (short)item.Nilai);
            if (row is null)
            {
                _db.GajiTarifTunggal.Add(new Models.Gaji.GajiTarifTunggal
                {
                    IdKomponen = komponen.IdKomponen, Nilai = (short)item.Nilai, TahunBerlaku = th, Nominal = item.Nominal,
                });
            }
            else
            {
                row.Nominal = item.Nominal;
            }
        }
        await _db.SaveChangesAsync();
        return (true, null);
    }

    private async Task<decimal> TarifSppdBandAsync(int band, int tahun)
    {
        var idSppd = await _db.GajiKomponen.AsNoTracking()
            .Where(k => k.Kode == "TJ_SPPD").Select(k => (int?)k.IdKomponen).FirstOrDefaultAsync();
        if (idSppd is not int ids) return 0m;
        return await _db.GajiTarifTunggal.AsNoTracking()
            .Where(t => t.IdKomponen == ids && t.Nilai == (short)band && t.TahunBerlaku == (short)tahun)
            .Select(t => (decimal?)t.Nominal).FirstOrDefaultAsync() ?? 0m;
    }

    // ===================== Uang Makan Dinas (MAKAN_DINAS): hitung dari UMDL disetujui =====================
    // <75km -> Rp40.000 flat; 75-150km -> 20% dari tarif SPPD Band pegawai. Periode 16-15
    // (sama dgn komponen lain). Sumber rentang_km: dinas.bukti (jenis="UMDL", ref_id=UMDL.ID).
    private const decimal UmdlFlatDibawah75 = 40000m;
    private const decimal UmdlPersen75_150 = 0.20m;

    public async Task<(bool Ok, string? Error, UmdlFormulaDto? Data)> HitungUmdlAsync(string nik, int tahun, int bulan)
    {
        var pegawai = await _gcs.PegawaiSdm.AsNoTracking().FirstOrDefaultAsync(p => p.Nik == nik);
        if (pegawai is null) return (false, "Pegawai tidak ditemukan.", null);

        var (_, band, _) = await ResolveJabatanAsync(nik);
        if (band is not int bandValue)
        {
            return (true, null, new UmdlFormulaDto(
                nik, pegawai.nama ?? nik, tahun, bulan, band, 0m, 0m, Array.Empty<UmdlFormulaKejadianDto>(),
                "Jabatan/Band pegawai belum ditempatkan di sistem grading - tidak bisa menghitung formula UMDL."));
        }

        var tarifSppd = await TarifSppdBandAsync(bandValue, tahun);

        var akhir = new DateOnly(tahun, bulan, 15);
        var awal = akhir.AddMonths(-1).AddDays(1);
        var awalDt = awal.ToDateTime(TimeOnly.MinValue);
        var akhirDt = akhir.ToDateTime(TimeOnly.MaxValue);

        var approvalUmdl = await _db.ApprovalPengajuan.AsNoTracking()
            .Where(a => a.Jenis == "UMDL" && a.IdKaryawan == nik && a.Status == "Disetujui")
            .ToListAsync();
        var idDisetujui = approvalUmdl
            .Select(a => decimal.TryParse(a.RefId, out var rid) ? rid : (decimal?)null)
            .Where(x => x.HasValue).Select(x => x!.Value).ToHashSet();
        var umdlRows = idDisetujui.Count == 0 ? new List<Models.Gcs.WebSdmUmdl>() : (await _gcs.WebSdmUmdl.AsNoTracking()
            .Where(u => idDisetujui.Contains(u.ID) && u.TGL_UMDL >= awalDt && u.TGL_UMDL <= akhirDt)
            .ToListAsync())
            .OrderBy(u => u.TGL_UMDL).ToList();

        var kejadian = new List<UmdlFormulaKejadianDto>();
        foreach (var u in umdlRows)
        {
            var bukti = await _db.DinasBukti.AsNoTracking()
                .FirstOrDefaultAsync(b => b.Jenis == "UMDL" && b.RefId == u.ID.ToString());
            var tanggal = DateOnly.FromDateTime(u.TGL_UMDL);
            if (bukti is null)
            {
                kejadian.Add(new UmdlFormulaKejadianDto(tanggal, null, 0m, "Belum ada data rentang km (bukti dinas tidak ditemukan)."));
                continue;
            }
            decimal nominal = bukti.RentangKm switch
            {
                "<75" => UmdlFlatDibawah75,
                "75-150" => Math.Round(tarifSppd * UmdlPersen75_150, 0, MidpointRounding.AwayFromZero),
                _ => 0m,
            };
            string? peringatan = bukti.RentangKm is "<75" or "75-150" ? null : $"Rentang km tidak dikenal ({bukti.RentangKm}).";
            kejadian.Add(new UmdlFormulaKejadianDto(tanggal, bukti.RentangKm, nominal, peringatan));
        }

        var total = kejadian.Sum(k => k.Nominal);
        return (true, null, new UmdlFormulaDto(
            nik, pegawai.nama ?? nik, tahun, bulan, bandValue, tarifSppd, total, kejadian, null));
    }

    // ===================== SPPD (TJ_SPPD): hitung dari SPPD disetujui =====================
    // Nominal = tarif per Band x jumlah SPPD disetujui dalam periode (16-15). Tidak
    // bergantung rentang_km (SPPD selalu >150km, satu-satunya nilai valid).
    public async Task<(bool Ok, string? Error, SppdFormulaDto? Data)> HitungSppdAsync(string nik, int tahun, int bulan)
    {
        var pegawai = await _gcs.PegawaiSdm.AsNoTracking().FirstOrDefaultAsync(p => p.Nik == nik);
        if (pegawai is null) return (false, "Pegawai tidak ditemukan.", null);

        var (_, band, _) = await ResolveJabatanAsync(nik);
        if (band is not int bandValue)
        {
            return (true, null, new SppdFormulaDto(
                nik, pegawai.nama ?? nik, tahun, bulan, band, 0m, 0m, Array.Empty<SppdFormulaKejadianDto>(),
                "Jabatan/Band pegawai belum ditempatkan di sistem grading - tidak bisa menghitung tarif SPPD."));
        }

        var tarif = await TarifSppdBandAsync(bandValue, tahun);

        var akhir = new DateOnly(tahun, bulan, 15);
        var awal = akhir.AddMonths(-1).AddDays(1);
        var awalDt = awal.ToDateTime(TimeOnly.MinValue);
        var akhirDt = akhir.ToDateTime(TimeOnly.MaxValue);

        var approvalSppd = await _db.ApprovalPengajuan.AsNoTracking()
            .Where(a => a.Jenis == "SPPD" && a.IdKaryawan == nik && a.Status == "Disetujui")
            .ToListAsync();
        var idDisetujui = approvalSppd
            .Select(a => int.TryParse(a.RefId, out var rid) ? rid : (int?)null)
            .Where(x => x.HasValue).Select(x => x!.Value).ToHashSet();
        var sppdRows = idDisetujui.Count == 0 ? new List<Models.Gcs.WebSdmSppd>() : (await _gcs.WebSdmSppd.AsNoTracking()
            .Where(s => idDisetujui.Contains(s.id) && s.tgl_berangkat >= awalDt && s.tgl_berangkat <= akhirDt)
            .ToListAsync())
            .OrderBy(s => s.tgl_berangkat).ToList();

        var kejadian = sppdRows
            .Select(s => new SppdFormulaKejadianDto(DateOnly.FromDateTime(s.tgl_berangkat), s.tujuan_sppd, tarif))
            .ToList();

        var total = kejadian.Sum(k => k.Nominal);
        return (true, null, new SppdFormulaDto(
            nik, pegawai.nama ?? nik, tahun, bulan, bandValue, tarif, total, kejadian, null));
    }

    // ===================== Tarif Tunjangan Luar Daerah (TJ_LUAR) per Wilayah x Band =====================
    // Cakupan saat ini (dikonfirmasi user): 3 wilayah dari PEGAWAI_SDM.WILAYAH (Medan,
    // Lampung, Makassar) x Band III-VI. Tabel generik (gaji.tarif_wilayah) - wilayah/band
    // lain bisa ditambah admin lewat panel tanpa migrasi baru, cukup ubah daftar berikut.
    private static readonly string[] WilayahLuarDaerah = ["Medan", "Lampung", "Makassar"];
    private static readonly int[] BandLuarDaerah = [3, 4, 5, 6];

    public async Task<TarifWilayahDto> GetTarifWilayahAsync(int tahun)
    {
        var idLuar = await _db.GajiKomponen.AsNoTracking()
            .Where(k => k.Kode == "TJ_LUAR").Select(k => (int?)k.IdKomponen).FirstOrDefaultAsync();
        if (idLuar is not int idl) return new TarifWilayahDto(tahun, WilayahLuarDaerah, BandLuarDaerah, Array.Empty<TarifWilayahSelDto>());

        short th = (short)tahun;
        var rows = await _db.GajiTarifWilayah.AsNoTracking()
            .Where(t => t.IdKomponen == idl && t.TahunBerlaku == th)
            .ToListAsync();

        var nilai = new List<TarifWilayahSelDto>();
        foreach (var w in WilayahLuarDaerah)
        {
            foreach (var b in BandLuarDaerah)
            {
                var nominal = rows.FirstOrDefault(r => r.Wilayah == w && r.Band == b)?.Nominal ?? 0m;
                nilai.Add(new TarifWilayahSelDto(w, b, BandLabel.TryGetValue(b, out var bl) ? bl : $"Band {b}", nominal));
            }
        }
        return new TarifWilayahDto(tahun, WilayahLuarDaerah, BandLuarDaerah, nilai);
    }

    public async Task<(bool Ok, string? Error)> SimpanTarifWilayahAsync(SimpanTarifWilayahRequest req)
    {
        var komponen = await _db.GajiKomponen.FirstOrDefaultAsync(k => k.Kode == "TJ_LUAR");
        if (komponen is null) return (false, "Komponen Tunjangan Luar Daerah belum tersedia - jalankan migrasi terbaru.");

        short th = (short)req.Tahun;
        var existing = await _db.GajiTarifWilayah
            .Where(t => t.IdKomponen == komponen.IdKomponen && t.TahunBerlaku == th)
            .ToListAsync();
        foreach (var item in req.Items)
        {
            var row = existing.FirstOrDefault(e => e.Wilayah == item.Wilayah && e.Band == item.Band);
            if (row is null)
            {
                _db.GajiTarifWilayah.Add(new Models.Gaji.GajiTarifWilayah
                {
                    IdKomponen = komponen.IdKomponen, Wilayah = item.Wilayah, Band = (short)item.Band,
                    TahunBerlaku = th, Nominal = item.Nominal,
                });
            }
            else
            {
                row.Nominal = item.Nominal;
            }
        }
        await _db.SaveChangesAsync();
        return (true, null);
    }

    // Preview (TIDAK menyimpan) - berbeda dari UMDL/SPPD, Tunjangan Luar Daerah BUKAN
    // dihitung dari kejadian/pengajuan, melainkan wilayah kerja + Band pegawai SAAT INI
    // (tunjangan tetap selama pegawai bertugas di wilayah tsb).
    public async Task<(bool Ok, string? Error, LuarDaerahFormulaDto? Data)> HitungLuarDaerahAsync(string nik, int tahun, int bulan)
    {
        var pegawai = await _gcs.PegawaiSdm.AsNoTracking().FirstOrDefaultAsync(p => p.Nik == nik);
        if (pegawai is null) return (false, "Pegawai tidak ditemukan.", null);

        var (_, band, _) = await ResolveJabatanAsync(nik);
        var wilayah = pegawai.WILAYAH?.Trim();

        if (band is not int bandValue)
        {
            return (true, null, new LuarDaerahFormulaDto(
                nik, pegawai.nama ?? nik, tahun, bulan, wilayah, band, 0m,
                "Jabatan/Band pegawai belum ditempatkan di sistem grading - tidak bisa menghitung tunjangan luar daerah."));
        }
        if (string.IsNullOrWhiteSpace(wilayah) || !WilayahLuarDaerah.Contains(wilayah))
        {
            return (true, null, new LuarDaerahFormulaDto(
                nik, pegawai.nama ?? nik, tahun, bulan, wilayah, bandValue, 0m,
                $"Wilayah pegawai ({wilayah ?? "-"}) belum termasuk cakupan Tunjangan Luar Daerah ({string.Join("/", WilayahLuarDaerah)})."));
        }
        if (!BandLuarDaerah.Contains(bandValue))
        {
            return (true, null, new LuarDaerahFormulaDto(
                nik, pegawai.nama ?? nik, tahun, bulan, wilayah, bandValue, 0m,
                $"Band pegawai (Band {bandValue}) belum termasuk cakupan Tunjangan Luar Daerah (Band {BandLuarDaerah.Min()}-{BandLuarDaerah.Max()})."));
        }

        var idLuar = await _db.GajiKomponen.AsNoTracking()
            .Where(k => k.Kode == "TJ_LUAR").Select(k => (int?)k.IdKomponen).FirstOrDefaultAsync();
        var nominal = idLuar is int idl
            ? await _db.GajiTarifWilayah.AsNoTracking()
                .Where(t => t.IdKomponen == idl && t.Wilayah == wilayah && t.Band == (short)bandValue && t.TahunBerlaku == (short)tahun)
                .Select(t => (decimal?)t.Nominal).FirstOrDefaultAsync() ?? 0m
            : 0m;

        return (true, null, new LuarDaerahFormulaDto(nik, pegawai.nama ?? nik, tahun, bulan, wilayah, bandValue, nominal, null));
    }

    // ===================== Tunjangan PTS (TJ_PTS) =====================
    // Karyawan menggantikan SEMENTARA formasi atasannya yang kosong - ditandai admin
    // di panel Struktur Organisasi (grading.pejabat_sementara), BUKAN dihitung otomatis
    // dari struktur. Nominal = TJ_JABATAN jabatan asli + 80% x selisih TJ_JABATAN thd
    // jabatan pengganti - HANYA berlaku bila jabatan pengganti PERSIS 1 band di atas
    // jabatan asli (band lebih kecil = lebih tinggi, band 0=Direksi).
    public async Task<(bool Ok, string? Error, PtsFormulaDto? Data)> HitungTunjanganPtsAsync(string nik, int tahun, int bulan)
    {
        var pegawai = await _gcs.MstPegawai.AsNoTracking().FirstOrDefaultAsync(p => p.ID_KARYAWAN == nik);
        if (pegawai is null) return (false, "Pegawai tidak ditemukan.", null);
        var nama = pegawai.NAMA_LENGKAP ?? nik;

        var pts = await _db.GradingPejabatSementara.AsNoTracking()
            .FirstOrDefaultAsync(x => x.IdKaryawan == nik && x.Status == "Aktif");
        if (pts is null)
        {
            return (true, null, new PtsFormulaDto(
                nik, nama, tahun, bulan, null, null, 0m, 0m, 0m, 0m,
                "Belum ditandai sebagai Pemangku Tugas Sementara (PTS) di Struktur Organisasi."));
        }

        var (jgAsli, bandAsli, jabatanAsli) = await ResolveJabatanAsync(nik);
        var pengganti = await _db.GradingJabatan.AsNoTracking()
            .FirstOrDefaultAsync(j => j.IdJabatan == pts.IdJabatanPengganti);
        if (pengganti is null)
        {
            return (true, null, new PtsFormulaDto(
                nik, nama, tahun, bulan, jabatanAsli, null, 0m, 0m, 0m, 0m,
                "Jabatan pengganti pada penandaan PTS tidak ditemukan."));
        }

        if (bandAsli is not int bandAsliValue || jgAsli is not int jgAsliValue)
        {
            return (true, null, new PtsFormulaDto(
                nik, nama, tahun, bulan, jabatanAsli, pengganti.NamaJabatan, 0m, 0m, 0m, 0m,
                "Jabatan asli pegawai belum ditempatkan/di luar skala JG - tidak bisa menghitung Tunjangan PTS."));
        }
        if (pengganti.Jg is null)
        {
            return (true, null, new PtsFormulaDto(
                nik, nama, tahun, bulan, jabatanAsli, pengganti.NamaJabatan, 0m, 0m, 0m, 0m,
                "Jabatan pengganti di luar skala JG (Direksi) - tidak bisa dihitung otomatis."));
        }
        if (bandAsliValue - pengganti.IdBand != 1)
        {
            return (true, null, new PtsFormulaDto(
                nik, nama, tahun, bulan, jabatanAsli, pengganti.NamaJabatan, 0m, 0m, 0m, 0m,
                $"Jabatan pengganti ({pengganti.NamaJabatan}, Band {pengganti.IdBand}) bukan persis 1 tingkat di atas jabatan asli (Band {bandAsliValue}) - Tunjangan PTS tidak berlaku."));
        }

        var idTjJabatan = await _db.GajiKomponen.AsNoTracking()
            .Where(k => k.Kode == "TJ_JABATAN").Select(k => (int?)k.IdKomponen).FirstOrDefaultAsync();
        short th = (short)tahun;
        var tarif = idTjJabatan is int idtj
            ? await _db.GajiTarifTunggal.AsNoTracking()
                .Where(t => t.IdKomponen == idtj && t.TahunBerlaku == th && (t.Nilai == jgAsliValue || t.Nilai == pengganti.Jg))
                .ToListAsync()
            : new List<Models.Gaji.GajiTarifTunggal>();
        var tjAwal = tarif.FirstOrDefault(t => t.Nilai == jgAsliValue)?.Nominal ?? 0m;
        var tjPengganti = tarif.FirstOrDefault(t => t.Nilai == pengganti.Jg)?.Nominal ?? 0m;

        var selisih80 = Math.Round(0.8m * (tjPengganti - tjAwal), 0, MidpointRounding.AwayFromZero);
        var nominal = tjAwal + selisih80;

        return (true, null, new PtsFormulaDto(
            nik, nama, tahun, bulan, jabatanAsli, pengganti.NamaJabatan,
            tjAwal, tjPengganti, selisih80, nominal, null));
    }

    // ===================== Potongan BPJS Kesehatan (POT_BPJS_KES) =====================
    // Total dibayar ke BPJS Kes = 5% dari Pendapatan Dasar (capped): 4% perusahaan
    // (TJ_BPJS_KES) + 1% karyawan (base, SELALU dibebankan, bukan special case). Kalau
    // karyawan mengikutsertakan anggota keluarga lain (didaftarkan sendiri, My Personal >
    // Profil, gaji.tanggungan_lebih), tambahan 1% dari basis yg sama PER ORANG - tanpa
    // batas gratis (dikoreksi user 2026-08-11, menggantikan aturan lama ">3 gratis").
    private const decimal PersenBaseBpjsKes = 0.01m;
    private const decimal PersenPerTanggunganLebih = 0.01m;

    // Total "Pendapatan Dasar" (Gaji Pokok + Tunjangan Jabatan/Perumahan/Pangan/Angkutan)
    // pegawai - dipakai jg oleh Tunjangan BPJS Kesehatan/JHT/JKK/JKM/JP (lihat GetSlipAsync).
    // Duplikasi resolusi Band/JG/PG yg sama dgn GetSlipAsync (basis Band/JG/PG, Tipe
    // Pendapatan) - komponen ybs semuanya basis tarif_tunggal, TIDAK ada yg manual, jadi
    // aman dihitung terpisah dari sebuah slip.
    private async Task<decimal> PendapatanDasarTotalAsync(string nik, int tahun)
    {
        var (jg, band, _) = await ResolveJabatanAsync(nik);
        var pg = await ResolvePgAsync(nik, tahun);

        var komponen = await _db.GajiKomponen.AsNoTracking()
            .Where(k => k.Aktif && k.Tipe == "Pendapatan" && (k.Basis == "Band" || k.Basis == "JG" || k.Basis == "PG"))
            .ToListAsync();
        if (komponen.Count == 0) return 0m;

        short th = (short)tahun;
        var ids = komponen.Select(k => k.IdKomponen).ToList();
        var rows = await _db.GajiTarifTunggal.AsNoTracking()
            .Where(t => t.TahunBerlaku == th && ids.Contains(t.IdKomponen))
            .ToListAsync();

        decimal total = 0;
        foreach (var k in komponen)
        {
            int? nilaiPegawai = k.Basis switch { "Band" => band, "JG" => jg, "PG" => pg, _ => null };
            if (nilaiPegawai is int np)
            {
                var match = rows.FirstOrDefault(r => r.IdKomponen == k.IdKomponen && r.Nilai == np);
                if (match is not null) total += match.Nominal;
            }
        }
        return total;
    }

    // Preview (TIDAK menyimpan). Base 1% SELALU dihitung; tambahan 1% per anggota
    // keluarga lain yg didaftarkan sendiri (gaji.tanggungan_lebih, My Personal > Profil,
    // TIDAK ada baris = 0 tanggungan tambahan, base 1% tetap berlaku). Basis dibatasi
    // dgn nilai FormulaBatas komponen TJ_BPJS_KES supaya konsisten dgn sisi perusahaan.
    public async Task<(bool Ok, string? Error, BpjsKesPotonganDto? Data)> HitungBpjsKesPotonganAsync(string nik, int tahun, int bulan)
    {
        var pegawai = await _gcs.MstPegawai.AsNoTracking().FirstOrDefaultAsync(p => p.ID_KARYAWAN == nik);
        if (pegawai is null) return (false, "Pegawai tidak ditemukan.", null);

        var daftar = await _db.GajiTanggunganLebih.AsNoTracking().FirstOrDefaultAsync(t => t.IdKaryawan == nik);
        var jumlahTanggungan = daftar?.JumlahTanggungan ?? 0;

        var pendapatanDasar = await PendapatanDasarTotalAsync(nik, tahun);
        var batas = await _db.GajiKomponen.AsNoTracking()
            .Where(k => k.Kode == "TJ_BPJS_KES").Select(k => k.FormulaBatas).FirstOrDefaultAsync();
        var basis = batas is decimal b ? Math.Min(pendapatanDasar, b) : pendapatanDasar;

        var persenTotal = PersenBaseBpjsKes + (jumlahTanggungan * PersenPerTanggunganLebih);
        var nominal = Math.Round(persenTotal * basis, 0, MidpointRounding.AwayFromZero);

        return (true, null, new BpjsKesPotonganDto(
            nik, pegawai.NAMA_LENGKAP, tahun, bulan, jumlahTanggungan, persenTotal * 100m,
            basis, nominal, null));
    }

    // ===================== Pendaftaran mandiri anggota keluarga lain BPJS Kesehatan (self-service) =====================
    public async Task<TanggunganBpjsDto> GetTanggunganBpjsAsync(string nik)
    {
        var row = await _db.GajiTanggunganLebih.AsNoTracking().FirstOrDefaultAsync(t => t.IdKaryawan == nik);
        return row is null
            ? new TanggunganBpjsDto(null, null, null, null)
            : new TanggunganBpjsDto(row.JumlahTanggungan, row.Keterangan, row.DibuatPada, row.DiubahPada);
    }

    public async Task<(bool Ok, string? Error)> SimpanTanggunganBpjsAsync(string nik, SimpanTanggunganBpjsRequest req)
    {
        if (req.JumlahTanggungan <= 0)
        {
            return (false, "Jumlah anggota keluarga lain yang diikutsertakan harus minimal 1.");
        }

        var row = await _db.GajiTanggunganLebih.FirstOrDefaultAsync(t => t.IdKaryawan == nik);
        if (row is null)
        {
            _db.GajiTanggunganLebih.Add(new Models.Gaji.GajiTanggunganLebih
            {
                IdKaryawan = nik, JumlahTanggungan = req.JumlahTanggungan,
                Keterangan = string.IsNullOrWhiteSpace(req.Keterangan) ? null : req.Keterangan.Trim(),
                DibuatPada = DateTime.UtcNow,
            });
        }
        else
        {
            row.JumlahTanggungan = req.JumlahTanggungan;
            row.Keterangan = string.IsNullOrWhiteSpace(req.Keterangan) ? null : req.Keterangan.Trim();
            row.DiubahPada = DateTime.UtcNow;
        }
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task HapusTanggunganBpjsAsync(string nik)
    {
        var row = await _db.GajiTanggunganLebih.FirstOrDefaultAsync(t => t.IdKaryawan == nik);
        if (row is not null)
        {
            _db.GajiTanggunganLebih.Remove(row);
            await _db.SaveChangesAsync();
        }
    }

    private async Task<List<int>> ReadIntsAsync(string sql)
    {
        var conn = _db.Database.GetDbConnection();
        var mustClose = conn.State != ConnectionState.Open;
        if (mustClose) await conn.OpenAsync();
        try
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = sql;
            var list = new List<int>();
            await using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync())
            {
                if (!r.IsDBNull(0)) list.Add(Convert.ToInt32(r.GetValue(0)));
            }
            return list;
        }
        finally
        {
            if (mustClose) await conn.CloseAsync();
        }
    }
}

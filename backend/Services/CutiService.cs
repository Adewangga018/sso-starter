using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SsoBackend.Data;
using SsoBackend.Models.Cuti;
using SsoBackend.Models.Dto;

namespace SsoBackend.Services;

// Cuti tahunan MyGCS (disederhanakan): saldo cutoff (cuti.saldo) + pengajuan (cuti.pengajuan).
// Atasan menyetujui -> saldo pemohon berkurang. Cuti bersama tidak diurus.
public class CutiService
{
    private readonly ApplicationDbContext _db;   // cuti.* + grading.* (db_mygcs)
    private readonly GcsDbContext _gcs;           // riwayat SDM lama
    private readonly ModuleAccessService _access; // hak Admin Modul SDM
    private readonly ILogger<CutiService> _log;

    public CutiService(ApplicationDbContext db, GcsDbContext gcs, ModuleAccessService access, ILogger<CutiService> log)
    {
        _db = db;
        _gcs = gcs;
        _access = access;
        _log = log;
    }

    public async Task<CutiDto> GetAsync(string nik)
    {
        // Dimuat tracked agar bisa di-reset bila periode sudah berganti tahun.
        var saldo = await _db.CutiSaldo.FirstOrDefaultAsync(s => s.IdKaryawan == nik);
        if (saldo is not null) await ResetJikaPeriodeBaruAsync(saldo);

        var pengajuanRows = await _db.CutiPengajuan.AsNoTracking()
            .Where(p => p.IdKaryawan == nik).OrderByDescending(p => p.Id).Take(50).ToListAsync();
        var persetujuanRows = await _db.CutiPengajuan.AsNoTracking()
            .Where(p => p.IdAtasan == nik && p.Status == "Menunggu").OrderBy(p => p.Id).ToListAsync();

        // Riwayat cuti tahunan dari SDM lama. Bersifat PELENGKAP: view intranet.vw_web_sdm_cuti
        // memanggil fungsi legacy GCSSDM.dbo.getPerJabatan yang butuh izin EXECUTE tersendiri
        // bagi login aplikasi (di dev pakai 'sa' → jalan; di prod 'svc_mygcs' bisa belum diberi
        // izin). Kalau gagal, JANGAN jatuhkan seluruh halaman Cuti — tampilkan tanpa riwayat.
        var riwayat = new List<CutiRiwayatDto>();
        try
        {
            var riwRows = await _gcs.WebSdmCutiView
                .Where(c => c.IdUser == nik && c.ListJenis == "Tahunan")
                .OrderByDescending(c => c.TglInput).Take(50).ToListAsync();
            riwayat = riwRows.Select(c => new CutiRiwayatDto(
                c.KodeCuti,
                c.TglInput.HasValue ? DateOnly.FromDateTime(c.TglInput.Value) : (DateOnly?)null,
                c.Keterangan, c.Status ?? "-",
                c.TglApprove.HasValue ? DateOnly.FromDateTime(c.TglApprove.Value) : (DateOnly?)null)).ToList();
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex,
                "Gagal memuat riwayat cuti SDM untuk {Nik}; menampilkan halaman Cuti tanpa riwayat. " +
                "Jika ini permission (EXECUTE getPerJabatan), beri izin ke login aplikasi di server.", nik);
        }

        var setelan = await GetOrInitSetelanAsync();
        var isAdminSdm = await _access.IsSdmAdminAsync(nik);

        var cbList = await _db.CutiBersama.AsNoTracking()
            .OrderByDescending(x => x.TglMulai)
            .Select(x => new CutiBersamaDto(x.Id, x.TglMulai, x.TglSelesai, x.JumlahHari, x.Keterangan, x.MengurangiHak, x.Tahun))
            .ToListAsync();
        var nasList = await _db.CutiNasional.AsNoTracking()
            .OrderByDescending(x => x.TglMulai)
            .Select(x => new CutiNasionalDto(x.Id, x.TglMulai, x.TglSelesai, x.JumlahHari, x.Keterangan, x.Tahun))
            .ToListAsync();

        return new CutiDto(
            Sisa: saldo?.Saldo ?? 0,
            AdaData: saldo is not null,
            Periode: saldo?.Periode,
            Tmt: saldo?.Tmt,
            Akrual: saldo?.Akrual ?? 0,
            Hak: saldo?.Hak ?? 0,
            Diambil: saldo?.Diambil ?? 0,
            CutiBersama: saldo?.CutiBersama ?? 0,
            HakPerTahun: setelan.HakPerTahun,
            BatasAkumulasi: setelan.BatasAkumulasi,
            BisaApprove: persetujuanRows.Count > 0,
            IsAdminSdm: isAdminSdm,
            Pengajuan: pengajuanRows.Select(Map).ToList(),
            Persetujuan: persetujuanRows.Select(Map).ToList(),
            Riwayat: riwayat,
            CutiBersamaList: cbList,
            CutiNasionalList: nasList);
    }

    // ==== Cuti Bersama (CRUD, Admin SDM). mengurangi_hak → potong saldo semua ====
    public async Task<(bool Ok, string? Error, long Id)> CreateCutiBersamaAsync(string nik, string? nama, SimpanCutiBersamaRequest req)
    {
        if (!await _access.IsSdmAdminAsync(nik)) return (false, ForbidSdm, 0);
        var (ok, err, hari) = ValidasiRentang(req.TglMulai, req.TglSelesai, req.Keterangan);
        if (!ok) return (false, err, 0);
        var cb = new CutiBersama
        {
            TglMulai = req.TglMulai, TglSelesai = req.TglSelesai, JumlahHari = hari,
            Keterangan = req.Keterangan.Trim(), MengurangiHak = req.MengurangiHak,
            Tahun = req.TglMulai.Year, IdPembuat = nik, NamaPembuat = nama, DibuatPada = DateTime.UtcNow,
        };
        _db.CutiBersama.Add(cb);
        await _db.SaveChangesAsync();
        await RecomputeSaldoAsync(TahunSekarang());
        return (true, null, cb.Id);
    }

    public async Task<(bool Ok, string? Error)> UpdateCutiBersamaAsync(string nik, long id, SimpanCutiBersamaRequest req)
    {
        if (!await _access.IsSdmAdminAsync(nik)) return (false, ForbidSdm);
        var (ok, err, hari) = ValidasiRentang(req.TglMulai, req.TglSelesai, req.Keterangan);
        if (!ok) return (false, err);
        var cb = await _db.CutiBersama.FirstOrDefaultAsync(x => x.Id == id);
        if (cb is null) return (false, "Cuti bersama tidak ditemukan.");
        cb.TglMulai = req.TglMulai; cb.TglSelesai = req.TglSelesai; cb.JumlahHari = hari;
        cb.Keterangan = req.Keterangan.Trim(); cb.MengurangiHak = req.MengurangiHak;
        cb.Tahun = req.TglMulai.Year; cb.DiubahPada = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await RecomputeSaldoAsync(TahunSekarang());
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> DeleteCutiBersamaAsync(string nik, long id)
    {
        if (!await _access.IsSdmAdminAsync(nik)) return (false, ForbidSdm);
        var cb = await _db.CutiBersama.FirstOrDefaultAsync(x => x.Id == id);
        if (cb is null) return (false, "Cuti bersama tidak ditemukan.");
        _db.CutiBersama.Remove(cb);
        await _db.SaveChangesAsync();
        await RecomputeSaldoAsync(TahunSekarang());
        return (true, null);
    }

    // ==== Cuti Nasional (CRUD, Admin SDM). TIDAK memotong hak ====
    public async Task<(bool Ok, string? Error, long Id)> CreateCutiNasionalAsync(string nik, string? nama, SimpanCutiNasionalRequest req)
    {
        if (!await _access.IsSdmAdminAsync(nik)) return (false, ForbidSdm, 0);
        var (ok, err, hari) = ValidasiRentang(req.TglMulai, req.TglSelesai, req.Keterangan);
        if (!ok) return (false, err, 0);
        var n = new CutiNasional
        {
            TglMulai = req.TglMulai, TglSelesai = req.TglSelesai, JumlahHari = hari,
            Keterangan = req.Keterangan.Trim(), Tahun = req.TglMulai.Year,
            IdPembuat = nik, NamaPembuat = nama, DibuatPada = DateTime.UtcNow,
        };
        _db.CutiNasional.Add(n);
        await _db.SaveChangesAsync();
        return (true, null, n.Id);
    }

    public async Task<(bool Ok, string? Error)> UpdateCutiNasionalAsync(string nik, long id, SimpanCutiNasionalRequest req)
    {
        if (!await _access.IsSdmAdminAsync(nik)) return (false, ForbidSdm);
        var (ok, err, hari) = ValidasiRentang(req.TglMulai, req.TglSelesai, req.Keterangan);
        if (!ok) return (false, err);
        var n = await _db.CutiNasional.FirstOrDefaultAsync(x => x.Id == id);
        if (n is null) return (false, "Cuti nasional tidak ditemukan.");
        n.TglMulai = req.TglMulai; n.TglSelesai = req.TglSelesai; n.JumlahHari = hari;
        n.Keterangan = req.Keterangan.Trim(); n.Tahun = req.TglMulai.Year; n.DiubahPada = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> DeleteCutiNasionalAsync(string nik, long id)
    {
        if (!await _access.IsSdmAdminAsync(nik)) return (false, ForbidSdm);
        var n = await _db.CutiNasional.FirstOrDefaultAsync(x => x.Id == id);
        if (n is null) return (false, "Cuti nasional tidak ditemukan.");
        _db.CutiNasional.Remove(n);
        await _db.SaveChangesAsync();
        return (true, null);
    }

    private const string ForbidSdm = "Hanya Admin Modul SDM yang dapat mengelola cuti bersama/nasional.";

    private static (bool Ok, string? Error, int Hari) ValidasiRentang(DateOnly mulai, DateOnly selesai, string? ket)
    {
        if (string.IsNullOrWhiteSpace(ket)) return (false, "Keterangan wajib diisi.", 0);
        if (selesai < mulai) return (false, "Tanggal selesai tidak boleh sebelum tanggal mulai.", 0);
        var hari = HitungHariKerja(mulai, selesai);
        if (hari <= 0) return (false, "Rentang tanggal tidak mengandung hari kerja (Senin–Jumat).", 0);
        return (true, null, hari);
    }

    // Total hari cuti bersama yang MENGURANGI hak pada tahun periode.
    private async Task<int> CutiBersamaPengurangAsync(int tahun) =>
        await _db.CutiBersama.Where(x => x.MengurangiHak && x.Tahun == tahun).SumAsync(x => (int?)x.JumlahHari) ?? 0;

    // Hitung ulang saldo SEMUA karyawan pada periode `tahun`:
    // cuti_bersama = total pengurang; hak = akrual - cuti_bersama; saldo = hak - diambil.
    private async Task RecomputeSaldoAsync(int tahun)
    {
        var total = await CutiBersamaPengurangAsync(tahun);
        var periode = $"{tahun}-{tahun + 1}";
        await _db.Database.ExecuteSqlRawAsync(
            "UPDATE cuti.saldo SET cuti_bersama = {0}, hak = akrual - {0}, saldo = akrual - {0} - diambil, " +
            "diperbarui_pada = SYSUTCDATETIME() WHERE periode = {1}",
            total, periode);
    }

    private static int TahunSekarang() => DateTime.UtcNow.AddHours(7).Year;
    private static int TahunPeriode(string periode) =>
        int.TryParse(periode.Split('-')[0], out var y) ? y : TahunSekarang();

    // Periode cuti berjalan = "{tahun}-{tahun+1}" berdasarkan tanggal WIB. Berganti
    // otomatis tiap 1 Januari (mis. 2026-2027, lalu 2027-2028).
    public static string PeriodeSekarang()
    {
        var wib = DateTime.UtcNow.AddHours(7);
        return $"{wib.Year}-{wib.Year + 1}";
    }

    // Reset saldo bila periode karyawan sudah bukan periode berjalan (pergantian tahun).
    // Akrual DI MUKA: sisa tahun lalu + hak/tahun (12), DIBATASI batas_akumulasi (24).
    // Lalu dikurangi cuti bersama (yang mengurangi hak) untuk periode baru. diambil = 0.
    // Dipanggil saat karyawan membuka/mengajukan cuti — "berjalan & reset tiap tahun".
    private async Task ResetJikaPeriodeBaruAsync(CutiSaldo saldo)
    {
        var periodeNow = PeriodeSekarang();
        if (saldo.Periode == periodeNow) return;

        var setelan = await GetOrInitSetelanAsync();
        var akrual = Math.Min(setelan.BatasAkumulasi, saldo.Saldo + setelan.HakPerTahun);
        if (akrual < 0) akrual = 0;
        var cbTotal = await CutiBersamaPengurangAsync(TahunPeriode(periodeNow));
        saldo.Periode = periodeNow;
        saldo.Akrual = akrual;
        saldo.CutiBersama = cbTotal;
        saldo.Hak = akrual - cbTotal;
        saldo.Diambil = 0;
        saldo.Saldo = akrual - cbTotal;
        saldo.TglCutoff = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        saldo.DiperbaruiPada = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    private async Task<CutiSetelan> GetOrInitSetelanAsync()
    {
        var s = await _db.CutiSetelan.FirstOrDefaultAsync(x => x.Id == 1);
        if (s is null)
        {
            s = new CutiSetelan { Id = 1, HakDasar = 24, CutiBersama = 0, HakPerTahun = 12, BatasAkumulasi = 24 };
            _db.CutiSetelan.Add(s);
            await _db.SaveChangesAsync();
        }
        return s;
    }

    public async Task<(bool Ok, string? Error, CutiPengajuan? Created)> AjukanAsync(string nik, string? nama, AjukanCutiRequest req)
    {
        if (req.TglSelesai < req.TglMulai)
        {
            return (false, "Tanggal selesai tidak boleh sebelum tanggal mulai.", null);
        }
        var jumlah = HitungHariKerja(req.TglMulai, req.TglSelesai);
        if (jumlah <= 0)
        {
            return (false, "Rentang tanggal tidak mengandung hari kerja (Senin–Jumat).", null);
        }
        var saldo = await _db.CutiSaldo.FirstOrDefaultAsync(s => s.IdKaryawan == nik);
        if (saldo is null)
        {
            return (false, "Saldo cuti belum tersedia untuk akun Anda.", null);
        }
        await ResetJikaPeriodeBaruAsync(saldo);
        var pendingTotal = await _db.CutiPengajuan
            .Where(p => p.IdKaryawan == nik && p.Status == "Menunggu")
            .SumAsync(p => (int?)p.JumlahHari) ?? 0;
        var tersedia = saldo.Saldo - pendingTotal;
        if (jumlah > tersedia)
        {
            return (false, $"Jumlah hari ({jumlah}) melebihi sisa cuti tersedia ({tersedia}).", null);
        }

        var atasan = await ResolveAtasanAsync(nik);
        var pengajuan = new CutiPengajuan
        {
            IdKaryawan = nik,
            Nama = nama,
            IdAtasan = atasan,
            TglMulai = req.TglMulai,
            TglSelesai = req.TglSelesai,
            JumlahHari = jumlah,
            Keterangan = string.IsNullOrWhiteSpace(req.Keterangan) ? null : req.Keterangan.Trim(),
            Status = "Menunggu",
            TglPengajuan = DateTime.UtcNow,
        };
        _db.CutiPengajuan.Add(pengajuan);
        await _db.SaveChangesAsync();
        return (true, null, pengajuan);
    }

    public async Task<(bool Ok, string? Error)> BatalAsync(long id, string nik)
    {
        var p = await _db.CutiPengajuan.FirstOrDefaultAsync(x => x.Id == id);
        if (p is null) return (false, "Pengajuan tidak ditemukan.");
        if (p.IdKaryawan != nik) return (false, "Ini bukan pengajuan Anda.");
        if (p.Status != "Menunggu") return (false, "Hanya pengajuan berstatus Menunggu yang bisa dibatalkan.");
        p.Status = "Batal";
        p.TglKeputusan = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> PutusanAsync(long id, string nikAtasan, bool setuju, string? komentar)
    {
        var p = await _db.CutiPengajuan.FirstOrDefaultAsync(x => x.Id == id);
        if (p is null) return (false, "Pengajuan tidak ditemukan.");
        if (p.IdAtasan != nikAtasan) return (false, "Anda bukan atasan yang berhak menyetujui pengajuan ini.");
        if (p.Status != "Menunggu") return (false, "Pengajuan sudah diproses.");

        var now = DateTime.UtcNow;
        if (setuju)
        {
            var saldo = await _db.CutiSaldo.FirstOrDefaultAsync(s => s.IdKaryawan == p.IdKaryawan);
            if (saldo is null) return (false, "Saldo pemohon tidak ditemukan.");
            if (p.JumlahHari > saldo.Saldo) return (false, "Sisa cuti pemohon tidak mencukupi.");
            saldo.Saldo -= p.JumlahHari;
            saldo.Diambil += p.JumlahHari;
            saldo.DiperbaruiPada = now;
            p.Status = "Disetujui";
        }
        else
        {
            p.Status = "Ditolak";
        }
        p.Komentar = string.IsNullOrWhiteSpace(komentar) ? null : komentar.Trim();
        p.TglKeputusan = now;

        // Sinkronkan baris di Kotak Persetujuan terpadu (approval.pengajuan) supaya
        // status konsisten baik keputusan dibuat dari halaman Cuti maupun dari
        // Kotak Persetujuan. Satu transaksi bersama cuti.pengajuan + saldo.
        var appr = await _db.ApprovalPengajuan
            .FirstOrDefaultAsync(x => x.Jenis == "Cuti" && x.RefId == id.ToString());
        if (appr is not null && appr.Status == "Menunggu")
        {
            appr.Status = p.Status;
            appr.Komentar = p.Komentar;
            appr.TglKeputusan = now;
        }

        await _db.SaveChangesAsync();
        return (true, null);
    }

    // ---- helper ----

    private static CutiPengajuanDto Map(CutiPengajuan p) => new(
        p.Id, p.IdKaryawan, p.Nama, p.TglMulai, p.TglSelesai, p.JumlahHari,
        p.Keterangan, p.Status, p.Komentar, p.TglPengajuan, p.TglKeputusan);

    // Jumlah hari kerja (Senin–Jumat) dalam rentang inklusif.
    private static int HitungHariKerja(DateOnly dari, DateOnly sampai)
    {
        var n = 0;
        for (var d = dari; d <= sampai; d = d.AddDays(1))
        {
            if (d.DayOfWeek is not (DayOfWeek.Saturday or DayOfWeek.Sunday)) n++;
        }
        return n;
    }

    // Penyetuju = MANAGER TERKAIT: ancestor terdekat pada band Manager-ke-atas (urutan <= 2,
    // yaitu Manager/GM/Direksi) yang jabatannya terisi. Bila tak ada (mis. pemohon sudah
    // Manager/GM), fallback ke atasan (ancestor) terdekat mana pun.
    private Task<string?> ResolveAtasanAsync(string nik) => ResolveManagerAsync(nik);

    private async Task<string?> ResolveManagerAsync(string nik)
    {
        var conn = _db.Database.GetDbConnection();
        var mustClose = conn.State != ConnectionState.Open;
        if (mustClose) await conn.OpenAsync();
        try
        {
            // 1) Manager terkait (band urutan <= 2), ancestor terdekat.
            var manager = await ScalarAsync(conn, @"
                SELECT TOP 1 pa.id_karyawan
                FROM grading.penempatan p
                JOIN grading.jabatan_hirarki h ON h.id_jabatan_bawahan = p.id_jabatan AND h.kedalaman > 0
                JOIN grading.jabatan ja ON ja.id_jabatan = h.id_jabatan_atasan
                JOIN grading.band   ba ON ba.id_band   = ja.id_band AND ba.urutan <= 2
                JOIN grading.penempatan pa ON pa.id_jabatan = ja.id_jabatan AND pa.status = 'Aktif'
                WHERE p.id_karyawan = @nik AND p.status = 'Aktif'
                ORDER BY h.kedalaman ASC", nik);
            if (!string.IsNullOrWhiteSpace(manager))
            {
                return manager;
            }
            // 2) Fallback: ancestor (atasan) terdekat mana pun yang terisi.
            return await ScalarAsync(conn, @"
                SELECT TOP 1 pa.id_karyawan
                FROM grading.penempatan p
                JOIN grading.jabatan_hirarki h ON h.id_jabatan_bawahan = p.id_jabatan AND h.kedalaman > 0
                JOIN grading.jabatan ja ON ja.id_jabatan = h.id_jabatan_atasan
                JOIN grading.penempatan pa ON pa.id_jabatan = ja.id_jabatan AND pa.status = 'Aktif'
                WHERE p.id_karyawan = @nik AND p.status = 'Aktif'
                ORDER BY h.kedalaman ASC", nik);
        }
        finally
        {
            if (mustClose) await conn.CloseAsync();
        }
    }

    private static async Task<string?> ScalarAsync(System.Data.Common.DbConnection conn, string sql, string nik)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        var pr = cmd.CreateParameter();
        pr.ParameterName = "@nik";
        pr.Value = nik;
        cmd.Parameters.Add(pr);
        return (await cmd.ExecuteScalarAsync()) as string;
    }
}

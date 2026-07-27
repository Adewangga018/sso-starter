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

    public GajiService(ApplicationDbContext db) => _db = db;

    private static readonly string[] BulanId =
        { "", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
          "Agustus", "September", "Oktober", "November", "Desember" };

    private static readonly string[] UrutanPendapatan =
        { "Gaji Pokok", "Tunjangan Tetap", "Tunjangan Tidak Tetap", "Tunjangan Lain" };
    private static readonly string[] UrutanPotongan =
        { "Potongan Tetap", "Potongan Tidak Tetap" };

    public async Task<GajiSlipDto> GetSlipAsync(string nik, string nama, int tahun, int bulan)
    {
        var (jg, band, jabatan) = await ResolveJabatanAsync(nik);
        var pg = await ResolvePgAsync(nik, tahun);
        var tingkatan = PosisiResolver.TingkatanDariBand(band);

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

        // Slip tersimpan (kalau sudah digenerate) -> nominal manual + potongan terlambat.
        var manual = new Dictionary<int, decimal>();
        decimal potonganTerlambat = 0;
        var periode = await _db.GajiPeriode.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Tahun == (short)tahun && p.Bulan == (byte)bulan);
        if (periode is not null)
        {
            var slip = await _db.GajiSlip.AsNoTracking()
                .FirstOrDefaultAsync(s => s.IdPeriode == periode.IdPeriode && s.IdKaryawan == nik);
            if (slip is not null)
            {
                potonganTerlambat = slip.PotonganTerlambat;
                manual = await _db.GajiSlipDetail.AsNoTracking()
                    .Where(d => d.IdSlip == slip.IdSlip)
                    .ToDictionaryAsync(d => d.IdKomponen, d => d.Nominal);
            }
        }

        decimal Nominal(int id, string basis) =>
            manual.TryGetValue(id, out var m) ? m
            : basis == "JG_PG" && tarif.TryGetValue(id, out var t) ? t
            : 0m;

        var pendapatan = BuildGrup(komponen, "Pendapatan", UrutanPendapatan, Nominal);
        var potongan = BuildGrup(komponen, "Potongan", UrutanPotongan, Nominal);

        var totalPendapatan = pendapatan.Sum(g => g.Subtotal);
        var totalPotongan = potongan.Sum(g => g.Subtotal);
        var gajiBersih = totalPendapatan - potonganTerlambat - totalPotongan;
        var belumDiisi = totalPendapatan == 0 && totalPotongan == 0 && potonganTerlambat == 0;

        var catatan = "Potongan keterlambatan presensi langsung mengurangi Tunjangan Pangan & Tunjangan Angkutan.";

        return new GajiSlipDto(
            tahun, bulan, BulanId[bulan], nama, jabatan, tingkatan, band, jg, pg,
            pendapatan, potongan, totalPendapatan, totalPotongan, potonganTerlambat, gajiBersih,
            belumDiisi, catatan);
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
                    k.Opsional, k.KenaPotonganTerlambat, k.Basis, k.Keterangan))
                .ToList();
            if (items.Count == 0) continue;
            grup.Add(new GajiGrupDto(kategori, items, items.Sum(i => i.Nominal)));
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

    // Pilihan JG (dari grading.job_grade) & PG (dari grading.person_grade yang ada).
    public async Task<GajiGradeOpsiDto> GetGradeOpsiAsync()
    {
        var jg = await ReadIntsAsync("SELECT jg FROM grading.job_grade ORDER BY jg");
        var pg = await ReadIntsAsync("SELECT DISTINCT pg FROM grading.person_grade ORDER BY pg");
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
            tarif.TryGetValue(k.IdKomponen, out var n) ? n : 0m)).ToList();
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

using System.Data;
using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using SsoBackend.Data;
using SsoBackend.Models.Coaching;
using SsoBackend.Models.Dto;

namespace SsoBackend.Services;

// Coaching & Diskusi Tim (My Team). Async, thread-based. Dua kanal:
//  - Sesi 1-on-1 privat (atasan langsung <-> bawahan langsung efektif) + tindak lanjut.
//  - Ruang tim (grup): pemilik = atasan; anggota = atasan + bawahan langsung efektifnya.
// "Efektif" = memakai ancestor TERISI terdekat (melewati jabatan yang kosong).
public class CoachingService
{
    private readonly ApplicationDbContext _db;

    public CoachingService(ApplicationDbContext db) => _db = db;

    // ===================== Inbox =====================
    public async Task<CoachingInboxDto> GetInboxAsync(string nik)
    {
        var sesiRows = await _db.CoachingSesi.AsNoTracking()
            .Where(s => s.IdAtasan == nik || s.IdBawahan == nik)
            .OrderByDescending(s => s.TglTerakhir ?? s.TglDibuat)
            .Take(100).ToListAsync();

        var ids = sesiRows.Select(s => s.Id).ToList();
        var lastBySesi = await LastPesanBySesiAsync(ids);

        var sesi = sesiRows.Select(s =>
        {
            var akuAtasan = s.IdAtasan == nik;
            var lawanNik = akuAtasan ? s.IdBawahan : s.IdAtasan;
            var lawanNama = akuAtasan ? s.NamaBawahan : s.NamaAtasan;
            var peranLawan = akuAtasan ? "Bawahan" : "Atasan";
            lastBySesi.TryGetValue(s.Id, out var last);
            return new CoachingSesiRingkasDto(s.Id, lawanNik, lawanNama, peranLawan, s.Topik, s.Status,
                last?.Isi, last?.TglKirim ?? s.TglTerakhir);
        }).ToList();

        // Ruang tim: milik atasan efektif (anggota) + milik sendiri (pemilik) bila punya bawahan.
        var ruang = new List<CoachingRuangRingkasDto>();
        var atasan = await EffectiveAtasanAsync(nik);
        if (atasan is not null)
        {
            var anggota = await EffectiveBawahanAsync(atasan.Value.Nik);
            var last = await LastPesanRuangAsync(atasan.Value.Nik);
            ruang.Add(new CoachingRuangRingkasDto(atasan.Value.Nik, atasan.Value.Nama, "Anggota", anggota.Count + 1, last?.Isi, last?.TglKirim));
        }
        var bawahanSaya = await EffectiveBawahanAsync(nik);
        if (bawahanSaya.Count > 0)
        {
            var last = await LastPesanRuangAsync(nik);
            ruang.Add(new CoachingRuangRingkasDto(nik, null, "Pemilik", bawahanSaya.Count + 1, last?.Isi, last?.TglKirim));
        }

        return new CoachingInboxDto(sesi, ruang);
    }

    // Kandidat lawan bicara sesi baru: atasan langsung + bawahan langsung efektif.
    public async Task<IReadOnlyList<LawanBicaraDto>> GetLawanBicaraAsync(string nik)
    {
        var list = new List<LawanBicaraDto>();
        var atasan = await EffectiveAtasanAsync(nik);
        if (atasan is not null)
        {
            list.Add(new LawanBicaraDto(atasan.Value.Nik, atasan.Value.Nama ?? atasan.Value.Nik, atasan.Value.Jabatan, "Atasan"));
        }
        foreach (var b in await EffectiveBawahanAsync(nik))
        {
            list.Add(new LawanBicaraDto(b.Nik, b.Nama, b.Jabatan, "Bawahan"));
        }
        return list;
    }

    // ===================== Sesi 1-on-1 =====================
    public async Task<(bool Ok, string? Error, long Id)> CreateSesiAsync(string nik, string? nama, string targetNik, string topik)
    {
        if (string.IsNullOrWhiteSpace(topik)) return (false, "Topik wajib diisi.", 0);
        if (string.Equals(targetNik, nik, StringComparison.OrdinalIgnoreCase)) return (false, "Tidak bisa membuat sesi dengan diri sendiri.", 0);

        var atasan = await EffectiveAtasanAsync(nik);
        var bawahan = await EffectiveBawahanAsync(nik);
        string idAtasan, idBawahan, namaAtasan, namaBawahan;

        if (atasan is not null && atasan.Value.Nik == targetNik)
        {
            idAtasan = targetNik; namaAtasan = atasan.Value.Nama ?? targetNik;
            idBawahan = nik; namaBawahan = nama ?? nik;
        }
        else if (bawahan.FirstOrDefault(b => b.Nik == targetNik) is { Nik: not null } b)
        {
            idAtasan = nik; namaAtasan = nama ?? nik;
            idBawahan = targetNik; namaBawahan = b.Nama;
        }
        else
        {
            return (false, "Sesi hanya bisa dibuat dengan atasan langsung atau bawahan langsung Anda.", 0);
        }

        var now = DateTime.UtcNow;
        var sesi = new CoachingSesi
        {
            IdAtasan = idAtasan, NamaAtasan = namaAtasan,
            IdBawahan = idBawahan, NamaBawahan = namaBawahan,
            Topik = topik.Trim(), Status = "Berjalan",
            IdPembuat = nik, TglDibuat = now, TglTerakhir = now,
        };
        _db.CoachingSesi.Add(sesi);
        await _db.SaveChangesAsync();
        return (true, null, sesi.Id);
    }

    public async Task<CoachingSesiDetailDto?> GetSesiAsync(string nik, long id)
    {
        var s = await _db.CoachingSesi.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (s is null || (s.IdAtasan != nik && s.IdBawahan != nik)) return null;

        var pesan = await _db.CoachingPesan.AsNoTracking()
            .Where(p => p.IdSesi == id).OrderBy(p => p.Id)
            .ToListAsync();
        var tl = await _db.CoachingTindakLanjut.AsNoTracking()
            .Where(t => t.IdSesi == id).OrderByDescending(t => t.Id)
            .ToListAsync();

        var akuAtasan = s.IdAtasan == nik;
        return new CoachingSesiDetailDto(
            s.Id, s.Topik, s.Status,
            akuAtasan ? s.IdBawahan : s.IdAtasan,
            akuAtasan ? s.NamaBawahan : s.NamaAtasan,
            akuAtasan ? "Bawahan" : "Atasan",
            pesan.Select(p => MapPesan(p, nik)).ToList(),
            tl.Select(t => new CoachingTindakLanjutDto(t.Id, t.Isi, t.Status, t.TglDibuat, t.TglSelesai)).ToList());
    }

    public async Task<(bool Ok, string? Error)> KirimPesanSesiAsync(string nik, string? nama, long idSesi, string isi)
    {
        if (string.IsNullOrWhiteSpace(isi)) return (false, "Pesan kosong.");
        var s = await _db.CoachingSesi.FirstOrDefaultAsync(x => x.Id == idSesi);
        if (s is null || (s.IdAtasan != nik && s.IdBawahan != nik)) return (false, "Sesi tidak ditemukan atau bukan milik Anda.");
        var now = DateTime.UtcNow;
        _db.CoachingPesan.Add(new CoachingPesan { IdSesi = idSesi, IdPengirim = nik, NamaPengirim = nama, Isi = isi.Trim(), TglKirim = now });
        s.TglTerakhir = now;
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> SetStatusSesiAsync(string nik, long idSesi, string status)
    {
        if (status is not ("Berjalan" or "Selesai")) return (false, "Status tidak valid.");
        var s = await _db.CoachingSesi.FirstOrDefaultAsync(x => x.Id == idSesi);
        if (s is null || (s.IdAtasan != nik && s.IdBawahan != nik)) return (false, "Sesi tidak ditemukan atau bukan milik Anda.");
        s.Status = status;
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> AddTindakLanjutAsync(string nik, long idSesi, string isi)
    {
        if (string.IsNullOrWhiteSpace(isi)) return (false, "Isi tindak lanjut kosong.");
        var s = await _db.CoachingSesi.FirstOrDefaultAsync(x => x.Id == idSesi);
        if (s is null || (s.IdAtasan != nik && s.IdBawahan != nik)) return (false, "Sesi tidak ditemukan atau bukan milik Anda.");
        _db.CoachingTindakLanjut.Add(new CoachingTindakLanjut { IdSesi = idSesi, Isi = isi.Trim(), Status = "Terbuka", IdPembuat = nik, TglDibuat = DateTime.UtcNow });
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> SetStatusTindakLanjutAsync(string nik, long idTl, string status)
    {
        if (status is not ("Terbuka" or "Selesai")) return (false, "Status tidak valid.");
        var t = await _db.CoachingTindakLanjut.FirstOrDefaultAsync(x => x.Id == idTl);
        if (t is null) return (false, "Tindak lanjut tidak ditemukan.");
        var s = await _db.CoachingSesi.FirstOrDefaultAsync(x => x.Id == t.IdSesi);
        if (s is null || (s.IdAtasan != nik && s.IdBawahan != nik)) return (false, "Bukan wewenang Anda.");
        t.Status = status;
        t.TglSelesai = status == "Selesai" ? DateTime.UtcNow : null;
        await _db.SaveChangesAsync();
        return (true, null);
    }

    // ===================== Ruang Tim =====================
    public async Task<CoachingRuangDetailDto?> GetRuangAsync(string nik, string ownerNik)
    {
        var peran = await PeranRuangAsync(nik, ownerNik);
        if (peran is null) return null;

        var anggotaRows = await EffectiveBawahanAsync(ownerNik);
        var ownerNama = await NamaPenempatanAsync(ownerNik);
        var anggota = new List<CoachingAnggotaDto> { new(ownerNik, ownerNama ?? ownerNik, "Pemilik ruang") };
        anggota.AddRange(anggotaRows.Select(a => new CoachingAnggotaDto(a.Nik, a.Nama, a.Jabatan)));

        var pesan = await _db.CoachingPesan.AsNoTracking()
            .Where(p => p.RuangNik == ownerNik).OrderBy(p => p.Id).ToListAsync();

        return new CoachingRuangDetailDto(ownerNik, ownerNama, peran, anggota, pesan.Select(p => MapPesan(p, nik)).ToList());
    }

    public async Task<(bool Ok, string? Error)> KirimPesanRuangAsync(string nik, string? nama, string ownerNik, string isi)
    {
        if (string.IsNullOrWhiteSpace(isi)) return (false, "Pesan kosong.");
        if (await PeranRuangAsync(nik, ownerNik) is null) return (false, "Anda bukan anggota ruang tim ini.");
        _db.CoachingPesan.Add(new CoachingPesan { RuangNik = ownerNik, IdPengirim = nik, NamaPengirim = nama, Isi = isi.Trim(), TglKirim = DateTime.UtcNow });
        await _db.SaveChangesAsync();
        return (true, null);
    }

    // "Pemilik" bila me==owner (punya bawahan), "Anggota" bila owner = atasan efektif me, else null.
    private async Task<string?> PeranRuangAsync(string nik, string ownerNik)
    {
        if (string.Equals(nik, ownerNik, StringComparison.OrdinalIgnoreCase))
        {
            return (await EffectiveBawahanAsync(nik)).Count > 0 ? "Pemilik" : null;
        }
        var atasan = await EffectiveAtasanAsync(nik);
        return atasan is not null && atasan.Value.Nik == ownerNik ? "Anggota" : null;
    }

    // ===================== helpers (grading, raw SQL) =====================
    private async Task<(string Nik, string? Nama, string? Jabatan)?> EffectiveAtasanAsync(string nik)
    {
        var conn = _db.Database.GetDbConnection();
        var mustClose = conn.State != ConnectionState.Open;
        if (mustClose) await conn.OpenAsync();
        try
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                SELECT TOP 1 pa.id_karyawan, pa.nama, ja.nama_jabatan
                FROM grading.penempatan p
                JOIN grading.jabatan_hirarki h ON h.id_jabatan_bawahan = p.id_jabatan AND h.kedalaman > 0
                JOIN grading.jabatan ja ON ja.id_jabatan = h.id_jabatan_atasan
                JOIN grading.penempatan pa ON pa.id_jabatan = ja.id_jabatan AND pa.status = 'Aktif'
                WHERE p.id_karyawan = @nik AND p.status = 'Aktif'
                ORDER BY h.kedalaman ASC";
            AddParam(cmd, "@nik", nik);
            await using var r = await cmd.ExecuteReaderAsync();
            if (await r.ReadAsync())
                return (r.GetString(0), r.IsDBNull(1) ? null : r.GetString(1), r.IsDBNull(2) ? null : r.GetString(2));
            return null;
        }
        finally { if (mustClose) await conn.CloseAsync(); }
    }

    // Orang-orang yang atasan efektif terdekatnya = @nik (bawahan langsung efektif).
    private async Task<List<(string Nik, string Nama, string? Jabatan)>> EffectiveBawahanAsync(string nik)
    {
        var list = new List<(string, string, string?)>();
        var conn = _db.Database.GetDbConnection();
        var mustClose = conn.State != ConnectionState.Open;
        if (mustClose) await conn.OpenAsync();
        try
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                SELECT pp.id_karyawan, pp.nama, j.nama_jabatan
                FROM grading.penempatan pp
                JOIN grading.jabatan j ON j.id_jabatan = pp.id_jabatan
                CROSS APPLY (
                    SELECT TOP 1 pa.id_karyawan AS atasan
                    FROM grading.jabatan_hirarki h
                    JOIN grading.penempatan pa ON pa.id_jabatan = h.id_jabatan_atasan AND pa.status = 'Aktif'
                    WHERE h.id_jabatan_bawahan = pp.id_jabatan AND h.kedalaman > 0
                    ORDER BY h.kedalaman ASC
                ) na
                WHERE pp.status = 'Aktif' AND na.atasan = @nik
                ORDER BY pp.nama";
            AddParam(cmd, "@nik", nik);
            await using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync())
                list.Add((r.GetString(0), r.IsDBNull(1) ? "" : r.GetString(1), r.IsDBNull(2) ? null : r.GetString(2)));
            return list;
        }
        finally { if (mustClose) await conn.CloseAsync(); }
    }

    private async Task<string?> NamaPenempatanAsync(string nik)
    {
        var conn = _db.Database.GetDbConnection();
        var mustClose = conn.State != ConnectionState.Open;
        if (mustClose) await conn.OpenAsync();
        try
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT TOP 1 nama FROM grading.penempatan WHERE id_karyawan = @nik AND status = 'Aktif'";
            AddParam(cmd, "@nik", nik);
            return (await cmd.ExecuteScalarAsync()) as string;
        }
        finally { if (mustClose) await conn.CloseAsync(); }
    }

    private async Task<Dictionary<long, CoachingPesan>> LastPesanBySesiAsync(List<long> ids)
    {
        if (ids.Count == 0) return new();
        var rows = await _db.CoachingPesan.AsNoTracking()
            .Where(p => p.IdSesi != null && ids.Contains(p.IdSesi.Value))
            .ToListAsync();
        return rows.GroupBy(p => p.IdSesi!.Value)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.Id).First());
    }

    private async Task<CoachingPesan?> LastPesanRuangAsync(string ownerNik) =>
        await _db.CoachingPesan.AsNoTracking()
            .Where(p => p.RuangNik == ownerNik).OrderByDescending(p => p.Id).FirstOrDefaultAsync();

    private static CoachingPesanDto MapPesan(CoachingPesan p, string nik) =>
        new(p.Id, p.IdPengirim, p.NamaPengirim, p.Isi, p.TglKirim, p.IdPengirim == nik);

    private static void AddParam(DbCommand cmd, string name, object value)
    {
        var p = cmd.CreateParameter();
        p.ParameterName = name;
        p.Value = value;
        cmd.Parameters.Add(p);
    }
}

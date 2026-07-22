using System.Data;
using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using SsoBackend.Data;
using SsoBackend.Models;
using SsoBackend.Models.Dto;

namespace SsoBackend.Services;

// My Team: menyusun konteks tim seorang pegawai dari data grading yang sudah ada
// (jabatan + penempatan + jabatan_hirarki + band + unit_organisasi) + kehadiran (attendances)
// + tugas (myteam.tugas). Berlaku untuk atasan (punya bawahan) maupun anggota biasa
// (punya atasan & rekan setim), jadi tidak pernah kosong.
//
// Skema grading & myteam dibuat manual; grading dibaca lewat SQL mentah pada koneksi
// ApplicationDbContext (db_mygcs), sedangkan tugas lewat EF (entity Tugas, ExcludeFromMigrations).
public class TeamService
{
    private static readonly string[] StatusValid = ["Baru", "Dikerjakan", "Selesai", "Batal"];

    private readonly ApplicationDbContext _db;

    public TeamService(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task<TeamDto> GetTeamAsync(string idKaryawan, bool semua)
    {
        var conn = _db.Database.GetDbConnection();
        var mustClose = conn.State != ConnectionState.Open;
        if (mustClose)
        {
            await conn.OpenAsync();
        }

        try
        {
            // Tugas untuk saya selalu ditampilkan (walau tak berjabatan).
            var tugasUntukSaya = await GetTugasAsync(t => t.IdPenerima == idKaryawan);

            // 1) Jabatan yang saya duduki + atasannya.
            int myJabatan;
            int? idAtasanJab;
            string? jabatanSaya, bandSaya;
            int? jgSaya;
            await using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = @"
                    SELECT TOP 1 j.id_jabatan, j.nama_jabatan, b.kode, j.jg, j.id_atasan
                    FROM grading.penempatan p
                    JOIN grading.jabatan j ON j.id_jabatan = p.id_jabatan
                    JOIN grading.band    b ON b.id_band    = j.id_band
                    WHERE p.id_karyawan = @nik AND p.status = 'Aktif'";
                AddParam(cmd, "@nik", idKaryawan);
                await using var r = await cmd.ExecuteReaderAsync();
                if (!await r.ReadAsync())
                {
                    // Tak menduduki jabatan apa pun: di luar struktur. Tetap tampilkan tugas untuk saya.
                    return new TeamDto(false, false, null, null, null, null, 0, 0, 0,
                        [], [], tugasUntukSaya, []);
                }
                myJabatan = Convert.ToInt32(r.GetValue(0));
                jabatanSaya = r.IsDBNull(1) ? null : r.GetString(1);
                bandSaya = r.IsDBNull(2) ? null : r.GetString(2);
                jgSaya = r.IsDBNull(3) ? null : Convert.ToInt32(r.GetValue(3));
                idAtasanJab = r.IsDBNull(4) ? null : Convert.ToInt32(r.GetValue(4));
            }

            // 2) Atasan langsung.
            AtasanDto? atasan = null;
            if (idAtasanJab is not null)
            {
                await using var cmd = conn.CreateCommand();
                cmd.CommandText = @"
                    SELECT j.nama_jabatan, b.kode, j.jg, p.id_karyawan, p.nama
                    FROM grading.jabatan j
                    JOIN grading.band    b ON b.id_band = j.id_band
                    LEFT JOIN grading.penempatan p ON p.id_jabatan = j.id_jabatan AND p.status = 'Aktif'
                    WHERE j.id_jabatan = @jab";
                AddParam(cmd, "@jab", idAtasanJab.Value);
                await using var r = await cmd.ExecuteReaderAsync();
                if (await r.ReadAsync())
                {
                    atasan = new AtasanDto(
                        r.GetString(0),
                        r.IsDBNull(1) ? null : r.GetString(1),
                        r.IsDBNull(2) ? null : Convert.ToInt32(r.GetValue(2)),
                        r.IsDBNull(3) ? null : r.GetString(3),
                        r.IsDBNull(4) ? null : r.GetString(4));
                }
            }

            // 3) Anggota tim (bawahan) dari closure hierarki.
            var maxDepth = semua ? 100 : 1;
            List<MemberRow> bawahanRows;
            await using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = @"
                    SELECT h.kedalaman, j.id_jabatan, j.nama_jabatan, b.kode, j.jg,
                           p.id_karyawan, p.nama, u.nama
                    FROM grading.jabatan_hirarki h
                    JOIN grading.jabatan j ON j.id_jabatan = h.id_jabatan_bawahan
                    JOIN grading.band    b ON b.id_band    = j.id_band
                    LEFT JOIN grading.unit_organisasi u ON u.id_unit = j.id_unit
                    LEFT JOIN grading.penempatan p ON p.id_jabatan = j.id_jabatan AND p.status = 'Aktif'
                    WHERE h.id_jabatan_atasan = @jab AND h.kedalaman BETWEEN 1 AND @depth
                    ORDER BY h.kedalaman, j.id_band, j.nama_jabatan";
                AddParam(cmd, "@jab", myJabatan);
                AddParam(cmd, "@depth", maxDepth);
                bawahanRows = await ReadMembers(cmd);
            }

            // 4) Rekan setim (peers): sesama bawahan langsung dari atasan yang sama, kecuali saya.
            List<MemberRow> peerRows = [];
            if (idAtasanJab is not null)
            {
                await using var cmd = conn.CreateCommand();
                cmd.CommandText = @"
                    SELECT 0 AS kedalaman, j.id_jabatan, j.nama_jabatan, b.kode, j.jg,
                           p.id_karyawan, p.nama, u.nama
                    FROM grading.jabatan j
                    JOIN grading.band    b ON b.id_band = j.id_band
                    LEFT JOIN grading.unit_organisasi u ON u.id_unit = j.id_unit
                    LEFT JOIN grading.penempatan p ON p.id_jabatan = j.id_jabatan AND p.status = 'Aktif'
                    WHERE j.id_atasan = @atasan AND j.id_jabatan <> @me AND j.aktif = 1
                    ORDER BY j.nama_jabatan";
                AddParam(cmd, "@atasan", idAtasanJab.Value);
                AddParam(cmd, "@me", myJabatan);
                peerRows = await ReadMembers(cmd);
            }

            // 5) Kehadiran hari ini (WIB) untuk bawahan + rekan yang terisi.
            var ids = bawahanRows.Concat(peerRows).Where(m => m.IdKaryawan is not null)
                .Select(m => m.IdKaryawan!).Distinct().ToList();
            var hadir = await KehadiranHariIni(ids);

            var anggota = bawahanRows.Select(m => ToMember(m, hadir)).ToList();
            var rekan = peerRows.Select(m => ToMember(m, hadir)).ToList();
            var terisi = anggota.Count(a => a.Terisi);

            // Punya tim? cek ada bawahan langsung (independen dari toggle "semua").
            var punyaTim = await ExistsBawahanLangsung(conn, myJabatan);

            var tugasDiberikan = punyaTim ? await GetTugasAsync(t => t.IdPemberi == idKaryawan) : [];

            return new TeamDto(
                PunyaTim: punyaTim,
                DalamStruktur: true,
                JabatanSaya: jabatanSaya, BandSaya: bandSaya, JgSaya: jgSaya,
                Atasan: atasan,
                JumlahAnggota: terisi,
                JumlahKosong: anggota.Count - terisi,
                JumlahHadir: anggota.Count(a => a.HadirHariIni),
                Anggota: anggota,
                RekanSetim: rekan,
                TugasUntukSaya: tugasUntukSaya,
                TugasDiberikan: tugasDiberikan);
        }
        finally
        {
            if (mustClose)
            {
                await conn.CloseAsync();
            }
        }
    }

    // ---- Tugas (delegasi) ----

    public async Task<(bool Ok, string? Error, TugasDto? Tugas)> CreateTugasAsync(string pemberiNik, string? pemberiNama, TugasCreateRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Judul))
        {
            return (false, "Judul tugas wajib diisi.", null);
        }
        if (string.IsNullOrWhiteSpace(req.IdPenerima))
        {
            return (false, "Penerima tugas wajib dipilih.", null);
        }
        if (!await IsBawahanAsync(pemberiNik, req.IdPenerima))
        {
            return (false, "Tugas hanya bisa diberikan ke bawahan Anda.", null);
        }

        var now = DateTime.UtcNow;
        var t = new Tugas
        {
            IdPemberi = pemberiNik,
            NamaPemberi = pemberiNama,
            IdPenerima = req.IdPenerima,
            NamaPenerima = await NamaPenempatan(req.IdPenerima),
            Judul = req.Judul.Trim(),
            Deskripsi = string.IsNullOrWhiteSpace(req.Deskripsi) ? null : req.Deskripsi.Trim(),
            Tenggat = req.Tenggat,
            Status = "Baru",
            DibuatPada = now,
            DiperbaruiPada = now,
        };
        _db.Tugas.Add(t);
        await _db.SaveChangesAsync();
        return (true, null, Map(t));
    }

    public async Task<(bool Ok, string? Error)> UpdateStatusAsync(int id, string nik, string status)
    {
        if (!StatusValid.Contains(status))
        {
            return (false, "Status tidak valid.");
        }
        var t = await _db.Tugas.FirstOrDefaultAsync(x => x.Id == id);
        if (t is null)
        {
            return (false, "Tugas tidak ditemukan.");
        }
        if (t.IdPemberi != nik && t.IdPenerima != nik)
        {
            return (false, "Anda tidak berhak mengubah tugas ini.");
        }
        t.Status = status;
        t.DiperbaruiPada = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> DeleteTugasAsync(int id, string nik)
    {
        var t = await _db.Tugas.FirstOrDefaultAsync(x => x.Id == id);
        if (t is null)
        {
            return (false, "Tugas tidak ditemukan.");
        }
        if (t.IdPemberi != nik)
        {
            return (false, "Hanya pemberi tugas yang bisa menghapus.");
        }
        _db.Tugas.Remove(t);
        await _db.SaveChangesAsync();
        return (true, null);
    }

    // ---- helper ----

    private record struct MemberRow(int Kedalaman, int IdJabatan, string Jabatan, string? Band, int? Jg, string? IdKaryawan, string? Nama, string? Unit);

    private static async Task<List<MemberRow>> ReadMembers(DbCommand cmd)
    {
        var list = new List<MemberRow>();
        await using var r = await cmd.ExecuteReaderAsync();
        while (await r.ReadAsync())
        {
            list.Add(new MemberRow(
                Convert.ToInt32(r.GetValue(0)),
                Convert.ToInt32(r.GetValue(1)),
                r.GetString(2),
                r.IsDBNull(3) ? null : r.GetString(3),
                r.IsDBNull(4) ? null : Convert.ToInt32(r.GetValue(4)),
                r.IsDBNull(5) ? null : r.GetString(5),
                r.IsDBNull(6) ? null : r.GetString(6),
                r.IsDBNull(7) ? null : r.GetString(7)));
        }
        return list;
    }

    private static TeamMemberDto ToMember(MemberRow m, HashSet<string> hadir) => new(
        m.Kedalaman, m.IdJabatan, m.Jabatan, m.Band, m.Jg, m.IdKaryawan, m.Nama, m.Unit,
        Terisi: m.IdKaryawan is not null,
        HadirHariIni: m.IdKaryawan is not null && hadir.Contains(m.IdKaryawan));

    private async Task<HashSet<string>> KehadiranHariIni(List<string> ids)
    {
        if (ids.Count == 0)
        {
            return [];
        }
        var todayWib = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        var present = await _db.Attendances
            .Where(a => a.Tanggal == todayWib && a.CheckIn != null && ids.Contains(a.KodePegawai))
            .Select(a => a.KodePegawai)
            .Distinct()
            .ToListAsync();
        return present.ToHashSet();
    }

    private static async Task<bool> ExistsBawahanLangsung(DbConnection conn, int myJabatan)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT TOP 1 1 FROM grading.jabatan_hirarki WHERE id_jabatan_atasan = @jab AND kedalaman = 1";
        AddParam(cmd, "@jab", myJabatan);
        var res = await cmd.ExecuteScalarAsync();
        return res is not null;
    }

    private async Task<bool> IsBawahanAsync(string atasanNik, string penerimaNik)
    {
        var conn = _db.Database.GetDbConnection();
        var mustClose = conn.State != ConnectionState.Open;
        if (mustClose)
        {
            await conn.OpenAsync();
        }
        try
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                SELECT TOP 1 1
                FROM grading.penempatan pm
                JOIN grading.jabatan_hirarki h ON h.id_jabatan_atasan = pm.id_jabatan AND h.kedalaman > 0
                JOIN grading.penempatan pp ON pp.id_jabatan = h.id_jabatan_bawahan AND pp.status = 'Aktif'
                WHERE pm.id_karyawan = @me AND pm.status = 'Aktif' AND pp.id_karyawan = @penerima";
            AddParam(cmd, "@me", atasanNik);
            AddParam(cmd, "@penerima", penerimaNik);
            var res = await cmd.ExecuteScalarAsync();
            return res is not null;
        }
        finally
        {
            if (mustClose)
            {
                await conn.CloseAsync();
            }
        }
    }

    private async Task<string?> NamaPenempatan(string nik)
    {
        var conn = _db.Database.GetDbConnection();
        var mustClose = conn.State != ConnectionState.Open;
        if (mustClose)
        {
            await conn.OpenAsync();
        }
        try
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT TOP 1 nama FROM grading.penempatan WHERE id_karyawan = @nik AND status = 'Aktif'";
            AddParam(cmd, "@nik", nik);
            var res = await cmd.ExecuteScalarAsync();
            return res as string;
        }
        finally
        {
            if (mustClose)
            {
                await conn.CloseAsync();
            }
        }
    }

    private async Task<IReadOnlyList<TugasDto>> GetTugasAsync(System.Linq.Expressions.Expression<Func<Tugas, bool>> where)
    {
        var rows = await _db.Tugas.Where(where).OrderByDescending(t => t.Id).ToListAsync();
        return rows.Select(Map).ToList();
    }

    private static TugasDto Map(Tugas t) => new(
        t.Id, t.IdPemberi, t.NamaPemberi, t.IdPenerima, t.NamaPenerima,
        t.Judul, t.Deskripsi, t.Tenggat, t.Status, t.DibuatPada);

    private static void AddParam(DbCommand cmd, string name, object value)
    {
        var p = cmd.CreateParameter();
        p.ParameterName = name;
        p.Value = value;
        cmd.Parameters.Add(p);
    }
}

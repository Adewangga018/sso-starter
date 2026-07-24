using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Data;
using SsoBackend.Models;
using SsoBackend.Models.Dto;
using SsoBackend.Models.Inovasi;

namespace SsoBackend.Controllers;

// Penilaian Juri untuk My Innovation. Admin menyusun STREAM (panel 4 orang:
// 1 Ketua, 2 Anggota, 1 Sekretaris) & menugaskannya ke sebuah gugus. Ketua &
// Anggota memberi skor 1-10 per kriteria (rubrik GIO/SS atau 5R sesuai jenis
// gugus); Sekretaris hanya melihat. Otorisasi in-code (tidak pakai
// [Authorize(Roles=...)]), konsisten dengan controller lain.
[ApiController]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
[Route("inovasi/penilaian")]
public class PenilaianController : ControllerBase
{
    private const string AdminRole = "Admin";
    private const string JuriRole = "Juri";

    private readonly InovasiDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;

    public PenilaianController(InovasiDbContext db, UserManager<ApplicationUser> userManager)
    {
        _db = db;
        _userManager = userManager;
    }

    private bool IsAdmin() =>
        User.HasClaim(c => (c.Type == "role" || c.Type == ClaimTypes.Role) && c.Value == AdminRole);

    private string? Uid() => _userManager.GetUserId(User);

    // Rubrik: SS/GIO -> form 'GIO-SS' ; 5R -> form '5R'.
    private static string FormFor(string? jenis) =>
        string.Equals(jenis?.Trim(), "5R", StringComparison.OrdinalIgnoreCase) ? "5R" : "GIO-SS";

    private static string Kategori(decimal nilai) =>
        nilai >= 94 ? "Excellent / Platinum"
        : nilai >= 87 ? "Very Good / Gold"
        : nilai >= 79 ? "Good / Silver"
        : nilai >= 61 ? "Fair / Bronze"
        : "Partisipatif";

    // =======================================================================
    // Rubrik (boleh diakses semua pengguna terautentikasi)
    // =======================================================================
    [HttpGet("kriteria")]
    public async Task<ActionResult<IReadOnlyList<PenilaianKriteriaDto>>> Kriteria([FromQuery] string? jenisForm)
    {
        var form = string.Equals(jenisForm?.Trim(), "5R", StringComparison.OrdinalIgnoreCase) ? "5R" : "GIO-SS";
        var rows = await _db.PenilaianKriteria.AsNoTracking()
            .Where(k => k.JenisForm == form && k.Aktif)
            .OrderBy(k => k.No)
            .Select(k => new PenilaianKriteriaDto(k.Id, k.JenisForm, k.Tahap, k.No, k.Kriteria, k.BobotPersen, k.Keterangan))
            .ToListAsync();
        return Ok(rows);
    }

    // Semua pengguna ber-role Juri (tanpa batas 100 seperti /admin/users), untuk
    // pemilih anggota stream.
    [HttpGet("juri-users")]
    public async Task<IActionResult> JuriUsers()
    {
        if (!IsAdmin()) return Forbid();
        var users = await _userManager.GetUsersInRoleAsync(JuriRole);
        var rows = users
            .OrderBy(u => u.FullName)
            .Select(u => new JuriUserDto(u.Id, u.FullName, u.Nik, u.Email))
            .ToList();
        return Ok(rows);
    }

    // =======================================================================
    // Kelola STREAM (Admin)
    // =======================================================================
    [HttpGet("stream")]
    public async Task<IActionResult> ListStream()
    {
        if (!IsAdmin()) return Forbid();
        var streams = await _db.PenilaianStream.AsNoTracking()
            .Include(s => s.Anggota)
            .OrderByDescending(s => s.Id)
            .ToListAsync();
        return Ok(streams.Select(ToStreamDto).ToList());
    }

    [HttpGet("stream/{id:int}")]
    public async Task<IActionResult> GetStream(int id)
    {
        if (!IsAdmin()) return Forbid();
        var s = await _db.PenilaianStream.AsNoTracking().Include(x => x.Anggota).FirstOrDefaultAsync(x => x.Id == id);
        return s is null ? NotFound() : Ok(ToStreamDto(s));
    }

    [HttpPost("stream")]
    public async Task<IActionResult> CreateStream([FromBody] SaveStreamRequest req)
    {
        if (!IsAdmin()) return Forbid();
        if (string.IsNullOrWhiteSpace(req.Nama)) return BadRequest(new { message = "Nama stream wajib diisi." });
        var err = await ValidateAnggotaAsync(req.Anggota);
        if (err != null) return BadRequest(new { message = err });

        var s = new PenilaianStream
        {
            Nama = req.Nama.Trim(),
            Keterangan = req.Keterangan,
            Aktif = req.Aktif,
            DibuatOleh = Uid(),
            DibuatPada = DateTime.UtcNow,
        };
        foreach (var a in req.Anggota)
        {
            var u = await _userManager.FindByIdAsync(a.UserId);
            s.Anggota.Add(new PenilaianStreamAnggota
            {
                UserId = a.UserId,
                Nik = u?.Nik ?? a.Nik,
                Nama = u?.FullName ?? a.Nama,
                Peran = a.Peran,
            });
        }
        _db.PenilaianStream.Add(s);
        await _db.SaveChangesAsync();
        return Ok(ToStreamDto(s));
    }

    [HttpPut("stream/{id:int}")]
    public async Task<IActionResult> UpdateStream(int id, [FromBody] SaveStreamRequest req)
    {
        if (!IsAdmin()) return Forbid();
        var s = await _db.PenilaianStream.Include(x => x.Anggota).FirstOrDefaultAsync(x => x.Id == id);
        if (s is null) return NotFound();
        if (string.IsNullOrWhiteSpace(req.Nama)) return BadRequest(new { message = "Nama stream wajib diisi." });
        var err = await ValidateAnggotaAsync(req.Anggota);
        if (err != null) return BadRequest(new { message = err });

        s.Nama = req.Nama.Trim();
        s.Keterangan = req.Keterangan;
        s.Aktif = req.Aktif;
        _db.PenilaianStreamAnggota.RemoveRange(s.Anggota);
        s.Anggota.Clear();
        foreach (var a in req.Anggota)
        {
            var u = await _userManager.FindByIdAsync(a.UserId);
            s.Anggota.Add(new PenilaianStreamAnggota
            {
                IdStream = s.Id,
                UserId = a.UserId,
                Nik = u?.Nik ?? a.Nik,
                Nama = u?.FullName ?? a.Nama,
                Peran = a.Peran,
            });
        }
        await _db.SaveChangesAsync();
        return Ok(ToStreamDto(s));
    }

    [HttpDelete("stream/{id:int}")]
    public async Task<IActionResult> DeleteStream(int id)
    {
        if (!IsAdmin()) return Forbid();
        var s = await _db.PenilaianStream.FirstOrDefaultAsync(x => x.Id == id);
        if (s is null) return NotFound();
        if (await _db.PenilaianPenugasan.AnyAsync(p => p.IdStream == id))
            return BadRequest(new { message = "Stream sudah ditugaskan ke inovasi. Hapus penugasan terlebih dahulu." });
        _db.PenilaianStream.Remove(s);   // anggota cascade
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static StreamDto ToStreamDto(PenilaianStream s) => new(
        s.Id, s.Nama, s.Keterangan, s.Aktif,
        s.Anggota
            .OrderBy(a => a.Peran == "Ketua" ? 0 : a.Peran == "Anggota" ? 1 : 2)
            .Select(a => new StreamAnggotaDto(a.Id, a.UserId, a.Nik, a.Nama, a.Peran))
            .ToList());

    // Komposisi wajib: 1 Ketua, 2 Anggota, 1 Sekretaris; semua user ada & ber-role Juri.
    private async Task<string?> ValidateAnggotaAsync(IReadOnlyList<StreamAnggotaInput>? anggota)
    {
        if (anggota is null || anggota.Count == 0) return "Anggota stream wajib diisi.";
        var ketua = anggota.Count(a => a.Peran == "Ketua");
        var ang = anggota.Count(a => a.Peran == "Anggota");
        var sek = anggota.Count(a => a.Peran == "Sekretaris");
        if (ketua != 1 || ang != 2 || sek != 1)
            return "Komposisi stream harus tepat: 1 Ketua, 2 Anggota, dan 1 Sekretaris.";
        var ids = anggota.Select(a => a.UserId).ToList();
        if (ids.Any(string.IsNullOrWhiteSpace)) return "Ada anggota tanpa pengguna terpilih.";
        if (ids.Distinct().Count() != ids.Count) return "Seorang pengguna terpilih lebih dari satu peran.";
        foreach (var a in anggota)
        {
            var u = await _userManager.FindByIdAsync(a.UserId);
            if (u is null) return "Pengguna tidak ditemukan.";
            if (!await _userManager.IsInRoleAsync(u, JuriRole))
                return $"{u.FullName ?? u.Email} belum berperan Juri. Aktifkan dulu di Manajemen Pengguna.";
        }
        return null;
    }

    // =======================================================================
    // PENUGASAN stream -> gugus (Admin)
    // =======================================================================
    [HttpGet("gugus-options")]
    public async Task<IActionResult> GugusOptions()
    {
        if (!IsAdmin()) return Forbid();
        var rows = await _db.Gugus.AsNoTracking()
            .Where(g => g.Status != "Draft")
            .OrderByDescending(g => g.Id)
            .Select(g => new GugusOptionDto(g.Id, g.Jenis, g.NoRegistrasi, g.NamaGugus, g.Judul, g.Status))
            .ToListAsync();
        return Ok(rows);
    }

    [HttpGet("penugasan")]
    public async Task<IActionResult> ListPenugasan()
    {
        if (!IsAdmin()) return Forbid();
        var rows = await (
            from p in _db.PenilaianPenugasan.AsNoTracking()
            join s in _db.PenilaianStream on p.IdStream equals s.Id
            join g in _db.Gugus on p.IdGugus equals g.Id
            orderby p.Id descending
            select new PenugasanDto(p.Id, p.IdGugus, p.IdStream, s.Nama, p.Status,
                g.Jenis, g.NoRegistrasi, g.NamaGugus, g.Judul, p.DibuatPada)
        ).ToListAsync();
        return Ok(rows);
    }

    [HttpPost("penugasan")]
    public async Task<IActionResult> CreatePenugasan([FromBody] CreatePenugasanRequest req)
    {
        if (!IsAdmin()) return Forbid();
        if (!await _db.Gugus.AnyAsync(g => g.Id == req.IdGugus)) return NotFound(new { message = "Inovasi tidak ditemukan." });
        if (!await _db.PenilaianStream.AnyAsync(s => s.Id == req.IdStream)) return NotFound(new { message = "Stream tidak ditemukan." });
        if (await _db.PenilaianPenugasan.AnyAsync(p => p.IdGugus == req.IdGugus && p.Status == "Berjalan"))
            return BadRequest(new { message = "Inovasi ini sudah memiliki penugasan yang sedang berjalan." });

        var p = new PenilaianPenugasan
        {
            IdGugus = req.IdGugus,
            IdStream = req.IdStream,
            Status = "Berjalan",
            DibuatOleh = Uid(),
            DibuatPada = DateTime.UtcNow,
        };
        _db.PenilaianPenugasan.Add(p);
        await _db.SaveChangesAsync();
        return Ok(new { p.Id });
    }

    [HttpPost("penugasan/{id:int}/tutup")]
    public async Task<IActionResult> TutupPenugasan(int id)
    {
        if (!IsAdmin()) return Forbid();
        var p = await _db.PenilaianPenugasan.FirstOrDefaultAsync(x => x.Id == id);
        if (p is null) return NotFound();
        p.Status = "Selesai";
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("penugasan/{id:int}")]
    public async Task<IActionResult> DeletePenugasan(int id)
    {
        if (!IsAdmin()) return Forbid();
        var p = await _db.PenilaianPenugasan.FirstOrDefaultAsync(x => x.Id == id);
        if (p is null) return NotFound();
        _db.PenilaianPenugasan.Remove(p);   // skor cascade
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // =======================================================================
    // Sisi JURI
    // =======================================================================
    [HttpGet("tugas")]
    public async Task<IActionResult> Tugas()
    {
        var uid = Uid();
        if (uid is null) return Unauthorized();
        var rows = await (
            from p in _db.PenilaianPenugasan.AsNoTracking()
            join a in _db.PenilaianStreamAnggota on p.IdStream equals a.IdStream
            join g in _db.Gugus on p.IdGugus equals g.Id
            where a.UserId == uid
            orderby p.Id descending
            select new { p.Id, p.Status, GugusId = g.Id, g.Jenis, g.NoRegistrasi, g.NamaGugus, g.Judul, g.Periode, a.Peran }
        ).ToListAsync();

        var dto = rows.Select(x => new TugasPenilaianDto(
            x.Id, x.GugusId, x.Jenis, FormFor(x.Jenis), x.NoRegistrasi, x.NamaGugus, x.Judul, x.Periode,
            x.Peran, x.Peran != "Sekretaris", x.Status)).ToList();
        return Ok(dto);
    }

    [HttpGet("{penugasanId:int}")]
    public async Task<IActionResult> Detail(int penugasanId)
    {
        var uid = Uid();
        if (uid is null) return Unauthorized();
        var p = await _db.PenilaianPenugasan.AsNoTracking().FirstOrDefaultAsync(x => x.Id == penugasanId);
        if (p is null) return NotFound();

        var me = await _db.PenilaianStreamAnggota.AsNoTracking()
            .FirstOrDefaultAsync(a => a.IdStream == p.IdStream && a.UserId == uid);
        if (me is null && !IsAdmin()) return Forbid();

        var g = await _db.Gugus.AsNoTracking().FirstOrDefaultAsync(x => x.Id == p.IdGugus);
        if (g is null) return NotFound();

        var form = FormFor(g.Jenis);
        var kriteria = await _db.PenilaianKriteria.AsNoTracking()
            .Where(k => k.JenisForm == form && k.Aktif).OrderBy(k => k.No)
            .Select(k => new PenilaianKriteriaDto(k.Id, k.JenisForm, k.Tahap, k.No, k.Kriteria, k.BobotPersen, k.Keterangan))
            .ToListAsync();

        var skorSaya = me is null ? new List<SkorDto>() : await _db.PenilaianSkor.AsNoTracking()
            .Where(x => x.IdPenugasan == penugasanId && x.PenilaiUserId == uid)
            .Select(x => new SkorDto(x.IdKriteria, x.Nilai, x.Catatan))
            .ToListAsync();

        var hasil = await BuildHasilAsync(p, form);
        var peran = me?.Peran ?? "Admin";
        var bisaNilai = me is not null && me.Peran != "Sekretaris" && p.Status == "Berjalan";
        var header = new GugusHeaderDto(g.Id, g.Jenis, g.NoRegistrasi, g.NamaGugus, g.Judul, g.Periode,
            g.NamaDepartemen, g.NamaKompartemen, g.Status);

        return Ok(new PenilaianDetailDto(p.Id, p.Status, header, form, peran, bisaNilai, kriteria, skorSaya, hasil));
    }

    [HttpPut("{penugasanId:int}/skor")]
    public async Task<IActionResult> SaveSkor(int penugasanId, [FromBody] SaveSkorRequest req)
    {
        var uid = Uid();
        if (uid is null) return Unauthorized();
        var p = await _db.PenilaianPenugasan.FirstOrDefaultAsync(x => x.Id == penugasanId);
        if (p is null) return NotFound();
        if (p.Status != "Berjalan") return BadRequest(new { message = "Penilaian sudah ditutup." });

        var me = await _db.PenilaianStreamAnggota.AsNoTracking()
            .FirstOrDefaultAsync(a => a.IdStream == p.IdStream && a.UserId == uid);
        if (me is null) return Forbid();
        if (me.Peran == "Sekretaris") return Forbid();

        var g = await _db.Gugus.AsNoTracking().FirstOrDefaultAsync(x => x.Id == p.IdGugus);
        if (g is null) return NotFound();
        var form = FormFor(g.Jenis);
        var validSet = (await _db.PenilaianKriteria.Where(k => k.JenisForm == form && k.Aktif)
            .Select(k => k.Id).ToListAsync()).ToHashSet();

        var existing = await _db.PenilaianSkor
            .Where(x => x.IdPenugasan == penugasanId && x.PenilaiUserId == uid).ToListAsync();
        var byKrit = existing.ToDictionary(x => x.IdKriteria);

        foreach (var s in req.Skor ?? Enumerable.Empty<SkorInput>())
        {
            if (!validSet.Contains(s.IdKriteria) || s.Nilai < 1 || s.Nilai > 10) continue;
            if (byKrit.TryGetValue(s.IdKriteria, out var row))
            {
                row.Nilai = s.Nilai;
                row.Catatan = s.Catatan;
                row.DiubahPada = DateTime.UtcNow;
            }
            else
            {
                _db.PenilaianSkor.Add(new PenilaianSkor
                {
                    IdPenugasan = penugasanId,
                    IdKriteria = s.IdKriteria,
                    PenilaiUserId = uid,
                    Nilai = s.Nilai,
                    Catatan = s.Catatan,
                    DiubahPada = DateTime.UtcNow,
                });
            }
        }
        await _db.SaveChangesAsync();
        return Ok(await BuildHasilAsync(p, form));
    }

    [HttpGet("{penugasanId:int}/hasil")]
    public async Task<IActionResult> Hasil(int penugasanId)
    {
        var uid = Uid();
        if (uid is null) return Unauthorized();
        var p = await _db.PenilaianPenugasan.AsNoTracking().FirstOrDefaultAsync(x => x.Id == penugasanId);
        if (p is null) return NotFound();
        var member = await _db.PenilaianStreamAnggota.AsNoTracking()
            .AnyAsync(a => a.IdStream == p.IdStream && a.UserId == uid);
        if (!member && !IsAdmin()) return Forbid();
        var g = await _db.Gugus.AsNoTracking().FirstOrDefaultAsync(x => x.Id == p.IdGugus);
        if (g is null) return NotFound();
        return Ok(await BuildHasilAsync(p, FormFor(g.Jenis)));
    }

    // Nilai per penilai = SUM(nilai/10 * bobot_persen) (0..100). Nilai akhir stream
    // = rata-rata penilai (Ketua+Anggota) yang sudah mengisi SELURUH kriteria.
    private async Task<PenilaianHasilDto> BuildHasilAsync(PenilaianPenugasan p, string form)
    {
        var kriteria = await _db.PenilaianKriteria.AsNoTracking()
            .Where(k => k.JenisForm == form && k.Aktif).ToListAsync();
        var totalKriteria = kriteria.Count;
        var bobot = kriteria.ToDictionary(k => k.Id, k => k.BobotPersen);

        var penilaiAnggota = await _db.PenilaianStreamAnggota.AsNoTracking()
            .Where(a => a.IdStream == p.IdStream && a.Peran != "Sekretaris").ToListAsync();
        var skor = await _db.PenilaianSkor.AsNoTracking().Where(x => x.IdPenugasan == p.Id).ToListAsync();

        var penilai = new List<PenilaiHasilDto>();
        foreach (var a in penilaiAnggota.OrderBy(a => a.Peran == "Ketua" ? 0 : 1))
        {
            var mine = skor.Where(x => x.PenilaiUserId == a.UserId).ToList();
            decimal nilai = 0m;
            foreach (var sc in mine)
                if (bobot.TryGetValue(sc.IdKriteria, out var b)) nilai += (sc.Nilai / 10m) * b;
            nilai = Math.Round(nilai, 2);
            penilai.Add(new PenilaiHasilDto(a.UserId, a.Nama, a.Peran, nilai, Kategori(nilai), mine.Count));
        }

        var lengkap = penilai.Where(x => x.Terisi >= totalKriteria && totalKriteria > 0).Select(x => x.Nilai).ToList();
        var akhir = lengkap.Count > 0 ? Math.Round(lengkap.Average(), 2) : 0m;
        return new PenilaianHasilDto(akhir, Kategori(akhir), totalKriteria, penilai);
    }
}

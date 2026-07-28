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
using SsoBackend.Services;

namespace SsoBackend.Controllers;

// Penilaian Juri untuk My Innovation. Admin menyusun STREAM (panel 4 orang:
// 1 Ketua & 3 Anggota) lalu menugaskannya ke sebuah gugus. Seluruh anggota
// panel memberi skor 1-10 per kriteria (rubrik GIO/SS atau 5R sesuai jenis
// gugus). Peran Sekretaris (dahulu ada, hanya melihat tanpa menilai) sudah
// dihapus - perhitungan hasil memang selalu merata-ratakan Ketua + 3 Anggota,
// jadi penghapusannya tidak mengubah angka apa pun.
// Otorisasi in-code (tidak pakai [Authorize(Roles=...)]), konsisten dengan
// controller lain.
[ApiController]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
[Route("inovasi/penilaian")]
[ModuleGate("my-innovation")]
public class PenilaianController : ControllerBase
{
    private const string AdminRole = "Admin";
    private const string JuriRole = "Juri";
    private const string PengelolaJuriRole = "PengelolaJuri";

    private readonly InovasiDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;

    public PenilaianController(InovasiDbContext db, UserManager<ApplicationUser> userManager)
    {
        _db = db;
        _userManager = userManager;
    }

    private bool HasRole(string role) =>
        User.HasClaim(c => (c.Type == "role" || c.Type == ClaimTypes.Role) && c.Value == role);

    private bool IsAdmin() => HasRole(AdminRole);

    // Boleh mengelola penjurian: Admin IT ATAU Pengelola Juri (koordinator yang
    // ditunjuk Admin; haknya terbatas pada Stream Penilai & Penugasan ke Inovasi).
    private bool IsPengelola() => IsAdmin() || HasRole(PengelolaJuriRole);

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
        if (!IsPengelola()) return Forbid();
        var users = await _userManager.GetUsersInRoleAsync(JuriRole);
        // Manager & GM (band 1/2 pada grading) otomatis boleh menjadi juri.
        var mgrNiks = await ManagerGmNiksAsync();
        var mgrUsers = mgrNiks.Count == 0
            ? new List<ApplicationUser>()
            : await _userManager.Users.Where(u => u.Nik != null && mgrNiks.Contains(u.Nik)).ToListAsync();
        var rows = users.Concat(mgrUsers)
            .GroupBy(u => u.Id).Select(g => g.First())
            .OrderBy(u => u.FullName)
            .Select(u => new JuriUserDto(u.Id, u.FullName, u.Nik, u.Email))
            .ToList();
        return Ok(rows);
    }

    // NIK pegawai ber-band 1 (GM) atau 2 (Manager) - dianggap juri secara otomatis.
    private async Task<List<string>> ManagerGmNiksAsync()
    {
        var niks = await (
            from p in _db.Penempatan
            join j in _db.Jabatan on p.IdJabatan equals j.IdJabatan
            where p.Status == "Aktif" && (j.IdBand == 1 || j.IdBand == 2) && p.IdKaryawan != null
            select p.IdKaryawan).Distinct().ToListAsync();
        return niks;
    }

    // =======================================================================
    // Kelola STREAM (Admin)
    // =======================================================================
    [HttpGet("stream")]
    public async Task<IActionResult> ListStream()
    {
        if (!IsPengelola()) return Forbid();
        var streams = await _db.PenilaianStream.AsNoTracking()
            .Include(s => s.Anggota)
            .OrderByDescending(s => s.Id)
            .ToListAsync();
        return Ok(streams.Select(ToStreamDto).ToList());
    }

    [HttpGet("stream/{id:int}")]
    public async Task<IActionResult> GetStream(int id)
    {
        if (!IsPengelola()) return Forbid();
        var s = await _db.PenilaianStream.AsNoTracking().Include(x => x.Anggota).FirstOrDefaultAsync(x => x.Id == id);
        return s is null ? NotFound() : Ok(ToStreamDto(s));
    }

    [HttpPost("stream")]
    public async Task<IActionResult> CreateStream([FromBody] SaveStreamRequest req)
    {
        if (!IsPengelola()) return Forbid();
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
        if (!IsPengelola()) return Forbid();
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
        if (!IsPengelola()) return Forbid();
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
            .OrderBy(a => a.Peran == "Ketua" ? 0 : 1)
            .Select(a => new StreamAnggotaDto(a.Id, a.UserId, a.Nik, a.Nama, a.Peran))
            .ToList());

    // Komposisi wajib: 1 Ketua + 3 Anggota; semua user ada & ber-role Juri.
    private async Task<string?> ValidateAnggotaAsync(IReadOnlyList<StreamAnggotaInput>? anggota)
    {
        if (anggota is null || anggota.Count == 0) return "Anggota stream wajib diisi.";
        var ketua = anggota.Count(a => a.Peran == "Ketua");
        var ang = anggota.Count(a => a.Peran == "Anggota");
        // Peran selain Ketua/Anggota ditolak - termasuk "Sekretaris" yang sudah
        // dihapus, supaya klien versi lama tidak menyelipkannya kembali.
        var lain = anggota.Where(a => a.Peran != "Ketua" && a.Peran != "Anggota").Select(a => a.Peran).FirstOrDefault();
        if (lain is not null) return $"Peran \"{lain}\" tidak dikenal. Stream hanya berisi Ketua dan Anggota.";
        if (ketua != 1 || ang != 3)
            return "Komposisi stream harus tepat: 1 Ketua dan 3 Anggota.";
        var ids = anggota.Select(a => a.UserId).ToList();
        if (ids.Any(string.IsNullOrWhiteSpace)) return "Ada anggota tanpa pengguna terpilih.";
        if (ids.Distinct().Count() != ids.Count) return "Seorang pengguna terpilih lebih dari satu peran.";
        var mgrNiks = (await ManagerGmNiksAsync()).ToHashSet();
        foreach (var a in anggota)
        {
            var u = await _userManager.FindByIdAsync(a.UserId);
            if (u is null) return "Pengguna tidak ditemukan.";
            // Boleh menilai bila ber-role Juri ATAU Manager/GM (band 1/2).
            var boleh = await _userManager.IsInRoleAsync(u, JuriRole)
                || (u.Nik is not null && mgrNiks.Contains(u.Nik));
            if (!boleh)
                return $"{u.FullName ?? u.Email} belum berperan Juri atau Manager/GM. Aktifkan dulu di Manajemen Pengguna.";
        }
        return null;
    }

    // =======================================================================
    // PENUGASAN stream -> gugus (Admin)
    // =======================================================================
    [HttpGet("gugus-options")]
    public async Task<IActionResult> GugusOptions()
    {
        if (!IsPengelola()) return Forbid();
        // Hanya inovasi yang SUDAH menuntaskan verifikasi Pengesahan Akhir
        // (status "Selesai") yang boleh dinilai juri.
        var rows = await _db.Gugus.AsNoTracking()
            .Where(g => g.Status == "Selesai")
            .OrderByDescending(g => g.Id)
            .Select(g => new GugusOptionDto(g.Id, g.Jenis, g.NoRegistrasi, g.NamaGugus, g.Judul, g.Status))
            .ToListAsync();
        return Ok(rows);
    }

    [HttpGet("penugasan")]
    public async Task<IActionResult> ListPenugasan()
    {
        if (!IsPengelola()) return Forbid();
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
        if (!IsPengelola()) return Forbid();
        var gugus = await _db.Gugus.AsNoTracking().FirstOrDefaultAsync(g => g.Id == req.IdGugus);
        if (gugus is null) return NotFound(new { message = "Inovasi tidak ditemukan." });
        // Hanya inovasi yang sudah menuntaskan verifikasi Pengesahan Akhir.
        if (gugus.Status != "Selesai")
            return BadRequest(new { message = "Inovasi belum menuntaskan Pengesahan Akhir, sehingga belum bisa dinilai." });
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

    // Ubah stream penilai sebuah penugasan. Skor lama (dari stream sebelumnya)
    // ikut terhapus agar hasil tidak bercampur antar panel.
    [HttpPut("penugasan/{id:int}")]
    public async Task<IActionResult> UpdatePenugasan(int id, [FromBody] UpdatePenugasanRequest req)
    {
        if (!IsPengelola()) return Forbid();
        var p = await _db.PenilaianPenugasan.FirstOrDefaultAsync(x => x.Id == id);
        if (p is null) return NotFound();
        if (!await _db.PenilaianStream.AnyAsync(s => s.Id == req.IdStream)) return NotFound(new { message = "Stream tidak ditemukan." });
        if (p.IdStream != req.IdStream)
        {
            var skorLama = _db.PenilaianSkor.Where(x => x.IdPenugasan == id);
            _db.PenilaianSkor.RemoveRange(skorLama);
            p.IdStream = req.IdStream;
            await _db.SaveChangesAsync();
        }
        return NoContent();
    }

    [HttpPost("penugasan/{id:int}/tutup")]
    public async Task<IActionResult> TutupPenugasan(int id)
    {
        if (!IsPengelola()) return Forbid();
        var p = await _db.PenilaianPenugasan.FirstOrDefaultAsync(x => x.Id == id);
        if (p is null) return NotFound();
        p.Status = "Selesai";
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("penugasan/{id:int}")]
    public async Task<IActionResult> DeletePenugasan(int id)
    {
        if (!IsPengelola()) return Forbid();
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
            x.Peran, true, x.Status)).ToList();   // seluruh anggota panel menilai
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
        if (me is null && !IsPengelola()) return Forbid();

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
        var bisaNilai = me is not null && p.Status == "Berjalan";
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
        if (!member && !IsPengelola()) return Forbid();
        var g = await _db.Gugus.AsNoTracking().FirstOrDefaultAsync(x => x.Id == p.IdGugus);
        if (g is null) return NotFound();
        return Ok(await BuildHasilAsync(p, FormFor(g.Jenis)));
    }

    // =======================================================================
    // Rekap nilai seluruh risalah yang sudah dinilai - dipakai kolom "Kategori
    // Penghargaan" pada Roadmap Inovasi. Hanya membaca hasil agregat (bukan skor
    // per juri), sehingga aman dibuka pengguna biasa. Bila satu gugus punya lebih
    // dari satu penugasan, yang dipakai adalah penugasan terbaru.
    // =======================================================================
    [HttpGet("rekap")]
    public async Task<ActionResult<IReadOnlyList<RekapNilaiDto>>> Rekap()
    {
        // Penugasan terbaru per gugus.
        var penugasan = await (
            from p in _db.PenilaianPenugasan.AsNoTracking()
            join g in _db.Gugus.AsNoTracking() on p.IdGugus equals g.Id
            select new { p.Id, p.IdGugus, p.IdStream, p.Status, g.Jenis }
        ).ToListAsync();
        if (penugasan.Count == 0) return Ok(Array.Empty<RekapNilaiDto>());

        var terbaru = penugasan.GroupBy(x => x.IdGugus)
            .Select(grp => grp.OrderByDescending(x => x.Id).First())
            .ToList();
        var idPenugasan = terbaru.Select(x => x.Id).ToHashSet();
        var idStream = terbaru.Select(x => x.IdStream).ToHashSet();

        var kriteria = await _db.PenilaianKriteria.AsNoTracking().Where(k => k.Aktif).ToListAsync();
        var bobot = kriteria.ToDictionary(k => k.Id, k => k.BobotPersen);
        var jumlahKriteria = kriteria.GroupBy(k => k.JenisForm).ToDictionary(grp => grp.Key, grp => grp.Count());

        var anggota = await _db.PenilaianStreamAnggota.AsNoTracking()
            .Where(a => idStream.Contains(a.IdStream))
            .Select(a => new { a.IdStream, a.UserId }).ToListAsync();
        var anggotaPerStream = anggota.GroupBy(a => a.IdStream)
            .ToDictionary(grp => grp.Key, grp => grp.Select(a => a.UserId).ToList());

        var skor = await _db.PenilaianSkor.AsNoTracking()
            .Where(x => idPenugasan.Contains(x.IdPenugasan))
            .Select(x => new { x.IdPenugasan, x.IdKriteria, x.PenilaiUserId, x.Nilai }).ToListAsync();
        var skorPerPenugasan = skor.GroupBy(x => x.IdPenugasan).ToDictionary(grp => grp.Key, grp => grp.ToList());

        var hasil = new List<RekapNilaiDto>(terbaru.Count);
        foreach (var p in terbaru)
        {
            var form = FormFor(p.Jenis);
            var totalKriteria = jumlahKriteria.GetValueOrDefault(form);
            var penilai = anggotaPerStream.GetValueOrDefault(p.IdStream) ?? new List<string>();
            var baris = skorPerPenugasan.GetValueOrDefault(p.Id) ?? new();

            var nilaiLengkap = new List<decimal>();
            foreach (var userId in penilai)
            {
                var mine = baris.Where(x => x.PenilaiUserId == userId).ToList();
                if (totalKriteria == 0 || mine.Count < totalKriteria) continue;   // belum tuntas
                decimal nilai = 0m;
                foreach (var sc in mine)
                    if (bobot.TryGetValue(sc.IdKriteria, out var b)) nilai += (sc.Nilai / 10m) * b;
                nilaiLengkap.Add(Math.Round(nilai, 2));
            }

            var akhir = nilaiLengkap.Count > 0 ? Math.Round(nilaiLengkap.Average(), 2) : 0m;
            hasil.Add(new RekapNilaiDto(p.IdGugus, akhir,
                nilaiLengkap.Count > 0 ? Kategori(akhir) : "-",
                p.Status, nilaiLengkap.Count, penilai.Count));
        }
        return Ok(hasil);
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
            .Where(a => a.IdStream == p.IdStream).ToListAsync();
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

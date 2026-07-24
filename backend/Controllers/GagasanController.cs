using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Data;
using SsoBackend.Models.Dto;
using SsoBackend.Models.Inovasi;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

// Sumbang Gagasan: usulan awal (latar belakang + masalah + solusi) yang dinilai
// berjenjang sebelum menjadi gugus inovasi (SS/GIO/5R). Alur:
//   Karyawan kirim -> Verifikator (Manager bagian) verifikasi -> GM Kompartemen
//   Asal setujui + pilih metodologi -> [bila lintas kompartemen] GM Kompartemen
//   Tujuan setujui -> Ketua daftarkan menjadi risalah dan mengisi
//   Sekretaris/Anggota/Fasilitator sendiri.
[ApiController]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
[Route("inovasi/gagasan")]
public class GagasanController : ControllerBase
{
    private const string RoleVerifikator = "Verifikator";        // Manager bagian
    private const string RoleGmAsal = "GM Kompartemen Asal";
    private const string RoleGmTujuan = "GM Kompartemen Tujuan";

    private readonly InovasiDbContext _db;
    private readonly CurrentUserContext _currentUser;
    private readonly OrgResolver _org;

    public GagasanController(InovasiDbContext db, CurrentUserContext currentUser, OrgResolver org)
    {
        _db = db;
        _currentUser = currentUser;
        _org = org;
    }

    // ---- daftar Departemen (untuk pilihan tujuan) ----
    [HttpGet("/inovasi/departemen")]
    public async Task<ActionResult<IReadOnlyList<UnitRingkas>>> Departemen()
        => Ok(await _org.ListDepartemenAsync());

    // ---- daftar Kompartemen (untuk filter direktori pegawai) ----
    [HttpGet("/inovasi/kompartemen")]
    public async Task<ActionResult<IReadOnlyList<UnitRingkas>>> Kompartemen()
        => Ok(await _org.ListKompartemenAsync());

    // ---- peran pengguna pada modul inovasi (menu approver vs karyawan) ----
    [HttpGet("/inovasi/peran")]
    public async Task<ActionResult<InovasiPeranDto>> Peran()
    {
        var (nik, _) = await IdentitasAsync();
        if (nik is null) return Ok(new InovasiPeranDto("Karyawan", false));

        // Band jabatan aktif menentukan peran: 1 = GM, 2 = Manager, selain itu Karyawan.
        var band = await (
            from p in _db.Penempatan
            join j in _db.Jabatan on p.IdJabatan equals j.IdJabatan
            where p.IdKaryawan == nik && p.Status == "Aktif"
            select (byte?)j.IdBand).FirstOrDefaultAsync();

        var peran = band switch { 1 => "GM", 2 => "Manager", _ => "Karyawan" };
        return Ok(new InovasiPeranDto(peran, peran is "GM" or "Manager"));
    }

    // ---- list ----
    [HttpGet]
    public async Task<ActionResult<GagasanListDto>> List()
    {
        var (nik, _) = await IdentitasAsync();
        if (nik is null) return Unauthorized(new { message = "Akun tidak tertaut ke NIK pegawai." });

        var rows = await _db.Gagasan.AsNoTracking()
            .Where(g => g.CreatedByNik == nik || g.Approval.Any(a => a.Nik == nik))
            .OrderByDescending(g => g.UpdatedAt ?? g.CreatedAt)
            .Select(g => new
            {
                g.Id, g.NoRegistrasi, g.Judul, g.Metodologi, g.NamaDepartemenAsal, g.NamaDepartemenTujuan,
                g.Status, g.CreatedByNik, g.IdGugus, g.CreatedAt,
                PeranAppr = g.Approval.Where(a => a.Nik == nik).Select(a => a.Peran).FirstOrDefault(),
            })
            .ToListAsync();

        // Setelah terdaftar, gunakan nomor registrasi risalah agar sama dengan Daftar Inovasi.
        var gugusIds = rows.Where(r => r.IdGugus != null).Select(r => r.IdGugus!.Value).Distinct().ToList();
        var gugusNoReg = gugusIds.Count == 0
            ? new Dictionary<int, string?>()
            : await _db.Gugus.AsNoTracking().Where(x => gugusIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.NoRegistrasi);

        var items = rows.Select(g => new GagasanRingkasDto(
            g.Id,
            (g.IdGugus is int gid && gugusNoReg.TryGetValue(gid, out var gn) ? gn : null) ?? g.NoRegistrasi,
            g.Judul, g.Metodologi, g.NamaDepartemenAsal, g.NamaDepartemenTujuan, g.Status,
            PeranSaya: g.CreatedByNik == nik ? "Pengaju" : g.PeranAppr ?? "-",
            g.IdGugus, g.CreatedAt)).ToList();

        return Ok(new GagasanListDto(items));
    }

    // ---- create ----
    [HttpPost]
    public async Task<ActionResult<GagasanDetailDto>> Create(CreateGagasanRequest req)
    {
        var (nik, nama) = await IdentitasAsync();
        if (nik is null) return Unauthorized(new { message = "Akun tidak tertaut ke NIK pegawai." });
        if (string.IsNullOrWhiteSpace(req.Judul)) return BadRequest(new { message = "Judul gagasan wajib diisi." });

        var asal = await _org.ResolveAsync(nik);

        // Tujuan: default = departemen asal. Bila memilih departemen lain, resolusi dept/komp-nya.
        int? idDeptTujuan = null; string? namaDeptTujuan = null; int? idKompTujuan = null; string? namaKompTujuan = null;
        var antarDept = req.IdDepartemenTujuan is { } tujuanUnit && tujuanUnit != asal.IdDepartemen;
        if (antarDept)
        {
            var t = await _org.ResolveUnitAsync(req.IdDepartemenTujuan!.Value);
            idDeptTujuan = t.IdDepartemen; namaDeptTujuan = t.NamaDepartemen;
            idKompTujuan = t.IdKompartemen; namaKompTujuan = t.NamaKompartemen;
        }
        var antarKomp = idKompTujuan is not null && idKompTujuan != asal.IdKompartemen;

        var g = new Gagasan
        {
            Judul = req.Judul.Trim(),
            LatarBelakang = req.LatarBelakang,
            Masalah = req.Masalah,
            Solusi = req.Solusi,
            CreatedByNik = nik,
            CreatedByNama = nama,
            IdDepartemenAsal = asal.IdDepartemen, NamaDepartemenAsal = asal.NamaDepartemen,
            IdKompartemenAsal = asal.IdKompartemen, NamaKompartemenAsal = asal.NamaKompartemen,
            IdDepartemenTujuan = idDeptTujuan, NamaDepartemenTujuan = namaDeptTujuan,
            IdKompartemenTujuan = idKompTujuan, NamaKompartemenTujuan = namaKompTujuan,
            Status = "Dikirim",
            CreatedAt = DateTime.Now,
            SubmittedAt = DateTime.Now,
            NoRegistrasi = await _org.GenerateNoGagasanAsync(),
        };

        // Rantai persetujuan: Verifikator (Manager) -> GM Kompartemen Asal -> [GM Kompartemen Tujuan].
        var manager = await _org.ResolveKepalaUnitAsync(asal.IdDepartemen);   // Manager departemen asal
        var gmAsal = await _org.ResolveKepalaUnitAsync(asal.IdKompartemen);   // GM kompartemen asal
        g.Approval.Add(new GagasanApproval { Urutan = 0, Peran = RoleVerifikator, Nik = manager?.Nik, Nama = manager?.Nama, Status = "Menunggu" });
        g.Approval.Add(new GagasanApproval { Urutan = 1, Peran = RoleGmAsal, Nik = gmAsal?.Nik, Nama = gmAsal?.Nama, Status = "Menunggu" });
        if (antarKomp)
        {
            var gmTujuan = await _org.ResolveKepalaUnitAsync(idKompTujuan);
            g.Approval.Add(new GagasanApproval { Urutan = 2, Peran = RoleGmTujuan, Nik = gmTujuan?.Nik, Nama = gmTujuan?.Nama, Status = "Menunggu" });
        }

        _db.Gagasan.Add(g);
        await _db.SaveChangesAsync();
        return await Detail(g.Id);
    }

    // ---- detail ----
    [HttpGet("{id:int}")]
    public async Task<ActionResult<GagasanDetailDto>> Detail(int id)
    {
        var (nik, _) = await IdentitasAsync();
        if (nik is null) return Unauthorized();

        var g = await _db.Gagasan.Include(x => x.Approval).FirstOrDefaultAsync(x => x.Id == id);
        if (g is null) return NotFound(new { message = "Gagasan tidak ditemukan." });
        if (g.CreatedByNik != nik && !g.Approval.Any(a => a.Nik == nik)) return Forbid();

        var steps = g.Approval.OrderBy(a => a.Urutan).ToList();
        var isOwner = g.CreatedByNik == nik;
        var bisaEdit = isOwner && (g.Status is "Dikirim" or "Revisi Verifikator" or "Revisi GM");
        var siapDaftar = isOwner && g.IdGugus is null && steps.Count > 0 && steps.All(a => a.Status == "Disetujui");

        var approvalDtos = steps.Select(a => new GagasanApprovalDto(
            a.Id, a.Urutan, a.Peran, a.Nik, a.Nama, a.Status, a.Komentar, a.Metodologi, a.Tgl,
            BisaSaya: BisaTandaTangan(steps, a, nik))).ToList();

        // Setelah terdaftar, tampilkan nomor registrasi risalah agar sama dengan Daftar Inovasi.
        var noReg = g.IdGugus is null ? g.NoRegistrasi
            : await _db.Gugus.Where(x => x.Id == g.IdGugus).Select(x => x.NoRegistrasi).FirstOrDefaultAsync() ?? g.NoRegistrasi;

        return Ok(new GagasanDetailDto(
            g.Id, noReg, g.Judul, g.LatarBelakang, g.Masalah, g.Solusi, g.Metodologi, g.CreatedByNik, g.CreatedByNama,
            g.IdDepartemenAsal, g.NamaDepartemenAsal, g.IdDepartemenTujuan, g.NamaDepartemenTujuan,
            g.Status, g.IdGugus, bisaEdit, isOwner, siapDaftar, g.CreatedAt, g.SubmittedAt, approvalDtos));
    }

    // ---- edit (pengaju, saat Dikirim/Revisi) ----
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, UpdateGagasanRequest req)
    {
        var (nik, _) = await IdentitasAsync();
        if (nik is null) return Unauthorized();

        var g = await _db.Gagasan.Include(x => x.Approval).FirstOrDefaultAsync(x => x.Id == id);
        if (g is null) return NotFound(new { message = "Gagasan tidak ditemukan." });
        if (g.CreatedByNik != nik) return Forbid();
        if (g.Status is not ("Dikirim" or "Revisi Verifikator" or "Revisi GM"))
            return BadRequest(new { message = "Gagasan tidak bisa diubah pada status saat ini." });
        if (string.IsNullOrWhiteSpace(req.Judul)) return BadRequest(new { message = "Judul wajib diisi." });

        g.Judul = req.Judul.Trim();
        g.LatarBelakang = req.LatarBelakang;
        g.Masalah = req.Masalah;
        g.Solusi = req.Solusi;
        g.UpdatedAt = DateTime.Now;

        // Bila sebelumnya diminta revisi, kembalikan langkah 'Revisi' -> 'Menunggu'.
        foreach (var a in g.Approval.Where(a => a.Status == "Revisi"))
        {
            a.Status = "Menunggu";
            a.Tgl = null;
        }
        g.Status = ComputeStatus(g);

        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ---- approval action (Verifikator / GM Kompartemen) ----
    [HttpPost("{id:int}/approval")]
    public async Task<IActionResult> Act(int id, GagasanApprovalActionRequest req)
    {
        var (nik, _) = await IdentitasAsync();
        if (nik is null) return Unauthorized();

        var g = await _db.Gagasan.Include(x => x.Approval).FirstOrDefaultAsync(x => x.Id == id);
        if (g is null) return NotFound(new { message = "Gagasan tidak ditemukan." });

        var steps = g.Approval.OrderBy(a => a.Urutan).ToList();
        var mine = steps.FirstOrDefault(a => a.Nik == nik && a.Status == "Menunggu" && BisaTandaTangan(steps, a, nik));
        if (mine is null) return Forbid();

        var aksi = req.Aksi?.Trim();
        if (aksi is not ("Disetujui" or "Revisi" or "Ditolak")) return BadRequest(new { message = "Aksi tidak dikenal." });

        // GM Kompartemen Asal memilih metodologi saat menyetujui.
        if (aksi == "Disetujui" && mine.Peran == RoleGmAsal)
        {
            var m = req.Metodologi?.Trim().ToUpperInvariant();
            if (m is not ("SS" or "GIO" or "5R"))
                return BadRequest(new { message = "GM Kompartemen wajib memilih metodologi (SS/GIO/5R)." });
            mine.Metodologi = m;
            g.Metodologi = m;
        }

        mine.Status = aksi;
        mine.Komentar = req.Komentar?.Trim();
        mine.Tgl = DateTime.Now;

        // Cascade: langkah berikutnya dengan approver (nik) sama otomatis disetujui.
        if (aksi == "Disetujui")
        {
            foreach (var next in steps.Where(a => a.Urutan > mine.Urutan).OrderBy(a => a.Urutan))
            {
                if (next.Status == "Menunggu" && next.Nik == nik) { next.Status = "Disetujui"; next.Tgl = DateTime.Now; }
                else break;
            }
        }

        g.Status = ComputeStatus(g);
        g.UpdatedAt = DateTime.Now;
        await _db.SaveChangesAsync();
        return Ok(new { g.Status });
    }

    // ---- daftarkan Inovasi (buat gugus; Ketua isi anggota sendiri) ----
    [HttpPost("{id:int}/daftar")]
    public async Task<ActionResult<DaftarGagasanResultDto>> Daftar(int id, DaftarGagasanRequest req)
    {
        var (nik, nama) = await IdentitasAsync();
        if (nik is null) return Unauthorized();

        var g = await _db.Gagasan.Include(x => x.Approval).FirstOrDefaultAsync(x => x.Id == id);
        if (g is null) return NotFound(new { message = "Gagasan tidak ditemukan." });
        if (g.CreatedByNik != nik) return Forbid();
        if (g.IdGugus is not null) return BadRequest(new { message = "Gagasan sudah terdaftar." });

        var steps = g.Approval.OrderBy(a => a.Urutan).ToList();
        if (steps.Count == 0 || !steps.All(a => a.Status == "Disetujui"))
            return BadRequest(new { message = "Gagasan belum disetujui seluruh approver." });

        var jenis = (req.Metodologi ?? g.Metodologi)?.Trim().ToUpperInvariant();
        if (jenis is not ("SS" or "GIO" or "5R")) return BadRequest(new { message = "Metodologi belum ditetapkan GM." });

        // Departemen gugus = tujuan bila lintas, selain itu asal.
        var idDept = g.IdDepartemenTujuan ?? g.IdDepartemenAsal;
        var namaDept = g.NamaDepartemenTujuan ?? g.NamaDepartemenAsal;
        var idKomp = g.IdKompartemenTujuan ?? g.IdKompartemenAsal;
        var namaKomp = g.NamaKompartemenTujuan ?? g.NamaKompartemenAsal;

        var periode = string.IsNullOrWhiteSpace(req.Periode) ? DefaultPeriode() : req.Periode.Trim();
        // Nomor registrasi inovasi diterbitkan saat daftar (bukan saat submit) agar
        // sama antara Verifikasi Gagasan dan Daftar Inovasi. Format per-metodologi.
        var noReg = await _org.GenerateNoRegistrasiAsync(jenis!, periode, idDept, idKomp);
        var gugus = new Gugus
        {
            Jenis = jenis!,
            Periode = periode,
            TemaKe = req.TemaKe,
            NamaGugus = req.NamaGugus?.Trim(),
            NoRegistrasi = noReg,
            Judul = g.Judul,
            LatarBelakang = g.LatarBelakang,
            MasalahUtama = g.Masalah,
            IdDepartemen = idDept, NamaDepartemen = namaDept,
            IdKompartemen = idKomp, NamaKompartemen = namaKomp,
            IdGagasan = g.Id,
            Status = "Draft",
            CreatedByNik = nik,
            CreatedByNama = nama,
            CreatedAt = DateTime.Now,
        };
        // Hanya Ketua (pengaju) yang terisi otomatis; Sekretaris/Anggota/Fasilitator
        // dilengkapi Ketua di form risalah.
        gugus.Anggota.Add(new Anggota
        {
            Peran = "Ketua", Nik = nik, Nama = nama ?? nik, Urutan = 1,
            Jabatan = await _org.ResolveJabatanNamaAsync(nik),
            DepBagian = namaDept ?? namaKomp,
        });

        // Template awal risalah (mengikuti format resmi PT GCS): kerangka QCDSE
        // dan fishbone sudah tersedia agar Ketua tinggal mengisi. Metodologi
        // menentukan detail lain (Pareto/verifikasi akar untuk GIO) yang diisi
        // di form. Latar belakang, masalah, dan judul dibawa dari gagasan.
        foreach (var aspek in new[] { "Q", "C", "D", "S", "E", "M" })
            gugus.Qcdse.Add(new Qcdse { Aspek = aspek });
        foreach (var faktor in new[] { "Man", "Method", "Machine", "Material", "Environment" })
            gugus.Fishbone.Add(new Fishbone { Faktor = faktor });

        _db.Gugus.Add(gugus);
        await _db.SaveChangesAsync();

        g.IdGugus = gugus.Id;
        g.Status = "Terdaftar";
        g.UpdatedAt = DateTime.Now;
        await _db.SaveChangesAsync();

        return Ok(new DaftarGagasanResultDto(gugus.Id, jenis!, "/my-innovation"));
    }

    // ---- delete ----
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var (nik, _) = await IdentitasAsync();
        if (nik is null) return Unauthorized();

        var g = await _db.Gagasan.FirstOrDefaultAsync(x => x.Id == id);
        if (g is null) return NotFound(new { message = "Gagasan tidak ditemukan." });
        if (g.CreatedByNik != nik) return Forbid();
        if (g.IdGugus is not null) return BadRequest(new { message = "Gagasan sudah terdaftar; tidak bisa dihapus." });

        _db.Gagasan.Remove(g);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ===================================================================
    private async Task<(string? Nik, string? Nama)> IdentitasAsync()
    {
        var (user, pegawai) = await _currentUser.ResolveAsync(User);
        var nik = pegawai?.ID_KARYAWAN ?? user?.Nik;
        var nama = pegawai?.NAMA_LENGKAP ?? user?.Name;
        return (string.IsNullOrWhiteSpace(nik) ? null : nik, nama);
    }

    private static bool BisaTandaTangan(List<GagasanApproval> steps, GagasanApproval row, string nik)
    {
        if (row.Nik != nik || row.Status != "Menunggu") return false;
        return steps.Where(a => a.Urutan < row.Urutan).All(a => a.Status == "Disetujui");
    }

    // Status keseluruhan gagasan diturunkan dari langkah-langkahnya.
    private static string ComputeStatus(Gagasan g)
    {
        if (g.IdGugus is not null) return "Terdaftar";
        var steps = g.Approval;
        if (steps.Any(a => a.Status == "Ditolak")) return "Ditolak";

        var verif = steps.FirstOrDefault(a => a.Peran == RoleVerifikator);
        if (verif?.Status == "Revisi") return "Revisi Verifikator";
        if (steps.Any(a => a.Status == "Revisi" && a.Peran != RoleVerifikator)) return "Revisi GM";

        var gmTujuan = steps.FirstOrDefault(a => a.Peran == RoleGmTujuan);
        if (gmTujuan?.Status == "Disetujui") return "Disetujui GM Kompartemen Tujuan";
        var gmAsal = steps.FirstOrDefault(a => a.Peran == RoleGmAsal);
        if (gmAsal?.Status == "Disetujui") return "Disetujui GM Kompartemen Asal";
        if (verif?.Status == "Disetujui") return "Disetujui Verifikator";
        return "Dikirim";
    }

    private static string DefaultPeriode()
    {
        var now = DateTime.Now;
        var awal = now.Month >= 6 ? now.Year : now.Year - 1;
        return $"{awal}/{awal + 1}";
    }
}

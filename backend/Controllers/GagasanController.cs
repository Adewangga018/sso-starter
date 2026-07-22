using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Data;
using SsoBackend.Models.Dto;
using SsoBackend.Models.Inovasi;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

// Sumbang Gagasan: usulan awal (judul + latar belakang) yang dinilai berjenjang
// sebelum menjadi gugus inovasi (SS/GIO/5R). Alur (mengacu SERGIO):
//   Karyawan kirim -> Fasilitator (Manager) verifikasi -> Verifikator (GM) pilih
//   metodologi -> VP Departemen Asal -> [bila antar-departemen] VP Departemen
//   Tujuan -> Daftarkan ke SERGIO (jadi gugus).
[ApiController]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
[Route("inovasi/gagasan")]
public class GagasanController : ControllerBase
{
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

        var items = rows.Select(g => new GagasanRingkasDto(
            g.Id, g.NoRegistrasi, g.Judul, g.Metodologi, g.NamaDepartemenAsal, g.NamaDepartemenTujuan, g.Status,
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

        var g = new Gagasan
        {
            Judul = req.Judul.Trim(),
            LatarBelakang = req.LatarBelakang,
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

        // Rantai persetujuan.
        var fasil = await _org.ResolveKepalaUnitAsync(asal.IdDepartemen);   // Manager departemen asal
        var gm = await _org.ResolveKepalaUnitAsync(asal.IdKompartemen);     // GM kompartemen asal
        g.Approval.Add(new GagasanApproval { Urutan = 0, Peran = "Fasilitator", Nik = fasil?.Nik, Nama = fasil?.Nama, Status = "Menunggu" });
        g.Approval.Add(new GagasanApproval { Urutan = 1, Peran = "Verifikator", Nik = gm?.Nik, Nama = gm?.Nama, Status = "Menunggu" });
        g.Approval.Add(new GagasanApproval { Urutan = 2, Peran = "VP Departemen Asal", Nik = gm?.Nik, Nama = gm?.Nama, Status = "Menunggu" });
        if (antarDept)
        {
            var gmTujuan = await _org.ResolveKepalaUnitAsync(idKompTujuan);
            g.Approval.Add(new GagasanApproval { Urutan = 3, Peran = "VP Departemen Tujuan", Nik = gmTujuan?.Nik, Nama = gmTujuan?.Nama, Status = "Menunggu" });
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
        var bisaEdit = isOwner && (g.Status is "Dikirim" or "Revisi Fasilitator" or "Revisi Verifikator");
        var siapDaftar = isOwner && g.IdGugus is null && steps.Count > 0 && steps.All(a => a.Status == "Disetujui");

        var approvalDtos = steps.Select(a => new GagasanApprovalDto(
            a.Id, a.Urutan, a.Peran, a.Nik, a.Nama, a.Status, a.Komentar, a.Metodologi, a.Tgl,
            BisaSaya: BisaTandaTangan(steps, a, nik))).ToList();

        return Ok(new GagasanDetailDto(
            g.Id, g.NoRegistrasi, g.Judul, g.LatarBelakang, g.Metodologi, g.CreatedByNik, g.CreatedByNama,
            g.IdDepartemenAsal, g.NamaDepartemenAsal, g.IdDepartemenTujuan, g.NamaDepartemenTujuan,
            g.FasilitatorNik, g.FasilitatorNama, g.PembinaNik, g.PembinaNama,
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
        if (g.Status is not ("Dikirim" or "Revisi Fasilitator" or "Revisi Verifikator"))
            return BadRequest(new { message = "Gagasan tidak bisa diubah pada status saat ini." });
        if (string.IsNullOrWhiteSpace(req.Judul)) return BadRequest(new { message = "Judul wajib diisi." });

        g.Judul = req.Judul.Trim();
        g.LatarBelakang = req.LatarBelakang;
        g.UpdatedAt = DateTime.Now;

        // Bila sebelumnya diminta revisi, kembalikan langkah yang 'Revisi' -> 'Menunggu'
        // agar approver terkait menilai ulang.
        foreach (var a in g.Approval.Where(a => a.Status == "Revisi"))
        {
            a.Status = "Menunggu";
            a.Tgl = null;
        }
        g.Status = ComputeStatus(g);

        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ---- approval action (Fasilitator/Verifikator/VP) ----
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

        if (aksi == "Disetujui" && mine.Peran == "Verifikator")
        {
            // GM (Verifikator) memilih metodologi + menetapkan Fasilitator (semua) &
            // Pembina (GIO), lewat pencarian pegawai.
            var m = req.Metodologi?.Trim().ToUpperInvariant();
            if (m is not ("SS" or "GIO" or "5R"))
                return BadRequest(new { message = "GM wajib memilih metodologi (SS/GIO/5R)." });

            // Aturan lingkup: SS hanya untuk satu departemen (tidak boleh lintas departemen).
            if (m == "SS" && g.IdDepartemenTujuan is not null)
                return BadRequest(new { message = "Sistem Saran (SS) hanya untuk satu departemen. Gagasan lintas departemen harus GIO atau 5R." });

            if (string.IsNullOrWhiteSpace(req.FasilitatorNik))
                return BadRequest(new { message = "GM wajib menetapkan Fasilitator." });
            if (m == "GIO" && string.IsNullOrWhiteSpace(req.PembinaNik))
                return BadRequest(new { message = "GM wajib menetapkan Pembina untuk GIO." });

            mine.Metodologi = m;
            g.Metodologi = m;
            g.FasilitatorNik = req.FasilitatorNik.Trim();
            g.FasilitatorNama = req.FasilitatorNama?.Trim();
            if (m == "GIO")
            {
                g.PembinaNik = req.PembinaNik!.Trim();
                g.PembinaNama = req.PembinaNama?.Trim();
            }
            else
            {
                g.PembinaNik = null;
                g.PembinaNama = null;
            }
        }

        mine.Status = aksi;
        mine.Komentar = req.Komentar?.Trim();
        mine.Tgl = DateTime.Now;

        // Cascade: langkah berikutnya dengan approver (nik) sama otomatis disetujui.
        if (aksi == "Disetujui")
        {
            foreach (var next in steps.Where(a => a.Urutan > mine.Urutan).OrderBy(a => a.Urutan))
            {
                if (next.Status == "Menunggu" && next.Nik == nik)
                {
                    next.Status = "Disetujui";
                    next.Tgl = DateTime.Now;
                }
                else break;
            }
        }

        g.Status = ComputeStatus(g);
        g.UpdatedAt = DateTime.Now;
        await _db.SaveChangesAsync();
        return Ok(new { g.Status });
    }

    // ---- daftarkan ke SERGIO (buat gugus) ----
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
        // 5R memakai template yang sama dengan SS (siklus PDCA).
        if (jenis is not ("SS" or "GIO" or "5R")) return BadRequest(new { message = "Metodologi tidak valid (harus SS, GIO, atau 5R)." });

        // Departemen gugus = tujuan bila antar-departemen, selain itu asal.
        var idDept = g.IdDepartemenTujuan ?? g.IdDepartemenAsal;
        var namaDept = g.NamaDepartemenTujuan ?? g.NamaDepartemenAsal;
        var idKomp = g.IdKompartemenTujuan ?? g.IdKompartemenAsal;
        var namaKomp = g.NamaKompartemenTujuan ?? g.NamaKompartemenAsal;

        var periode = string.IsNullOrWhiteSpace(req.Periode) ? DefaultPeriode() : req.Periode.Trim();
        var gugus = new Gugus
        {
            Jenis = jenis!,
            Periode = periode,
            TemaKe = req.TemaKe,
            NamaGugus = req.NamaGugus?.Trim(),
            Judul = g.Judul,
            LatarBelakang = g.LatarBelakang,
            IdDepartemen = idDept, NamaDepartemen = namaDept,
            IdKompartemen = idKomp, NamaKompartemen = namaKomp,
            IdGagasan = g.Id,
            Status = "Draft",
            CreatedByNik = nik,
            CreatedByNama = nama,
            CreatedAt = DateTime.Now,
        };
        // Ketua = pengaju; Fasilitator (semua) & Pembina (GIO) sesuai penetapan GM.
        // Sekretaris/Anggota lain diisi pengaju di form risalah.
        var urut = 1;
        gugus.Anggota.Add(new Anggota { Peran = "Ketua", Nik = nik, Nama = nama ?? nik, Urutan = urut++, DepBagian = namaDept ?? namaKomp });
        if (!string.IsNullOrWhiteSpace(g.FasilitatorNik))
            gugus.Anggota.Add(new Anggota { Peran = "Fasilitator", Nik = g.FasilitatorNik, Nama = g.FasilitatorNama ?? g.FasilitatorNik, Urutan = urut++ });
        if (jenis == "GIO" && !string.IsNullOrWhiteSpace(g.PembinaNik))
            gugus.Anggota.Add(new Anggota { Peran = "Pembina", Nik = g.PembinaNik, Nama = g.PembinaNama ?? g.PembinaNik, Urutan = urut++ });

        _db.Gugus.Add(gugus);
        await _db.SaveChangesAsync();

        g.IdGugus = gugus.Id;
        g.Status = "Terdaftar Sergio";
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
        if (g.IdGugus is not null) return "Terdaftar Sergio";
        var steps = g.Approval;
        if (steps.Any(a => a.Status == "Ditolak")) return "Ditolak";

        var fasil = steps.FirstOrDefault(a => a.Peran == "Fasilitator");
        if (fasil?.Status == "Revisi") return "Revisi Fasilitator";
        if (steps.Any(a => a.Status == "Revisi" && a.Peran != "Fasilitator")) return "Revisi Verifikator";

        var vpTujuan = steps.FirstOrDefault(a => a.Peran == "VP Departemen Tujuan");
        if (vpTujuan?.Status == "Disetujui") return "Disetujui VP Departemen Tujuan";
        var vpAsal = steps.FirstOrDefault(a => a.Peran == "VP Departemen Asal");
        if (vpAsal?.Status == "Disetujui") return "Disetujui VP Departemen Asal";
        var verif = steps.FirstOrDefault(a => a.Peran == "Verifikator");
        if (verif?.Status == "Disetujui") return "Disetujui Verifikator";
        if (fasil?.Status == "Disetujui") return "Disetujui Fasilitator";
        return "Dikirim";
    }

    private static string DefaultPeriode()
    {
        var now = DateTime.Now;
        var awal = now.Month >= 6 ? now.Year : now.Year - 1;
        return $"{awal}/{awal + 1}";
    }
}

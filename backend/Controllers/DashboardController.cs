using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Data;
using SsoBackend.Models.Dto;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

[ApiController]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
[Route("dashboard")]
public class DashboardController : ControllerBase
{
    private const string AdminRole = "Admin";

    private readonly CurrentUserContext _currentUser;
    private readonly GcsDbContext _db;
    private readonly PosisiResolver _posisi;
    private readonly ModuleAccessService _access;
    private readonly ModuleSettingsService _modules;

    public DashboardController(
        CurrentUserContext currentUser,
        GcsDbContext db,
        PosisiResolver posisi,
        ModuleAccessService access,
        ModuleSettingsService modules)
    {
        _currentUser = currentUser;
        _db = db;
        _posisi = posisi;
        _access = access;
        _modules = modules;
    }

    [HttpGet("summary")]
    public async Task<ActionResult<DashboardSummaryDto>> GetSummary()
    {
        var (user, pegawai) = await _currentUser.ResolveAsync(User);
        if (user is null)
        {
            return Unauthorized();
        }

        // Jabatan & tingkatan hanya pelengkap tampilan: kalau pegawainya belum tertaut,
        // dashboard tetap tampil tanpa baris jabatan - bukan alasan menggagalkan halaman.
        //
        // Sumber jabatan/level: SISTEM GRADING BERBASIS BAND (PosisiResolver), sesuai
        // dokumen "Data 85 Pegawai Organik". Untuk pegawai yang ADA di grading, jabatan
        // struktural & tingkatan diambil dari sana (bersih; tidak ada "Lakma"/"Pjs ...").
        // Untuk yang di luar grading (mis. TKNO), pakai jabatan legacy SDM setelah
        // dibersihkan dari awalan pejabat sementara / label tanpa makna.
        string? jabatan = null, tingkatan = null;
        int? band = null;
        if (pegawai is not null)
        {
            var posisi = await _posisi.ResolveAsync(pegawai.ID_KARYAWAN);
            tingkatan = posisi.Tingkatan;
            band = posisi.Band;

            if (posisi.Jabatan is not null)
            {
                jabatan = posisi.Jabatan;
            }
            else
            {
                var legacy = await _db.PegawaiSdm
                    .Where(p => p.Nik == pegawai.ID_KARYAWAN)
                    .Select(p => p.nm_jabatan)
                    .FirstOrDefaultAsync();
                jabatan = PosisiResolver.BersihkanJabatanLegacy(legacy);
            }
        }

        var profileComplete = pegawai is not null && ProfileRules.IsComplete(pegawai);
        var isAdminModulSdm = pegawai is not null && await _access.IsSdmAdminAsync(pegawai.ID_KARYAWAN);

        // Kartu modul mengikuti Panel Admin IT > Akses Modul. Daftarnya selalu lengkap;
        // modul yang dikunci ke Admin IT dikirim sebagai kartu terkunci ("Coming Soon"),
        // bukan dihilangkan - lihat ModuleSettingsService.GetTilesForAsync.
        var isAdmin = User.HasClaim(c => (c.Type == "role" || c.Type == ClaimTypes.Role) && c.Value == AdminRole);
        var modules = await _modules.GetTilesForAsync(isAdmin);

        return Ok(new DashboardSummaryDto(user.Name, jabatan, modules, profileComplete, tingkatan, band, isAdminModulSdm));
    }
}

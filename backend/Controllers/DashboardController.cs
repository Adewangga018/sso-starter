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
    private readonly CurrentUserContext _currentUser;
    private readonly GcsDbContext _db;
    private readonly PosisiResolver _posisi;
    private readonly ModuleAccessService _access;

    public DashboardController(CurrentUserContext currentUser, GcsDbContext db, PosisiResolver posisi, ModuleAccessService access)
    {
        _currentUser = currentUser;
        _db = db;
        _posisi = posisi;
        _access = access;
    }

    private static readonly IReadOnlyList<ModuleTileDto> Modules = new[]
    {
        new ModuleTileDto("my-personal", "My Personal", "HR MANAGEMENT", "users", true),
        new ModuleTileDto("my-office", "My Office", "SURAT-MENYURAT", "mail", true),
        new ModuleTileDto("my-prosedur", "My Prosedur", "SOP & KEBIJAKAN", "clipboard-check", false),
        new ModuleTileDto("my-health", "My Health", "KESEHATAN", "activity", false),
        new ModuleTileDto("my-innovation", "My Innovation", "INOVASI", "lightbulb", true),
        new ModuleTileDto("my-asset", "My Asset", "ASET", "archive", true),
        new ModuleTileDto("my-progress", "My Progress", "KPI", "trending-up", true),
        new ModuleTileDto("my-team", "My Team", "KINERJA TIM", "users-round", true),
    };

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

        // Nama tampilan: utamakan NAMA_LENGKAP dari data pegawai (mis. "Diah Puspitasari"),
        // bukan nama akun/token yang bisa berupa username singkat ("diah").
        var nama = !string.IsNullOrWhiteSpace(pegawai?.NAMA_LENGKAP) ? pegawai!.NAMA_LENGKAP.Trim() : user.Name;

        var profileComplete = pegawai is not null && ProfileRules.IsComplete(pegawai);
        var isAdminModulSdm = pegawai is not null && await _access.IsSdmAdminAsync(pegawai.ID_KARYAWAN);
        return Ok(new DashboardSummaryDto(nama, jabatan, Modules, profileComplete, tingkatan, band, isAdminModulSdm));
    }
}

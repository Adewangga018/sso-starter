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
    private readonly FeatureSettingsService _features;

    public DashboardController(
        CurrentUserContext currentUser,
        GcsDbContext db,
        PosisiResolver posisi,
        ModuleAccessService access,
        ModuleSettingsService modules,
        FeatureSettingsService features)
    {
        _currentUser = currentUser;
        _db = db;
        _posisi = posisi;
        _access = access;
        _modules = modules;
        _features = features;
    }

    // Daftar modul tidak lagi statis di sini: katalognya di ModuleCatalog dan status
    // aktif/aksesnya diatur Admin IT (Panel Admin > Akses Modul).
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
        // IsSdmAdminAsync kini otomatis true utk Admin IT jg (bypass di ModuleAccessService,
        // tak lagi bergantung pegawai != null - Admin IT bisa saja tak tertaut NIK).
        var isAdminModulSdm = await _access.IsSdmAdminAsync(pegawai?.ID_KARYAWAN);

        // Kartu modul mengikuti Panel Admin IT > Akses Modul. Daftarnya selalu lengkap;
        // modul yang dikunci ke Admin IT dikirim sebagai kartu terkunci ("Coming Soon"),
        // bukan dihilangkan - lihat ModuleSettingsService.GetTilesForAsync.
        var isAdmin = User.HasClaim(c => (c.Type == "role" || c.Type == ClaimTypes.Role) && c.Value == AdminRole);
        var nik = pegawai?.ID_KARYAWAN;
        var modules = await _modules.GetTilesForAsync(isAdmin, key => _access.IsModuleAdminAsync(key, nik));

        // Modul "Payroll" khusus Admin Modul SDM (konfigurasi tarif gaji). Tidak ada di
        // katalog modul umum; kartunya hanya ditambahkan untuk yang berhak. Ini juga jadi
        // penjaga rute /payroll (RequireModule "payroll" hanya lolos bila kartu ini ada).
        if (isAdminModulSdm)
        {
            modules = modules.Append(new ModuleTileDto("payroll", "Payroll", "GAJI & TARIF", "wallet", true)).ToList();
            // Modul "Struktur Organisasi" - sama pola dengan Payroll di atas (khusus Admin
            // Modul SDM, kartu jadi penjaga rute /org lewat RequireModule).
            modules = modules.Append(new ModuleTileDto("org", "Struktur Organisasi", "UNIT & JABATAN", "network", true)).ToList();
        }

        var lockedFeatures = await _features.GetLockedKeysAsync();
        return Ok(new DashboardSummaryDto(nama, jabatan, modules, profileComplete, tingkatan, band, isAdminModulSdm, lockedFeatures));
    }
}

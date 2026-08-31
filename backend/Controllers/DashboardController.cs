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

        // Jabatan & tingkatan hanya pelengkap tampilan: kalau NIK-nya tidak diketahui sama
        // sekali, dashboard tetap tampil tanpa baris jabatan - bukan alasan menggagalkan halaman.
        //
        // Sumber jabatan/level: SISTEM GRADING BERBASIS BAND (PosisiResolver), sesuai
        // dokumen "Data 85 Pegawai Organik". Untuk pegawai yang ADA di grading, jabatan
        // struktural & tingkatan diambil dari sana (bersih; tidak ada "Lakma"/"Pjs ...").
        // Untuk yang di luar grading (mis. TKNO), pakai jabatan legacy SDM setelah
        // dibersihkan dari awalan pejabat sementara / label tanpa makna.
        //
        // NIK dipakai untuk resolusi ini adalah NIK dari TOKEN LOGIN (user.Nik), BUKAN
        // disyaratkan sudah ada baris MST_PEGAWAI (pegawai != null) - keduanya independen.
        // MST_PEGAWAI hanya terisi kalau orangnya pernah menyimpan My Personal > Profil
        // (lihat PersonalController.UpdateProfile, "doubles as self-registration"); Direksi/
        // eksekutif yang tak pernah menyentuh My Personal tetap harus dapat jabatannya tampil
        // di header selama sudah ditempatkan di Struktur Organisasi - ditemukan 2026-08-28,
        // kasus Nugroho Iman Prakosa (Direktur Keuangan, grading.penempatan aktif & benar,
        // tapi header tampil "Pegawai Organik" krn belum pernah isi profil -> pegawai null).
        string? jabatan = null, tingkatan = null;
        int? band = null;
        var nikUntukPosisi = pegawai?.ID_KARYAWAN ?? user.Nik;
        if (!string.IsNullOrWhiteSpace(nikUntukPosisi))
        {
            var posisi = await _posisi.ResolveAsync(nikUntukPosisi);
            tingkatan = posisi.Tingkatan;
            band = posisi.Band;

            if (posisi.Jabatan is not null)
            {
                jabatan = posisi.Jabatan;
            }
            else
            {
                var legacy = await _db.PegawaiSdm
                    .Where(p => p.Nik == nikUntukPosisi)
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
        // tak lagi bergantung pegawai != null - Admin IT bisa saja tak tertaut NIK). Dipakai
        // nikUntukPosisi (NIK token, BUKAN pegawai?.ID_KARYAWAN) - Direksi tidak pernah
        // mengisi MST_PEGAWAI (form itu untuk karyawan, bukan mereka - diklarifikasi user
        // 2026-08-28), jadi pegawai selalu null utk mereka meski penempatan grading-nya
        // benar; pakai pegawai?.ID_KARYAWAN di sini membuat mrk selalu gagal cek admin-modul
        // walau band Direksi-nya sudah diizinkan di ModuleAccessService.IsDeptAdminAsync.
        var isAdminModulSdm = await _access.IsSdmAdminAsync(nikUntukPosisi);

        // Kartu modul mengikuti Panel Admin IT > Akses Modul. Daftarnya selalu lengkap;
        // modul yang dikunci ke Admin IT dikirim sebagai kartu terkunci ("Coming Soon"),
        // bukan dihilangkan - lihat ModuleSettingsService.GetTilesForAsync.
        var isAdmin = User.HasClaim(c => (c.Type == "role" || c.Type == ClaimTypes.Role) && c.Value == AdminRole);
        var modules = await _modules.GetTilesForAsync(isAdmin, key => _access.IsModuleAdminAsync(key, nikUntukPosisi));

        // Modul "HR Management" (gabungan Payroll + Struktur Organisasi, 2026-08-20) khusus
        // Admin Modul SDM. Tidak ada di katalog modul umum; kartunya hanya ditambahkan untuk
        // yang berhak. Ini juga jadi penjaga rute /payroll & /org (RequireModule
        // "hr-management" hanya lolos bila kartu ini ada) - lihat frontend App.jsx.
        if (isAdminModulSdm)
        {
            modules = modules.Append(new ModuleTileDto("hr-management", "Admin SDM", "PAYROLL & STRUKTUR ORGANISASI", "user-cog", true)).ToList();
        }

        var lockedFeatures = await _features.GetLockedKeysAsync();
        return Ok(new DashboardSummaryDto(nama, jabatan, modules, profileComplete, tingkatan, band, isAdminModulSdm, lockedFeatures));
    }
}

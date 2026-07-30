using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace SsoBackend.Services;

// Penjaga akses modul di sisi server. Dipasang di controller yang melayani satu modul,
// mis. [ModuleGate("my-office")] di OfficeController. Menyembunyikan kartu modul di
// dashboard saja tidak cukup - tanpa penjaga ini pengguna masih bisa memanggil API-nya
// langsung. Pengaturannya berasal dari Panel Admin IT > Akses Modul.
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false)]
public sealed class ModuleGateAttribute : TypeFilterAttribute
{
    public ModuleGateAttribute(string moduleKey) : base(typeof(ModuleGateFilter))
    {
        Arguments = [moduleKey];
    }
}

// public, bukan internal: instansinya dibuat lewat refleksi oleh TypeFilterAttribute.
public sealed class ModuleGateFilter : IAsyncAuthorizationFilter
{
    private const string AdminRole = "Admin";

    private readonly string _moduleKey;
    private readonly ModuleSettingsService _modules;
    private readonly ModuleAccessService _access;
    private readonly CurrentUserContext _currentUser;

    public ModuleGateFilter(string moduleKey, ModuleSettingsService modules,
        ModuleAccessService access, CurrentUserContext currentUser)
    {
        _moduleKey = moduleKey;
        _modules = modules;
        _access = access;
        _currentUser = currentUser;
    }

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var user = context.HttpContext.User;

        // Belum login: biarkan [Authorize] yang menjawab 401, jangan tumpangi dengan 403.
        if (user?.Identity?.IsAuthenticated != true)
        {
            return;
        }

        // Admin IT selalu boleh (termasuk untuk menguji modul yang belum dibuka umum).
        var isAdmin = user.HasClaim(c => (c.Type == "role" || c.Type == ClaimTypes.Role) && c.Value == AdminRole);
        if (isAdmin)
        {
            return;
        }

        var state = await _modules.GetStateAsync(_moduleKey);

        // Modul nonaktif: hanya Admin IT (sudah lolos di atas) yang boleh.
        if (!state.Found || !state.Enabled)
        {
            context.Result = Forbid($"Modul {state.Label} sedang dinonaktifkan oleh Admin IT.");
            return;
        }

        if (state.Access == Models.ModuleAccessLevels.Semua)
        {
            return;
        }

        // Tingkat "Admin Modul": Admin Modul terkait (mis. Admin SDM / Kepatuhan) juga boleh.
        if (state.Access == Models.ModuleAccessLevels.AdminModul)
        {
            var (resolved, pegawai) = await _currentUser.ResolveAsync(user);
            var nik = pegawai?.ID_KARYAWAN ?? resolved?.Nik;
            if (await _access.IsModuleAdminAsync(_moduleKey, nik))
            {
                return;
            }
            context.Result = Forbid($"Modul {state.Label} hanya dapat diakses oleh Admin IT atau Admin Modul terkait.");
            return;
        }

        // Sisa: "admin" (Admin IT saja).
        context.Result = Forbid($"Modul {state.Label} hanya dapat diakses oleh Admin IT.");
    }

    private static ObjectResult Forbid(string message) =>
        new(new { message }) { StatusCode = StatusCodes.Status403Forbidden };
}

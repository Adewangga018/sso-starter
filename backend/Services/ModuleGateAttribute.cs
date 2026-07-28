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

    public ModuleGateFilter(string moduleKey, ModuleSettingsService modules)
    {
        _moduleKey = moduleKey;
        _modules = modules;
    }

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var user = context.HttpContext.User;

        // Belum login: biarkan [Authorize] yang menjawab 401, jangan tumpangi dengan 403.
        if (user?.Identity?.IsAuthenticated != true)
        {
            return;
        }

        var isAdmin = user.HasClaim(c => (c.Type == "role" || c.Type == ClaimTypes.Role) && c.Value == AdminRole);
        if (isAdmin)
        {
            return;
        }

        var state = await _modules.GetStateAsync(_moduleKey);
        if (state.Found && state.Enabled && state.Access == Models.ModuleAccessLevels.Semua)
        {
            return;
        }

        var message = !state.Enabled
            ? $"Modul {state.Label} sedang dinonaktifkan oleh Admin IT."
            : $"Modul {state.Label} hanya dapat diakses oleh Admin IT.";

        context.Result = new ObjectResult(new { message })
        {
            StatusCode = StatusCodes.Status403Forbidden,
        };
    }
}

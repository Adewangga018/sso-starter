using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace SsoBackend.Services;

// Penjaga akses per FITUR di sisi server. Dipasang di controller/aksi yang melayani satu
// fitur (item menu), mis. [FeatureGate("my-personal:cuti")] di CutiController. Bila fitur
// dikunci Admin IT, non-Admin ditolak 403. Admin IT selalu lolos (untuk uji).
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false)]
public sealed class FeatureGateAttribute : TypeFilterAttribute
{
    public FeatureGateAttribute(string featureKey) : base(typeof(FeatureGateFilter))
    {
        Arguments = [featureKey];
    }
}

public sealed class FeatureGateFilter : IAsyncAuthorizationFilter
{
    private const string AdminRole = "Admin";

    private readonly string _featureKey;
    private readonly FeatureSettingsService _features;

    public FeatureGateFilter(string featureKey, FeatureSettingsService features)
    {
        _featureKey = featureKey;
        _features = features;
    }

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var user = context.HttpContext.User;
        if (user?.Identity?.IsAuthenticated != true) return; // biar [Authorize] yang 401

        var isAdmin = user.HasClaim(c => (c.Type == "role" || c.Type == ClaimTypes.Role) && c.Value == AdminRole);
        if (isAdmin) return;

        if (await _features.IsEnabledAsync(_featureKey)) return;

        context.Result = new ObjectResult(new { message = "Fitur ini sedang dikunci oleh Admin IT." })
        {
            StatusCode = StatusCodes.Status403Forbidden,
        };
    }
}

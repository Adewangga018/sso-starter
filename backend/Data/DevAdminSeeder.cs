using Microsoft.AspNetCore.Identity;
using SsoBackend.Models;

namespace SsoBackend.Data;

// DEV ONLY. Ensures a ready-to-use Admin IT account exists locally so the admin panel can be
// tested without going through the legacy easy.users migration. Reads DevAdmin:Email and
// DevAdmin:Password from config (set them via user-secrets); does nothing if either is missing
// or if not running in the Development environment. It is registered only in Development, so it
// can never run in Production.
public class DevAdminSeeder : IHostedService
{
    private const string AdminRole = "Admin";

    private readonly IServiceProvider _services;
    private readonly IHostEnvironment _env;
    private readonly IConfiguration _config;
    private readonly ILogger<DevAdminSeeder> _logger;

    public DevAdminSeeder(
        IServiceProvider services,
        IHostEnvironment env,
        IConfiguration config,
        ILogger<DevAdminSeeder> logger)
    {
        _services = services;
        _env = env;
        _config = config;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        if (!_env.IsDevelopment())
        {
            return;
        }

        var email = _config["DevAdmin:Email"];
        var password = _config["DevAdmin:Password"];
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            return;
        }

        using var scope = _services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();

        if (!await roleManager.RoleExistsAsync(AdminRole))
        {
            await roleManager.CreateAsync(new IdentityRole(AdminRole));
        }

        var user = await userManager.FindByEmailAsync(email);
        if (user is null)
        {
            user = new ApplicationUser
            {
                UserName = email,
                Email = email,
                EmailConfirmed = true,
                FullName = "Administrator IT (Dev)",
                IsActive = true,
            };

            var result = await userManager.CreateAsync(user, password);
            if (!result.Succeeded)
            {
                _logger.LogWarning("DevAdminSeeder gagal membuat akun {Email}: {Errors}", email,
                    string.Join("; ", result.Errors.Select(e => e.Description)));
                return;
            }

            _logger.LogInformation("DevAdminSeeder: akun admin dev dibuat -> {Email}", email);
        }

        if (!await userManager.IsInRoleAsync(user, AdminRole))
        {
            await userManager.AddToRoleAsync(user, AdminRole);
            _logger.LogInformation("DevAdminSeeder: role Admin diberikan ke {Email}", email);
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}

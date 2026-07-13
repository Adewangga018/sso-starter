using Microsoft.AspNetCore.Http;
using SsoBackend.Data;
using SsoBackend.Models;

namespace SsoBackend.Services;

public interface IAuditLogger
{
    Task LogAsync(string eventType, string? userId, string? email, string? detail = null);
}

// Writes append-only audit rows, capturing the caller's IP and user-agent from the
// current request. Failures to write are swallowed so auditing never blocks the
// primary flow (a missing audit row must not stop a user from logging in).
public class AuditLogger : IAuditLogger
{
    private readonly ApplicationDbContext _db;
    private readonly IHttpContextAccessor _http;
    private readonly ILogger<AuditLogger> _logger;

    public AuditLogger(ApplicationDbContext db, IHttpContextAccessor http, ILogger<AuditLogger> logger)
    {
        _db = db;
        _http = http;
        _logger = logger;
    }

    public async Task LogAsync(string eventType, string? userId, string? email, string? detail = null)
    {
        try
        {
            var ctx = _http.HttpContext;
            var entry = new AuditLog
            {
                TimestampUtc = DateTime.UtcNow,
                EventType = eventType,
                UserId = userId,
                Email = email,
                IpAddress = ctx?.Connection.RemoteIpAddress?.ToString(),
                UserAgent = ctx?.Request.Headers.UserAgent.ToString(),
                Detail = detail,
            };

            _db.AuditLogs.Add(entry);
            await _db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Gagal menulis audit log untuk event {EventType}", eventType);
        }
    }
}

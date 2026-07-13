namespace SsoBackend.Models;

// Append-only security audit record (SRS Fitur D). Rows are only ever inserted,
// never updated or deleted, so the trail stays tamper-evident.
public class AuditLog
{
    public long Id { get; set; }

    public DateTime TimestampUtc { get; set; }

    // Dotted event key, e.g. "login.success", "login.failure", "logout",
    // "mfa.enabled", "password.reset.requested", "password.reset.completed".
    public string EventType { get; set; } = string.Empty;

    // Identity user id when known (failures against unknown emails leave this null).
    public string? UserId { get; set; }
    public string? Email { get; set; }

    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }

    // Originating component; "SSO Hub" for platform-level events.
    public string Module { get; set; } = "SSO Hub";

    // Free-form extra context (reason, outcome, etc.).
    public string? Detail { get; set; }
}

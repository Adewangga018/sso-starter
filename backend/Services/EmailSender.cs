using System.Net;
using System.Net.Mail;

namespace SsoBackend.Services;

public interface IEmailSender
{
    Task SendAsync(string toEmail, string subject, string body);
}

// Production sender via corporate SMTP. Activated when Email:Smtp:Host is configured
// (see Program.cs). Config keys: Email:Smtp:{Host,Port,EnableSsl,User,Password,From}.
public class SmtpEmailSender : IEmailSender
{
    private readonly IConfiguration _config;
    private readonly ILogger<SmtpEmailSender> _logger;

    public SmtpEmailSender(IConfiguration config, ILogger<SmtpEmailSender> logger)
    {
        _config = config;
        _logger = logger;
    }

    public async Task SendAsync(string toEmail, string subject, string body)
    {
        var s = _config.GetSection("Email:Smtp");
        var host = s["Host"]!;
        var port = int.TryParse(s["Port"], out var p) ? p : 587;
        var from = s["From"] ?? s["User"] ?? "no-reply@gcs-gresik.com";

        using var client = new SmtpClient(host, port)
        {
            EnableSsl = !bool.TryParse(s["EnableSsl"], out var ssl) || ssl,
            Credentials = string.IsNullOrEmpty(s["User"])
                ? CredentialCache.DefaultNetworkCredentials
                : new NetworkCredential(s["User"], s["Password"]),
        };

        using var message = new MailMessage(from, toEmail, subject, body);
        await client.SendMailAsync(message);
        _logger.LogInformation("Email terkirim ke {To} (subjek: {Subject})", toEmail, subject);
    }
}

// Development / placeholder sender: writes the message (incl. reset links) to the
// application log instead of sending real email. Swap for an SMTP-backed implementation
// (PT GCS corporate mail / SMS gateway) in production — see IMPLEMENTASI-IDENTITY-OIDC.md.
public class LoggingEmailSender : IEmailSender
{
    private readonly ILogger<LoggingEmailSender> _logger;

    public LoggingEmailSender(ILogger<LoggingEmailSender> logger)
    {
        _logger = logger;
    }

    public Task SendAsync(string toEmail, string subject, string body)
    {
        _logger.LogWarning(
            "[EMAIL-DEV] Kepada: {To} | Subjek: {Subject}\n{Body}",
            toEmail, subject, body);
        return Task.CompletedTask;
    }
}

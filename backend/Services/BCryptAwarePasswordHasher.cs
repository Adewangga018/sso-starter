using Microsoft.AspNetCore.Identity;
using SsoBackend.Models;

namespace SsoBackend.Services;

// Password hasher that understands BOTH ASP.NET Core Identity's PBKDF2 format and the
// legacy Laravel bcrypt hashes migrated from easy.users. A bcrypt hash is verified via
// BCrypt.Net and reported as SuccessRehashNeeded, so Identity transparently re-hashes it
// to PBKDF2 on the user's next successful login. New passwords always use PBKDF2.
public class BCryptAwarePasswordHasher : PasswordHasher<ApplicationUser>
{
    private static bool IsBCrypt(string hash) =>
        hash.StartsWith("$2a$", StringComparison.Ordinal) ||
        hash.StartsWith("$2b$", StringComparison.Ordinal) ||
        hash.StartsWith("$2y$", StringComparison.Ordinal);

    public override PasswordVerificationResult VerifyHashedPassword(
        ApplicationUser user, string hashedPassword, string providedPassword)
    {
        if (!string.IsNullOrEmpty(hashedPassword) && IsBCrypt(hashedPassword))
        {
            return BCrypt.Net.BCrypt.Verify(providedPassword, hashedPassword)
                ? PasswordVerificationResult.SuccessRehashNeeded
                : PasswordVerificationResult.Failed;
        }

        return base.VerifyHashedPassword(user, hashedPassword, providedPassword);
    }
}

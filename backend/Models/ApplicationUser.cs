using Microsoft.AspNetCore.Identity;

namespace SsoBackend.Models;

// The MyGCS SSO Hub user. ASP.NET Core Identity is the source of truth for
// authentication; the extra fields preserve the link back to the legacy GCS
// employee data so business modules (My Personal, dashboard) keep working.
public class ApplicationUser : IdentityUser
{
    // Display name, seeded from easy.users.Name on first login.
    public string? FullName { get; set; }

    // Employee badge number (e.g. "P.224457"). Joins to MST_PEGAWAI.ID_KARYAWAN
    // / PEGAWAI_SDM.Nik. Despite the legacy column name this is NOT the KTP NIK.
    public string? Nik { get; set; }

    // Provenance: the easy.users.Id this account was migrated from. Lets modules
    // resolve the original GCS user row even for accounts without a badge.
    public long? GcsUserId { get; set; }

    // Mirrors easy.users.Status == "Aktif". A deactivated account cannot sign in.
    public bool IsActive { get; set; } = true;
}

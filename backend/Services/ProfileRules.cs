using SsoBackend.Models.Gcs;

namespace SsoBackend.Services;

// Single source of truth for "has this employee finished filling in their own profile" - not
// the same as "does a MST_PEGAWAI row exist". HR-seeded/legacy rows can exist with gaps (an
// employee migrated in without a full biodata), so a row's mere presence isn't enough to trust
// the data other modules (Absensi, Izin, Lembur, SPPD, UMDL, Tiket) depend on.
//
// Mirrors PersonalController.GetMissingRequiredFields (checked against the submitted payload at
// save time) and ProfilPage.jsx's REQUIRED_ON_REGISTER (checked against the form for the "*"
// markers) - keep the three in sync if the required set ever changes.
public static class ProfileRules
{
    public static bool IsComplete(MstPegawai p) =>
        !string.IsNullOrWhiteSpace(p.NAMA_LENGKAP) &&
        !string.IsNullOrWhiteSpace(p.NIK) &&
        !string.IsNullOrWhiteSpace(p.STATUS_KARYAWAN) &&
        !string.IsNullOrWhiteSpace(p.TEMPAT_LAHIR) &&
        p.TGL_LAHIR.HasValue &&
        !string.IsNullOrWhiteSpace(p.JENIS_KELAMIN) &&
        !string.IsNullOrWhiteSpace(p.AGAMA) &&
        !string.IsNullOrWhiteSpace(p.PENDIDIKAN) &&
        !string.IsNullOrWhiteSpace(p.STATUS_NIKAH) &&
        !string.IsNullOrWhiteSpace(p.NO_HP) &&
        !string.IsNullOrWhiteSpace(p.ALAMAT) &&
        !string.IsNullOrWhiteSpace(p.RT) &&
        !string.IsNullOrWhiteSpace(p.RW) &&
        !string.IsNullOrWhiteSpace(p.PROVINSI) &&
        !string.IsNullOrWhiteSpace(p.KABUPATEN) &&
        !string.IsNullOrWhiteSpace(p.KECAMATAN) &&
        !string.IsNullOrWhiteSpace(p.DESA) &&
        !string.IsNullOrWhiteSpace(p.KODE_POS) &&
        !string.IsNullOrWhiteSpace(p.NAMA_DARURAT) &&
        !string.IsNullOrWhiteSpace(p.HP_DARURAT);
}

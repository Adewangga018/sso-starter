using SsoBackend.Models.Gcs;

namespace SsoBackend.Services;

// The set of employee document slots (MST_PEGAWAI FILE_* columns), keyed by the identifier
// used in the URL/UI. Shared by the employee's own view (PersonalController) and the admin
// browser so the mapping and the marital-document rule live in one place.
public static class EmployeeDocuments
{
    public sealed record Field(
        string Key,
        string Label,
        Func<MstPegawai, string?> Selector,
        Action<MstPegawai, string?> Setter);

    public static readonly IReadOnlyList<Field> Fields =
    [
        new("ktp", "KTP", p => p.FILE_KTP, (p, v) => p.FILE_KTP = v),
        new("kk", "Kartu Keluarga", p => p.FILE_KK, (p, v) => p.FILE_KK = v),
        new("buku-nikah", "Buku Nikah", p => p.FILE_BUKU_NIKAH, (p, v) => p.FILE_BUKU_NIKAH = v),
        new("ijazah", "Ijazah", p => p.FILE_IJAZAH, (p, v) => p.FILE_IJAZAH = v),
        new("sim", "SIM", p => p.FILE_SIM, (p, v) => p.FILE_SIM = v),
        new("gada-pratama", "Sertifikat Gada Pratama", p => p.FILE_GADA_PRATAMA, (p, v) => p.FILE_GADA_PRATAMA = v),
        new("k3", "Sertifikat K3", p => p.FILE_K3, (p, v) => p.FILE_K3 = v),
        new("lain", "Berkas Lainnya", p => p.FILE_LAIN, (p, v) => p.FILE_LAIN = v),
    ];

    // Only "buku-nikah" is genuinely marriage-specific. "kk" (Kartu Keluarga) applies to every
    // employee regardless of marital status - single employees are still listed on a family
    // card (their parents', typically) - so it's gated only behind having a MST_PEGAWAI row,
    // not IsMarried.
    public static readonly IReadOnlySet<string> MaritalKeys = new HashSet<string> { "buku-nikah" };

    public static Field? Find(string key) => Fields.FirstOrDefault(f => f.Key == key);

    public static bool IsMarried(MstPegawai pegawai) =>
        string.Equals(pegawai.STATUS_NIKAH, "Kawin", StringComparison.OrdinalIgnoreCase);
}

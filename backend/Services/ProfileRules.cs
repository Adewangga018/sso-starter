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
    // Daftar 19 field biodata wajib + labelnya (dipakai bareng IsComplete/MissingBiodataLabels
    // di bawah) - mirror ProfilPage.jsx REQUIRED_ON_REGISTER/missingFieldsOf, keep in sync.
    private static readonly (string Label, Func<MstPegawai, string?> Get)[] BiodataFields =
    [
        ("Nama Lengkap", p => p.NAMA_LENGKAP),
        ("NIK", p => p.NIK),
        ("Status Karyawan", p => p.STATUS_KARYAWAN),
        ("Tempat Lahir", p => p.TEMPAT_LAHIR),
        ("Tanggal Lahir", p => p.TGL_LAHIR.HasValue ? "x" : null),
        ("Jenis Kelamin", p => p.JENIS_KELAMIN),
        ("Agama", p => p.AGAMA),
        ("Pendidikan", p => p.PENDIDIKAN),
        ("Status Pernikahan", p => p.STATUS_NIKAH),
        ("No. HP", p => p.NO_HP),
        ("Alamat", p => p.ALAMAT),
        ("RT", p => p.RT),
        ("RW", p => p.RW),
        ("Provinsi", p => p.PROVINSI),
        ("Kota/Kabupaten", p => p.KABUPATEN),
        ("Kecamatan", p => p.KECAMATAN),
        ("Desa/Kelurahan", p => p.DESA),
        ("Kode Pos", p => p.KODE_POS),
        ("Nama Kontak Darurat", p => p.NAMA_DARURAT),
        ("No. HP Darurat", p => p.HP_DARURAT),
    ];

    public static IReadOnlyList<string> MissingBiodataLabels(MstPegawai p) =>
        BiodataFields.Where(f => string.IsNullOrWhiteSpace(f.Get(p))).Select(f => f.Label).ToList();

    public static bool IsComplete(MstPegawai p) => MissingBiodataLabels(p).Count == 0;

    // Kelengkapan Profil GABUNGAN (biodata + dokumen dasar) - dipakai meteran "Kelengkapan
    // Profil" (ProfilPage.jsx hero, dihitung ulang di frontend dari PersonalProfileDto) &
    // rekap Admin SDM (PegawaiDirektoriController). BEDA dari IsComplete di atas (biodata
    // SAJA, dipakai gate modul lain spt Absensi/Izin/Lembur - sengaja TIDAK ikut dokumen
    // supaya karyawan tidak mendadak terkunci gara-gara belum sempat upload berkas).
    // Dokumen dasar = KTP/KK/Ijazah selalu, + Buku Nikah kalau berstatus Kawin - lihat
    // EmployeeDocuments.RequiredScoreKeys (SIM/Gada Pratama/K3/Lainnya sengaja tidak
    // diikutkan, itu spesifik profesi tertentu, bukan semua karyawan akan pernah punya).
    public static ProfilKelengkapan Assess(MstPegawai p)
    {
        var missingBiodata = MissingBiodataLabels(p);
        var requiredDocs = EmployeeDocuments.RequiredFieldsFor(p);
        var missingDocs = requiredDocs.Where(f => string.IsNullOrWhiteSpace(f.Selector(p))).Select(f => f.Label).ToList();
        var total = BiodataFields.Length + requiredDocs.Count;
        var filled = total - missingBiodata.Count - missingDocs.Count;
        var persen = total == 0 ? 100 : Math.Max(10, (int)Math.Round(filled * 100.0 / total));
        return new ProfilKelengkapan(missingBiodata.Count == 0, missingDocs.Count == 0, persen, missingBiodata, missingDocs);
    }
}

public record ProfilKelengkapan(
    bool BiodataLengkap, bool DokumenLengkap, int Persen,
    IReadOnlyList<string> BiodataKurang, IReadOnlyList<string> DokumenKurang);

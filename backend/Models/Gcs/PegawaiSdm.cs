namespace SsoBackend.Models.Gcs;

// Maps to the existing dbo.PEGAWAI_SDM view. Read-only.
// Note there is also an unrelated easy.PEGAWAI_SDM - this must stay pinned to dbo.
//
// Two consumers:
//  - Surat Izin printout: REGU ("Kelompok") and BAGIAN (addressee line).
//  - SPPD: the traveller's golongan/jabatan/struktur, snapshotted into web_sdm_sppd_detail,
//    plus the employee picker ("Cari Data Pegawai").
public class PegawaiSdm
{
    public string Nik { get; set; } = string.Empty;
    public string? nama { get; set; }

    // UNIT_KERJA is the one to display: REGU carries the same text for most staff but is
    // blank for anyone at department level (e.g. a manager), which is why EASy reads this one.
    public string? UNIT_KERJA { get; set; }
    public string? REGU { get; set; }
    public string? BAGIAN { get; set; }
    public string? WILAYAH { get; set; }

    public string? GOL { get; set; }
    public string? nm_jabatan { get; set; }
    public string? struktur { get; set; }

    public int id_golongan { get; set; }
    public int id_jabatan { get; set; }
    public int id_struktur { get; set; }

    // "Aktif" for employees still on staff - the picker only offers those.
    public string? data_aktif { get; set; }
}

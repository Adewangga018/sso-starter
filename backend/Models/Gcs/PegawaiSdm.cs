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

    // "Tetap" (organik/permanent) | "Kontrak" | "InternShip" | "Borongan" | "BP" | "DPB".
    // Employee-search pickers across the app are restricted to "Tetap" only for now
    // (2026-08-13, explicit user instruction) - contract/mitra staff not yet onboarded
    // as MyGCS users, so they must not appear as pickable colleagues anywhere.
    public string? jenis_pegawai { get; set; }

    // Tanggal masuk kerja (hire date) - name is a legacy quirk, NOT a typo for anything
    // else. MST_PEGAWAI has no equivalent column; this is the only reliable source found
    // (100% coverage across the 83 organik/Tetap staff, verified 2026-08-13 - the other
    // legacy candidates, master_pegawai/Sdm_Mst_Pegawai.TGL_MASUK, are near-empty/placeholder
    // for the current organik roster).
    public DateTime? tgl_masker { get; set; }
}

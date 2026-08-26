namespace SsoBackend.Models.Dinas;

// Ketua/anggota UMDL (schema dinas, db_mygcs) - layer PARALEL spt DinasBukti, TIDAK
// menyentuh tabel legacy GCS (web_sdm_umdl). Dipasangkan ke baris legacy lewat ref_id
// (WebSdmUmdl.ID.ToString()). Mirror dari web_sdm_sppd_detail (SPPD) tapi lebih ringkas -
// UMDL tidak pernah dicetak sbg surat multi-orang, jadi tanpa snapshot golongan/jabatan/
// struktur/tugas - murni penanda "siapa saja yang ikut dinas ini" supaya anggota (bukan
// cuma pengaju) ikut melihat baris ini di halaman UMDL mereka sendiri.
public class UmdlAnggota
{
    public int Id { get; set; }
    public string RefId { get; set; } = string.Empty;
    public string IdKaryawan { get; set; } = string.Empty;
    public string Posisi { get; set; } = string.Empty;   // Ketua | Anggota
    public DateTime DibuatPada { get; set; }
}

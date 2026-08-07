namespace SsoBackend.Models.Dinas;

// Bukti perjalanan dinas (rentang km + foto lokasi bertimestamp) untuk pengajuan
// UMDL/SPPD (schema dinas, db_mygcs). Layer paralel - TIDAK menyentuh tabel legacy
// GCS (web_sdm_umdl/web_sdm_sppd, shared-write dengan EASy). Dipasangkan ke baris
// legacy lewat (Jenis, RefId), sama pola dengan approval.pengajuan.
public class DinasBukti
{
    public int Id { get; set; }
    public string Jenis { get; set; } = string.Empty;       // UMDL | SPPD
    public string RefId { get; set; } = string.Empty;       // id baris legacy terkait
    public string IdKaryawan { get; set; } = string.Empty;
    public string RentangKm { get; set; } = string.Empty;   // <75 | 75-150 | >150 (PP)
    public string Foto { get; set; } = string.Empty;        // path relatif file (spt Attendance.Foto)
    public decimal Lat { get; set; }
    public decimal Lng { get; set; }
    public decimal? Accuracy { get; set; }
    public DateTime DibuatPada { get; set; }
}

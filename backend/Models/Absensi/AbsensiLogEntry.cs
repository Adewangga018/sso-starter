namespace SsoBackend.Models.Absensi;

// Log absensi app mobile MyGCS Absensi (deteksi fake-GPS, lihat mobile/README.md) - TABEL
// BARU (absensi.log), terpisah dari:
//   - GCS.dbo.vw_web_sdm_absensi (fingerprint IoT lobby, via AbsensiLog) - tidak disentuh,
//     tetap satu-satunya sumber "Log Absensi" di My Personal (diminta manager 2026-08-27).
//   - dbo.Attendances (fitur absen selfie WEB lama, sudah dihapus dari UI My Personal) -
//     dibiarkan sbg data historis, tidak dipakai lagi utk tulisan baru.
public class AbsensiLogEntry
{
    public long Id { get; set; }
    public string IdKaryawan { get; set; } = string.Empty;
    public string NamaKaryawan { get; set; } = string.Empty;
    public DateOnly Tanggal { get; set; }
    public string? NamaHari { get; set; }
    public string? CheckIn { get; set; }     // "HH:mm:ss" saat Type == "in"
    public string? CheckOut { get; set; }    // "HH:mm:ss" saat Type == "out"
    public string? Foto { get; set; }        // path relatif (Attendance:PhotoPath)
    public decimal Lat { get; set; }
    public decimal Lng { get; set; }
    public decimal? Accuracy { get; set; }
    public string Type { get; set; } = "in"; // "in" | "out"
    public string? Tempat { get; set; }      // nama titik yg dipakai validasi saat itu
    // Anomali audit server-side (impossible travel DAN/ATAU koordinat identik persis dgn
    // absen sebelumnya - lihat PersonalController.PostAbsensi) - TIDAK memblokir absen
    // (sama spt Accuracy: sinyal audit manual utk Admin SDM, bukan validasi otomatis).
    // Lapisan pertahanan yang TIDAK bisa dibohongi client manapun (device root/APK
    // dimodifikasi/dsb) karena murni dihitung dari riwayat absen tersimpan di server.
    public string? PeringatanAnomali { get; set; }
    public DateTime DibuatPada { get; set; }
    public DateTime DiperbaruiPada { get; set; }
}

namespace SsoBackend.Models.Absensi;

// Titik absen pribadi per karyawan (bengkel/gudang/sopir/dll yg tidak beraktivitas di
// kantor) - diajukan karyawan sendiri lewat app mobile ATAU ditetapkan langsung oleh Admin
// SDM (menu "Kelola Lokasi Absensi"). Satu baris AKTIF per karyawan (unique IdKaryawan) -
// mengajukan ulang menimpa baris lama & mereset Status ke Menunggu. Selama belum Disetujui,
// validasi absen tetap jatuh ke default Kantor Pusat (tabel Locations) - lihat
// PersonalController.PostAbsensi.
public class LokasiKaryawan
{
    public long Id { get; set; }
    public string IdKaryawan { get; set; } = string.Empty;
    public string? NamaKaryawan { get; set; }
    public decimal Lat { get; set; }
    public decimal Lng { get; set; }
    public string? Keterangan { get; set; }
    // Alamat hasil reverse-geocoding (OpenStreetMap Nominatim) - "Jalan, Kec. X, Kota Y,
    // Provinsi Z", dihitung SEKALI saat diajukan/ditetapkan (lihat ReverseGeocodingService),
    // bukan tiap kali halaman admin dibuka. Null kalau lookup gagal/belum sempat jalan.
    public string? Alamat { get; set; }
    public string Status { get; set; } = "Menunggu";  // Menunggu | Disetujui | Ditolak
    public string Sumber { get; set; } = "Karyawan";  // Karyawan | AdminSdm (admin = auto-approve)
    public string DiajukanOleh { get; set; } = string.Empty;
    public DateTime TglDiajukan { get; set; }
    public string? DiputuskanOleh { get; set; }
    public DateTime? TglDiputuskan { get; set; }
    public string? CatatanAdmin { get; set; }
}

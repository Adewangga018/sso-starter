namespace SsoBackend.Models.Dto;

// Radius standar yang berlaku SAMA untuk semua titik absen - baik Kantor Pusat/Locations
// (Admin IT) maupun titik pribadi karyawan (Admin SDM) - diminta user 2026-08-27 ("radius
// tetap saja"). Satu konstanta global, bukan per-titik.
public static class AbsensiRadius
{
    public const double StandarMeter = 150.0;
}

// Status titik absen pribadi milik SAYA (karyawan) - GET personal/absensi/lokasi. Status
// null berarti belum pernah mengajukan - absen tetap divalidasi ke default Kantor Pusat.
public record LokasiKaryawanSayaDto(
    string? Status,          // Menunggu | Disetujui | Ditolak | null (belum pernah ajukan)
    decimal? Lat,
    decimal? Lng,
    string? Keterangan,
    string? Alamat,          // hasil reverse-geocoding otomatis (OpenStreetMap)
    string? CatatanAdmin,
    DateTime? TglDiajukan,
    DateTime? TglDiputuskan,
    double RadiusMeters);

public record AjukanLokasiRequest(decimal Lat, decimal Lng, string? Keterangan);

// Baris "Kelola Lokasi Absensi" (Admin SDM) - satu per karyawan yang pernah mengajukan/
// ditetapkan titik pribadi.
public record LokasiKaryawanAdminDto(
    long Id,
    string IdKaryawan,
    string? NamaKaryawan,
    decimal Lat,
    decimal Lng,
    double RadiusMeters,
    string? Keterangan,
    string? Alamat,          // hasil reverse-geocoding otomatis (OpenStreetMap)
    string Status,
    string Sumber,           // Karyawan | AdminSdm
    string DiajukanOleh,
    DateTime TglDiajukan,
    string? DiputuskanOleh,
    DateTime? TglDiputuskan,
    string? CatatanAdmin);

public record PutusanLokasiRequest(bool Setuju, string? Catatan);

// Admin SDM menetapkan langsung (tanpa pengajuan) - auto-approved (Sumber = AdminSdm).
public record TetapkanLokasiRequest(string IdKaryawan, decimal Lat, decimal Lng, string? Keterangan);

// Baris "Audit Log Absensi Mobile" (Admin SDM) - satu per catatan absen app mobile
// (absensi.log). PeringatanAnomali terisi kalau server mendeteksi "impossible travel"
// dan/atau koordinat identik persis dgn absen sebelumnya (lihat
// PersonalController.PostAbsensi) - TIDAK memblokir absen, murni sinyal audit manual.
public record AbsensiLogAdminDto(
    long Id,
    string IdKaryawan,
    string? NamaKaryawan,
    DateOnly Tanggal,
    string? CheckIn,
    string? CheckOut,
    string? Tempat,
    decimal? Accuracy,
    string? PeringatanAnomali,
    DateTime DibuatPada);

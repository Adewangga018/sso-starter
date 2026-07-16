namespace SsoBackend.Models;

// Camera-based self-service attendance, stored in db_mygcs.dbo.attendances (owned by
// ApplicationDbContext / DefaultConnection). The column set is deliberately a UNION of two
// sources so a single row carries both worlds:
//   - GCS.dbo.vw_web_sdm_absensi : KodePegawai, NamaPegawai, Tanggal, NamaHari, CheckIn,
//     CheckOut, CatatanMangkir  (the shape the "Log Absensi" already renders)
//   - db_absensi_gcs.dbo.attendances : Foto, Lat, Lng, Type, CreatedAt, UpdatedAt
//     (the photo + GPS clock-in/out payload) plus Tempat (named office location).
// Nothing is ever written to GCS or to the view - this table is the only sink for the
// camera feature, and the Log Absensi merges these rows with the view purely for display.
public class Attendance
{
    public int Id { get; set; }

    // --- Kolom yang selaras dengan vw_web_sdm_absensi ---
    public string KodePegawai { get; set; } = string.Empty;   // = MST_PEGAWAI.ID_KARYAWAN
    public string NamaPegawai { get; set; } = string.Empty;
    public DateOnly Tanggal { get; set; }
    public string? NamaHari { get; set; }
    public string? CheckIn { get; set; }     // "HH:mm:ss" saat Type == "in"
    public string? CheckOut { get; set; }    // "HH:mm:ss" saat Type == "out"
    public string? CatatanMangkir { get; set; }

    // --- Kolom yang selaras dengan db_absensi_gcs.attendances ---
    public string? Foto { get; set; }        // data URL base64 (nvarchar(max))
    public decimal Lat { get; set; }
    public decimal Lng { get; set; }
    public decimal? Accuracy { get; set; }   // meter, dari GeolocationPosition.coords.accuracy
    public string Type { get; set; } = "in"; // "in" | "out"
    public string? Tempat { get; set; }      // mis. "Kantor Pusat PT. Gresik Cipta Sejahtera"
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

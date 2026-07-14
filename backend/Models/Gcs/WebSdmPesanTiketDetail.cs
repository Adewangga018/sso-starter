namespace SsoBackend.Models.Gcs;

// Maps to intranet.web_sdm_pesan_tiket_detail: one row per booking line (a flight, a hotel
// stay, a bus leg...). "id" is the parent web_sdm_pesan_tiket.id; id_det is the identity key.
//
// Unlike SPPD's detail table, no foreign key is declared in the database here, so the rows
// must be deleted explicitly when the parent goes.
public class WebSdmPesanTiketDetail
{
    public int id_det { get; set; }
    public int id { get; set; }

    // Bus / Hotel / Kapal Laut / Kereta Api / Pesawat.
    public string jenis_tiket { get; set; } = string.Empty;

    public DateTime tgl_tiket_in { get; set; }
    public DateTime tgl_tiket_out { get; set; }
    public string keterangan { get; set; } = string.Empty;
}

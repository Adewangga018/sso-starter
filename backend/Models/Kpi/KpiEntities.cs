namespace SsoBackend.Models.Kpi;

// KPI (schema kpi, db_mygcs). level='Perusahaan' (top-level, id_pemilik null) atau
// 'Individu' (id_pemilik = NIK). Realisasi dinilai atasan; bawahan hanya melihat.
public class Kpi
{
    public long Id { get; set; }
    public string Periode { get; set; } = string.Empty;
    public string Judul { get; set; } = string.Empty;
    public string? Deskripsi { get; set; }
    public string? Satuan { get; set; }
    public decimal Target { get; set; }
    public decimal Realisasi { get; set; }
    public decimal? Bobot { get; set; }
    public string Level { get; set; } = "Individu";   // Perusahaan | Individu
    public string? IdPemilik { get; set; }
    public string? NamaPemilik { get; set; }
    public long? IdParent { get; set; }
    public string IdPembuat { get; set; } = string.Empty;
    public string? NamaPembuat { get; set; }
    public string Status { get; set; } = "Berjalan";   // Berjalan | Tercapai | Tidak Tercapai | Dibatalkan
    public string? Catatan { get; set; }
    public DateTime TglDibuat { get; set; }
    public DateTime? TglDiubah { get; set; }
}

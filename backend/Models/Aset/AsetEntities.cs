namespace SsoBackend.Models.Aset;

// Master inventaris aset (schema aset, db_mygcs).
public class Aset
{
    public long Id { get; set; }
    public string Kode { get; set; } = string.Empty;
    public string Nama { get; set; } = string.Empty;
    public string? Kategori { get; set; }
    public string? Merk { get; set; }
    public string? NomorSeri { get; set; }
    public string? Lokasi { get; set; }
    public string? IdPic { get; set; }
    public string? NamaPic { get; set; }
    public string Kondisi { get; set; } = "Baik";
    public string Status { get; set; } = "Aktif";
    public decimal? Nilai { get; set; }
    public DateOnly? TglPerolehan { get; set; }
    public string? Catatan { get; set; }
    public string IdPembuat { get; set; } = string.Empty;
    public DateTime TglDibuat { get; set; }
    public DateTime? TglDiubah { get; set; }
}

// Jadwal & riwayat pemeliharaan aset.
public class AsetMaintenance
{
    public long Id { get; set; }
    public long IdAset { get; set; }
    public string Jenis { get; set; } = "Rutin";
    public DateOnly TglJadwal { get; set; }
    public DateOnly? TglSelesai { get; set; }
    public string Status { get; set; } = "Terjadwal";
    public string? Pelaksana { get; set; }
    public decimal? Biaya { get; set; }
    public string? Catatan { get; set; }
    public string IdPembuat { get; set; } = string.Empty;
    public DateTime TglDibuat { get; set; }
}

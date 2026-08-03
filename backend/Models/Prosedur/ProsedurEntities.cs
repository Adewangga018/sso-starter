namespace SsoBackend.Models.Prosedur;

// Identitas dokumen SOP/Kebijakan (lintas versi). Schema prosedur, db_mygcs.
public class ProsedurDokumen
{
    public long Id { get; set; }
    public string Kode { get; set; } = string.Empty;
    public string Judul { get; set; } = string.Empty;
    public string Jenis { get; set; } = "SOP";
    public string? Unit { get; set; }
    public string? Kategori { get; set; }
    public string? Deskripsi { get; set; }
    // True = berlaku untuk semua kompartemen; false = lihat ProsedurDokumenKompartemen.
    public bool SemuaKompartemen { get; set; }
    // 'Umum' = terpusat (Admin Kepatuhan, dibaca semua) | 'Unit' = privasi departemen.
    public string Lingkup { get; set; } = "Umum";
    // id_unit Departemen pemilik (grading) untuk lingkup 'Unit'; null utk 'Umum'.
    public int? IdUnitPemilik { get; set; }
    public string IdPembuat { get; set; } = string.Empty;
    public DateTime TglDibuat { get; set; }
    public DateTime? TglDiubah { get; set; }
}

// Kompartemen tertentu yang berlaku bagi sebuah dokumen (dipakai bila SemuaKompartemen=false).
public class ProsedurDokumenKompartemen
{
    public long Id { get; set; }
    public long IdDokumen { get; set; }
    public string Kompartemen { get; set; } = string.Empty;
}

// Satu versi dokumen + berkasnya. Status Berlaku = versi aktif (maks 1/dokumen).
public class ProsedurVersi
{
    public long Id { get; set; }
    public long IdDokumen { get; set; }
    public int Versi { get; set; }
    public string? Ringkasan { get; set; }
    public string NamaFile { get; set; } = string.Empty;
    public string? TipeFile { get; set; }
    public byte[] Konten { get; set; } = System.Array.Empty<byte>();
    public string Status { get; set; } = "Berlaku";
    public DateOnly? TglBerlaku { get; set; }
    public string IdPenerbit { get; set; } = string.Empty;
    public string? NamaPenerbit { get; set; }
    public DateTime TglUnggah { get; set; }
}

// Pernyataan "sudah baca & paham" per (versi, karyawan).
public class ProsedurAcknowledgement
{
    public long Id { get; set; }
    public long IdVersi { get; set; }
    public long IdDokumen { get; set; }
    public string Nik { get; set; } = string.Empty;
    public string? Nama { get; set; }
    public DateTime Tgl { get; set; }
}

namespace SsoBackend.Models.Office;

// Master kode surat GCS — sumber tiap segmen nomor surat
// {urut}/{bagian}/{klasifikasi}/{jenis}/{tahun}. Tabel diisi lewat
// docs/office-kode-surat.sql; aplikasi hanya membacanya.

public class RefJenisSurat
{
    public string Kode { get; set; } = string.Empty;   // DR|MI|BA|RR
    public string Nama { get; set; } = string.Empty;
    public int Urutan { get; set; }
    public bool Aktif { get; set; } = true;
}

public class RefBagian
{
    public string Kode { get; set; } = string.Empty;   // GCS.01 .. GCS.12
    public string Nama { get; set; } = string.Empty;
    public int Urutan { get; set; }
    public bool Aktif { get; set; } = true;
}

public class RefKlasifikasi
{
    public string Kode { get; set; } = string.Empty;   // mis. NK.01.03
    public string Kelompok { get; set; } = string.Empty;  // PR|SA|LI|KEU|NK|TU|WA|LG|TK
    public string Masalah { get; set; } = string.Empty;
    public bool Aktif { get; set; } = true;
}

// Pemetaan nama unit organisasi (schema grading) ke kode bagian, dipakai untuk
// menebak bagian pembuat surat. Dicocokkan berjenjang: bagian -> departemen -> kompartemen.
public class RefBagianUnit
{
    public string NamaUnit { get; set; } = string.Empty;
    public string KodeBagian { get; set; } = string.Empty;
    public string Tingkat { get; set; } = "Departemen";
}

// Penghitung nomor urut: satu deret untuk seluruh perusahaan, reset tiap tahun.
public class SuratNomor
{
    public int Tahun { get; set; }
    public int Terakhir { get; set; }
}

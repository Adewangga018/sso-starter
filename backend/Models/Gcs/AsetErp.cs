namespace SsoBackend.Models.Gcs;

// Maps to the existing dbo.assets table - modul Aktiva Tetap pada ERP (penyusutan,
// akuisisi, GL). SEBAGIAN BESAR read-only - satu-satunya tulisan yang MyGCS lakukan ke
// tabel ini adalah pendaftaran aset baru (AsetService.DaftarAsetBaruAsync), yang HANYA
// mengisi identitas dasar (nama/lokasi/kategori/tanggal/satuan) + beberapa kolom status
// dengan nilai default yang meniru pola mayoritas data existing (lihat catatan di
// DaftarAsetBaruAsync). Nilai buku, penyusutan, & field akuntansi lain TETAP domain
// akunting/ERP - MyGCS tidak pernah mengisi/mengubahnya. Hanya subset kolom yang relevan
// untuk My Asset yang dipetakan (bukan semua 44 kolom).
public class AsetErp
{
    public string OBJECTID { get; set; } = string.Empty;
    public string? DESC_OBJECT { get; set; }
    public string? NOTE { get; set; }
    public string? GROUP_ASSET { get; set; }
    public string? KELOMPOK { get; set; }
    public DateTime? TANGGAL { get; set; }
    public decimal? QTY { get; set; }
    public string? SATUAN { get; set; }
    public string? LOKASI { get; set; }
    public string? KODE_CC { get; set; }
    public string? NOPOL { get; set; }
    public string? STATUS { get; set; }
    public string? AKTIF { get; set; }
    public string? PROSES { get; set; }
    public string? METODE { get; set; }
    public decimal? NILAI_PEROLEHAN { get; set; }
    public decimal? NILAI_BUKU { get; set; }
    public decimal? AKUMULASI { get; set; }
    public decimal? MASA { get; set; } // masa manfaat, satuan BULAN (mis. 48 = 4 tahun)
    public DateTime LAST_UPDATED { get; set; }
}

// Lookup dbo.AssetS_Group: nama kategori (GROUP_ASSET -> deskripsi), mis. "A02" -> "Bangunan & Instalasi Listrik".
public class AsetErpGroup
{
    public string DIV { get; set; } = string.Empty;
    public string GROUP_ASSET { get; set; } = string.Empty;
    public string? ASSETS_DESC { get; set; }
}

// Lookup dbo.AssetS_KELOMPOK: nama sub-kelompok (KELOMPOK -> deskripsi), mis. "A0201" -> "Bangunan & Pabrik Petroganik Lampung".
public class AsetErpKelompok
{
    public string DIV { get; set; } = string.Empty;
    public string KELOMPOK { get; set; } = string.Empty;
    public string? NAMA_KELOMPOK { get; set; }
}

// Lookup dbo.akun_account_cc: WILAYAH per KODE_CC - dipakai sebagai nilai "Lokasi"
// yang ditampilkan (lebih deskriptif drpd dbo.assets.LOKASI mentah), mis. "110101" ->
// "Wilayah Produksi Malang".
public class AsetErpCc
{
    public string KODE_CC { get; set; } = string.Empty;
    public string? WILAYAH { get; set; }
    public string? KETERANGAN { get; set; }
}

// Lookup dbo.akun_rekanan: master vendor/rekanan ERP - dipakai autocomplete "Vendor/Pelaksana"
// di form Catat Aktivitas (boleh juga diisi manual kalau vendornya tidak ada di sini).
public class AsetErpRekanan
{
    public string KODEREKANAN { get; set; } = string.Empty;
    public string? NAMA { get; set; }
}
namespace SsoBackend.Models.Dbsmp;

// Master jenis surat milik aplikasi SMP (database DBSMP, dbo.TB_SURAT_JENIS).
// Read-only: tabel ini dimiliki sistem lain, MyGCS hanya membacanya untuk mengisi
// dropdown "Jenis Surat" pada Buat Surat Baru dan menerjemahkan kode -> nama.
//
// Catatan kolom (penting, mudah tertukar):
//   KD    = kunci baris, unik. INI yang disimpan MyGCS di office.surat.jenis.
//   KODE  = kode pengelompokan, TIDAK unik (SP, AD, dan DR sama-sama ber-KODE "DR").
// Karena KODE tidak unik, dropdown memakai KD supaya pilihan pengguna tidak hilang.
public class SuratJenisDbsmp
{
    public string Kd { get; set; } = string.Empty;      // KD  - kunci, mis. "MI", "SP", "AD", "DR"
    public string? NamaJenis { get; set; }              // NM_JENIS - mis. "Surat Memo Intern"
    public string? Status { get; set; }                 // "Aktif" | "Pasif"
    public string? Kode { get; set; }                   // KODE - kode kelompok (tidak unik)
}

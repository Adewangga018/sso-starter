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

// Register aset tidak produktif (idle, menunggu dijual). Berdiri sendiri, tidak
// terhubung ke Aset - lihat catatan di backend/Database/aset/01-tidak-produktif-ddl.sql.
public class AsetTidakProduktif
{
    public long Id { get; set; }
    public string Jenis { get; set; } = string.Empty;
    public string? Nama { get; set; }
    public string? SertifikatHak { get; set; }
    public DateOnly? SertifikatJangkaWaktu { get; set; }
    public string? SertifikatNo { get; set; }
    public int? SertifikatTahun { get; set; }
    public string? SertifikatKeterangan { get; set; }
    public string? Lokasi { get; set; }
    public decimal? Qty { get; set; }
    public string Satuan { get; set; } = "M2";
    public string? StatusJaminan { get; set; }
    public decimal? HargaPasar { get; set; }
    public decimal? AppraisalHarga { get; set; }
    public string? AppraisalKjpp { get; set; }
    public int? AppraisalTahun { get; set; }
    public string? AppraisalNo { get; set; }
    public string? PbbNop { get; set; }
    public decimal? PbbNominal { get; set; }
    public DateOnly? PbbTglPembayaran { get; set; }
    public string? CatatanAkt { get; set; }
    public string? PerijinanPemegangSaham { get; set; }
    public string IdPembuat { get; set; } = string.Empty;
    public DateTime TglDibuat { get; set; }
    public string? IdPengubah { get; set; }
    public DateTime? TglDiubah { get; set; }
}

// Log aktivitas per aset tidak produktif (pembersihan, kunjungan calon pembeli,
// negosiasi harga, dst). Sengaja punya FK ke AsetTidakProduktif - lihat catatan
// di backend/Database/aset/05-tidak-produktif-aktivitas-ddl.sql.
public class AsetTidakProduktifAktivitas
{
    public long Id { get; set; }
    public long IdAset { get; set; }
    public string Jenis { get; set; } = string.Empty;
    public DateOnly TglAktivitas { get; set; }
    public string? Deskripsi { get; set; }
    public string? PihakTerkait { get; set; }
    public decimal? NilaiNego { get; set; }
    public string IdPembuat { get; set; } = string.Empty;
    public DateTime TglDibuat { get; set; }
    public string? IdPengubah { get; set; }
    public DateTime? TglDiubah { get; set; }
}

// ---- Lapisan operasional di atas master ERP (GCS.dbo.assets) - Aug 2026.
// Direferensikan lewat ObjectId (bukan FK, lintas database) - lihat catatan di
// backend/Database/aset/06-overlay-ddl.sql.

// Riwayat kondisi fisik operasional aset - HISTORIS (tiap perubahan = baris baru,
// bukan upsert), karena kondisi aset berubah sepanjang usianya dan riwayat lama
// tidak boleh hilang. "Kondisi saat ini" = baris terbaru per ObjectId.
public class AsetKondisi
{
    public long Id { get; set; }
    public string ObjectId { get; set; } = string.Empty;
    public string Kondisi { get; set; } = "Baik";
    public string? Catatan { get; set; }
    public string IdPembuat { get; set; } = string.Empty;
    public DateTime TglDibuat { get; set; }
}

// Nomor aset internal buatan tim Aset - identifier TERPISAH dari dbo.assets.OBJECTID
// (ERP tetap sumber identitas utama). 1 baris per ObjectId: identitas/label yang
// jarang berubah, beda sifat dari AsetKondisi (state yang berubah-ubah).
public class AsetNomorInternal
{
    public string ObjectId { get; set; } = string.Empty;
    public string NomorAset { get; set; } = string.Empty;
    public string? Catatan { get; set; }
    public string IdPengubah { get; set; } = string.Empty;
    public DateTime TglDiubah { get; set; }
}

// Penanggung jawab (PIC) aset + histori lengkap - basis clearance sheet SDM.
// JenisPic 'Orang': Nik/NamaPic/Departemen terisi, IdUnit/NamaUnit null.
// JenisPic 'Bagian': IdUnit/NamaUnit terisi, Nik/NamaPic null (tidak masuk hitungan
// Clearance - itu murni per-karyawan).
public class AsetPicAssignment
{
    public long Id { get; set; }
    public string ObjectId { get; set; } = string.Empty;
    public string JenisPic { get; set; } = "Orang";
    public string? Nik { get; set; }
    public string? NamaPic { get; set; }
    public string? Departemen { get; set; }
    public int? IdUnit { get; set; }
    public string? NamaUnit { get; set; }
    public DateOnly TglMulai { get; set; }
    public DateOnly? TglSelesai { get; set; }
    public string Status { get; set; } = "Aktif";
    public string? Catatan { get; set; }
    public string IdPembuat { get; set; } = string.Empty;
    public DateTime TglDibuat { get; set; }
}

// Log aktivitas umum SEMUA aset (pemeliharaan, mutasi, penghapusan, appraisal,
// klaim asuransi, perpanjangan pajak/STNK/sertifikat, dst).
public class AsetAktivitas
{
    public long Id { get; set; }
    public string ObjectId { get; set; } = string.Empty;
    public string Jenis { get; set; } = string.Empty;
    public DateOnly TglAktivitas { get; set; }
    public string? Deskripsi { get; set; }
    public string? VendorPelaksana { get; set; }
    public decimal? Biaya { get; set; }
    public string Status { get; set; } = "Selesai";
    public string IdPembuat { get; set; } = string.Empty;
    public DateTime TglDibuat { get; set; }
    public string? IdPengubah { get; set; }
    public DateTime? TglDiubah { get; set; }
}

// Master daftar "Jenis Aktivitas" (dropdown form Catat Aktivitas) - dikelola sebagai
// data, bukan hardcode. Tanpa baris di AsetJenisAktivitasKategori = "Umum" (berlaku
// semua kategori aset).
public class AsetJenisAktivitas
{
    public int Id { get; set; }
    public string Nama { get; set; } = string.Empty;
    public bool Aktif { get; set; } = true;
    public int Urutan { get; set; }
    public string IdPembuat { get; set; } = string.Empty;
    public DateTime TglDibuat { get; set; }
    public string? IdPengubah { get; set; }
    public DateTime? TglDiubah { get; set; }
}

// Relasi many-to-many jenis aktivitas <-> GROUP_ASSET (kategori aset ERP, dbo.assets.GROUP_ASSET).
public class AsetJenisAktivitasKategori
{
    public int IdJenisAktivitas { get; set; }
    public string GroupAsset { get; set; } = string.Empty;
}

// Lampiran dokumen per aset (sertifikat tanah, IMB, BPKB, STNK, polis asuransi, dll)
// + tanggal jatuh tempo untuk reminder. File fisik di disk (pola sama seperti
// modul Inovasi), kolom ini hanya simpan path relatif + nama asli. status
// 'Nonaktif' dipakai saat dokumen diganti versi baru - baris lama TETAP ada,
// bukan dihapus, supaya riwayat dokumen tersimpan. Lihat backend/Database/aset/10-dokumen-ddl.sql.
public class AsetDokumen
{
    public long Id { get; set; }
    public string ObjectId { get; set; } = string.Empty;
    public string JenisDokumen { get; set; } = string.Empty;
    public string? NomorDokumen { get; set; }
    public DateOnly? TglTerbit { get; set; }
    public DateOnly? TglJatuhTempo { get; set; }
    public string? FilePath { get; set; }
    public string? FileNamaAsli { get; set; }
    public string? Catatan { get; set; }
    public string Status { get; set; } = "Aktif";
    public string IdPembuat { get; set; } = string.Empty;
    public DateTime TglDibuat { get; set; }
    public string? IdPengubah { get; set; }
    public DateTime? TglDiubah { get; set; }
}

// Header/batch satu putaran stock opname (bisa dibatasi ke kategori tertentu lewat
// LingkupKategori - daftar GROUP_ASSET dipisah koma, null = semua aset). Lihat
// backend/Database/aset/11-opname-ddl.sql.
public class AsetOpnameSesi
{
    public int Id { get; set; }
    public string NamaSesi { get; set; } = string.Empty;
    public DateOnly TglMulai { get; set; }
    public DateOnly? TglSelesai { get; set; }
    public string Status { get; set; } = "Berjalan";
    public string? LingkupKategori { get; set; }
    public string? Catatan { get; set; }
    public string IdPembuat { get; set; } = string.Empty;
    public DateTime TglDibuat { get; set; }
    public string? IdPengubah { get; set; }
    public DateTime? TglDiubah { get; set; }
}

// Event tiap kali aset di-scan dalam satu sesi opname - APPEND ONLY (bukan upsert;
// scan ulang aset yang sama dalam 1 sesi boleh, baris terbaru = data terpakai).
// Laporan selisih (tercatat tapi belum discan) dihitung lewat query, bukan kolom.
public class AsetOpnameScan
{
    public long Id { get; set; }
    public int IdSesi { get; set; }
    public string ObjectId { get; set; } = string.Empty;
    public string? LokasiAktual { get; set; }
    public string? KondisiAktual { get; set; }
    public string? FotoPath { get; set; }
    public string? FotoNamaAsli { get; set; }
    public string? Catatan { get; set; }
    public string NikPemindai { get; set; } = string.Empty;
    public DateTime TglScan { get; set; }
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

namespace SsoBackend.Models.Dto;

public record AsetDto(
    long Id,
    string Kode,
    string Nama,
    string? Kategori,
    string? Merk,
    string? NomorSeri,
    string? Lokasi,
    string? IdPic,
    string? NamaPic,
    string Kondisi,
    string Status,
    decimal? Nilai,
    DateOnly? TglPerolehan,
    string? Catatan,
    DateOnly? MaintenanceBerikutnya,   // tgl_jadwal terdekat berstatus Terjadwal
    DateTime TglDibuat,
    DateTime? TglDiubah);

// Daftar aset + flag apakah pemakai adalah Admin Aset (pengelola).
public record AsetListDto(IReadOnlyList<AsetDto> Items, bool IsAdminAset);

// ---- Inventaris: sumber datanya GCS.dbo.assets (ERP Aktiva Tetap), read-only.
// Lihat catatan arsitektur di Models/Gcs/AsetErp.cs - db_mygcs TIDAK menyimpan
// salinan data induk aset lagi, supaya nilai/lokasi selalu mengikuti ERP.
public record AsetErpDto(
    string ObjectId,
    string? NomorAset,     // nomor aset internal buatan tim Aset (aset.nomor_internal) - TERPISAH dari OBJECTID ERP
    string? Nama,
    string? Kategori,      // nama GROUP_ASSET, mis. "Bangunan & Instalasi Listrik"
    string? KategoriKode,  // kode GROUP_ASSET mentah (A01-A06) - dipakai filter Jenis Aktivitas
    string? Kelompok,      // nama KELOMPOK, mis. "Bangunan & Pabrik Petroganik Lampung"
    string? Lokasi,
    string? NoPol,
    string? Status,
    string? Aktif,         // 'Y' | 'T'
    decimal? Qty,
    string? Satuan,
    decimal? NilaiPerolehan,
    decimal? NilaiBuku,
    DateOnly? TglPerolehan,
    decimal? MasaManfaatBulan, // dbo.assets.MASA, satuan bulan
    string? PicSaatIni,    // nama PIC aktif (orang atau bagian) dari aset.pic_assignment, buat filter
    string? Klasifikasi,   // status tambahan dari aset.klasifikasi (mis. "Tidak Bergerak"), TANPA ubah skema dbo.assets
    string? Catatan,
    AsetKlasifikasiDetailDto? KlasifikasiDetail); // detail sertifikat/appraisal/perijinan - null kalau tidak ada/belum dilengkapi

// Detail sertifikat/appraisal/perijinan ke pemegang saham - khusus aset berklasifikasi
// "Tidak Bergerak" (disetujui dijual sesuai keputusan pemegang saham). aset.klasifikasi.
public record AsetKlasifikasiDetailDto(
    string? Catatan,
    string? SertifikatHak,
    string? SertifikatJangkaWaktu,
    string? SertifikatNo,
    string? SertifikatTahun,
    decimal? NilaiPasar,
    decimal? NilaiAppraisal,
    string? StatusJaminan,
    string? Kjpp,
    string? KjppTahun,
    string? KjppNo,
    string? KeteranganPemegangSaham);

public record AsetErpListDto(IReadOnlyList<AsetErpDto> Items, int Total);

// ---- Pendaftaran aset baru (MyGCS -> dbo.assets, SSOT tetap ERP). Lihat catatan
// arsitektur lengkap di AsetService.DaftarAsetBaruAsync. HANYA identitas dasar yang
// diisi dari MyGCS - nilai perolehan/nilai buku/masa manfaat/dst TETAP kosong, diisi
// akunting langsung di ERP.
public record AsetGroupDto(string Kode, string Nama);
public record AsetKelompokDto(string Kode, string Nama);
public record AsetKodeCcDto(string KodeCc, string Wilayah);

public record SimpanAsetBaruRequest(
    string Nama,
    string Lokasi,
    string GroupAsset,
    string Kelompok,
    DateOnly Tanggal,
    string KodeCc,
    string Satuan,
    string? NomorInternal); // opsional - kalau diisi, langsung tersimpan ke aset.nomor_internal (MyGCS)

public record AsetMaintenanceDto(
    long Id,
    long IdAset,
    string Jenis,
    DateOnly TglJadwal,
    DateOnly? TglSelesai,
    string Status,
    string? Pelaksana,
    decimal? Biaya,
    string? Catatan,
    DateTime TglDibuat);

// Detail aset + riwayat maintenance-nya.
public record AsetDetailDto(AsetDto Aset, IReadOnlyList<AsetMaintenanceDto> Maintenance, bool IsAdminAset);

// Baris maintenance dengan info aset (untuk halaman Jadwal Maintenance global).
public record MaintenanceRowDto(
    long Id,
    long IdAset,
    string KodeAset,
    string NamaAset,
    string Jenis,
    DateOnly TglJadwal,
    DateOnly? TglSelesai,
    string Status,
    string? Pelaksana,
    decimal? Biaya,
    string? Catatan);

public record MaintenanceListDto(IReadOnlyList<MaintenanceRowDto> Items, bool IsAdminAset);

// ---- request ----
public record SimpanAsetRequest(
    string Kode,
    string Nama,
    string? Kategori,
    string? Merk,
    string? NomorSeri,
    string? Lokasi,
    string? IdPic,
    string? NamaPic,
    string? Kondisi,
    string? Status,
    decimal? Nilai,
    DateOnly? TglPerolehan,
    string? Catatan);

public record SimpanMaintenanceRequest(
    string Jenis,
    DateOnly TglJadwal,
    DateOnly? TglSelesai,
    string? Status,
    string? Pelaksana,
    decimal? Biaya,
    string? Catatan);

// ---- aset tidak produktif ----
public record AsetTidakProduktifDto(
    long Id,
    string Jenis,
    string? Nama,
    string? SertifikatHak,
    DateOnly? SertifikatJangkaWaktu,
    string? SertifikatNo,
    int? SertifikatTahun,
    string? SertifikatKeterangan,
    string? Lokasi,
    decimal? Qty,
    string Satuan,
    string? StatusJaminan,
    decimal? HargaPasar,
    decimal? AppraisalHarga,
    string? AppraisalKjpp,
    int? AppraisalTahun,
    string? AppraisalNo,
    string? PbbNop,
    decimal? PbbNominal,
    DateOnly? PbbTglPembayaran,
    string? CatatanAkt,
    string? PerijinanPemegangSaham,
    DateTime TglDibuat,
    DateTime? TglDiubah);

public record AsetTidakProduktifListDto(IReadOnlyList<AsetTidakProduktifDto> Items, bool IsAdminAset);

public record SimpanAsetTidakProduktifRequest(
    string Jenis,
    string? Nama,
    string? SertifikatHak,
    DateOnly? SertifikatJangkaWaktu,
    string? SertifikatNo,
    int? SertifikatTahun,
    string? SertifikatKeterangan,
    string? Lokasi,
    decimal? Qty,
    string? Satuan,
    string? StatusJaminan,
    decimal? HargaPasar,
    decimal? AppraisalHarga,
    string? AppraisalKjpp,
    int? AppraisalTahun,
    string? AppraisalNo,
    string? PbbNop,
    decimal? PbbNominal,
    DateOnly? PbbTglPembayaran,
    string? CatatanAkt,
    string? PerijinanPemegangSaham);

// ---- aktivitas aset tidak produktif ----
// AsetLabel: ringkasan identitas aset (jenis + lokasi/no sertifikat) untuk ditampilkan
// di daftar aktivitas tanpa perlu join manual di frontend.
public record AsetTidakProduktifAktivitasDto(
    long Id,
    long IdAset,
    string AsetLabel,
    string Jenis,
    DateOnly TglAktivitas,
    string? Deskripsi,
    string? PihakTerkait,
    decimal? NilaiNego,
    DateTime TglDibuat,
    DateTime? TglDiubah);

public record AsetTidakProduktifAktivitasListDto(
    IReadOnlyList<AsetTidakProduktifAktivitasDto> Items,
    IReadOnlyList<AsetPilihanDto> DaftarAset,
    bool IsAdminAset);

// Untuk dropdown pilih aset saat mencatat aktivitas baru.
public record AsetPilihanDto(long Id, string Label);

public record SimpanAktivitasRequest(
    long IdAset,
    string Jenis,
    DateOnly TglAktivitas,
    string? Deskripsi,
    string? PihakTerkait,
    decimal? NilaiNego);

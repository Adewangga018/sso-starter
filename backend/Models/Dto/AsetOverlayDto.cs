namespace SsoBackend.Models.Dto;

// ---- Lapisan operasional My Asset di atas master ERP (GCS.dbo.assets).
// Lihat catatan arsitektur di Services/AsetOverlayService.cs.

// Historis - satu baris per perubahan kondisi.
public record AsetKondisiDto(long Id, string ObjectId, string Kondisi, string? Catatan, DateTime TglDibuat);

public record SimpanKondisiRequest(string Kondisi, string? Catatan);

public record AsetNomorInternalDto(string ObjectId, string NomorAset, string? Catatan, DateTime TglDiubah);

public record SimpanNomorInternalRequest(string NomorAset, string? Catatan);

// JenisPic 'Orang': Nik/NamaPic/Departemen terisi. JenisPic 'Bagian': IdUnit/NamaUnit terisi.
public record AsetPicDto(
    long Id,
    string ObjectId,
    string JenisPic,
    string? Nik,
    string? NamaPic,
    string? Departemen,
    int? IdUnit,
    string? NamaUnit,
    DateOnly TglMulai,
    DateOnly? TglSelesai,
    string Status,
    string? Catatan,
    DateTime TglDibuat);

// Isi salah satu: Nik (JenisPic=Orang) ATAU IdUnit (JenisPic=Bagian).
public record SimpanPicRequest(string JenisPic, string? Nik, int? IdUnit, DateOnly? TglMulai, string? Catatan);

// Untuk picker "Individu" di form PIC (search-as-you-type).
public record AsetPegawaiDto(string Nik, string Nama, string? Jabatan, string? Unit);

// Untuk dropdown "Bagian" di form PIC.
public record AsetUnitDto(int Id, string Nama, string? NamaDepartemen);

// Untuk autocomplete "Vendor/Pelaksana" di form Catat Aktivitas (dbo.akun_rekanan).
// Boleh juga diisi manual (free text) kalau vendornya tidak ada di sini.
public record AsetRekananDto(string Kode, string Nama);

// Master "Jenis Aktivitas" (dropdown Catat Aktivitas). GroupAsset kosong = Umum
// (berlaku semua kategori aset); terisi = hanya relevan utk kategori tsb.
public record AsetJenisAktivitasDto(int Id, string Nama, IReadOnlyList<string> GroupAsset);

public record AsetAktivitasUmumDto(
    long Id,
    string ObjectId,
    string Jenis,
    DateOnly TglAktivitas,
    string? Deskripsi,
    string? VendorPelaksana,
    decimal? Biaya,
    string Status,
    DateTime TglDibuat,
    DateTime? TglDiubah);

public record SimpanAktivitasUmumRequest(
    string Jenis,
    DateOnly TglAktivitas,
    string? Deskripsi,
    string? VendorPelaksana,
    decimal? Biaya,
    string? Status);

// Ringkasan overlay 1 aset (dipakai halaman Detail Aset): kondisi terkini + riwayat,
// nomor internal, PIC aktif + riwayat, riwayat aktivitas, dan dokumen terlampir.
public record AsetOverlayDto(
    AsetKondisiDto? Kondisi,
    IReadOnlyList<AsetKondisiDto> RiwayatKondisi,
    AsetNomorInternalDto? NomorInternal,
    AsetPicDto? PicAktif,
    IReadOnlyList<AsetPicDto> RiwayatPic,
    IReadOnlyList<AsetAktivitasUmumDto> Aktivitas,
    IReadOnlyList<AsetDokumenDto> Dokumen,
    bool IsAdminAset,
    bool CanCatatAktivitas); // admin, ATAU Operator Aktivitas yg juga PIC aktif aset ini

// Operator Aktivitas: pegawai dgn hak terbatas "Catat Aktivitas SAJA" (bukan Admin Aset
// penuh), wajib PIC aktif atas aset bersangkutan tiap kali dipakai. Lihat aset.aktivitas_operator.
public record AsetAktivitasOperatorDto(
    int Id,
    string Nik,
    string Nama,
    bool Aktif,
    bool MasihPic,   // status PIC SEKARANG (bukan cuma saat digrant) - dicek ulang tiap load
    DateTime TglDibuat);

public record TambahAktivitasOperatorRequest(string Nik, string Nama);

// Baris "Riwayat PIC" lintas-aset (halaman Riwayat PIC) - AsetPicDto + info aset,
// supaya frontend tidak perlu join manual. Query READ-ONLY murni ke aset.pic_assignment
// yang sudah ada - lihat AsetOverlayService.GetRiwayatPicAsync.
public record AsetPicRiwayatDto(
    long Id,
    string ObjectId,
    string? NamaAset,
    string? KategoriAset,
    string JenisPic,
    string? Nik,
    string? NamaPic,
    string? Departemen,
    int? IdUnit,
    string? NamaUnit,
    DateOnly TglMulai,
    DateOnly? TglSelesai,
    string Status,
    string? Catatan,
    DateTime TglDibuat);

// Clearance sheet SDM: daftar aset yang jadi tanggungan 1 NIK.
public record AsetClearanceItemDto(
    long IdAssignment,
    string ObjectId,
    string? NamaAset,
    string? Lokasi,
    DateOnly TglMulai,
    string Status);

public record AsetClearanceDto(string Nik, string? NamaKaryawan, IReadOnlyList<AsetClearanceItemDto> Aset);
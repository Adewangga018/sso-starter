namespace SsoBackend.Models.Dto;

// Pegawai hasil pencarian untuk memilih penanggung jawab / tujuan distribusi surat.
public record OfficePegawaiDto(string Nik, string Nama, string? Jabatan, string? Unit);

// ---- input pembuatan surat ----
public record SuratPjInput(string Peran, string Nik, string? Nama, string? Jabatan, int Urutan);
public record SuratDistribusiInput(string Tipe, string Nik, string? Nama, string? Jabatan);

public record CreateSuratRequest(
    string Jenis, string? Klasifikasi, string Sifat, string Kecepatan,
    string Judul, string? Keterangan, string? Isi,
    DateOnly? TanggalSurat, DateOnly? BerlakuMulai, DateOnly? BerlakuSampai,
    IReadOnlyList<SuratPjInput>? PenanggungJawab,
    IReadOnlyList<SuratDistribusiInput>? Distribusi,
    bool KirimKeReviewer);   // true -> "Menunggu Review", false -> tetap "Draft"

// ---- output ----
public record SuratListItemDto(
    long Id, string? Nomor, string Jenis, string Sifat, string Kecepatan,
    string Judul, string Status, DateOnly? TanggalSurat, System.DateTime DibuatPada);

public record SuratPjDto(long Id, string Peran, int Urutan, string Nik, string? Nama, string? Jabatan, string Status, string? Komentar, System.DateTime? Tgl);
public record SuratDistribusiDto(long Id, string Tipe, string Nik, string? Nama, string? Jabatan);
public record SuratLampiranDto(long Id, string NamaFile, long? Ukuran, string? Tipe);
public record SuratRiwayatDto(long Id, string Aksi, string? OlehNama, string? Catatan, System.DateTime Tgl);

public record SuratDetailDto(
    long Id, string? Nomor, string Jenis, string? Klasifikasi, string Sifat, string Kecepatan,
    string Judul, string? Keterangan, string? Isi, string Status,
    string PembuatNik, string? PembuatNama,
    DateOnly? TanggalSurat, DateOnly? BerlakuMulai, DateOnly? BerlakuSampai,
    System.DateTime DibuatPada, bool IsPembuat,
    string? AksiPeran,   // "Reviewer"/"Approver" bila giliran user ini bertindak; selain itu null
    IReadOnlyList<SuratPjDto> PenanggungJawab,
    IReadOnlyList<SuratDistribusiDto> Distribusi,
    IReadOnlyList<SuratLampiranDto> Lampiran,
    IReadOnlyList<SuratRiwayatDto> Riwayat);

// Aksi reviewer/approver atas surat.
public record PengesahanRequest(string Aksi, string? Komentar);   // Aksi: Setujui|Tolak|Revisi

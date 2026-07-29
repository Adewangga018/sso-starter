namespace SsoBackend.Models.Dto;

// Baris daftar dokumen (menampilkan versi berlaku).
public record ProsedurDokumenDto(
    long Id, string Kode, string Judul, string Jenis, string? Unit, string? Kategori, string? Deskripsi,
    int? VersiBerlaku, string StatusBerlaku, DateOnly? TglBerlaku, long? IdVersiBerlaku, string? NamaFile,
    bool SudahAck, DateTime? TglUnggah);

public record ProsedurListDto(IReadOnlyList<ProsedurDokumenDto> Items, bool IsAdmin, int JumlahBelumAck);

public record ProsedurVersiDto(
    long Id, int Versi, string? Ringkasan, string NamaFile, string? TipeFile, string Status,
    DateOnly? TglBerlaku, string? NamaPenerbit, DateTime TglUnggah, int JumlahAck);

public record ProsedurDetailDto(
    long Id, string Kode, string Judul, string Jenis, string? Unit, string? Kategori, string? Deskripsi,
    IReadOnlyList<ProsedurVersiDto> Versi,
    long? IdVersiBerlaku, int? VersiBerlaku, bool SudahAckBerlaku, bool IsAdmin, int JumlahAckBerlaku);

public record ProsedurAckOrangDto(string Nik, string? Nama, DateTime Tgl);

// ---- request (JSON) ----
public record UbahDokumenRequest(string Kode, string Judul, string Jenis, string? Unit, string? Kategori, string? Deskripsi);
public record SetStatusVersiRequest(string Status);

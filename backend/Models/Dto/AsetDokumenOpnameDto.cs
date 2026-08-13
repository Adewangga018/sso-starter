namespace SsoBackend.Models.Dto;

// ---- Dokumen aset (sertifikat/BPKB/STNK/IMB/polis) + jatuh tempo. Lihat catatan
// arsitektur di Services/AsetDokumenService.cs.

public record AsetDokumenDto(
    long Id,
    string ObjectId,
    string JenisDokumen,
    string? NomorDokumen,
    DateOnly? TglTerbit,
    DateOnly? TglJatuhTempo,
    string? FileUrl,
    string? FileNamaAsli,
    string? Catatan,
    string Status,
    DateTime TglDibuat);

// [FromForm]: field metadata + berkas opsional dalam satu request multipart.
public class UploadDokumenForm
{
    public string JenisDokumen { get; set; } = string.Empty;
    public string? NomorDokumen { get; set; }
    public DateOnly? TglTerbit { get; set; }
    public DateOnly? TglJatuhTempo { get; set; }
    public string? Catatan { get; set; }
    public IFormFile? File { get; set; }
}

public record SimpanDokumenRequest(string JenisDokumen, string? NomorDokumen, DateOnly? TglTerbit, DateOnly? TglJatuhTempo, string? Catatan, string? Status);

// Baris dashboard "Dokumen Jatuh Tempo" - lintas aset.
public record AsetDokumenJatuhTempoDto(
    long Id,
    string ObjectId,
    string? NamaAset,
    string JenisDokumen,
    string? NomorDokumen,
    DateOnly TglJatuhTempo,
    int SisaHari);

// ---- Stock opname digital berbasis scan QR. Lihat catatan arsitektur di
// Services/AsetOpnameService.cs.

public record AsetOpnameSesiDto(
    int Id,
    string NamaSesi,
    DateOnly TglMulai,
    DateOnly? TglSelesai,
    string Status,
    string? LingkupKategori,
    string? Catatan,
    int JumlahDalamLingkup,
    int JumlahSudahDiscan,
    DateTime TglDibuat);

public record SimpanOpnameSesiRequest(string NamaSesi, DateOnly TglMulai, string? LingkupKategori, string? Catatan);

public record AsetOpnameScanDto(
    long Id,
    int IdSesi,
    string ObjectId,
    string? NamaAset,
    string? LokasiAktual,
    string? KondisiAktual,
    string? FotoUrl,
    string? FotoNamaAsli,
    string? Catatan,
    string NikPemindai,
    DateTime TglScan);

// [FromForm]: field scan + foto opsional dalam satu request multipart.
public class SubmitScanForm
{
    public string ObjectId { get; set; } = string.Empty;
    public string? LokasiAktual { get; set; }
    public string? KondisiAktual { get; set; }
    public string? Catatan { get; set; }
    public IFormFile? Foto { get; set; }
}

// Aset dalam lingkup sesi yang BELUM discan sama sekali.
public record AsetOpnameSelisihDto(string ObjectId, string? Nama, string? Kategori, string? Lokasi, string? NomorAset);

// Ringkasan 1 aset dalam lingkup sesi (baik sudah maupun belum discan) - sumber daftar
// pilihan "Kode Aset" di form Catat Scan, supaya pemakai memilih dari aset yang memang
// sesuai lingkup sesi (bukan ketik bebas tanpa batas).
public record AsetOpnameLingkupItemDto(string ObjectId, string? Nama, string? Kategori, bool SudahDiscan);

public record AsetOpnameSesiDetailDto(
    AsetOpnameSesiDto Sesi,
    IReadOnlyList<AsetOpnameScanDto> Scan,
    IReadOnlyList<AsetOpnameSelisihDto> Selisih,
    IReadOnlyList<AsetOpnameLingkupItemDto> LingkupAset);
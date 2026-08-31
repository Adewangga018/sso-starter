using SsoBackend.Models.Aset;
using SsoBackend.Models.Dto;

namespace SsoBackend.Services;

// Helper murni (tanpa state/DI) yang dipakai bareng oleh AsetService/AsetOverlayService/
// AsetDokumenService/AsetOpnameService - sebelumnya disalin identik ke masing-masing file
// (private const/method), disatukan di sini supaya perubahan (mis. teks pesan forbid)
// cuma perlu diubah 1 tempat. Method yang MEMANG beda perilaku antar service (mis.
// ContentType() - Dokumen dukung PDF, Opname foto-only) SENGAJA tidak disatukan di sini.
internal static class AsetShared
{
    public const string ForbidMsg = "Hanya Admin Aset (Departemen Kepatuhan) yang dapat mengelola aset.";

    public static AsetDokumenDto MapDokumen(AsetDokumen d) => new(
        d.Id, d.ObjectId, d.JenisDokumen, d.NomorDokumen, d.TglTerbit, d.TglJatuhTempo,
        d.FilePath is null ? null : $"/api/aset/dokumen/{d.Id}/file", d.FileNamaAsli, d.Catatan, d.Status, d.TglDibuat);
}

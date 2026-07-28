namespace SsoBackend.Models.Dto;

public record CoachingPesanDto(long Id, string IdPengirim, string? NamaPengirim, string Isi, DateTime TglKirim, bool Saya);

public record CoachingTindakLanjutDto(long Id, string Isi, string Status, DateTime TglDibuat, DateTime? TglSelesai);

// Ringkas sesi 1-on-1 untuk daftar. PeranLawan = posisi lawan bicara relatif ke saya.
public record CoachingSesiRingkasDto(
    long Id, string LawanNik, string? LawanNama, string PeranLawan,
    string Topik, string Status, string? PesanTerakhir, DateTime? TglTerakhir);

// Ringkas ruang tim. Peran = "Pemilik" (tim saya) | "Anggota" (tim atasan).
public record CoachingRuangRingkasDto(
    string OwnerNik, string? OwnerNama, string Peran, int JumlahAnggota,
    string? PesanTerakhir, DateTime? TglTerakhir);

public record CoachingInboxDto(
    IReadOnlyList<CoachingSesiRingkasDto> Sesi,
    IReadOnlyList<CoachingRuangRingkasDto> Ruang);

// Kandidat lawan bicara untuk sesi baru (atasan langsung + bawahan langsung efektif).
public record LawanBicaraDto(string Nik, string Nama, string? Jabatan, string Peran);

public record CoachingSesiDetailDto(
    long Id, string Topik, string Status,
    string LawanNik, string? LawanNama, string PeranLawan,
    IReadOnlyList<CoachingPesanDto> Pesan,
    IReadOnlyList<CoachingTindakLanjutDto> TindakLanjut);

public record CoachingAnggotaDto(string Nik, string Nama, string? Jabatan);

public record CoachingRuangDetailDto(
    string OwnerNik, string? OwnerNama, string Peran,
    IReadOnlyList<CoachingAnggotaDto> Anggota,
    IReadOnlyList<CoachingPesanDto> Pesan);

// ---- request ----
public record BuatSesiRequest(string TargetNik, string Topik);
public record KirimPesanRequest(string Isi);
public record TindakLanjutRequest(string Isi);
public record UpdateStatusRequest(string Status);

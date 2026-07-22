namespace SsoBackend.Models.Dto;

// Satu anggota tim (bawahan/rekan) di My Team. Kalau jabatan belum terisi, IdKaryawan/Nama
// null dan Terisi=false (formasi kosong).
public record TeamMemberDto(
    int Kedalaman,          // 1 = bawahan langsung, 2 = bawahan-dari-bawahan; 0 = rekan setim
    int IdJabatan,
    string Jabatan,
    string? Band,
    int? Jg,
    string? IdKaryawan,
    string? Nama,
    string? Unit,
    bool Terisi,
    bool HadirHariIni);

// Atasan langsung dari jabatan yang saya duduki (null bila saya di puncak / tak berjabatan).
public record AtasanDto(string Jabatan, string? Band, int? Jg, string? IdKaryawan, string? Nama);

public record TugasDto(
    int Id,
    string IdPemberi, string? NamaPemberi,
    string IdPenerima, string? NamaPenerima,
    string Judul, string? Deskripsi,
    DateOnly? Tenggat, string Status, DateTime DibuatPada);

// Konteks My Team untuk siapa pun yang login:
//  - PunyaTim=true  -> saya atasan; ada Anggota (bawahan) + TugasDiberikan.
//  - selalu         -> Atasan saya, RekanSetim, dan TugasUntukSaya (agar tak pernah kosong).
public record TeamDto(
    bool PunyaTim,
    bool DalamStruktur,      // false = akun belum tertaut jabatan sama sekali
    string? JabatanSaya, string? BandSaya, int? JgSaya,
    AtasanDto? Atasan,
    int JumlahAnggota, int JumlahKosong, int JumlahHadir,
    IReadOnlyList<TeamMemberDto> Anggota,
    IReadOnlyList<TeamMemberDto> RekanSetim,
    IReadOnlyList<TugasDto> TugasUntukSaya,
    IReadOnlyList<TugasDto> TugasDiberikan);

public record TugasCreateRequest(string IdPenerima, string Judul, string? Deskripsi, DateOnly? Tenggat);
public record TugasStatusRequest(string Status);

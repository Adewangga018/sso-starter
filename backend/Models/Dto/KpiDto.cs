namespace SsoBackend.Models.Dto;

// Satu KPI untuk ditampilkan. Persen = realisasi/target*100 (dihitung di service).
public record KpiDto(
    long Id,
    string Periode,
    string Judul,
    string? Deskripsi,
    string? Satuan,
    decimal Target,
    decimal Realisasi,
    decimal? Bobot,
    decimal Persen,
    string Level,
    string? IdPemilik,
    string? NamaPemilik,
    long? IdParent,
    string IdPembuat,
    string? NamaPembuat,
    string Status,
    string? Catatan,
    DateTime TglDibuat,
    DateTime? TglDiubah);

// Halaman "KPI Saya" (semua karyawan): KPI perusahaan (konteks) + KPI milik sendiri.
public record KpiSayaDto(
    IReadOnlyList<KpiDto> Perusahaan,
    IReadOnlyList<KpiDto> Saya,
    bool IsAtasan,
    bool IsAdminSdm);

// Satu anggota tim untuk daftar "KPI Tim".
public record KpiAnggotaDto(string Nik, string Nama, string? Jabatan, int JumlahKpi);

// Buat/ubah KPI. Untuk Perusahaan: idPemilik diabaikan. Untuk Individu: idPemilik wajib.
public record SimpanKpiRequest(
    string Periode,
    string Judul,
    string? Deskripsi,
    string? Satuan,
    decimal Target,
    decimal? Bobot,
    long? IdParent);

// Ubah realisasi/penilaian (atasan menilai).
public record NilaiKpiRequest(decimal Realisasi, string Status, string? Catatan);

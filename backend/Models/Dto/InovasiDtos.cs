namespace SsoBackend.Models.Dto;

// ============================================================================
// DTO modul My Innovation (Sistem Saran / GIO). Semua kolom pakai camelCase di
// JSON (default System.Text.Json). Struktur "aggregate": satu GET mengembalikan
// seluruh risalah (identitas + anggota + P.1-P.8 + DO/CHECK/ACTION + pengesahan),
// dan PUT per-tahap (plan/do/check/action) menyimpan sub-koleksinya sekaligus.
// ============================================================================

// --- Ringkasan baris untuk Daftar Inovasi (list) ---
public record GugusRingkasDto(
    int Id,
    string Jenis,
    string? NoRegistrasi,
    string? NamaGugus,
    int? TemaKe,
    string Periode,
    string? Judul,
    string? NamaDepartemen,
    string? NamaKompartemen,
    string Status,
    bool PlanDisahkan,
    string PeranSaya,          // Ketua | Sekretaris | Anggota | Fasilitator | Pembina | Pengaju
    string? KetuaNama,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public record GugusListDto(IReadOnlyList<GugusRingkasDto> Items);

// --- Buat gugus baru ---
public record CreateGugusRequest(string Jenis, string Periode, int? TemaKe, string? NamaGugus);

// --- Sub-koleksi ---
public record AnggotaDto(int Id, string Peran, string? Nik, string Nama, string? Jabatan, string? DepBagian, int Urutan);
public record DataPendukungDto(int Id, string? Indikator, string? KondisiAwal, string? SumberKeterangan,
    string? LampiranPath, string? LampiranNama, string? LampiranLink, int Urutan);
public record JadwalDto(int Id, string Tahapan, string Jenis, string? Bulan, int? Jumlah);
public record SasaranDto(int Id, string? Sasaran, string? KondisiSebelum, string? Target, string? Indikator, int Urutan);
public record ParetoDto(int Id, string? Kategori, int? Frekuensi, int Urutan);
public record QcdseDto(int Id, string Aspek, string? DampakKualitatif, string? DampakKuantitatif);
public record FishboneDto(int Id, string Faktor, string? Penyebab, string? AkarDominan, byte? Prioritas);
public record RencanaPerbaikanDto(int Id, string? AkarPenyebab, string? What, string? Why, string? Where,
    string? When, string? Who, string? How, string? HowMuch, int Urutan);
public record PengesahanDto(int Id, string Tahap, string Peran, string? Nik, string? Nama, int Urutan,
    string Status, string? Komentar, DateTime? Tgl, bool BisaSaya);
public record DoPelaksanaanDto(int Id, string? TahapanKegiatan, string? MonitoringHasil, DateOnly? Tanggal,
    string? EvidencePath, string? EvidenceNama, int Urutan);
public record DoKendalaDto(int Id, string? Kendala, string? Solusi, string? Waktu, string? Pic, int Urutan);
public record CheckPerbandinganDto(int Id, string? Sebelum, string? Sesudah, int Urutan);
public record CheckSasaranDto(int Id, string? Sasaran, string? Sebelum, string? Target, string? Sesudah, string? PersenCapaian, int Urutan);
public record CheckBiayaDto(int Id, string? Komponen, string? Perhitungan, string? Nilai, int Urutan);
public record CheckRisikoDto(int Id, string? DampakNegatif, string? Mitigasi, int Urutan);
public record ActionStandarisasiDto(int Id, string? StandarBaru, string? NoDokumen, DateOnly? TglBerlaku, string? Pic, int Urutan);
public record ActionTindakLanjutDto(int Id, string? Rencana, string? TargetWaktu, string? Pic, string? Status, int Urutan);

// --- Aggregate lengkap (GET detail) ---
public record GugusDetailDto(
    int Id,
    string Jenis,
    string? NoRegistrasi,
    string? NamaGugus,
    int? TemaKe,
    string Periode,
    int? IdDepartemen,
    string? NamaDepartemen,
    int? IdKompartemen,
    string? NamaKompartemen,
    string? Judul,
    string? LatarBelakang,
    string? MasalahUtama,
    string? VerifikasiAkar,
    int? IdGagasan,
    string? ActionTemaBerikutnya,
    string Status,
    bool PlanDisahkan,
    string CreatedByNik,
    string? CreatedByNama,
    bool BisaEdit,
    bool IsOwner,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    DateTime? SubmittedAt,
    IReadOnlyList<AnggotaDto> Anggota,
    IReadOnlyList<DataPendukungDto> DataPendukung,
    IReadOnlyList<JadwalDto> Jadwal,
    IReadOnlyList<SasaranDto> Sasaran,
    IReadOnlyList<ParetoDto> Pareto,
    IReadOnlyList<QcdseDto> Qcdse,
    IReadOnlyList<FishboneDto> Fishbone,
    IReadOnlyList<RencanaPerbaikanDto> RencanaPerbaikan,
    IReadOnlyList<PengesahanDto> Pengesahan,
    IReadOnlyList<DoPelaksanaanDto> DoPelaksanaan,
    IReadOnlyList<DoKendalaDto> DoKendala,
    IReadOnlyList<CheckPerbandinganDto> CheckPerbandingan,
    IReadOnlyList<CheckSasaranDto> CheckSasaran,
    IReadOnlyList<CheckBiayaDto> CheckBiaya,
    IReadOnlyList<CheckRisikoDto> CheckRisiko,
    IReadOnlyList<ActionStandarisasiDto> ActionStandarisasi,
    IReadOnlyList<ActionTindakLanjutDto> ActionTindakLanjut);

// --- Payload simpan tahap PLAN (identitas + P.1-P.8) ---
public record SavePlanRequest(
    string? NamaGugus,
    int? TemaKe,
    string? Periode,
    string? Judul,
    string? LatarBelakang,
    string? MasalahUtama,
    string? VerifikasiAkar,
    IReadOnlyList<AnggotaDto>? Anggota,
    IReadOnlyList<DataPendukungDto>? DataPendukung,
    IReadOnlyList<JadwalDto>? Jadwal,
    IReadOnlyList<SasaranDto>? Sasaran,
    IReadOnlyList<ParetoDto>? Pareto,
    IReadOnlyList<QcdseDto>? Qcdse,
    IReadOnlyList<FishboneDto>? Fishbone,
    IReadOnlyList<RencanaPerbaikanDto>? RencanaPerbaikan);

// --- Payload simpan tahap DO ---
public record SaveDoRequest(
    IReadOnlyList<DoPelaksanaanDto>? DoPelaksanaan,
    IReadOnlyList<DoKendalaDto>? DoKendala);

// --- Payload simpan tahap CHECK ---
public record SaveCheckRequest(
    IReadOnlyList<CheckPerbandinganDto>? CheckPerbandingan,
    IReadOnlyList<CheckSasaranDto>? CheckSasaran,
    IReadOnlyList<CheckBiayaDto>? CheckBiaya,
    IReadOnlyList<CheckRisikoDto>? CheckRisiko);

// --- Payload simpan tahap ACTION ---
public record SaveActionRequest(
    string? ActionTemaBerikutnya,
    IReadOnlyList<ActionStandarisasiDto>? ActionStandarisasi,
    IReadOnlyList<ActionTindakLanjutDto>? ActionTindakLanjut);

// --- Pengesahan (approve/reject/revisi oleh Fasilitator/Pembina) ---
public record PengesahanActionRequest(string Aksi, string? Komentar);  // Aksi: Disetujui | Ditolak | Revisi

// --- Hasil unggah berkas ---
public record InovasiUploadDto(string Path, string Nama, string Url);

// --- Pencarian pegawai untuk menambah anggota ---
public record InovasiPegawaiDto(string Nik, string Nama, string? Jabatan, string? Unit);

// ============================================================================
// Sumbang Gagasan
// ============================================================================
public record GagasanApprovalDto(int Id, int Urutan, string Peran, string? Nik, string? Nama,
    string Status, string? Komentar, string? Metodologi, DateTime? Tgl, bool BisaSaya);

public record GagasanRingkasDto(int Id, string? NoRegistrasi, string Judul, string? Metodologi,
    string? NamaDepartemenAsal, string? NamaDepartemenTujuan, string Status, string PeranSaya,
    int? IdGugus, DateTime CreatedAt);

public record GagasanListDto(IReadOnlyList<GagasanRingkasDto> Items);

public record GagasanDetailDto(int Id, string? NoRegistrasi, string Judul, string? LatarBelakang,
    string? Masalah, string? Solusi, string? Metodologi, string CreatedByNik, string? CreatedByNama,
    int? IdDepartemenAsal, string? NamaDepartemenAsal, int? IdDepartemenTujuan, string? NamaDepartemenTujuan,
    string Status, int? IdGugus, bool BisaEdit, bool IsOwner, bool SiapDaftar,
    DateTime CreatedAt, DateTime? SubmittedAt,
    IReadOnlyList<GagasanApprovalDto> Approval);

public record CreateGagasanRequest(string Judul, string? LatarBelakang, string? Masalah, string? Solusi, int? IdDepartemenTujuan);
public record UpdateGagasanRequest(string Judul, string? LatarBelakang, string? Masalah, string? Solusi, int? IdDepartemenTujuan);
// Aksi: Disetujui|Revisi|Ditolak. Pada langkah GM Kompartemen Asal saat Disetujui,
// wajib menyertakan Metodologi (SS/GIO/5R). Penetapan Fasilitator/anggota dilakukan
// Ketua saat mendaftarkan risalah, bukan di sini.
public record GagasanApprovalActionRequest(string Aksi, string? Komentar, string? Metodologi);
public record DaftarGagasanRequest(string? Metodologi, string? NamaGugus, int? TemaKe, string? Periode);
public record DaftarGagasanResultDto(int IdGugus, string Jenis, string Base);

// Peran pengguna pada modul inovasi (untuk menu berbeda approver vs karyawan).
public record InovasiPeranDto(string Peran, bool BolehApprove);  // Peran: GM | Manager | Karyawan

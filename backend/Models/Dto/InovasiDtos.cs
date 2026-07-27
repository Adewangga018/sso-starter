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
    DateTime? UpdatedAt,
    string? GagasanJudul = null,   // judul Sumbang Gagasan asal (bila risalah lahir dari gagasan)
    bool SudahDinilai = false);    // ada penugasan juri yang sudah memuat skor

public record GugusListDto(IReadOnlyList<GugusRingkasDto> Items);

// --- Buat gugus baru ---
public record CreateGugusRequest(string Jenis, string Periode, int? TemaKe, string? NamaGugus);

// --- Sub-koleksi ---
public record AnggotaDto(int Id, string Peran, string? Nik, string Nama, string? Jabatan, string? DepBagian, int Urutan);
public record DataPendukungDto(int Id, string? Indikator, string? KondisiAwal, string? SumberKeterangan,
    string? LampiranPath, string? LampiranNama, string? LampiranLink, int Urutan);
public record JadwalDto(int Id, string Tahapan, string Jenis, string? Bulan, int? Jumlah, string? Rentang);
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
    string? BagianSeksi,
    string? Judul,
    string? LatarBelakang,
    string? MasalahUtama,
    string? VerifikasiAkar,
    string? VerifikasiStatistik,
    string? AreaLokasi,
    string? ProfilDenahPath,
    string? ProfilDenahNama,
    string? DampakPositif,
    string? DampakPositifLainnya,
    string? LimaRJadwal,
    string? LimaRCatatan,
    string? LimaRDokumentasi,
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
    string? BagianSeksi,
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
    IReadOnlyList<RencanaPerbaikanDto>? RencanaPerbaikan,
    // Khusus 5R (null untuk SS/GIO).
    string? AreaLokasi = null,
    string? ProfilDenahPath = null,
    string? ProfilDenahNama = null,
    string? DampakPositif = null,
    string? DampakPositifLainnya = null,
    string? LimaRJadwal = null,
    string? LimaRCatatan = null,
    string? LimaRDokumentasi = null);

// --- Payload simpan tahap DO ---
public record SaveDoRequest(
    IReadOnlyList<DoPelaksanaanDto>? DoPelaksanaan,
    IReadOnlyList<DoKendalaDto>? DoKendala);

// --- Payload simpan tahap CHECK (VerifikasiStatistik = C.3, khusus GIO) ---
public record SaveCheckRequest(
    string? VerifikasiStatistik,
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

// Baris direktori pegawai (halaman Daftar Pegawai): sama seperti InovasiPegawaiDto
// namun disertai departemen & kompartemen hasil resolusi org untuk kolom & filter.
public record InovasiPegawaiDirektoriDto(string Nik, string Nama, string? Jabatan, string? Unit,
    string? Departemen, string? Kompartemen);

// ============================================================================
// Sumbang Gagasan
// ============================================================================
public record GagasanApprovalDto(int Id, int Urutan, string Peran, string? Nik, string? Nama,
    string Status, string? Komentar, string? Metodologi, DateTime? Tgl, bool BisaSaya);

public record GagasanRingkasDto(int Id, string? NoRegistrasi, string Judul, string? Metodologi,
    string? NamaDepartemenAsal, string? NamaDepartemenTujuan, string Status, string PeranSaya,
    int? IdGugus, DateTime CreatedAt,
    string? CreatedByNik = null, string? CreatedByNama = null);

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

// ============================================================================
// History Approval - jejak persetujuan gagasan/risalah. Satu baris = satu
// langkah approval. Dipakai menu History: approver (Manager/GM) menelusuri apa
// saja yang pernah ia verifikasi/setujui, pengaju melihat perjalanan usulannya.
// ============================================================================
public record RiwayatApprovalDto(
    string Kind,             // Gagasan | Inovasi
    int IdTarget,
    string? NoRegistrasi,
    string? Judul,
    string? Metodologi,      // SS | GIO | 5R
    string? Unit,            // departemen / kompartemen
    string? Tahap,           // PLAN | FINAL (risalah); null untuk gagasan
    string Peran,
    string? Nik,
    string? Nama,
    string StatusLangkah,    // Menunggu | Disetujui | Revisi | Ditolak
    string? Komentar,
    DateTime? Tgl,
    string StatusTarget,
    DateTime TargetCreatedAt,
    bool Saya);

public record RiwayatApprovalListDto(IReadOnlyList<RiwayatApprovalDto> Items);

// ============================================================================
// Penilaian Juri (stream) - rubrik GIO/SS & 5R, panel juri, penugasan, skor.
// ============================================================================

public record PenilaianKriteriaDto(int Id, string JenisForm, string Tahap, int No, string Kriteria, decimal BobotPersen, string? Keterangan);

// Pengguna ber-role Juri (untuk pemilih anggota stream).
public record JuriUserDto(string Id, string? Nama, string? Nik, string? Email);

// --- Kelola stream (Admin) ---
public record StreamAnggotaDto(int Id, string UserId, string? Nik, string? Nama, string Peran);
public record StreamDto(int Id, string Nama, string? Keterangan, bool Aktif, IReadOnlyList<StreamAnggotaDto> Anggota);
public record StreamAnggotaInput(string UserId, string? Nik, string? Nama, string Peran); // Peran: Ketua|Anggota|Sekretaris
public record SaveStreamRequest(string Nama, string? Keterangan, bool Aktif, IReadOnlyList<StreamAnggotaInput> Anggota);

// --- Penugasan stream -> gugus (Admin) ---
public record GugusOptionDto(int Id, string Jenis, string? NoRegistrasi, string? NamaGugus, string? Judul, string Status);
public record PenugasanDto(int Id, int IdGugus, int IdStream, string StreamNama, string Status,
    string Jenis, string? NoRegistrasi, string? NamaGugus, string? Judul, DateTime DibuatPada);
public record CreatePenugasanRequest(int IdGugus, int IdStream);
public record UpdatePenugasanRequest(int IdStream);

// --- Sisi Juri ---
// Ringkas: satu penugasan yang perlu dinilai/dilihat oleh juri saat ini.
public record TugasPenilaianDto(int IdPenugasan, int IdGugus, string Jenis, string JenisForm,
    string? NoRegistrasi, string? NamaGugus, string? Judul, string Periode,
    string PeranSaya, bool BisaNilai, string Status);

public record GugusHeaderDto(int Id, string Jenis, string? NoRegistrasi, string? NamaGugus, string? Judul,
    string Periode, string? NamaDepartemen, string? NamaKompartemen, string Status);

public record SkorDto(int IdKriteria, byte Nilai, string? Catatan);

public record PenilaiHasilDto(string UserId, string? Nama, string Peran, decimal Nilai, string Kategori, int Terisi);

public record PenilaianHasilDto(decimal NilaiAkhir, string Kategori, int JumlahKriteria,
    IReadOnlyList<PenilaiHasilDto> Penilai);

public record PenilaianDetailDto(int IdPenugasan, string Status, GugusHeaderDto Gugus, string JenisForm,
    string PeranSaya, bool BisaNilai,
    IReadOnlyList<PenilaianKriteriaDto> Kriteria,
    IReadOnlyList<SkorDto> SkorSaya,
    PenilaianHasilDto Hasil);

// Rekap nilai juri per risalah (dipakai Roadmap Inovasi). NilaiAkhir 0 bila belum
// ada penilai yang mengisi seluruh kriteria; Kategori mengikuti ambang rubrik.
public record RekapNilaiDto(int IdGugus, decimal NilaiAkhir, string Kategori,
    string StatusPenilaian, int PenilaiLengkap, int PenilaiTotal);

public record SkorInput(int IdKriteria, byte Nilai, string? Catatan);
public record SaveSkorRequest(IReadOnlyList<SkorInput> Skor);

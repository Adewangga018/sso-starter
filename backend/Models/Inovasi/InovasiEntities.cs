namespace SsoBackend.Models.Inovasi;

// Kepala risalah inovasi (SS / GIO). Lihat backend/Database/inovasi/01-schema-ddl.sql.
public class Gugus
{
    public int Id { get; set; }
    public string Jenis { get; set; } = "SS";           // SS | GIO
    public string? NoRegistrasi { get; set; }
    public string? NamaGugus { get; set; }
    public int? TemaKe { get; set; }
    public string Periode { get; set; } = string.Empty;  // '2026/2027'
    public int? IdDepartemen { get; set; }
    public string? NamaDepartemen { get; set; }
    public int? IdKompartemen { get; set; }
    public string? NamaKompartemen { get; set; }
    public string? Judul { get; set; }
    public string? LatarBelakang { get; set; }
    public string? MasalahUtama { get; set; }
    public string? VerifikasiAkar { get; set; }   // GIO P.8 Verifikasi Akar Penyebab Dominan
    public int? IdGagasan { get; set; }            // tautan ke gagasan sumbernya
    public string? ActionTemaBerikutnya { get; set; }
    public string Status { get; set; } = "Draft";
    public bool PlanDisahkan { get; set; }
    public string CreatedByNik { get; set; } = string.Empty;
    public string? CreatedByNama { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public DateTime? SubmittedAt { get; set; }

    public List<Anggota> Anggota { get; set; } = new();
    public List<DataPendukung> DataPendukung { get; set; } = new();
    public List<Jadwal> Jadwal { get; set; } = new();
    public List<Sasaran> Sasaran { get; set; } = new();
    public List<Pareto> Pareto { get; set; } = new();      // GIO P.3
    public List<Qcdse> Qcdse { get; set; } = new();
    public List<Fishbone> Fishbone { get; set; } = new();
    public List<RencanaPerbaikan> RencanaPerbaikan { get; set; } = new();
    public List<Pengesahan> Pengesahan { get; set; } = new();
    public List<DoPelaksanaan> DoPelaksanaan { get; set; } = new();
    public List<DoKendala> DoKendala { get; set; } = new();
    public List<CheckPerbandingan> CheckPerbandingan { get; set; } = new();
    public List<CheckSasaran> CheckSasaran { get; set; } = new();
    public List<CheckBiaya> CheckBiaya { get; set; } = new();
    public List<CheckRisiko> CheckRisiko { get; set; } = new();
    public List<ActionStandarisasi> ActionStandarisasi { get; set; } = new();
    public List<ActionTindakLanjut> ActionTindakLanjut { get; set; } = new();
}

public class Anggota
{
    public int Id { get; set; }
    public int IdGugus { get; set; }
    public string Peran { get; set; } = "Anggota";
    public string? Nik { get; set; }
    public string Nama { get; set; } = string.Empty;
    public string? Jabatan { get; set; }
    public string? DepBagian { get; set; }
    public int Urutan { get; set; }
}

public class DataPendukung
{
    public int Id { get; set; }
    public int IdGugus { get; set; }
    public string? Indikator { get; set; }
    public string? KondisiAwal { get; set; }
    public string? SumberKeterangan { get; set; }
    public string? LampiranPath { get; set; }
    public string? LampiranNama { get; set; }
    public string? LampiranLink { get; set; }
    public int Urutan { get; set; }
}

public class Jadwal
{
    public int Id { get; set; }
    public int IdGugus { get; set; }
    public string Tahapan { get; set; } = "PLAN";  // PLAN|DO|CHECK|ACTION
    public string Jenis { get; set; } = "Rencana"; // Rencana|Realisasi
    public string? Bulan { get; set; }             // csv "6,7"
    public int? Jumlah { get; set; }
}

public class Sasaran
{
    public int Id { get; set; }
    public int IdGugus { get; set; }
    public string? SasaranText { get; set; }
    public string? KondisiSebelum { get; set; }
    public string? Target { get; set; }
    public string? Indikator { get; set; }
    public int Urutan { get; set; }
}

public class Pareto
{
    public int Id { get; set; }
    public int IdGugus { get; set; }
    public string? Kategori { get; set; }
    public int? Frekuensi { get; set; }
    public int Urutan { get; set; }
}

public class Qcdse
{
    public int Id { get; set; }
    public int IdGugus { get; set; }
    public string Aspek { get; set; } = "Q";
    public string? DampakKualitatif { get; set; }
    public string? DampakKuantitatif { get; set; }
}

public class Fishbone
{
    public int Id { get; set; }
    public int IdGugus { get; set; }
    public string Faktor { get; set; } = "Man";
    public string? Penyebab { get; set; }
    public string? AkarDominan { get; set; }
    public byte? Prioritas { get; set; }
}

public class RencanaPerbaikan
{
    public int Id { get; set; }
    public int IdGugus { get; set; }
    public string? AkarPenyebab { get; set; }
    public string? What { get; set; }
    public string? Why { get; set; }
    public string? Dimana { get; set; }   // kolom "where"
    public string? Kapan { get; set; }    // kolom "when"
    public string? Who { get; set; }
    public string? How { get; set; }
    public string? HowMuch { get; set; }
    public int Urutan { get; set; }
}

public class Pengesahan
{
    public int Id { get; set; }
    public int IdGugus { get; set; }
    public string Tahap { get; set; } = "PLAN";
    public string Peran { get; set; } = string.Empty;
    public string? Nik { get; set; }
    public string? Nama { get; set; }
    public int Urutan { get; set; }
    public string Status { get; set; } = "Menunggu";
    public string? Komentar { get; set; }
    public DateTime? Tgl { get; set; }
}

public class DoPelaksanaan
{
    public int Id { get; set; }
    public int IdGugus { get; set; }
    public string? TahapanKegiatan { get; set; }
    public string? MonitoringHasil { get; set; }
    public DateOnly? Tanggal { get; set; }
    public string? EvidencePath { get; set; }
    public string? EvidenceNama { get; set; }
    public int Urutan { get; set; }
}

public class DoKendala
{
    public int Id { get; set; }
    public int IdGugus { get; set; }
    public string? Kendala { get; set; }
    public string? Solusi { get; set; }
    public string? Waktu { get; set; }
    public string? Pic { get; set; }
    public int Urutan { get; set; }
}

public class CheckPerbandingan
{
    public int Id { get; set; }
    public int IdGugus { get; set; }
    public string? Sebelum { get; set; }
    public string? Sesudah { get; set; }
    public int Urutan { get; set; }
}

public class CheckSasaran
{
    public int Id { get; set; }
    public int IdGugus { get; set; }
    public string? SasaranText { get; set; }
    public string? Sebelum { get; set; }
    public string? Target { get; set; }
    public string? Sesudah { get; set; }
    public string? PersenCapaian { get; set; }
    public int Urutan { get; set; }
}

public class CheckBiaya
{
    public int Id { get; set; }
    public int IdGugus { get; set; }
    public string? Komponen { get; set; }
    public string? Perhitungan { get; set; }
    public string? Nilai { get; set; }
    public int Urutan { get; set; }
}

public class CheckRisiko
{
    public int Id { get; set; }
    public int IdGugus { get; set; }
    public string? DampakNegatif { get; set; }
    public string? Mitigasi { get; set; }
    public int Urutan { get; set; }
}

public class ActionStandarisasi
{
    public int Id { get; set; }
    public int IdGugus { get; set; }
    public string? StandarBaru { get; set; }
    public string? NoDokumen { get; set; }
    public DateOnly? TglBerlaku { get; set; }
    public string? Pic { get; set; }
    public int Urutan { get; set; }
}

public class ActionTindakLanjut
{
    public int Id { get; set; }
    public int IdGugus { get; set; }
    public string? Rencana { get; set; }
    public string? TargetWaktu { get; set; }
    public string? Pic { get; set; }
    public string? Status { get; set; }
    public int Urutan { get; set; }
}

// --- Sumbang Gagasan: usulan awal yang dinilai berjenjang sebelum menjadi
//     gugus (SS/GIO/5R). Lihat backend/Database/inovasi/02-gagasan-gio.sql. ---
public class Gagasan
{
    public int Id { get; set; }
    public string? NoRegistrasi { get; set; }
    public string Judul { get; set; } = string.Empty;
    public string? LatarBelakang { get; set; }
    public string? Masalah { get; set; }               // pokok masalah
    public string? Solusi { get; set; }                // usulan solusi
    public string? Metodologi { get; set; }            // SS|GIO|5R (dipilih GM Kompartemen Asal)
    public string CreatedByNik { get; set; } = string.Empty;
    public string? CreatedByNama { get; set; }
    public int? IdDepartemenAsal { get; set; }
    public string? NamaDepartemenAsal { get; set; }
    public int? IdKompartemenAsal { get; set; }
    public string? NamaKompartemenAsal { get; set; }
    public int? IdDepartemenTujuan { get; set; }
    public string? NamaDepartemenTujuan { get; set; }
    public int? IdKompartemenTujuan { get; set; }
    public string? NamaKompartemenTujuan { get; set; }
    // Ditetapkan GM (Verifikator) saat menyetujui, untuk prefill anggota gugus.
    public string? FasilitatorNik { get; set; }
    public string? FasilitatorNama { get; set; }
    public string? PembinaNik { get; set; }      // hanya GIO
    public string? PembinaNama { get; set; }
    public string Status { get; set; } = "Dikirim";
    public int? IdGugus { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public DateTime? SubmittedAt { get; set; }

    public List<GagasanApproval> Approval { get; set; } = new();
}

public class GagasanApproval
{
    public int Id { get; set; }
    public int IdGagasan { get; set; }
    public int Urutan { get; set; }
    public string Peran { get; set; } = string.Empty;  // Verifikator | GM Kompartemen Asal | GM Kompartemen Tujuan
    public string? Nik { get; set; }
    public string? Nama { get; set; }
    public string Status { get; set; } = "Menunggu";   // Menunggu|Disetujui|Revisi|Ditolak
    public string? Komentar { get; set; }
    public string? Metodologi { get; set; }
    public DateTime? Tgl { get; set; }
}

// --- Read-only refleksi tabel grading (di db_mygcs) untuk resolusi unit
//     organisasi & pencarian pegawai internal. Tidak pernah ditulis. ---
public class UnitOrganisasi
{
    public int IdUnit { get; set; }
    public string Nama { get; set; } = string.Empty;
    public string Tipe { get; set; } = string.Empty;   // Direktorat|Kompartemen|Departemen|Region|Kelompok
    public int? IdUnitInduk { get; set; }
}

public class Jabatan
{
    public int IdJabatan { get; set; }
    public string NamaJabatan { get; set; } = string.Empty;
    public int? IdUnit { get; set; }
    public byte IdBand { get; set; }   // 1 = GM, 2 = Manager, dst
}

public class Penempatan
{
    public int Id { get; set; }
    public int IdJabatan { get; set; }
    public string IdKaryawan { get; set; } = string.Empty;
    public string Nama { get; set; } = string.Empty;
    public string Status { get; set; } = "Aktif";
}

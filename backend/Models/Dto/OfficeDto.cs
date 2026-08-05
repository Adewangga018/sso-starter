namespace SsoBackend.Models.Dto;

// Pegawai hasil pencarian untuk memilih penanggung jawab / tujuan distribusi surat.
public record OfficePegawaiDto(string Nik, string Nama, string? Jabatan, string? Unit);

// ---- input pembuatan surat ----
public record SuratPjInput(string Peran, string Nik, string? Nama, string? Jabatan, int Urutan);
public record SuratDistribusiInput(string Tipe, string Nik, string? Nama, string? Jabatan);

public record CreateSuratRequest(
    string Jenis,               // kode office.ref_jenis_surat: DR|MI|BA|RR
    string? KodeBagian,         // kode office.ref_bagian; kosong -> ditebak dari data organisasi pembuat
    string? KodeKlasifikasi,    // kode office.ref_klasifikasi
    string Sifat, string Kecepatan,
    string Judul, string? Keterangan, string? Isi,
    DateOnly? TanggalSurat, DateOnly? BerlakuMulai, DateOnly? BerlakuSampai,
    IReadOnlyList<SuratPjInput>? PenanggungJawab,
    IReadOnlyList<SuratDistribusiInput>? Distribusi,
    bool KirimKeReviewer);   // true -> "Menunggu Review", false -> tetap "Draft"

// ---- master kode surat ----
public record RefJenisSuratDto(string Kode, string Nama);
public record RefBagianDto(string Kode, string Nama);
public record RefKlasifikasiDto(string Kode, string Kelompok, string Masalah);

// Dikirim sekali ke form Buat Surat. BagianSaya = tebakan kode bagian pembuat
// dari data organisasi (grading); null bila unitnya belum terpetakan.
public record OfficeReferensiDto(
    IReadOnlyList<RefJenisSuratDto> Jenis,
    IReadOnlyList<RefBagianDto> Bagian,
    IReadOnlyList<RefKlasifikasiDto> Klasifikasi,
    string? BagianSaya);

// ---- output ----
// JenisNama = nama panjang kode jenis (mis. "MI" -> "Memo"), supaya tabel tidak
// menampilkan kode telanjang. Null bila kode tak ada di master.
public record SuratListItemDto(
    long Id, string? Nomor, string Jenis, string? JenisNama, string Sifat, string Kecepatan,
    string Judul, string Status, DateOnly? TanggalSurat, System.DateTime DibuatPada);

// ---- kotak masuk (menu Inbox, meniru tab-tab DOF) ----
// Peran = keterlibatan saya pada surat: Tujuan|CC|Reviewer|Approver.
public record InboxItemDto(
    long Id, string? Nomor, string Jenis, string? JenisNama, string Judul, string Status,
    DateOnly? TanggalSurat, System.DateTime DibuatPada,
    string? Pengirim, string? Approver, string Peran, string Keterangan, bool Dibaca);

public record InboxCountsDto(int BelumDibaca, int Dibaca, int DalamProses, int Selesai, int Dibatalkan);

public record InboxResponseDto(string Tab, InboxCountsDto Counts, IReadOnlyList<InboxItemDto> Items);

public record SuratPjDto(long Id, string Peran, int Urutan, string Nik, string? Nama, string? Jabatan, string Status, string? Komentar, System.DateTime? Tgl);
public record SuratDistribusiDto(long Id, string Tipe, string Nik, string? Nama, string? Jabatan);
public record SuratLampiranDto(long Id, string NamaFile, long? Ukuran, string? Tipe);
public record SuratRiwayatDto(long Id, string Aksi, string? OlehNama, string? Catatan, System.DateTime Tgl);

public record SuratDetailDto(
    long Id, string? Nomor, string Jenis, string? JenisNama,
    string? KodeBagian, string? BagianNama,
    string? KodeKlasifikasi, string? Klasifikasi, string Sifat, string Kecepatan,
    string Judul, string? Keterangan, string? Isi, string Status,
    string PembuatNik, string? PembuatNama,
    DateOnly? TanggalSurat, DateOnly? BerlakuMulai, DateOnly? BerlakuSampai,
    System.DateTime DibuatPada, bool IsPembuat,
    string? AksiPeran,   // "Reviewer"/"Approver" bila giliran user ini bertindak; selain itu null
    bool BolehTindakLanjut,   // penerima (tujuan/CC) surat final boleh mendisposisikan
    IReadOnlyList<SuratPjDto> PenanggungJawab,
    IReadOnlyList<SuratDistribusiDto> Distribusi,
    IReadOnlyList<SuratLampiranDto> Lampiran,
    IReadOnlyList<SuratRiwayatDto> Riwayat);

// Aksi reviewer/approver atas surat.
public record PengesahanRequest(string Aksi, string? Komentar);   // Aksi: Setujui|Tolak|Revisi

// ---- tab "Tindak Lanjut" pada detail surat ----
public record SuratTindakLanjutDto(
    long Id, System.DateTime Tgl, string Keterangan,
    string? Dari, string? Untuk, string? Catatan,
    string? NamaLampiran, long? Ukuran);

// Namanya diawali "Surat" karena modul Coaching sudah punya TindakLanjutRequest sendiri.
public record SuratTindakLanjutRequest(
    string Keterangan,      // Diteruskan|Disposisi|Tanggapan|Selesai
    string? UntukNik, string? UntukNama, string? Catatan);

// ---- menu Notifikasi ----
public record NotifikasiItemDto(
    long Id, string Judul, long? IdSurat,
    string? OlehNik, string? OlehNama, string? OlehJabatan,
    System.DateTime DibuatPada, bool Dibaca);

public record NotifikasiCountsDto(int Semua, int Dibaca, int BelumDibaca);

public record NotifikasiResponseDto(
    string Filter, NotifikasiCountsDto Counts, IReadOnlyList<NotifikasiItemDto> Items);

// Angka lonceng/badge sidebar My Office — sengaja ringan, hanya dua hitungan.
public record OfficeBadgeDto(int InboxBelumDibaca, int NotifikasiBelumDibaca);

// ---- tab "Hirarki" pada detail surat ----
// Satu simpul alur surat. Peran: Drafter|Reviewer|Approver|Tujuan|CC.
// Urutan = nomor tahapan (Reviewer 1, Reviewer 2, dst); 0 untuk drafter & distribusi.
public record HirarkiNodeDto(
    string Peran, int Urutan, string Nik, string? Nama, string? Jabatan,
    string Status, System.DateTime? Tgl);

public record HirarkiDto(IReadOnlyList<HirarkiNodeDto> Nodes);

// ---- dashboard My Office (mengikuti tata letak dashboard DOF) ----
// Seluruh angka dihitung dari isi office.surat / surat_pj / surat_lampiran / surat_riwayat -
// tidak ada nilai tetap. Bila belum ada surat, semuanya wajar bernilai 0.
public record OfficeDashboardDto(
    int Tahun,
    IReadOnlyList<int> TahunTersedia,

    // Rata-rata lama proses (menit) untuk surat pada tahun terpilih.
    int MenitPenyetujuan,   // dibuat -> berstatus Disetujui
    int MenitReview,        // dikirim ke review -> reviewer terakhir menindak
    int MenitApprove,       // masuk tahap approval -> approver terakhir menindak
    int SampelPenyetujuan,  // banyak surat yang ikut dirata-rata (0 = belum ada sampel)
    int SampelReview,
    int SampelApprove,

    // Surat sudah Disetujui tapi lampiran hasil tanda tangan belum diunggah (tahun terpilih).
    int BelumUpload,
    int BelumUploadNonSp,
    int BelumUploadSp,

    // Berlaku untuk SELURUH TAHUN (bukan tahun terpilih), sesuai catatan "*" pada DOF.
    int SpBerakhir,
    int SpBerakhirSudahUpload,
    int SpBerakhirBelumUpload,

    int TotalSurat,             // surat yang saya buat pada tahun terpilih
    int TotalSuratSubordinat,   // surat yang dibuat bawahan langsung saya (vw_web_sdm_approval)

    int MenungguApprove,        // menunggu tindakan saya sekarang (lintas tahun)
    int SuratSirkuler,          // Jenis = "Sirkuler" pada tahun terpilih
    int MenungguReview);        // menunggu tindakan saya sekarang (lintas tahun)

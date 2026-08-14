namespace SsoBackend.Models.Dto;

// Satu baris komponen pada slip. GrupKode/GrupLabel non-null => komponen ini bagian dari
// sub-komponen yang tampil sebagai satu dropdown (mis. Lembur, BPJS Ketenagakerjaan) -
// frontend mengelompokkan baris berurutan yang berbagi GrupKode yang sama.
public record GajiBarisDto(
    string Kode,
    string Nama,
    decimal Nominal,
    bool Opsional,
    bool KenaTerlambat,
    string Basis,
    string? Keterangan,
    string? GrupKode = null,
    string? GrupLabel = null,
    // false = ditampilkan sbg informasi tapi TIDAK ikut dijumlah ke Subtotal
    // kategori maupun Total Pendapatan/Potongan/Gaji Bersih (mis. kontribusi
    // BPJS TK sisi perusahaan - dibayarkan ke BPJS, bukan diterima karyawan).
    bool MasukTotal = true);

// Grup komponen per kategori (mis. "Tunjangan Tetap") + subtotalnya.
public record GajiGrupDto(
    string Kategori,
    IReadOnlyList<GajiBarisDto> Items,
    decimal Subtotal);

// Slip gaji terstruktur untuk satu pegawai pada satu periode.
// TarifBelumDiisi = true kalau seluruh nominal basis JG_PG masih 0 (tarif belum
// dikonfigurasi) -> UI menampilkan banner "nominal belum diisi".
// Final = true kalau Admin SDM sudah menandai slip periode ini SELESAI/POSTING
// (GajiSlip.Status == "Final") -> UI menampilkan "Gaji Bersih" sebagai angka final.
// Selama belum (Status "Draft", termasuk saat slip belum pernah dibuat sama sekali),
// UI HARUS menampilkan sebagai "Estimasi THP" - potongan per-karyawan (K3PG, Angsuran,
// dst - lihat admin/manual) bisa saja belum lengkap diinput.
public record GajiSlipDto(
    int Tahun,
    int Bulan,
    string NamaBulan,
    string Nama,
    string? Jabatan,
    string? Tingkatan,
    int? Band,
    int? Jg,
    int? Pg,
    IReadOnlyList<GajiGrupDto> Pendapatan,
    IReadOnlyList<GajiGrupDto> Potongan,
    decimal TotalPendapatan,
    decimal TotalPotongan,
    decimal GajiBersih,
    bool TarifBelumDiisi,
    string? Catatan,
    bool Final = false);

// ---- Konfigurasi tarif (Admin Modul SDM) ----

// Pilihan JG & PG yang tersedia untuk pengisian tarif.
public record GajiGradeOpsiDto(IReadOnlyList<int> Jg, IReadOnlyList<int> Pg);

// Satu komponen JG_PG + nominalnya pada sel (JG, PG, tahun) tertentu.
public record GajiKomponenTarifDto(
    int IdKomponen, string Kode, string Nama, string Tipe, string Kategori, decimal Nominal,
    string? GrupKode = null, string? GrupLabel = null);

// Isi satu sel matriks tarif (JG, PG, tahun) berikut daftar komponen + nominal.
public record GajiTarifSelDto(int Tahun, int Jg, int Pg, IReadOnlyList<GajiKomponenTarifDto> Items);

// Request simpan tarif satu sel.
public record TarifItem(int IdKomponen, decimal Nominal);
public record SimpanTarifRequest(int Tahun, int Jg, int Pg, IReadOnlyList<TarifItem> Items);

// ---- Pendapatan Dasar: tarif satu dimensi (Band | JG | PG) ----

// Satu nilai (mis. satu Band) + nominalnya untuk sebuah komponen.
public record TarifTunggalNilaiDto(int Nilai, string Label, decimal Nominal);

// Satu komponen "Pendapatan Dasar" + seluruh baris nilai (Band 0-6, atau JG/PG 7-21).
public record TarifTunggalKomponenDto(
    int IdKomponen, string Kode, string Nama, string Basis,
    IReadOnlyList<TarifTunggalNilaiDto> Nilai);

public record PendapatanDasarDto(int Tahun, IReadOnlyList<TarifTunggalKomponenDto> Komponen);

// Request simpan (bisa items dari beberapa komponen sekaligus, satu tombol Simpan).
public record TarifTunggalItem(int IdKomponen, int Nilai, decimal Nominal);
public record SimpanPendapatanDasarRequest(int Tahun, IReadOnlyList<TarifTunggalItem> Items);

// ---- Komponen berbasis rumus (basis 'PendapatanDasar') ----
// nominal = Persen% x MIN(total Pendapatan Dasar pegawai, Batas). Batas null = tanpa batas.
public record FormulaKomponenDto(int IdKomponen, string Kode, string Nama, decimal? Persen, decimal? Batas, string? Keterangan);
public record FormulaListDto(IReadOnlyList<FormulaKomponenDto> Komponen);

public record SimpanFormulaItem(int IdKomponen, decimal Persen, decimal? Batas);
public record SimpanFormulaRequest(IReadOnlyList<SimpanFormulaItem> Items);

// ---- Komponen basis 'Flat': satu nominal sama untuk semua karyawan ----
public record FlatKomponenDto(int IdKomponen, string Kode, string Nama, decimal Nilai, string? Keterangan);
public record FlatListDto(IReadOnlyList<FlatKomponenDto> Komponen);

public record SimpanFlatItem(int IdKomponen, decimal Nilai);
public record SimpanFlatRequest(IReadOnlyList<SimpanFlatItem> Items);

// ---- Nominal manual per karyawan per periode (basis 'Karyawan_Periode') ----
public record GajiPegawaiPickerDto(string Nik, string Nama, string? Jabatan, string? Unit);

public record GajiManualKomponenDto(
    int IdKomponen, string Kode, string Nama, string Tipe, string Kategori, decimal Nominal,
    string? GrupKode, string? GrupLabel);
// Status = "Draft" (belum diposting, tampil ke karyawan sbg "Estimasi THP") atau
// "Final" (Admin SDM sudah selesai/posting periode ini untuk pegawai ybs).
public record GajiManualDto(string Nik, string Nama, int Tahun, int Bulan, IReadOnlyList<GajiManualKomponenDto> Komponen, string Status = "Draft");

public record GajiManualItem(int IdKomponen, decimal Nominal);
public record SimpanGajiManualRequest(string Nik, int Tahun, int Bulan, IReadOnlyList<GajiManualItem> Items);

// Tandai slip gaji satu pegawai pada satu periode sbg selesai/posting (Final) atau
// dibuka kembali (Draft). Dipakai admin SDM setelah yakin seluruh potongan sudah lengkap.
public record SetStatusGajiRequest(string Nik, int Tahun, int Bulan, bool Final);

// ---- Potongan Presensi: dihitung (preview, TIDAK disimpan otomatis) dari absensi +
// surat ijin disetujui, mengacu Nota Dinas 0188/08/ND Potongan Absen 2018. Admin
// Payroll review hasil ini lalu simpan manual lewat endpoint admin/manual biasa. ----
public record PresensiKejadianDto(
    DateOnly Tanggal, string Jenis, bool AdaIjin, decimal? JamHilang, decimal PersenTp, decimal PersenTa);

public record PotonganPresensiDto(
    string Nik, string Nama, int Tahun, int Bulan,
    decimal PersenTpTotal, decimal PersenTaTotal,
    decimal NominalTp, decimal NominalTa, decimal Total,
    IReadOnlyList<PresensiKejadianDto> Kejadian, string? Peringatan);

// ---- Lembur Biasa: dihitung (preview, TIDAK disimpan otomatis) dari SPL "Biasa" yang
// sudah disetujui. Khusus Band V/VI - band lain tidak dihitung (Peringatan terisi). ----
public record LemburBiasaKejadianDto(
    DateOnly Tanggal, string TipeHari, string JamMulai, string JamSelesai,
    decimal JamI, decimal JamII, decimal JamIII, decimal JamIV,
    decimal JamDibayar, decimal Nominal, bool Terpotong45Jam);

public record LemburBiasaDto(
    string Nik, string Nama, int Tahun, int Bulan, int? Band, decimal Tarif,
    decimal TotalJamDibayar, bool Dibatasi45Jam, decimal Total,
    IReadOnlyList<LemburBiasaKejadianDto> Kejadian, string? Peringatan);

// ---- Lembur Crash Program: dihitung (preview) dari SPL "Crash Program" disetujui.
// Khusus Band I-IV. "Jam mati" - TANPA pengali tarif (beda dari Lembur Biasa), TANPA
// batas 45 jam/periode. ----
public record LemburCrashKejadianDto(DateOnly Tanggal, string JamMulai, string JamSelesai, decimal Jam, decimal Nominal);

public record LemburCrashDto(
    string Nik, string Nama, int Tahun, int Bulan, int? Band, decimal Tarif,
    decimal TotalJam, decimal Total,
    IReadOnlyList<LemburCrashKejadianDto> Kejadian, string? Peringatan);

// ---- Tarif SPPD per Band (admin) - dipakai (1) nominal komponen SPPD sendiri (tarif x
// jumlah SPPD disetujui/periode) dan (2) basis formula Uang Makan Dinas rentang 75-150km
// (20% dari tarif SPPD Band pegawai). Reuse tabel gaji.tarif_tunggal tapi TIDAK lewat
// panel generik Pendapatan Dasar/Potongan Tunggal (basis komponen SPPD = Karyawan_Periode,
// bukan Band - endpoint own supaya nilainya tetap bisa diatur per Band). ----
public record TarifSppdDto(int Tahun, IReadOnlyList<TarifTunggalNilaiDto> Nilai);
public record SimpanTarifSppdRequest(int Tahun, IReadOnlyList<TarifTunggalItem> Items);

// ---- Uang Makan Dinas (UMDL/MAKAN_DINAS): dihitung (preview) dari pengajuan UMDL yang
// sudah disetujui, formulanya berdasar rentang_km bukti dinas (dinas.bukti):
//   <75km    -> Rp40.000 flat
//   75-150km -> 20% dari tarif SPPD Band pegawai (lihat TarifSppdDto)
// (>150km tak mungkin muncul di UMDL - divalidasi UmdlController saat submit). ----
public record UmdlFormulaKejadianDto(DateOnly Tanggal, string? RentangKm, decimal Nominal, string? Peringatan);

public record UmdlFormulaDto(
    string Nik, string Nama, int Tahun, int Bulan, int? Band, decimal TarifSppdBand, decimal Total,
    IReadOnlyList<UmdlFormulaKejadianDto> Kejadian, string? Peringatan);

// ---- SPPD (TJ_SPPD): dihitung (preview) dari pengajuan SPPD yang sudah disetujui -
// nominal = tarif per Band (TarifSppdDto) x jumlah SPPD disetujui dalam periode. ----
public record SppdFormulaKejadianDto(DateOnly Tanggal, string? Tujuan, decimal Nominal);

public record SppdFormulaDto(
    string Nik, string Nama, int Tahun, int Bulan, int? Band, decimal Tarif, decimal Total,
    IReadOnlyList<SppdFormulaKejadianDto> Kejadian, string? Peringatan);

// ---- Tarif Tunjangan Luar Daerah (TJ_LUAR) per Wilayah x Band. Cakupan saat ini: 3
// wilayah (Medan/Lampung/Makassar) x Band III-VI (dikonfirmasi user; tabel generik,
// wilayah/band lain bisa ditambah admin lewat panel tanpa migrasi baru). ----
public record TarifWilayahSelDto(string Wilayah, int Band, string BandLabel, decimal Nominal);

public record TarifWilayahDto(
    int Tahun, IReadOnlyList<string> WilayahList, IReadOnlyList<int> BandList,
    IReadOnlyList<TarifWilayahSelDto> Nilai);

public record TarifWilayahItem(string Wilayah, int Band, decimal Nominal);
public record SimpanTarifWilayahRequest(int Tahun, IReadOnlyList<TarifWilayahItem> Items);

// ---- Tunjangan Luar Daerah (TJ_LUAR): dihitung (preview) dari wilayah kerja + Band
// pegawai saat ini (BUKAN dari kejadian/pengajuan spt UMDL/SPPD - tunjangan tetap
// selama pegawai bertugas di wilayah itu). ----
public record LuarDaerahFormulaDto(
    string Nik, string Nama, int Tahun, int Bulan, string? Wilayah, int? Band,
    decimal Nominal, string? Peringatan);

// ---- Tunjangan PTS (TJ_PTS): karyawan MENGGANTIKAN SEMENTARA formasi atasannya yang
// kosong (ditandai admin di Struktur Organisasi, grading.pejabat_sementara). Nominal =
// TJ_JABATAN jabatan asli + 80% x selisih TJ_JABATAN thd jabatan pengganti - HANYA
// berlaku bila jabatan pengganti persis 1 band di atas jabatan asli. ----
public record PtsFormulaDto(
    string Nik, string Nama, int Tahun, int Bulan,
    string? JabatanAsli, string? JabatanPengganti,
    decimal TjJabatanAwal, decimal TjJabatanPengganti, decimal Selisih80Persen,
    decimal Nominal, string? Peringatan);

// ---- Potongan BPJS Kesehatan (POT_BPJS_KES): base 1% dari Pendapatan Dasar (capped)
// SELALU dibebankan ke karyawan. Tambahan 1% per anggota keluarga lain yang
// diikutsertakan (karyawan MENDAFTARKAN SENDIRI, My Personal > Profil,
// gaji.tanggungan_lebih) - tanpa batas gratis. Basis = MIN(Pendapatan Dasar, batas
// yg sama dgn TJ_BPJS_KES). Total dibayar ke BPJS Kes = 5% (4% perusahaan + 1% karyawan)
// + 1%/tanggungan kalau ada. ----
public record BpjsKesPotonganDto(
    string Nik, string Nama, int Tahun, int Bulan,
    int JumlahTanggungan, decimal PersenTotal,
    decimal BasisPerhitungan, decimal Nominal, string? Peringatan);

// ---- Pendaftaran mandiri anggota keluarga lain utk BPJS Kesehatan (My Personal > Profil). ----
public record TanggunganBpjsDto(
    int? JumlahTanggungan, string? Keterangan, DateTime? DibuatPada, DateTime? DiubahPada);

public record SimpanTanggunganBpjsRequest(int JumlahTanggungan, string? Keterangan);

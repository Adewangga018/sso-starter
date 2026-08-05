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
    string? Catatan);

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
public record GajiManualDto(string Nik, string Nama, int Tahun, int Bulan, IReadOnlyList<GajiManualKomponenDto> Komponen);

public record GajiManualItem(int IdKomponen, decimal Nominal);
public record SimpanGajiManualRequest(string Nik, int Tahun, int Bulan, IReadOnlyList<GajiManualItem> Items);

// ---- Potongan Presensi: dihitung (preview, TIDAK disimpan otomatis) dari absensi +
// surat ijin disetujui, mengacu Nota Dinas 0188/08/ND Potongan Absen 2018. Admin
// Payroll review hasil ini lalu simpan manual lewat endpoint admin/manual biasa. ----
public record PresensiKejadianDto(
    DateOnly Tanggal, string Jenis, bool AdaIjin, decimal? JamHilang, decimal PersenTp, decimal PersenTa);

public record PotonganPresensiDto(
    string Nik, string Nama, int Tahun, int Bulan,
    decimal PersenTpTotal, decimal PersenTaTotal,
    decimal NominalTp, decimal NominalTa, decimal Total,
    IReadOnlyList<PresensiKejadianDto> Kejadian);

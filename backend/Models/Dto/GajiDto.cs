namespace SsoBackend.Models.Dto;

// Satu baris komponen pada slip.
public record GajiBarisDto(
    string Kode,
    string Nama,
    decimal Nominal,
    bool Opsional,
    bool KenaTerlambat,
    string Basis,
    string? Keterangan);

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
    int IdKomponen, string Kode, string Nama, string Tipe, string Kategori, decimal Nominal);

// Isi satu sel matriks tarif (JG, PG, tahun) berikut daftar komponen + nominal.
public record GajiTarifSelDto(int Tahun, int Jg, int Pg, IReadOnlyList<GajiKomponenTarifDto> Items);

// Request simpan tarif satu sel.
public record TarifItem(int IdKomponen, decimal Nominal);
public record SimpanTarifRequest(int Tahun, int Jg, int Pg, IReadOnlyList<TarifItem> Items);

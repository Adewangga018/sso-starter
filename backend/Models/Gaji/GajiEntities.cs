namespace SsoBackend.Models.Gaji;

// Master komponen gaji/potongan (schema gaji, db_mygcs). Nominal TIDAK di sini -
// untuk komponen basis JG_PG nominal diambil dari gaji.tarif; untuk
// Karyawan_Periode diinput manual di gaji.slip_detail.
public class GajiKomponen
{
    public int IdKomponen { get; set; }
    public string Kode { get; set; } = string.Empty;
    public string Nama { get; set; } = string.Empty;
    public string Tipe { get; set; } = string.Empty;      // Pendapatan | Potongan
    public string Kategori { get; set; } = string.Empty;  // Gaji Pokok / Tunjangan Tetap / ...
    public string Basis { get; set; } = string.Empty;     // JG_PG | Karyawan_Periode
    public bool Opsional { get; set; }
    public bool KenaPotonganTerlambat { get; set; }
    public int Urutan { get; set; }
    public bool Aktif { get; set; }
    public string? Keterangan { get; set; }
    // Pengelompokan tampilan (dropdown/accordion) untuk komponen yang punya sub-komponen,
    // mis. Lembur (Biasa/Crash/Pengganti) atau BPJS TK (JHT/JKK/JKM/JP). NULL = berdiri sendiri.
    public string? GrupKode { get; set; }
    public string? GrupLabel { get; set; }
    // Parameter rumus untuk basis 'PendapatanDasar': nominal = FormulaPersen% x
    // MIN(total Pendapatan Dasar, FormulaBatas). FormulaBatas NULL = tanpa batas atas.
    public decimal? FormulaPersen { get; set; }
    public decimal? FormulaBatas { get; set; }
    // Nilai untuk basis 'Flat': satu nominal yang sama untuk SEMUA karyawan (bukan
    // per Band/JG/PG, bukan per periode). NULL = belum diisi admin (nominal 0).
    public decimal? NilaiFlat { get; set; }
    // false = komponen tetap tampil di slip (informasi) tapi TIDAK menambah
    // Total Pendapatan/Potongan maupun Gaji Bersih - mis. kontribusi BPJS TK
    // sisi perusahaan (JHT/JKK/JKM/JP) yang dibayarkan langsung ke BPJS, bukan
    // diterima/dipotong dari karyawan. Default true (perilaku lama, tak berubah).
    public bool MasukTotal { get; set; } = true;
}

// Tarif komponen basis JG_PG per (JG, PG, tahun). Kosong sampai dikonfigurasi.
public class GajiTarif
{
    public int Id { get; set; }
    public int IdKomponen { get; set; }
    public byte Jg { get; set; }
    public byte Pg { get; set; }
    public short TahunBerlaku { get; set; }
    public decimal Nominal { get; set; }
}

// Tarif SATU DIMENSI (Band | JG | PG saja) per (komponen, nilai, tahun). Dipakai
// komponen "Pendapatan Dasar" (Gaji Pokok/Tunjangan Jabatan/Perumahan/Pangan/
// Angkutan) yang basis-nya bukan lagi matriks JG x PG (gaji.tarif) melainkan satu
// nilai saja - lihat GajiKomponen.Basis ('Band'|'JG'|'PG').
public class GajiTarifTunggal
{
    public int Id { get; set; }
    public int IdKomponen { get; set; }
    public short Nilai { get; set; }
    public short TahunBerlaku { get; set; }
    public decimal Nominal { get; set; }
}

// Tarif DUA DIMENSI (wilayah x Band) per (komponen, tahun). Dipakai Tunjangan Luar
// Daerah (TJ_LUAR) - beda dari GajiTarifTunggal yang cuma satu dimensi.
public class GajiTarifWilayah
{
    public int Id { get; set; }
    public int IdKomponen { get; set; }
    public string Wilayah { get; set; } = string.Empty;
    public short Band { get; set; }
    public short TahunBerlaku { get; set; }
    public decimal Nominal { get; set; }
}

// Pendaftaran mandiri karyawan (My Personal > Profil) - tanggungan BPJS Kesehatan LEBIH
// DARI 3 (di luar diri sendiri). Kalau tidak ada baris utk karyawan, potongan BPJS
// Kesehatan default 0 (ditanggung penuh s/d 3 tanggungan) - lihat GajiService.
public class GajiTanggunganLebih
{
    public long Id { get; set; }
    public string IdKaryawan { get; set; } = string.Empty;
    public int JumlahTanggungan { get; set; }
    public string? Keterangan { get; set; }
    public DateTime DibuatPada { get; set; }
    public DateTime? DiubahPada { get; set; }
}

// Periode (bulan) gaji.
public class GajiPeriode
{
    public int IdPeriode { get; set; }
    public short Tahun { get; set; }
    public byte Bulan { get; set; }
    public string Status { get; set; } = "Draft";
    public DateTime DibuatPada { get; set; }
}

// Header slip gaji per pegawai per periode (snapshot JG/PG/band/jabatan).
public class GajiSlip
{
    public long IdSlip { get; set; }
    public int IdPeriode { get; set; }
    public string IdKaryawan { get; set; } = string.Empty;
    public string Nama { get; set; } = string.Empty;
    public byte? Jg { get; set; }
    public byte? Pg { get; set; }
    public byte? IdBand { get; set; }
    public string? Tingkatan { get; set; }
    public string? Jabatan { get; set; }
    public decimal PotonganTerlambat { get; set; }
    public string Status { get; set; } = "Draft";
    public DateTime DibuatPada { get; set; }
}

// Baris nominal per komponen pada sebuah slip.
public class GajiSlipDetail
{
    public long Id { get; set; }
    public long IdSlip { get; set; }
    public int IdKomponen { get; set; }
    public decimal Nominal { get; set; }
}

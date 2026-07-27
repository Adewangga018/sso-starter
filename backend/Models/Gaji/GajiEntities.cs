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

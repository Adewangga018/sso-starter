namespace SsoBackend.Models.Cuti;

// Cuti Bersama (cuti.cuti_bersama, db_mygcs). Dikelola CRUD oleh Admin SDM.
// mengurangi_hak = true → saldo SEMUA karyawan dipotong sebanyak JumlahHari.
public class CutiBersama
{
    public long Id { get; set; }
    public DateOnly TglMulai { get; set; }
    public DateOnly TglSelesai { get; set; }
    public int JumlahHari { get; set; }             // hari kerja (Sen–Jum) dalam rentang
    public string Keterangan { get; set; } = string.Empty;
    public bool MengurangiHak { get; set; }
    public int Tahun { get; set; }                  // dari TglMulai; menentukan periode terdampak
    public string? IdPembuat { get; set; }
    public string? NamaPembuat { get; set; }
    public DateTime DibuatPada { get; set; }
    public DateTime? DiubahPada { get; set; }
}

// Cuti Nasional / hari libur (cuti.cuti_nasional). CRUD Admin SDM. TIDAK memotong hak.
public class CutiNasional
{
    public long Id { get; set; }
    public DateOnly TglMulai { get; set; }
    public DateOnly TglSelesai { get; set; }
    public int JumlahHari { get; set; }
    public string Keterangan { get; set; } = string.Empty;
    public int Tahun { get; set; }
    public string? IdPembuat { get; set; }
    public string? NamaPembuat { get; set; }
    public DateTime DibuatPada { get; set; }
    public DateTime? DiubahPada { get; set; }
}

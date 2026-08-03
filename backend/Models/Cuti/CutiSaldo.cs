namespace SsoBackend.Models.Cuti;

// Saldo cutoff cuti tahunan per karyawan (cuti.saldo, db_mygcs). Diseed dari spreadsheet
// ORGANIK (Pak A). Dikelola manual/raw SQL — EF baca/tulis via ExcludeFromMigrations.
public class CutiSaldo
{
    public int Id { get; set; }
    public string IdKaryawan { get; set; } = string.Empty;
    public string? Nama { get; set; }
    public DateOnly? Tmt { get; set; }
    public string Periode { get; set; } = "2024-2025";
    public int Akrual { get; set; }                 // basis (min(batas, sisa+hak/thn)) sebelum cuti bersama
    public int Hak { get; set; }                     // net = akrual - cuti_bersama pengurang
    public int CutiBersama { get; set; }             // total hari cuti bersama yang mengurangi hak
    public int Diambil { get; set; }
    public int Saldo { get; set; }
    public DateOnly? TglCutoff { get; set; }
    public DateTime DibuatPada { get; set; }
    public DateTime DiperbaruiPada { get; set; }
}

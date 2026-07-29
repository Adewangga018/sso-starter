namespace SsoBackend.Models.Cuti;

// Setelan global cuti (satu baris, id=1). hak_dasar (mis. 24) dikurangi cuti_bersama
// (jumlah cuti bersama 2 tahun terakhir yang diinput SDM) → hak awal tiap karyawan.
public class CutiSetelan
{
    public byte Id { get; set; }
    public int HakDasar { get; set; }
    public int CutiBersama { get; set; }
    public DateTime? DiperbaruiPada { get; set; }
    public string? DiperbaruiOleh { get; set; }
}

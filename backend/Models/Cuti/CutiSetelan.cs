namespace SsoBackend.Models.Cuti;

// Setelan global cuti (satu baris, id=1). hak_dasar (mis. 24) dikurangi cuti_bersama
// (jumlah cuti bersama 2 tahun terakhir yang diinput SDM) → hak awal tiap karyawan.
public class CutiSetelan
{
    public byte Id { get; set; }
    public int HakDasar { get; set; }
    public int CutiBersama { get; set; }
    // Nama kolom "per tahun" adalah sisa penamaan lama (skema tak diubah) - sejak
    // 2026-08-13 nilainya = hak per SIKLUS akrual 2-tahunan (di ulang tahun kerja
    // masing-masing karyawan berbasis TMT), BUKAN lagi per tahun kalender. Lihat
    // CutiService.AkrualJikaSiklusBaruAsync.
    public int HakPerTahun { get; set; } = 24;
    public int BatasAkumulasi { get; set; } = 24;   // saldo maksimum (tetap 24 - 1 siklus penuh)
    public DateTime? DiperbaruiPada { get; set; }
    public string? DiperbaruiOleh { get; set; }
}

namespace SsoBackend.Models.Cuti;

// Pengajuan cuti tahunan (cuti.pengajuan, db_mygcs). Disetujui atasan -> memotong cuti.saldo.
public class CutiPengajuan
{
    public long Id { get; set; }
    public string IdKaryawan { get; set; } = string.Empty;
    public string? Nama { get; set; }
    public string? IdAtasan { get; set; }        // NIK atasan yang berwenang menyetujui
    public DateOnly TglMulai { get; set; }
    public DateOnly TglSelesai { get; set; }
    public int JumlahHari { get; set; }
    public string? Keterangan { get; set; }
    public string Status { get; set; } = "Menunggu";   // Menunggu|Disetujui|Ditolak|Batal
    public string? Komentar { get; set; }
    public DateTime TglPengajuan { get; set; }
    public DateTime? TglKeputusan { get; set; }
}

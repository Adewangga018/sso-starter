namespace SsoBackend.Models.Coaching;

// Sesi coaching 1-on-1 (privat: id_atasan + id_bawahan).
public class CoachingSesi
{
    public long Id { get; set; }
    public string IdAtasan { get; set; } = string.Empty;
    public string? NamaAtasan { get; set; }
    public string IdBawahan { get; set; } = string.Empty;
    public string? NamaBawahan { get; set; }
    public string Topik { get; set; } = string.Empty;
    public string Status { get; set; } = "Berjalan";
    public string IdPembuat { get; set; } = string.Empty;
    public DateTime TglDibuat { get; set; }
    public DateTime? TglTerakhir { get; set; }
}

// Pesan untuk SESI (IdSesi) ATAU RUANG TIM (RuangNik). Tepat satu terisi.
public class CoachingPesan
{
    public long Id { get; set; }
    public long? IdSesi { get; set; }
    public string? RuangNik { get; set; }
    public string IdPengirim { get; set; } = string.Empty;
    public string? NamaPengirim { get; set; }
    public string Isi { get; set; } = string.Empty;
    public DateTime TglKirim { get; set; }
}

// Status "sudah dibaca" per pengguna per kanal (badge belum-dibaca).
public class CoachingBaca
{
    public string Nik { get; set; } = string.Empty;
    public string Kanal { get; set; } = string.Empty;   // "sesi:{id}" | "ruang:{nik}"
    public DateTime TglBaca { get; set; }
}

// Override "atasan efektif" Coaching SAJA (2026-08-21) - lihat catatan lengkap di
// docs/coaching-schema.sql. TIDAK mengubah grading.jabatan.id_atasan (hierarki asli).
public class CoachingAtasanOverride
{
    public int Id { get; set; }
    public int IdJabatanBawahan { get; set; }
    public int IdJabatanAtasan { get; set; }
    public string? Catatan { get; set; }
    public DateTime DibuatPada { get; set; }
}

// Action item hasil sesi coaching.
public class CoachingTindakLanjut
{
    public long Id { get; set; }
    public long IdSesi { get; set; }
    public string Isi { get; set; } = string.Empty;
    public string Status { get; set; } = "Terbuka";
    public string IdPembuat { get; set; } = string.Empty;
    public DateTime TglDibuat { get; set; }
    public DateTime? TglSelesai { get; set; }
}

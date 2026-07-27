namespace SsoBackend.Models;

// Pengaturan akses per modul MyGCS, dikelola dari Panel Admin IT > Akses Modul
// (AdminModulesController). Daftar modulnya sendiri statis di ModuleCatalog; tabel ini
// hanya menyimpan *override* per modul: aktif/tidak dan siapa yang boleh membukanya.
// Modul yang belum punya baris di sini memakai nilai bawaan katalog.
public class ModuleAccess
{
    // Kunci modul, sama persis dengan ModuleCatalog (mis. "my-office").
    public string ModuleKey { get; set; } = string.Empty;

    // false = modul tampil terkunci ("Coming Soon") dan API-nya menolak semua pengguna
    // non-Admin. Admin IT tetap bisa masuk supaya bisa menguji sebelum dibuka umum.
    public bool Enabled { get; set; } = true;

    // Lihat ModuleAccessLevels: "semua" atau "admin".
    public string Access { get; set; } = ModuleAccessLevels.Semua;

    public DateTime UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }
}

public static class ModuleAccessLevels
{
    // Semua pengguna terautentikasi boleh membuka modul.
    public const string Semua = "semua";

    // Hanya pemegang role Admin IT.
    public const string Admin = "admin";

    public static bool IsValid(string? value) => value is Semua or Admin;
}

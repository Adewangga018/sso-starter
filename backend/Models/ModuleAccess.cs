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

    // Kolom di bawah ini hanya terisi untuk modul custom (IsCustom = true), yaitu modul yang
    // dibuat Admin IT dari Panel Admin > Akses Modul, bukan salah satu dari ModuleCatalog.All.
    // Untuk modul katalog, Label/Subtitle/Icon tetap dari ModuleCatalog - baris ini cuma override.
    public bool IsCustom { get; set; }
    public string? Label { get; set; }
    public string? Subtitle { get; set; }
    public string? Icon { get; set; }

    // Path relatif file logo di bawah folder uploads/modules (mis. "a1b2c3d4.png"), dipakai
    // baik untuk modul katalog maupun modul custom. Null = belum ada logo yang diupload.
    public string? LogoPath { get; set; }

    public DateTime? CreatedAt { get; set; }
    public string? CreatedBy { get; set; }
}

public static class ModuleAccessLevels
{
    // Semua pengguna terautentikasi boleh membuka modul.
    public const string Semua = "semua";

    // Hanya pemegang role Admin IT.
    public const string Admin = "admin";

    public static bool IsValid(string? value) => value is Semua or Admin;
}

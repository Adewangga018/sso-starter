using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using SsoBackend.Data;
using SsoBackend.Models;
using SsoBackend.Models.Dto;

namespace SsoBackend.Services;

// Sumber kebenaran "modul portal mana boleh dibuka siapa" (Panel Admin IT > Akses Modul).
//
// Katalog modulnya statis (ModuleCatalog); yang tersimpan di dbo.module_access hanyalah
// override per modul (aktif + tingkat akses). Dibaca pada SETIAP request modul lewat
// ModuleGateAttribute, jadi hasilnya di-cache di memori dan hanya dibuang saat Admin IT
// menyimpan perubahan. Aman karena backend berjalan sebagai satu instance IIS; TTL 5 menit
// dipasang sebagai jaring pengaman kalau baris tabelnya pernah diubah langsung dari SQL.
//
// Beda dengan ModuleAccessService, yang menentukan siapa "Admin Modul SDM" dari grading.
public class ModuleSettingsService
{
    private const string CacheKey = "modules:overrides";
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);

    private readonly ApplicationDbContext _db;
    private readonly IMemoryCache _cache;

    public ModuleSettingsService(ApplicationDbContext db, IMemoryCache cache)
    {
        _db = db;
        _cache = cache;
    }

    // State efektif satu modul. Found = false kalau kuncinya tidak ada di katalog.
    public record ModuleState(bool Found, bool Enabled, string Access, string Label);

    private async Task<IReadOnlyDictionary<string, ModuleAccess>> OverridesAsync()
    {
        if (_cache.TryGetValue(CacheKey, out IReadOnlyDictionary<string, ModuleAccess>? cached) && cached is not null)
        {
            return cached;
        }

        var rows = await _db.ModuleAccess.AsNoTracking().ToListAsync();
        var map = rows.ToDictionary(r => r.ModuleKey, StringComparer.OrdinalIgnoreCase);
        _cache.Set(CacheKey, (IReadOnlyDictionary<string, ModuleAccess>)map, CacheTtl);
        return map;
    }

    private void Invalidate() => _cache.Remove(CacheKey);

    public async Task<ModuleState> GetStateAsync(string moduleKey)
    {
        var def = ModuleCatalog.Find(moduleKey);
        if (def is null)
        {
            return new ModuleState(false, false, ModuleAccessLevels.Semua, moduleKey);
        }

        var overrides = await OverridesAsync();
        if (overrides.TryGetValue(def.Key, out var row))
        {
            return new ModuleState(true, row.Enabled, row.Access, def.Label);
        }

        return new ModuleState(true, def.DefaultEnabled, ModuleAccessLevels.Semua, def.Label);
    }

    // Boleh dibuka? Admin IT selalu boleh - termasuk saat modulnya dimatikan, supaya bisa
    // menguji dulu sebelum dibuka untuk semua orang.
    public async Task<bool> IsAllowedAsync(string moduleKey, bool isAdmin)
    {
        if (isAdmin)
        {
            return true;
        }

        var state = await GetStateAsync(moduleKey);
        return state.Found && state.Enabled && state.Access == ModuleAccessLevels.Semua;
    }

    // Daftar lengkap untuk halaman Akses Modul (Admin IT).
    public async Task<IReadOnlyList<ModuleSettingDto>> GetSettingsAsync()
    {
        var overrides = await OverridesAsync();
        return ModuleCatalog.All.Select(def =>
        {
            overrides.TryGetValue(def.Key, out var row);
            return new ModuleSettingDto(
                def.Key,
                def.Label,
                def.Subtitle,
                def.Icon,
                row?.Enabled ?? def.DefaultEnabled,
                row?.Access ?? ModuleAccessLevels.Semua,
                row?.UpdatedAt,
                row?.UpdatedBy);
        }).ToList();
    }

    // Kartu modul untuk dashboard. Grid modul harus selalu utuh: modul yang dikunci ke
    // Admin IT TIDAK dihilangkan dari daftar, melainkan dikirim sebagai kartu terkunci
    // (Enabled = false) supaya tampil "Coming Soon" seperti modul yang memang belum jadi.
    // Menghilangkannya membuat dashboard karyawan bolong-bolong tanpa penjelasan.
    // isModuleAdmin: callback opsional yang menjawab apakah pengguna saat ini adalah Admin
    // Modul untuk kunci modul tertentu (dipakai untuk tingkat akses "admin_modul"). Bila
    // null, tingkat "admin_modul" diperlakukan seperti "admin" (terkunci untuk non-Admin IT).
    public async Task<IReadOnlyList<ModuleTileDto>> GetTilesForAsync(bool isAdmin, Func<string, Task<bool>>? isModuleAdmin = null)
    {
        var settings = await GetSettingsAsync();
        var tiles = new List<ModuleTileDto>(settings.Count);
        foreach (var s in settings)
        {
            bool terkunci;
            if (isAdmin || s.Access == ModuleAccessLevels.Semua)
            {
                terkunci = false;
            }
            else if (s.Access == ModuleAccessLevels.AdminModul)
            {
                terkunci = isModuleAdmin is null || !await isModuleAdmin(s.Key);
            }
            else // "admin" (Admin IT saja)
            {
                terkunci = true;
            }
            tiles.Add(new ModuleTileDto(s.Key, s.Label, s.Subtitle, s.Icon, s.Enabled && !terkunci, s.Access));
        }
        return tiles;
    }

    public async Task<ModuleSettingDto?> SetAsync(string moduleKey, bool enabled, string access, string? by)
    {
        var def = ModuleCatalog.Find(moduleKey);
        if (def is null)
        {
            return null;
        }

        var row = await _db.ModuleAccess.FirstOrDefaultAsync(m => m.ModuleKey == def.Key);
        if (row is null)
        {
            row = new ModuleAccess { ModuleKey = def.Key };
            _db.ModuleAccess.Add(row);
        }

        row.Enabled = enabled;
        row.Access = access;
        row.UpdatedAt = DateTime.UtcNow;
        row.UpdatedBy = by;

        await _db.SaveChangesAsync();
        Invalidate();

        return new ModuleSettingDto(def.Key, def.Label, def.Subtitle, def.Icon, row.Enabled, row.Access, row.UpdatedAt, row.UpdatedBy);
    }
}

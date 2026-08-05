using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using SsoBackend.Data;
using SsoBackend.Models;
using SsoBackend.Models.Dto;

namespace SsoBackend.Services;

// Sumber kebenaran lock/unlock per FITUR (item menu sidebar). Katalog statis di
// FeatureCatalog; dbo.feature_access hanya menyimpan override enabled per fitur.
// Dibaca pada setiap request (gate + summary), jadi di-cache di memori (TTL 5 menit),
// dibuang saat Admin IT menyimpan. Pola sama dengan ModuleSettingsService.
public class FeatureSettingsService
{
    private const string CacheKey = "features:overrides";
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);

    private readonly ApplicationDbContext _db;
    private readonly IMemoryCache _cache;

    public FeatureSettingsService(ApplicationDbContext db, IMemoryCache cache)
    {
        _db = db;
        _cache = cache;
    }

    private async Task<IReadOnlyDictionary<string, FeatureAccess>> OverridesAsync()
    {
        if (_cache.TryGetValue(CacheKey, out IReadOnlyDictionary<string, FeatureAccess>? cached) && cached is not null)
            return cached;
        var rows = await _db.FeatureAccess.AsNoTracking().ToListAsync();
        var map = rows.ToDictionary(r => r.FeatureKey, StringComparer.OrdinalIgnoreCase);
        _cache.Set(CacheKey, (IReadOnlyDictionary<string, FeatureAccess>)map, CacheTtl);
        return map;
    }

    private void Invalidate() => _cache.Remove(CacheKey);

    // Fitur aktif? Key tak dikenal dianggap aktif (tidak diblok). Override menang atas bawaan.
    public async Task<bool> IsEnabledAsync(string featureKey)
    {
        var def = FeatureCatalog.Find(featureKey);
        if (def is null) return true;
        var overrides = await OverridesAsync();
        return overrides.TryGetValue(def.Key, out var row) ? row.Enabled : def.DefaultEnabled;
    }

    // Kunci fitur yang TERKUNCI (disembunyikan bagi non-Admin IT). Dipakai summary dashboard.
    public async Task<IReadOnlyList<string>> GetLockedKeysAsync()
    {
        var overrides = await OverridesAsync();
        var locked = new List<string>();
        foreach (var def in FeatureCatalog.All)
        {
            var enabled = overrides.TryGetValue(def.Key, out var row) ? row.Enabled : def.DefaultEnabled;
            if (!enabled) locked.Add(def.Key);
        }
        return locked;
    }

    // Daftar lengkap untuk halaman Akses Modul (bagian fitur tiap modul).
    public async Task<IReadOnlyList<FeatureSettingDto>> GetSettingsAsync()
    {
        var overrides = await OverridesAsync();
        return FeatureCatalog.All.Select(def =>
        {
            overrides.TryGetValue(def.Key, out var row);
            return new FeatureSettingDto(def.Key, def.ModuleKey, def.Label,
                row?.Enabled ?? def.DefaultEnabled, row?.UpdatedAt, row?.UpdatedBy);
        }).ToList();
    }

    public async Task<FeatureSettingDto?> SetAsync(string featureKey, bool enabled, string? by)
    {
        var def = FeatureCatalog.Find(featureKey);
        if (def is null) return null;

        var row = await _db.FeatureAccess.FirstOrDefaultAsync(f => f.FeatureKey == def.Key);
        if (row is null)
        {
            row = new FeatureAccess { FeatureKey = def.Key };
            _db.FeatureAccess.Add(row);
        }
        row.Enabled = enabled;
        row.UpdatedAt = DateTime.UtcNow;
        row.UpdatedBy = by;
        await _db.SaveChangesAsync();
        Invalidate();
        return new FeatureSettingDto(def.Key, def.ModuleKey, def.Label, row.Enabled, row.UpdatedAt, row.UpdatedBy);
    }
}

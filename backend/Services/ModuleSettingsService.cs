using System.Text.RegularExpressions;
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

    // State efektif satu modul. Found = false kalau kuncinya tidak ada di katalog maupun
    // sebagai modul custom yang pernah dibuat lewat CreateModuleAsync.
    public record ModuleState(bool Found, bool Enabled, string Access, string Label);

    public enum CreateModuleError { None, InvalidKey, DuplicateKey }

    public record CreateModuleResult(CreateModuleError Error, ModuleSettingDto? Module);

    // Format key modul custom: slug huruf kecil/angka dipisah tanda hubung, mis. "my-library".
    private static readonly Regex KeyFormat = new(@"^[a-z0-9]+(-[a-z0-9]+)*$", RegexOptions.Compiled);

    private static string? LogoUrlFor(string key, ModuleAccess? row) =>
        row?.LogoPath is null ? null : $"/admin/modules/{key}/logo";

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
        var overrides = await OverridesAsync();

        if (def is null)
        {
            var lookupKey = moduleKey.Trim().ToLowerInvariant();
            if (overrides.TryGetValue(lookupKey, out var customRow) && customRow.IsCustom)
            {
                return new ModuleState(true, customRow.Enabled, customRow.Access, customRow.Label ?? customRow.ModuleKey);
            }
            return new ModuleState(false, false, ModuleAccessLevels.Semua, moduleKey);
        }

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

    // Daftar lengkap untuk halaman Akses Modul (Admin IT): modul katalog (statis) digabung
    // dengan modul custom yang dibuat Admin IT (baris dbo.module_access dengan IsCustom=true
    // yang key-nya tidak ada di ModuleCatalog sama sekali).
    public async Task<IReadOnlyList<ModuleSettingDto>> GetSettingsAsync()
    {
        var overrides = await OverridesAsync();

        var katalog = ModuleCatalog.All.Select(def =>
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
                row?.UpdatedBy,
                LogoUrlFor(def.Key, row));
        });

        var custom = overrides.Values
            .Where(row => row.IsCustom && ModuleCatalog.Find(row.ModuleKey) is null)
            .Select(row => new ModuleSettingDto(
                row.ModuleKey,
                row.Label ?? row.ModuleKey,
                row.Subtitle ?? string.Empty,
                row.Icon ?? string.Empty,
                row.Enabled,
                row.Access,
                row.UpdatedAt,
                row.UpdatedBy,
                LogoUrlFor(row.ModuleKey, row)));

        return katalog.Concat(custom).ToList();
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
            tiles.Add(new ModuleTileDto(s.Key, s.Label, s.Subtitle, s.Icon, s.Enabled && !terkunci, s.Access, s.LogoUrl));
        }
        return tiles;
    }

    // Berlaku untuk modul katalog maupun modul custom (key harus sudah terdaftar salah satu
    // caranya - dipakai lewat CreateModuleAsync untuk modul custom).
    public async Task<ModuleSettingDto?> SetAsync(string moduleKey, bool enabled, string access, string? by)
    {
        var def = ModuleCatalog.Find(moduleKey);
        var lookupKey = def?.Key ?? moduleKey.Trim().ToLowerInvariant();
        var row = await _db.ModuleAccess.FirstOrDefaultAsync(m => m.ModuleKey == lookupKey);

        if (def is null && (row is null || !row.IsCustom))
        {
            return null;
        }

        if (row is null)
        {
            row = new ModuleAccess { ModuleKey = lookupKey };
            _db.ModuleAccess.Add(row);
        }

        row.Enabled = enabled;
        row.Access = access;
        row.UpdatedAt = DateTime.UtcNow;
        row.UpdatedBy = by;

        await _db.SaveChangesAsync();
        Invalidate();

        return new ModuleSettingDto(
            row.ModuleKey,
            def?.Label ?? row.Label ?? row.ModuleKey,
            def?.Subtitle ?? row.Subtitle ?? string.Empty,
            def?.Icon ?? row.Icon ?? string.Empty,
            row.Enabled,
            row.Access,
            row.UpdatedAt,
            row.UpdatedBy,
            LogoUrlFor(row.ModuleKey, row));
    }

    // Mendaftarkan modul baru (mis. "My Library") yang belum ada di ModuleCatalog. Ditolak
    // kalau key sudah dipakai modul katalog maupun modul custom lain.
    public async Task<CreateModuleResult> CreateModuleAsync(string key, string label, string subtitle, string icon, bool enabled, string access, string? by)
    {
        var normalizedKey = (key ?? string.Empty).Trim().ToLowerInvariant();
        if (normalizedKey.Length is < 3 or > 50 || !KeyFormat.IsMatch(normalizedKey))
        {
            return new CreateModuleResult(CreateModuleError.InvalidKey, null);
        }

        if (ModuleCatalog.Find(normalizedKey) is not null)
        {
            return new CreateModuleResult(CreateModuleError.DuplicateKey, null);
        }

        var overrides = await OverridesAsync();
        if (overrides.ContainsKey(normalizedKey))
        {
            return new CreateModuleResult(CreateModuleError.DuplicateKey, null);
        }

        var now = DateTime.UtcNow;
        var row = new ModuleAccess
        {
            ModuleKey = normalizedKey,
            Enabled = enabled,
            Access = access,
            IsCustom = true,
            Label = label.Trim(),
            Subtitle = (subtitle ?? string.Empty).Trim(),
            Icon = (icon ?? string.Empty).Trim(),
            CreatedAt = now,
            CreatedBy = by,
            UpdatedAt = now,
            UpdatedBy = by,
        };
        _db.ModuleAccess.Add(row);

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return new CreateModuleResult(CreateModuleError.DuplicateKey, null);
        }

        Invalidate();

        var dto = new ModuleSettingDto(
            row.ModuleKey, row.Label!, row.Subtitle!, row.Icon!, row.Enabled, row.Access, row.UpdatedAt, row.UpdatedBy, LogoUrlFor(row.ModuleKey, row));
        return new CreateModuleResult(CreateModuleError.None, dto);
    }

    // Menyimpan path logo (relatif terhadap folder uploads/modules) untuk modul katalog
    // maupun custom. Mengembalikan LogoPath lama supaya controller bisa hapus file lama
    // SETELAH commit DB berhasil - menghindari file yatim kalau SaveChangesAsync gagal.
    public async Task<(ModuleSettingDto? Module, string? OldLogoPath)> SetLogoAsync(string moduleKey, string logoPath, string? by)
    {
        var def = ModuleCatalog.Find(moduleKey);
        var lookupKey = def?.Key ?? moduleKey.Trim().ToLowerInvariant();
        var row = await _db.ModuleAccess.FirstOrDefaultAsync(m => m.ModuleKey == lookupKey);

        if (def is null && (row is null || !row.IsCustom))
        {
            return (null, null);
        }

        var oldLogoPath = row?.LogoPath;
        if (row is null)
        {
            row = new ModuleAccess { ModuleKey = lookupKey, Enabled = def!.DefaultEnabled, Access = ModuleAccessLevels.Semua };
            _db.ModuleAccess.Add(row);
        }

        row.LogoPath = logoPath;
        row.UpdatedAt = DateTime.UtcNow;
        row.UpdatedBy = by;

        await _db.SaveChangesAsync();
        Invalidate();

        var dto = new ModuleSettingDto(
            row.ModuleKey,
            def?.Label ?? row.Label ?? row.ModuleKey,
            def?.Subtitle ?? row.Subtitle ?? string.Empty,
            def?.Icon ?? row.Icon ?? string.Empty,
            row.Enabled,
            row.Access,
            row.UpdatedAt,
            row.UpdatedBy,
            LogoUrlFor(row.ModuleKey, row));

        return (dto, oldLogoPath);
    }

    // Path fisik file logo modul saat ini (relatif ke folder uploads/modules), dipakai aksi
    // GET publik yang menyajikan gambarnya. Null = modul belum punya logo ter-upload.
    public async Task<string?> GetLogoPathAsync(string moduleKey)
    {
        var def = ModuleCatalog.Find(moduleKey);
        var lookupKey = def?.Key ?? moduleKey.Trim().ToLowerInvariant();
        var overrides = await OverridesAsync();
        return overrides.TryGetValue(lookupKey, out var row) ? row.LogoPath : null;
    }
}

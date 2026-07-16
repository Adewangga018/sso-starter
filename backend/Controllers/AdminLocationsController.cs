using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Data;
using SsoBackend.Models;
using SsoBackend.Models.Dto;

namespace SsoBackend.Controllers;

// Panel Admin IT: CRUD titik geofence (kantor pusat, region, gudang) yang dipakai absensi
// kamera (PersonalController). Gated ke role Admin, sama seperti AdminController.
[ApiController]
[Route("admin/locations")]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
public class AdminLocationsController : ControllerBase
{
    private const string AdminRole = "Admin";
    private const double MaxRadiusMeters = 5000.0;

    private readonly ApplicationDbContext _db;

    public AdminLocationsController(ApplicationDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AdminLocationDto>>> GetAll()
    {
        if (!IsAdmin())
        {
            return Forbid();
        }

        var items = await _db.Locations
            .OrderBy(l => l.Nama)
            .Select(l => new AdminLocationDto(l.Id, l.Nama, l.Lat, l.Lng, l.RadiusMeters, l.Aktif))
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost]
    public async Task<ActionResult<AdminLocationDto>> Create(LocationRequest request)
    {
        if (!IsAdmin())
        {
            return Forbid();
        }

        if (Validate(request) is { } error)
        {
            return BadRequest(new { message = error });
        }

        var now = DateTime.UtcNow;
        var loc = new Location
        {
            Nama = request.Nama.Trim(),
            Lat = request.Lat,
            Lng = request.Lng,
            RadiusMeters = request.RadiusMeters,
            Aktif = request.Aktif,
            CreatedAt = now,
            UpdatedAt = now,
        };

        _db.Locations.Add(loc);
        await _db.SaveChangesAsync();

        return Ok(new AdminLocationDto(loc.Id, loc.Nama, loc.Lat, loc.Lng, loc.RadiusMeters, loc.Aktif));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, LocationRequest request)
    {
        if (!IsAdmin())
        {
            return Forbid();
        }

        if (Validate(request) is { } error)
        {
            return BadRequest(new { message = error });
        }

        var loc = await _db.Locations.FirstOrDefaultAsync(l => l.Id == id);
        if (loc is null)
        {
            return NotFound(new { message = "Lokasi tidak ditemukan." });
        }

        loc.Nama = request.Nama.Trim();
        loc.Lat = request.Lat;
        loc.Lng = request.Lng;
        loc.RadiusMeters = request.RadiusMeters;
        loc.Aktif = request.Aktif;
        loc.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (!IsAdmin())
        {
            return Forbid();
        }

        var loc = await _db.Locations.FirstOrDefaultAsync(l => l.Id == id);
        if (loc is null)
        {
            return NotFound(new { message = "Lokasi tidak ditemukan." });
        }

        _db.Locations.Remove(loc);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static string? Validate(LocationRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Nama))
        {
            return "Nama lokasi wajib diisi.";
        }

        if (request.Lat < -90 || request.Lat > 90 || request.Lng < -180 || request.Lng > 180)
        {
            return "Koordinat tidak valid.";
        }

        if (request.RadiusMeters <= 0 || request.RadiusMeters > MaxRadiusMeters)
        {
            return $"Radius harus antara 1 dan {MaxRadiusMeters:0} meter.";
        }

        return null;
    }

    private bool IsAdmin() =>
        User.HasClaim(c => (c.Type == "role" || c.Type == ClaimTypes.Role) && c.Value == AdminRole);
}

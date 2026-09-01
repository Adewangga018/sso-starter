using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Data;
using SsoBackend.Models.Absensi;
using SsoBackend.Models.Dto;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

// "Kelola Lokasi Absensi" - Admin SDM (BUKAN Admin IT/AdminLocationsController, sengaja
// dipisah - diminta user 2026-08-27) menyetujui/menolak titik absen pribadi yang diajukan
// karyawan (bengkel/gudang/sopir/dll yg tidak beraktivitas di kantor), atau menetapkan
// langsung tanpa pengajuan (auto-approved) utk provisioning massal. Gate per-aksi
// IsSdmAdminAsync, sama pola dgn OrgStrukturController - "org" tidak terdaftar di
// ModuleCatalog umum jadi tidak pakai [ModuleGate].
[ApiController]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
[Route("org/absensi-lokasi")]
public class AbsensiLokasiAdminController : ControllerBase
{
    private readonly CurrentUserContext _currentUser;
    private readonly ModuleAccessService _access;
    private readonly ApplicationDbContext _appDb;
    private readonly GcsDbContext _db;
    private readonly ReverseGeocodingService _geocoding;
    private readonly IConfiguration _config;

    public AbsensiLokasiAdminController(
        CurrentUserContext currentUser, ModuleAccessService access, ApplicationDbContext appDb,
        GcsDbContext db, ReverseGeocodingService geocoding, IConfiguration config)
    {
        _currentUser = currentUser;
        _access = access;
        _appDb = appDb;
        _db = db;
        _geocoding = geocoding;
        _config = config;
    }

    // Picker karyawan utk "Tetapkan Langsung" - seluruh perusahaan (Admin SDM, bukan
    // dibatasi departemen sendiri spt picker SPPD), tenaga kerja organik saja (Tetap) -
    // konsisten dgn picker lain (lihat SppdController.CariPegawai).
    [HttpGet("cari-pegawai")]
    public async Task<ActionResult<IReadOnlyList<PegawaiPickerDto>>> CariPegawai([FromQuery] string? q)
    {
        if (!await IsSdmAdminAsync()) return Forbid();

        var query = _db.PegawaiSdm.Where(p => p.data_aktif == "Aktif" && p.jenis_pegawai == "Tetap");
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            query = query.Where(p => p.Nik.Contains(term) || (p.nama != null && p.nama.Contains(term)));
        }

        var hasil = await query
            .OrderBy(p => p.nama)
            .Take(100)
            .Select(p => new PegawaiPickerDto(p.Nik, p.nama, p.WILAYAH, p.UNIT_KERJA))
            .ToListAsync();

        return Ok(hasil);
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<LokasiKaryawanAdminDto>>> List()
    {
        if (!await IsSdmAdminAsync()) return Forbid();

        var rows = await _appDb.LokasiKaryawan
            .OrderByDescending(l => l.TglDiajukan)
            .Select(l => new LokasiKaryawanAdminDto(
                l.Id, l.IdKaryawan, l.NamaKaryawan, l.Lat, l.Lng, AbsensiRadius.StandarMeter,
                l.Keterangan, l.Alamat, l.Status, l.Sumber, l.DiajukanOleh, l.TglDiajukan,
                l.DiputuskanOleh, l.TglDiputuskan, l.CatatanAdmin))
            .ToListAsync();

        return Ok(rows);
    }

    // Setuju/tolak pengajuan karyawan.
    [HttpPost("{id:long}/putusan")]
    public async Task<IActionResult> Putusan(long id, [FromBody] PutusanLokasiRequest req)
    {
        var nik = await CurrentNikAsync();
        if (!await _access.IsSdmAdminAsync(nik)) return Forbid();

        var lok = await _appDb.LokasiKaryawan.FirstOrDefaultAsync(l => l.Id == id);
        if (lok is null) return NotFound(new { message = "Pengajuan tidak ditemukan." });
        if (lok.Status != "Menunggu") return BadRequest(new { message = "Pengajuan ini sudah diputuskan sebelumnya." });

        lok.Status = req.Setuju ? "Disetujui" : "Ditolak";
        lok.DiputuskanOleh = nik;
        lok.TglDiputuskan = DateTime.UtcNow;
        lok.CatatanAdmin = req.Catatan;
        await _appDb.SaveChangesAsync();
        return NoContent();
    }

    // Admin SDM menetapkan langsung tanpa pengajuan - langsung Disetujui (utk provisioning
    // massal, mis. banyak sopir/gudang sekaligus). Menimpa baris lama karyawan itu bila ada.
    [HttpPost]
    public async Task<IActionResult> Tetapkan([FromBody] TetapkanLokasiRequest req)
    {
        var nik = await CurrentNikAsync();
        if (!await _access.IsSdmAdminAsync(nik)) return Forbid();
        if (string.IsNullOrWhiteSpace(req.IdKaryawan)) return BadRequest(new { message = "Karyawan wajib dipilih." });

        var lok = await _appDb.LokasiKaryawan.FirstOrDefaultAsync(l => l.IdKaryawan == req.IdKaryawan);
        var now = DateTime.UtcNow;
        if (lok is null)
        {
            lok = new LokasiKaryawan { IdKaryawan = req.IdKaryawan };
            _appDb.LokasiKaryawan.Add(lok);
        }
        lok.Lat = req.Lat;
        lok.Lng = req.Lng;
        lok.Keterangan = req.Keterangan;
        lok.Alamat = await _geocoding.ResolveAsync(req.Lat, req.Lng);
        lok.Status = "Disetujui";
        lok.Sumber = "AdminSdm";
        lok.DiajukanOleh = nik ?? string.Empty;
        lok.TglDiajukan = now;
        lok.DiputuskanOleh = nik;
        lok.TglDiputuskan = now;
        lok.CatatanAdmin = null;

        await _appDb.SaveChangesAsync();
        return NoContent();
    }

    // Mencabut titik pribadi karyawan - kembali ke default Kantor Pusat.
    [HttpDelete("{id:long}")]
    public async Task<IActionResult> Hapus(long id)
    {
        if (!await IsSdmAdminAsync()) return Forbid();

        var lok = await _appDb.LokasiKaryawan.FirstOrDefaultAsync(l => l.Id == id);
        if (lok is null) return NotFound(new { message = "Data tidak ditemukan." });
        _appDb.LokasiKaryawan.Remove(lok);
        await _appDb.SaveChangesAsync();
        return NoContent();
    }

    // Audit Log Absensi Mobile - daftar catatan absen app mobile (absensi.log), dengan
    // filter "hanya yang ada peringatan" utk fokus ke kandidat fake-GPS (lihat
    // PersonalController.PostAbsensi, deteksi "impossible travel" & "koordinat identik
    // persis" 2026-08-28). Read-only - tidak ada aksi setuju/tolak di sini, murni audit
    // manual.
    [HttpGet("/org/absensi-log")]
    public async Task<ActionResult<IReadOnlyList<AbsensiLogAdminDto>>> ListLog(
        [FromQuery] string? nik, [FromQuery] bool hanyaPeringatan = false, [FromQuery] int take = 200)
    {
        if (!await IsSdmAdminAsync()) return Forbid();

        var q = _appDb.AbsensiMobileLog.AsQueryable();
        if (!string.IsNullOrWhiteSpace(nik)) q = q.Where(a => a.IdKaryawan == nik.Trim());
        if (hanyaPeringatan) q = q.Where(a => a.PeringatanAnomali != null);

        var rows = await q
            .OrderByDescending(a => a.DibuatPada)
            .Take(Math.Clamp(take, 1, 1000))
            .Select(a => new AbsensiLogAdminDto(
                a.Id, a.IdKaryawan, a.NamaKaryawan, a.Tanggal, a.CheckIn, a.CheckOut,
                a.Tempat, a.Accuracy, a.PeringatanAnomali, a.DibuatPada))
            .ToListAsync();

        return Ok(rows);
    }

    // Foto bukti absen (dgn watermark tanggal/jam server - lihat WatermarkService &
    // PersonalController.PostAbsensi) - dilayani sbg stream file, bukan dicatat di database
    // (path fisik langsung dari kolom Foto). Admin SDM saja.
    [HttpGet("/org/absensi-log/{id:long}/foto")]
    public async Task<IActionResult> GetFoto(long id)
    {
        if (!await IsSdmAdminAsync()) return Forbid();

        var relPath = await _appDb.AbsensiMobileLog
            .Where(a => a.Id == id)
            .Select(a => a.Foto)
            .FirstOrDefaultAsync();
        if (string.IsNullOrWhiteSpace(relPath)) return NotFound(new { message = "Foto tidak ditemukan." });

        var basePath = _config["Attendance:PhotoPath"];
        if (string.IsNullOrWhiteSpace(basePath)) return NotFound(new { message = "Penyimpanan foto belum dikonfigurasi." });

        // relPath tersimpan sbg "attendances/<file>.jpg" - foto ada langsung di basePath
        // (basePath itu sendiri sudah folder "attendances", lihat PersonalController.PostAbsensi).
        var fileName = Path.GetFileName(relPath);
        var fullPath = Path.Combine(basePath, fileName);
        if (!System.IO.File.Exists(fullPath)) return NotFound(new { message = "Berkas foto tidak ditemukan di penyimpanan." });

        return PhysicalFile(fullPath, "image/jpeg");
    }

    private async Task<string?> CurrentNikAsync()
    {
        var (user, pegawai) = await _currentUser.ResolveAsync(User);
        return pegawai?.ID_KARYAWAN ?? user?.Nik;
    }

    private async Task<bool> IsSdmAdminAsync() => await _access.IsSdmAdminAsync(await CurrentNikAsync());
}

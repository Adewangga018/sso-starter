using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Data;
using SsoBackend.Models;
using SsoBackend.Models.Dto;
using SsoBackend.Models.Gcs;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

[ApiController]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
[Route("personal")]
public class PersonalController : ControllerBase
{
    private static readonly string[] AllowedDocExt = [".pdf", ".png", ".jpg", ".jpeg"];
    private const long MaxDocBytes = 10 * 1024 * 1024;

    private static readonly HashSet<string> AllowedStatusKaryawan =
        new(["BP", "IK", "Layanan Jasa", "PKWT", "Tetap"], StringComparer.OrdinalIgnoreCase);

    private readonly GcsDbContext _db;
    private readonly ApplicationDbContext _appDb;
    private readonly DocumentResolver _documentResolver;
    private readonly CurrentUserContext _currentUser;
    private readonly IConfiguration _config;
    private readonly ILogger<PersonalController> _logger;
    private readonly IAuditLogger _audit;

    public PersonalController(
        GcsDbContext db,
        ApplicationDbContext appDb,
        DocumentResolver documentResolver,
        CurrentUserContext currentUser,
        IConfiguration config,
        ILogger<PersonalController> logger,
        IAuditLogger audit)
    {
        _db = db;
        _appDb = appDb;
        _documentResolver = documentResolver;
        _currentUser = currentUser;
        _config = config;
        _logger = logger;
        _audit = audit;
    }

    private static string HariIndonesia(DayOfWeek d) => d switch
    {
        DayOfWeek.Sunday => "Minggu",
        DayOfWeek.Monday => "Senin",
        DayOfWeek.Tuesday => "Selasa",
        DayOfWeek.Wednesday => "Rabu",
        DayOfWeek.Thursday => "Kamis",
        DayOfWeek.Friday => "Jumat",
        DayOfWeek.Saturday => "Sabtu",
        _ => string.Empty,
    };

    // Jarak Haversine dalam meter.
    private static double DistanceMeters(double lat1, double lng1, double lat2, double lng2)
    {
        const double R = 6371000.0;
        static double ToRad(double d) => d * Math.PI / 180.0;
        var dLat = ToRad(lat2 - lat1);
        var dLng = ToRad(lng2 - lng1);
        var a = Math.Pow(Math.Sin(dLat / 2), 2)
            + Math.Cos(ToRad(lat1)) * Math.Cos(ToRad(lat2)) * Math.Pow(Math.Sin(dLng / 2), 2);
        return 2 * R * Math.Asin(Math.Sqrt(a));
    }

    // "data:image/jpeg;base64,...." -> byte[].
    private static byte[] DecodeDataUrl(string dataUrl)
    {
        var idx = dataUrl.IndexOf("base64,", StringComparison.Ordinal);
        var b64 = idx >= 0 ? dataUrl[(idx + 7)..] : dataUrl;
        return Convert.FromBase64String(b64);
    }

    [HttpGet("profile")]
    public async Task<ActionResult<PersonalProfileDto>> GetProfile()
    {
        var (user, pegawai) = await _currentUser.ResolveAsync(User);
        if (user is null)
        {
            return Unauthorized();
        }

        if (pegawai is null)
        {
            if (string.IsNullOrWhiteSpace(user.Nik))
            {
                return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
            }

            // The account is tied to a badge number (from the login token) but HR hasn't
            // created the MST_PEGAWAI master row for it yet. Hand back an empty shell -
            // isProfileEmpty() on the frontend opens edit mode automatically, so the page
            // renders as an input form. Saving it (PUT /personal/profile) creates the row.
            return Ok(new PersonalProfileDto(
                0,
                user.Name,
                user.Nik,
                string.Empty,
                null, null, null, null,
                user.IsActive,
                null, null, null, user.Email,
                new AlamatDto(null, null, null, null, null, null, null, null),
                null, null, false, null, null, null, null,
                null,
                [],
                [],
                Registered: false,
                ProfileComplete: false));
        }

        var anak = await _db.MstAnakPegawai
            .Where(a => a.ID_PEGAWAI == pegawai.ID_PEGAWAI)
            .OrderBy(a => a.URUTAN_ANAK)
            .Select(a => new AnakDto(
                a.ID_ANAK,
                a.URUTAN_ANAK,
                a.NAMA_ANAK,
                a.TEMPAT_LAHIR_ANAK,
                a.TGL_LAHIR_ANAK.HasValue ? DateOnly.FromDateTime(a.TGL_LAHIR_ANAK.Value) : null,
                !string.IsNullOrWhiteSpace(a.FILE_AKTA)))
            .ToListAsync();

        var isMarried = string.Equals(pegawai.STATUS_NIKAH, "Kawin", StringComparison.OrdinalIgnoreCase);

        var pasangan = isMarried
            ? new PasanganDto(
                pegawai.NAMA_PASANGAN,
                pegawai.TEMPAT_LAHIR_PASANGAN,
                pegawai.TGL_LAHIR_PASANGAN.HasValue ? DateOnly.FromDateTime(pegawai.TGL_LAHIR_PASANGAN.Value) : null)
            : null;

        var berkas = EmployeeDocuments.Fields
            .Select(f => new BerkasDto(f.Key, f.Label, !string.IsNullOrWhiteSpace(f.Selector(pegawai))))
            .ToList();

        var dto = new PersonalProfileDto(
            pegawai.ID_PEGAWAI,
            pegawai.NAMA_LENGKAP,
            pegawai.ID_KARYAWAN,
            pegawai.NIK,
            pegawai.TEMPAT_LAHIR,
            pegawai.TGL_LAHIR.HasValue ? DateOnly.FromDateTime(pegawai.TGL_LAHIR.Value) : null,
            pegawai.JENIS_KELAMIN,
            pegawai.STATUS_KARYAWAN,
            user.IsActive,
            pegawai.AGAMA,
            pegawai.PENDIDIKAN,
            pegawai.NO_HP,
            // Email is account-owned (easy.users.Email via the login token), not HR-entered -
            // prefer it over the MST_PEGAWAI copy so a stale/blank HR record never hides it.
            user.Email ?? pegawai.EMAIL,
            new AlamatDto(pegawai.ALAMAT, pegawai.RT, pegawai.RW, pegawai.PROVINSI, pegawai.KABUPATEN, pegawai.KECAMATAN, pegawai.DESA, pegawai.KODE_POS),
            pegawai.RIWAYAT_KESEHATAN,
            pegawai.STATUS_NIKAH,
            isMarried,
            pasangan,
            pegawai.JUMLAH_ANAK,
            pegawai.NAMA_DARURAT,
            pegawai.HP_DARURAT,
            DateOnly.FromDateTime(pegawai.CREATED_AT),
            anak,
            berkas,
            ProfileComplete: ProfileRules.IsComplete(pegawai));

        return Ok(dto);
    }

    // Self-service profile edit. The employee may change their own biodata, contact, address,
    // marital/spouse, and employment-status fields. ID_KARYAWAN (the account link) and
    // ID_PEGAWAI are NOT editable here.
    //
    // Doubles as self-registration: if the account has a badge number but no MST_PEGAWAI row
    // yet (see GetProfile's "shell" response), this creates it instead of updating it. Requires
    // an INSERT grant on dbo.MST_PEGAWAI for the app's SQL login, in addition to the existing
    // UPDATE grant - see DEPLOY-IIS.md.
    [HttpPut("profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest req)
    {
        var (user, pegawai) = await _currentUser.ResolveAsync(User);
        if (user is null)
        {
            return Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(req.NamaLengkap))
        {
            return BadRequest(new { message = "Nama lengkap wajib diisi." });
        }

        var nik = Clean(req.Nik);
        if (nik is not null && (nik.Length != 16 || !nik.All(char.IsAsciiDigit)))
        {
            return BadRequest(new { message = "NIK harus 16 digit angka." });
        }

        var statusKaryawan = Clean(req.StatusKaryawan);
        if (statusKaryawan is not null && !AllowedStatusKaryawan.Contains(statusKaryawan))
        {
            return BadRequest(new { message = "Status Karyawan tidak valid." });
        }

        // Required fields are enforced on every save, not just the first one - a pre-existing
        // HR/legacy row can already exist with gaps (created before this rule), and simply
        // editing it shouldn't be a way to dodge completing it. See ProfileRules.IsComplete,
        // which the dashboard/sidebar gate reads back from the saved data.
        var missing = GetMissingRegistrationFields(req);
        if (missing.Count > 0)
        {
            return BadRequest(new { message = $"Lengkapi dulu: {string.Join(", ", missing)}." });
        }

        var isNew = pegawai is null;
        MstPegawai entity;
        if (isNew)
        {
            if (string.IsNullOrWhiteSpace(user.Nik))
            {
                return NotFound(new { message = "Akun ini belum tertaut ke nomor karyawan." });
            }

            entity = new MstPegawai
            {
                ID_KARYAWAN = user.Nik,
                // CREATED_AT is NOT NULL with no default in this table; set it explicitly.
                CREATED_AT = DateTime.Now,
            };
            _db.MstPegawai.Add(entity);
        }
        else
        {
            // NoTracking is the context default, so load a tracked copy to update + save.
            var tracked = await _db.MstPegawai.AsTracking().FirstOrDefaultAsync(p => p.ID_PEGAWAI == pegawai!.ID_PEGAWAI);
            if (tracked is null)
            {
                return NotFound(new { message = "Data pegawai tidak ditemukan." });
            }
            entity = tracked;
        }

        entity.NAMA_LENGKAP = req.NamaLengkap.Trim();
        entity.NIK = nik ?? string.Empty;
        entity.TEMPAT_LAHIR = Clean(req.TempatLahir);
        entity.TGL_LAHIR = req.TglLahir?.ToDateTime(TimeOnly.MinValue);
        entity.JENIS_KELAMIN = Clean(req.JenisKelamin);
        entity.STATUS_KARYAWAN = statusKaryawan;
        entity.AGAMA = Clean(req.Agama);
        entity.PENDIDIKAN = Clean(req.Pendidikan);
        entity.NO_HP = Clean(req.NoHp);
        // Not user input - always the account's own login email (easy.users.Email via the
        // token), kept in lockstep with AccountController.SyncFromLegacyAsync on every login.
        entity.EMAIL = user.Email;

        var alamat = req.Alamat;
        entity.ALAMAT = Clean(alamat?.Alamat);
        entity.RT = Clean(alamat?.Rt);
        entity.RW = Clean(alamat?.Rw);
        entity.PROVINSI = Clean(alamat?.Provinsi);
        entity.KABUPATEN = Clean(alamat?.Kabupaten);
        entity.KECAMATAN = Clean(alamat?.Kecamatan);
        entity.DESA = Clean(alamat?.Desa);
        entity.KODE_POS = Clean(alamat?.KodePos);

        entity.RIWAYAT_KESEHATAN = Clean(req.RiwayatKesehatan);
        entity.STATUS_NIKAH = Clean(req.StatusNikah);
        entity.NAMA_PASANGAN = Clean(req.NamaPasangan);
        entity.TEMPAT_LAHIR_PASANGAN = Clean(req.TempatLahirPasangan);
        entity.TGL_LAHIR_PASANGAN = req.TglLahirPasangan?.ToDateTime(TimeOnly.MinValue);
        entity.JUMLAH_ANAK = req.JumlahAnak;
        entity.NAMA_DARURAT = Clean(req.NamaDarurat);
        entity.HP_DARURAT = Clean(req.HpDarurat);

        await _db.SaveChangesAsync();

        await _audit.LogAsync(
            isNew ? "profile.registered" : "profile.updated",
            entity.ID_KARYAWAN,
            User.FindFirstValue("email"),
            isNew
                ? $"Pegawai {entity.ID_KARYAWAN} mendaftarkan data profil baru."
                : $"Pegawai {entity.ID_KARYAWAN} memperbarui data profil.");

        return NoContent();
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    // Mirrors the frontend's REQUIRED_ON_REGISTER list (ProfilPage.jsx) and ProfileRules.
    // IsComplete (checked against the saved entity, for the dashboard/sidebar gate) - enforced
    // here too so the rule holds even if someone calls the API directly instead of going through
    // the form. Data Keluarga/Data Anak/Berkas Pribadi aren't checked because that whole section
    // of the SPA is hidden until registration completes, so there's nothing there yet to require.
    private static List<string> GetMissingRegistrationFields(UpdateProfileRequest req)
    {
        var missing = new List<string>();
        void Require(string? value, string label)
        {
            if (string.IsNullOrWhiteSpace(value)) missing.Add(label);
        }

        Require(req.NamaLengkap, "Nama Lengkap");
        Require(req.Nik, "NIK");
        Require(req.StatusKaryawan, "Status Karyawan");
        Require(req.TempatLahir, "Tempat Lahir");
        Require(req.TglLahir?.ToString(), "Tanggal Lahir");
        Require(req.JenisKelamin, "Jenis Kelamin");
        Require(req.Agama, "Agama");
        Require(req.Pendidikan, "Pendidikan");
        Require(req.StatusNikah, "Status Pernikahan");
        Require(req.NoHp, "No. HP");
        Require(req.Alamat?.Alamat, "Alamat");
        Require(req.Alamat?.Rt, "RT");
        Require(req.Alamat?.Rw, "RW");
        Require(req.Alamat?.Provinsi, "Provinsi");
        Require(req.Alamat?.Kabupaten, "Kota/Kabupaten");
        Require(req.Alamat?.Kecamatan, "Kecamatan");
        Require(req.Alamat?.Desa, "Desa/Kelurahan");
        Require(req.Alamat?.KodePos, "Kode Pos");
        Require(req.NamaDarurat, "Nama Kontak Darurat");
        Require(req.HpDarurat, "No. HP Darurat");

        return missing;
    }

    // --- Children (MST_ANAK_PEGAWAI), scoped to the signed-in employee ---

    [HttpPost("anak")]
    public async Task<IActionResult> AddAnak([FromBody] AnakUpsertRequest req)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        if (string.IsNullOrWhiteSpace(req.Nama))
        {
            return BadRequest(new { message = "Nama anak wajib diisi." });
        }

        // Default the sequence number to the next slot when the client doesn't send one.
        int nextUrutan;
        if (req.Urutan.HasValue)
        {
            nextUrutan = req.Urutan.Value;
        }
        else
        {
            var maxUrutan = await _db.MstAnakPegawai
                .Where(a => a.ID_PEGAWAI == pegawai.ID_PEGAWAI)
                .Select(a => (int?)a.URUTAN_ANAK)
                .MaxAsync();
            nextUrutan = (maxUrutan ?? 0) + 1;
        }

        var anak = new MstAnakPegawai
        {
            ID_PEGAWAI = pegawai.ID_PEGAWAI,
            URUTAN_ANAK = nextUrutan,
            NAMA_ANAK = Clean(req.Nama),
            TEMPAT_LAHIR_ANAK = Clean(req.TempatLahir),
            TGL_LAHIR_ANAK = req.TglLahir?.ToDateTime(TimeOnly.MinValue),
            // CREATED_AT is NOT NULL (datetime, getdate() default); set it explicitly so EF
            // doesn't send the invalid default(DateTime) 0001-01-01.
            CREATED_AT = DateTime.Now,
        };

        _db.MstAnakPegawai.Add(anak);
        await _db.SaveChangesAsync();

        await _audit.LogAsync("profile.anak.added", pegawai.ID_KARYAWAN, User.FindFirstValue("email"),
            $"Pegawai {pegawai.ID_KARYAWAN} menambah data anak (id {anak.ID_ANAK}).");

        var dto = new AnakDto(
            anak.ID_ANAK,
            anak.URUTAN_ANAK,
            anak.NAMA_ANAK,
            anak.TEMPAT_LAHIR_ANAK,
            anak.TGL_LAHIR_ANAK.HasValue ? DateOnly.FromDateTime(anak.TGL_LAHIR_ANAK.Value) : null,
            !string.IsNullOrWhiteSpace(anak.FILE_AKTA));

        return Ok(dto);
    }

    [HttpPut("anak/{idAnak:int}")]
    public async Task<IActionResult> UpdateAnak(int idAnak, [FromBody] AnakUpsertRequest req)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        if (string.IsNullOrWhiteSpace(req.Nama))
        {
            return BadRequest(new { message = "Nama anak wajib diisi." });
        }

        var anak = await _db.MstAnakPegawai
            .AsTracking()
            .FirstOrDefaultAsync(a => a.ID_ANAK == idAnak && a.ID_PEGAWAI == pegawai.ID_PEGAWAI);
        if (anak is null)
        {
            return NotFound(new { message = "Data anak tidak ditemukan." });
        }

        anak.NAMA_ANAK = Clean(req.Nama);
        anak.TEMPAT_LAHIR_ANAK = Clean(req.TempatLahir);
        anak.TGL_LAHIR_ANAK = req.TglLahir?.ToDateTime(TimeOnly.MinValue);
        if (req.Urutan.HasValue)
        {
            anak.URUTAN_ANAK = req.Urutan.Value;
        }

        await _db.SaveChangesAsync();

        await _audit.LogAsync("profile.anak.updated", pegawai.ID_KARYAWAN, User.FindFirstValue("email"),
            $"Pegawai {pegawai.ID_KARYAWAN} memperbarui data anak (id {idAnak}).");

        return NoContent();
    }

    [HttpDelete("anak/{idAnak:int}")]
    public async Task<IActionResult> DeleteAnak(int idAnak)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        var anak = await _db.MstAnakPegawai
            .AsTracking()
            .FirstOrDefaultAsync(a => a.ID_ANAK == idAnak && a.ID_PEGAWAI == pegawai.ID_PEGAWAI);
        if (anak is null)
        {
            return NotFound(new { message = "Data anak tidak ditemukan." });
        }

        // Best-effort remove the akta file from the share before dropping the row.
        var aktaPhysical = _documentResolver.ToPhysicalPath(anak.FILE_AKTA);
        if (aktaPhysical is not null)
        {
            try { System.IO.File.Delete(aktaPhysical); } catch { /* best effort */ }
        }

        _db.MstAnakPegawai.Remove(anak);
        await _db.SaveChangesAsync();

        await _audit.LogAsync("profile.anak.deleted", pegawai.ID_KARYAWAN, User.FindFirstValue("email"),
            $"Pegawai {pegawai.ID_KARYAWAN} menghapus data anak (id {idAnak}).");

        return NoContent();
    }

    [HttpGet("absensi")]
    public async Task<ActionResult<IReadOnlyList<AbsensiDto>>> GetAbsensi()
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        // Baris resmi dari SDM (read-only; view GCS tidak pernah diubah). Diindeks per tanggal.
        var sdmRows = await _db.AbsensiLog
            .Where(a => a.KodePegawai == pegawai.ID_KARYAWAN)
            .Select(a => new
            {
                a.Tanggal,
                a.NamaPegawai,
                a.NamaHari,
                a.CheckIn,
                a.CheckOut,
                a.CatatanMangkir,
            })
            .ToListAsync();

        var sdmByDate = sdmRows
            .GroupBy(a => DateOnly.FromDateTime(a.Tanggal))
            .ToDictionary(g => g.Key, g => g.First());

        // Hasil absensi kamera (db_mygcs), digabung per tanggal: jam masuk = check-in paling
        // awal, jam keluar = check-out paling akhir pada hari itu.
        var kameraRows = await _appDb.Attendances
            .Where(a => a.KodePegawai == pegawai.ID_KARYAWAN)
            .ToListAsync();

        var kameraByDate = kameraRows
            .GroupBy(a => a.Tanggal)
            .ToDictionary(g => g.Key, g => new
            {
                NamaPegawai = g.First().NamaPegawai,
                NamaHari = g.First().NamaHari,
                CheckIn = g.Where(x => x.CheckIn != null).OrderBy(x => x.CheckIn).Select(x => x.CheckIn).FirstOrDefault(),
                CheckOut = g.Where(x => x.CheckOut != null).OrderByDescending(x => x.CheckOut).Select(x => x.CheckOut).FirstOrDefault(),
            });

        // Satu tanggal = satu baris. Kamera = data terbaru (dipakai bila ada, jika kosong pakai
        // nilai vw). Keterangan mengikuti logika vw (catatan_mangkir); kosong bila tanggal itu
        // hanya berasal dari kamera. Tidak ada nilai yang ditulis balik ke GCS.
        var logs = sdmByDate.Keys
            .Union(kameraByDate.Keys)
            .Select(d =>
            {
                sdmByDate.TryGetValue(d, out var s);
                kameraByDate.TryGetValue(d, out var k);
                return new AbsensiDto(
                    s?.NamaPegawai ?? k?.NamaPegawai ?? pegawai.NAMA_LENGKAP,
                    d,
                    s?.NamaHari ?? k?.NamaHari,
                    k?.CheckIn ?? s?.CheckIn,
                    k?.CheckOut ?? s?.CheckOut,
                    s?.CatatanMangkir,
                    k != null ? "Kamera" : "SDM");
            })
            .OrderByDescending(x => x.Tanggal)
            .ToList();

        return Ok(logs);
    }

    // Lokasi geofence aktif untuk SPA absensi kamera (cek radius sisi klien sebelum submit;
    // server tetap memvalidasi ulang di PostAbsensi). Tidak admin-only - sekadar daftar
    // titik kantor/gudang, bukan data sensitif.
    [HttpGet("locations")]
    public async Task<ActionResult<IReadOnlyList<LocationDto>>> GetLocations()
    {
        var items = await _appDb.Locations
            .Where(l => l.Aktif)
            .OrderBy(l => l.Nama)
            .Select(l => new LocationDto(l.Id, l.Nama, l.Lat, l.Lng, l.RadiusMeters))
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost("absensi")]
    public async Task<ActionResult<AbsensiDto>> PostAbsensi([FromBody] AbsensiCheckInDto dto)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        if (string.IsNullOrWhiteSpace(dto.Foto))
        {
            return BadRequest(new { message = "Foto absensi wajib diambil terlebih dahulu." });
        }

        // Akurasi GPS device di dalam gedung rutin buruk (puluhan-ratusan meter) walau posisinya
        // benar - jadi TIDAK dipakai untuk menolak absen (dulu sempat begitu, tapi malah
        // memblokir pegawai yang sah sedang berada di kantor). Nilainya tetap disimpan di
        // Attendance.Accuracy untuk audit manual HR/atasan (pola akurasi sempurna berulang kali
        // adalah indikasi umum fake-GPS, tapi itu keputusan manusia, bukan validasi otomatis).
        if (dto.Accuracy is null)
        {
            return BadRequest(new { message = "Akurasi lokasi tidak terbaca. Pastikan GPS aktif lalu coba lagi." });
        }

        // Geofence: hanya boleh absen dalam radius salah satu lokasi Aktif (kantor/gudang).
        // Divalidasi ulang di server agar tidak bisa ditembus dari klien.
        var lokasiAktif = await _appDb.Locations.Where(l => l.Aktif).ToListAsync();
        if (lokasiAktif.Count == 0)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                message = "Konfigurasi lokasi kantor belum tersedia. Hubungi admin IT.",
            });
        }

        var terdekat = lokasiAktif
            .Select(l => new { Lokasi = l, Jarak = DistanceMeters((double)dto.Lat, (double)dto.Lng, (double)l.Lat, (double)l.Lng) })
            .OrderBy(x => x.Jarak)
            .First();

        if (terdekat.Jarak > terdekat.Lokasi.RadiusMeters)
        {
            return BadRequest(new
            {
                message = $"Anda berada di luar radius {terdekat.Lokasi.Nama} (~{terdekat.Jarak:0} m). Absensi hanya dapat dilakukan dalam radius {terdekat.Lokasi.RadiusMeters:0} meter.",
            });
        }

        var basePath = _config["Attendance:PhotoPath"];
        if (string.IsNullOrWhiteSpace(basePath))
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                message = "Penyimpanan foto absensi belum dikonfigurasi (Attendance:PhotoPath). Hubungi IT.",
            });
        }

        // WIB (UTC+7) dihitung eksplisit agar tidak bergantung pada zona waktu server.
        var nowUtc = DateTime.UtcNow;
        var nowWib = nowUtc.AddHours(7);
        var jam = nowWib.ToString("HH:mm:ss");
        var tanggalWib = DateOnly.FromDateTime(nowWib);

        // Satu tombol: sistem menentukan masuk/keluar dari status absensi hari ini, bukan dari
        // jam. Belum ada absen masuk hari itu -> tap ini dihitung "masuk" (termasuk yang telat).
        // Sudah absen masuk -> tap berikutnya dihitung "keluar". Tidak mungkin "keluar" tercatat
        // sebelum "masuk". "Sudah absen masuk" dicek di KEDUA sumber - kamera (db_mygcs.Attendances)
        // maupun fingerprint/SDM (GCS.vw_web_sdm_absensi via AbsensiLog) - supaya check-in fingerprint
        // pagi ini tidak diabaikan lalu tercatat dobel sebagai "masuk" lagi di sini.
        var startOfDayWib = tanggalWib.ToDateTime(TimeOnly.MinValue);
        var endOfDayWib = startOfDayWib.AddDays(1);
        var sudahAbsenMasuk =
            await _appDb.Attendances.AnyAsync(a => a.KodePegawai == pegawai.ID_KARYAWAN && a.Tanggal == tanggalWib && a.CheckIn != null) ||
            await _db.AbsensiLog.AnyAsync(a => a.KodePegawai == pegawai.ID_KARYAWAN && a.Tanggal >= startOfDayWib && a.Tanggal < endOfDayWib && a.CheckIn != null);
        var type = sudahAbsenMasuk ? "out" : "in";

        // Foto (sudah bertempel timestamp dari klien) disimpan sebagai file di share EASy;
        // hanya path relatifnya yang dicatat di database.
        byte[] fotoBytes;
        try
        {
            fotoBytes = DecodeDataUrl(dto.Foto);
        }
        catch (FormatException)
        {
            return BadRequest(new { message = "Format foto tidak valid." });
        }

        var safeKode = new string((pegawai.ID_KARYAWAN ?? "").Where(char.IsLetterOrDigit).ToArray());
        var fileName = $"{safeKode}_{nowWib:yyyyMMdd_HHmmss}.jpg";
        try
        {
            Directory.CreateDirectory(basePath);
            await System.IO.File.WriteAllBytesAsync(Path.Combine(basePath, fileName), fotoBytes);
        }
        catch (Exception ex)
        {
            // Penyebab tersering: identitas App Pool IIS tidak punya izin tulis ke share UNC
            // (Attendance:PhotoPath). Exception asli (UnauthorizedAccessException / IOException /
            // DirectoryNotFoundException) dicatat agar IT bisa membedakan izin vs path salah.
            _logger.LogError(ex, "Gagal menyimpan foto absensi ke {BasePath} (file {FileName})", basePath, fileName);
            return StatusCode(StatusCodes.Status500InternalServerError, new
            {
                message = "Gagal menyimpan foto absensi ke penyimpanan. Hubungi IT.",
            });
        }

        var row = new Attendance
        {
            KodePegawai = pegawai.ID_KARYAWAN ?? string.Empty,
            NamaPegawai = pegawai.NAMA_LENGKAP,
            Tanggal = DateOnly.FromDateTime(nowWib),
            NamaHari = HariIndonesia(nowWib.DayOfWeek),
            CheckIn = type == "in" ? jam : null,
            CheckOut = type == "out" ? jam : null,
            CatatanMangkir = null,
            Foto = "attendances/" + fileName,
            Lat = dto.Lat,
            Lng = dto.Lng,
            Accuracy = dto.Accuracy,
            Type = type,
            Tempat = dto.Tempat,
            CreatedAt = nowUtc,
            UpdatedAt = nowUtc,
        };

        _appDb.Attendances.Add(row);
        await _appDb.SaveChangesAsync();

        return Ok(new AbsensiDto(
            row.NamaPegawai,
            row.Tanggal,
            row.NamaHari,
            row.CheckIn,
            row.CheckOut,
            row.CatatanMangkir,
            "Kamera"));
    }

    // Streams the employee's OWN document. The file physically lives on the WCP-GCS share;
    // it is never exposed as a public URL, so this ownership-scoped endpoint is the only way in.
    [HttpGet("documents/{key}")]
    public async Task<IActionResult> GetDocument(string key)
    {
        var field = EmployeeDocuments.Find(key);
        if (field is null)
        {
            return NotFound();
        }

        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        if (EmployeeDocuments.MaritalKeys.Contains(key) && !EmployeeDocuments.IsMarried(pegawai))
        {
            return Forbid();
        }

        return StreamDocument(field.Selector(pegawai));
    }

    [HttpGet("documents/anak/{idAnak:int}/akta")]
    public async Task<IActionResult> GetAktaAnak(int idAnak)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        var anak = await _db.MstAnakPegawai
            .FirstOrDefaultAsync(a => a.ID_ANAK == idAnak && a.ID_PEGAWAI == pegawai.ID_PEGAWAI);

        if (anak is null)
        {
            return NotFound(new { message = "Data anak tidak ditemukan." });
        }

        return StreamDocument(anak.FILE_AKTA);
    }

    // Uploads/replaces one of the employee's OWN documents. The file is written to the WCP-GCS
    // uploads folder (LegacyFiles:Root) and its relative path saved back to the FILE_* column.
    [HttpPost("documents/{key}")]
    [RequestSizeLimit(MaxDocBytes)]
    public async Task<IActionResult> UploadDocument(string key, IFormFile file)
    {
        var field = EmployeeDocuments.Find(key);
        if (field is null)
        {
            return NotFound();
        }

        var invalid = ValidateUpload(file);
        if (invalid is not null)
        {
            return invalid;
        }

        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        var entity = await _db.MstPegawai.AsTracking().FirstOrDefaultAsync(p => p.ID_PEGAWAI == pegawai.ID_PEGAWAI);
        if (entity is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan." });
        }

        if (EmployeeDocuments.MaritalKeys.Contains(key) && !EmployeeDocuments.IsMarried(entity))
        {
            return Forbid();
        }

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var relative = BuildDocRelative(entity.ID_KARYAWAN, key, ext);

        var writeError = await WriteUploadedFileAsync(file, relative, previousRelative: field.Selector(entity));
        if (writeError is not null)
        {
            return writeError;
        }

        field.Setter(entity, relative);
        await _db.SaveChangesAsync();

        await _audit.LogAsync("profile.document.updated", entity.ID_KARYAWAN, User.FindFirstValue("email"),
            $"Pegawai {entity.ID_KARYAWAN} memperbarui dokumen '{field.Label}'.");

        return NoContent();
    }

    [HttpPost("documents/anak/{idAnak:int}/akta")]
    [RequestSizeLimit(MaxDocBytes)]
    public async Task<IActionResult> UploadAktaAnak(int idAnak, IFormFile file)
    {
        var invalid = ValidateUpload(file);
        if (invalid is not null)
        {
            return invalid;
        }

        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        var anak = await _db.MstAnakPegawai
            .AsTracking()
            .FirstOrDefaultAsync(a => a.ID_ANAK == idAnak && a.ID_PEGAWAI == pegawai.ID_PEGAWAI);
        if (anak is null)
        {
            return NotFound(new { message = "Data anak tidak ditemukan." });
        }

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var relative = BuildDocRelative(pegawai.ID_KARYAWAN, $"akta_{idAnak}", ext);

        var writeError = await WriteUploadedFileAsync(file, relative, previousRelative: anak.FILE_AKTA);
        if (writeError is not null)
        {
            return writeError;
        }

        anak.FILE_AKTA = relative;
        await _db.SaveChangesAsync();

        await _audit.LogAsync("profile.document.updated", pegawai.ID_KARYAWAN, User.FindFirstValue("email"),
            $"Pegawai {pegawai.ID_KARYAWAN} memperbarui akta anak (id {idAnak}).");

        return NoContent();
    }

    private IActionResult? ValidateUpload(IFormFile? file)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(new { message = "Berkas kosong." });
        }

        if (file.Length > MaxDocBytes)
        {
            return BadRequest(new { message = "Ukuran berkas maksimal 10 MB." });
        }

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedDocExt.Contains(ext))
        {
            return BadRequest(new { message = "Berkas harus berupa PDF, PNG, JPG, atau JPEG." });
        }

        return null;
    }

    // Deterministic, per-employee-per-slot filename so re-uploading replaces the same file:
    // uploads/karyawan/{idKaryawan}_{slot}{ext}. The employee id is sanitised because it lands
    // in a file path.
    private static string BuildDocRelative(string idKaryawan, string slot, string ext)
    {
        var safeId = new string(idKaryawan.Where(c => char.IsAsciiLetterOrDigit(c) || c is '.' or '-' or '_').ToArray());
        if (string.IsNullOrEmpty(safeId))
        {
            safeId = "pegawai";
        }

        return $"uploads/karyawan/{safeId}_{slot}{ext}";
    }

    // Writes the uploaded file to its physical location under the root, then best-effort deletes
    // the previously referenced file if it was at a different path. Returns an error result on
    // failure, or null on success.
    private async Task<IActionResult?> WriteUploadedFileAsync(IFormFile file, string relative, string? previousRelative)
    {
        var physical = _documentResolver.ToPhysicalPath(relative);
        if (physical is null)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                message = "Penyimpanan dokumen belum dikonfigurasi (LegacyFiles:Root). Hubungi IT."
            });
        }

        Directory.CreateDirectory(Path.GetDirectoryName(physical)!);
        await using (var stream = System.IO.File.Create(physical))
        {
            await file.CopyToAsync(stream);
        }

        var previousNormalised = previousRelative?.Replace('\\', '/').TrimStart('/');
        if (!string.IsNullOrWhiteSpace(previousNormalised) &&
            !string.Equals(previousNormalised, relative, StringComparison.OrdinalIgnoreCase))
        {
            var oldPhysical = _documentResolver.ToPhysicalPath(previousNormalised);
            if (oldPhysical is not null && !string.Equals(oldPhysical, physical, StringComparison.OrdinalIgnoreCase))
            {
                try { System.IO.File.Delete(oldPhysical); } catch { /* best effort - orphan is harmless */ }
            }
        }

        return null;
    }

    // Resolves the stored relative path to a real file on the WCP-GCS share and streams it
    // inline (the viewer displays it in an iframe). 404 when the document isn't available.
    private IActionResult StreamDocument(string? relativePath)
    {
        var file = _documentResolver.Resolve(relativePath);
        if (file is null)
        {
            return NotFound(new { message = "Dokumen belum tersedia." });
        }

        var stream = System.IO.File.OpenRead(file.PhysicalPath);
        return File(stream, file.ContentType);
    }
}

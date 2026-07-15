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
    private readonly GcsDbContext _db;
    private readonly ApplicationDbContext _appDb;
    private readonly DocumentResolver _documentResolver;
    private readonly CurrentUserContext _currentUser;
    private readonly IConfiguration _config;
    private readonly ILogger<PersonalController> _logger;

    public PersonalController(GcsDbContext db, ApplicationDbContext appDb, DocumentResolver documentResolver, CurrentUserContext currentUser, IConfiguration config, ILogger<PersonalController> logger)
    {
        _db = db;
        _appDb = appDb;
        _documentResolver = documentResolver;
        _currentUser = currentUser;
        _config = config;
        _logger = logger;
    }

    // Geofence kantor: absensi hanya sah dalam radius 15 m dari titik ini.
    private const double OfficeLat = -7.160305232233935;
    private const double OfficeLng = 112.63314286876565;
    private const double RadiusMeters = 200.0;

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

    // Every MST_PEGAWAI document column, keyed by the identifier used in the URL/UI.
    // "kk" and "buku-nikah" are marital documents and gated to married employees below.
    private static readonly (string Key, string Label, Func<MstPegawai, string?> Selector)[] DocumentFields =
    [
        ("ktp", "KTP", p => p.FILE_KTP),
        ("kk", "Kartu Keluarga", p => p.FILE_KK),
        ("buku-nikah", "Buku Nikah", p => p.FILE_BUKU_NIKAH),
        ("ijazah", "Ijazah", p => p.FILE_IJAZAH),
        ("sim", "SIM", p => p.FILE_SIM),
        ("gada-pratama", "Sertifikat Gada Pratama", p => p.FILE_GADA_PRATAMA),
        ("k3", "Sertifikat K3", p => p.FILE_K3),
        ("lain", "Berkas Lainnya", p => p.FILE_LAIN),
    ];

    private static readonly HashSet<string> MaritalDocumentKeys = new(["kk", "buku-nikah"]);

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
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini. Hubungi HR/SDM." });
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

        var berkas = DocumentFields
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
            pegawai.EMAIL,
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
            berkas);

        return Ok(dto);
    }

    [HttpGet("absensi")]
    public async Task<ActionResult<IReadOnlyList<AbsensiDto>>> GetAbsensi()
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini. Hubungi HR/SDM." });
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

    [HttpPost("absensi")]
    public async Task<ActionResult<AbsensiDto>> PostAbsensi([FromBody] AbsensiCheckInDto dto)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini. Hubungi HR/SDM." });
        }

        if (string.IsNullOrWhiteSpace(dto.Foto))
        {
            return BadRequest(new { message = "Foto absensi wajib diambil terlebih dahulu." });
        }

        // Geofence: hanya boleh absen dalam radius kantor. Divalidasi ulang di server agar
        // tidak bisa ditembus dari klien.
        var jarak = DistanceMeters((double)dto.Lat, (double)dto.Lng, OfficeLat, OfficeLng);
        if (jarak > RadiusMeters)
        {
            return BadRequest(new
            {
                message = $"Anda berada di luar radius kantor (~{jarak:0} m). Absensi hanya dapat dilakukan dalam radius {RadiusMeters:0} meter dari kantor.",
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
        // sebelum "masuk".
        var sudahAbsenMasuk = await _appDb.Attendances
            .AnyAsync(a => a.KodePegawai == pegawai.ID_KARYAWAN && a.Tanggal == tanggalWib && a.CheckIn != null);
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

    [HttpGet("documents/{key}")]
    public async Task<ActionResult<DocumentInfo>> GetDocument(string key)
    {
        var field = DocumentFields.FirstOrDefault(f => f.Key == key);
        if (field.Key is null)
        {
            return NotFound();
        }

        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        if (MaritalDocumentKeys.Contains(key) && !string.Equals(pegawai.STATUS_NIKAH, "Kawin", StringComparison.OrdinalIgnoreCase))
        {
            return Forbid();
        }

        return Ok(_documentResolver.Resolve(field.Selector(pegawai)));
    }

    [HttpGet("documents/anak/{idAnak:int}/akta")]
    public async Task<ActionResult<DocumentInfo>> GetAktaAnak(int idAnak)
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

        return Ok(_documentResolver.Resolve(anak.FILE_AKTA));
    }
}

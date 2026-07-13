using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SsoBackend.Data;
using SsoBackend.Models.Dto;
using SsoBackend.Models.Gcs;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

[ApiController]
[Authorize]
[Route("api/personal")]
public class PersonalController : ControllerBase
{
    private readonly GcsDbContext _db;
    private readonly DocumentResolver _documentResolver;
    private readonly CurrentUserContext _currentUser;

    public PersonalController(GcsDbContext db, DocumentResolver documentResolver, CurrentUserContext currentUser)
    {
        _db = db;
        _documentResolver = documentResolver;
        _currentUser = currentUser;
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

        var jabatan = await _db.PegawaiSdm
            .Where(p => p.Nik == pegawai.ID_KARYAWAN)
            .Select(p => p.nm_jabatan)
            .FirstOrDefaultAsync();

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
            jabatan,
            string.Equals(user.Status, "Aktif", StringComparison.OrdinalIgnoreCase),
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

        var logs = await _db.AbsensiLog
            .Where(a => a.KodePegawai == pegawai.ID_KARYAWAN)
            .OrderByDescending(a => a.Tanggal)
            .Select(a => new AbsensiDto(
                a.NamaPegawai,
                DateOnly.FromDateTime(a.Tanggal),
                a.NamaHari,
                a.CheckIn,
                a.CheckOut,
                a.CatatanMangkir))
            .ToListAsync();

        return Ok(logs);
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

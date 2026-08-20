using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Data;
using SsoBackend.Models.Dto;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

// Direktori karyawan untuk Admin SDM (modul HR Management > Data Karyawan) - "lihat
// seluruh data karyawan termasuk file upload" (diminta 2026-08-20). Rute di bawah /org
// supaya otomatis ikut penjaga rute modul "hr-management" di frontend (App.jsx) tanpa
// perlu RequireModule baru - gate akses sebenarnya tetap IsSdmAdminAsync per-aksi di
// sini, sama pola dengan OrgStrukturController/GajiController.
//
// Beda dari AdminDocumentsController (khusus Identity role "Admin"/Admin IT, di luar
// modul HR Management): controller ini utk Admin Modul SDM, dan menampilkan SELURUH
// data biodata (bukan cuma manifest berkas) + jangkauannya SEMUA status kepegawaian
// (tidak dibatasi jenis_pegawai='Tetap' spt picker lain - lihat PegawaiDirektoriDto.cs).
[ApiController]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
[Route("org/pegawai")]
public class PegawaiDirektoriController : ControllerBase
{
    private readonly CurrentUserContext _currentUser;
    private readonly ModuleAccessService _access;
    private readonly GcsDbContext _db;
    private readonly DocumentResolver _documentResolver;
    private readonly PosisiResolver _posisi;

    public PegawaiDirektoriController(
        CurrentUserContext currentUser,
        ModuleAccessService access,
        GcsDbContext db,
        DocumentResolver documentResolver,
        PosisiResolver posisi)
    {
        _currentUser = currentUser;
        _access = access;
        _db = db;
        _documentResolver = documentResolver;
        _posisi = posisi;
    }

    // GET /org/pegawai?q=...  -> daftar karyawan (100 pertama, urut nama; q kosong/1
    // huruf = daftar default spt picker lain supaya halaman langsung tampil isi).
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PegawaiDirektoriItemDto>>> Cari([FromQuery] string? q)
    {
        if (!await IsSdmAdminAsync()) return Forbid();

        var term = (q ?? string.Empty).Trim();
        var query = _db.MstPegawai.AsNoTracking().AsQueryable();
        if (term.Length >= 2)
        {
            query = query.Where(p => p.NAMA_LENGKAP.Contains(term) || p.NIK.Contains(term) || p.ID_KARYAWAN.Contains(term));
        }

        var rows = await query
            .OrderBy(p => p.NAMA_LENGKAP)
            .Take(100)
            .Select(p => new PegawaiDirektoriItemDto(p.ID_PEGAWAI, p.ID_KARYAWAN, p.NIK, p.NAMA_LENGKAP, p.STATUS_KARYAWAN))
            .ToListAsync();

        return Ok(rows);
    }

    // GET /org/pegawai/{idPegawai} -> detail lengkap (biodata, alamat, keluarga, anak,
    // manifest berkas) + konteks jabatan/unit/band kalau ada penempatan grading aktif.
    [HttpGet("{idPegawai:int}")]
    public async Task<ActionResult<PegawaiDetailAdminDto>> Detail(int idPegawai)
    {
        if (!await IsSdmAdminAsync()) return Forbid();

        var pegawai = await _db.MstPegawai.AsNoTracking().FirstOrDefaultAsync(p => p.ID_PEGAWAI == idPegawai);
        if (pegawai is null) return NotFound(new { message = "Data pegawai tidak ditemukan." });

        var anak = await _db.MstAnakPegawai.AsNoTracking()
            .Where(a => a.ID_PEGAWAI == idPegawai)
            .OrderBy(a => a.URUTAN_ANAK)
            .Select(a => new AnakDto(
                a.ID_ANAK, a.URUTAN_ANAK, a.NAMA_ANAK, a.TEMPAT_LAHIR_ANAK,
                a.TGL_LAHIR_ANAK.HasValue ? DateOnly.FromDateTime(a.TGL_LAHIR_ANAK.Value) : null,
                !string.IsNullOrWhiteSpace(a.FILE_AKTA)))
            .ToListAsync();

        var isMarried = string.Equals(pegawai.STATUS_NIKAH, "Kawin", StringComparison.OrdinalIgnoreCase);
        var pasangan = isMarried
            ? new PasanganDto(
                pegawai.NAMA_PASANGAN, pegawai.TEMPAT_LAHIR_PASANGAN,
                pegawai.TGL_LAHIR_PASANGAN.HasValue ? DateOnly.FromDateTime(pegawai.TGL_LAHIR_PASANGAN.Value) : null)
            : null;

        var berkas = EmployeeDocuments.Fields
            .Select(f => new BerkasDto(f.Key, f.Label, !string.IsNullOrWhiteSpace(f.Selector(pegawai))))
            .ToList();

        // Jabatan/unit/band struktural (grading) kalau ada, jatuh ke legacy PEGAWAI_SDM -
        // sama sumber kebenaran dgn header/picker lain (lihat PosisiResolver).
        var legacy = await _db.PegawaiSdm.AsNoTracking()
            .Where(p => p.Nik == pegawai.ID_KARYAWAN)
            .Select(p => new { p.nm_jabatan, Unit = p.UNIT_KERJA ?? p.BAGIAN, p.tgl_masker })
            .FirstOrDefaultAsync();

        var posisi = await _posisi.ResolveAsync(pegawai.ID_KARYAWAN);

        var dto = new PegawaiDetailAdminDto(
            pegawai.ID_PEGAWAI, pegawai.NAMA_LENGKAP, pegawai.ID_KARYAWAN, pegawai.NIK,
            pegawai.TEMPAT_LAHIR, pegawai.TGL_LAHIR.HasValue ? DateOnly.FromDateTime(pegawai.TGL_LAHIR.Value) : null,
            pegawai.JENIS_KELAMIN, pegawai.STATUS_KARYAWAN,
            pegawai.AGAMA, pegawai.PENDIDIKAN, pegawai.NO_HP, pegawai.EMAIL,
            new AlamatDto(pegawai.ALAMAT, pegawai.RT, pegawai.RW, pegawai.PROVINSI, pegawai.KABUPATEN, pegawai.KECAMATAN, pegawai.DESA, pegawai.KODE_POS),
            pegawai.RIWAYAT_KESEHATAN, pegawai.STATUS_NIKAH, isMarried, pasangan,
            pegawai.JUMLAH_ANAK, pegawai.NAMA_DARURAT, pegawai.HP_DARURAT,
            DateOnly.FromDateTime(pegawai.CREATED_AT),
            legacy?.tgl_masker.HasValue == true ? DateOnly.FromDateTime(legacy.tgl_masker!.Value) : null,
            PosisiResolver.NamaJabatanTerbaik(posisi, legacy?.nm_jabatan), legacy?.Unit,
            posisi.Band, posisi.Tingkatan,
            anak, berkas);

        return Ok(dto);
    }

    [HttpGet("{idPegawai:int}/file/{key}")]
    public async Task<IActionResult> GetFile(int idPegawai, string key)
    {
        if (!await IsSdmAdminAsync()) return Forbid();

        var field = EmployeeDocuments.Find(key);
        if (field is null) return NotFound();

        var pegawai = await _db.MstPegawai.AsNoTracking().FirstOrDefaultAsync(p => p.ID_PEGAWAI == idPegawai);
        if (pegawai is null) return NotFound(new { message = "Data pegawai tidak ditemukan." });

        return StreamDocument(field.Selector(pegawai));
    }

    [HttpGet("{idPegawai:int}/anak/{idAnak:int}/akta")]
    public async Task<IActionResult> GetAktaAnak(int idPegawai, int idAnak)
    {
        if (!await IsSdmAdminAsync()) return Forbid();

        var anak = await _db.MstAnakPegawai.AsNoTracking()
            .FirstOrDefaultAsync(a => a.ID_ANAK == idAnak && a.ID_PEGAWAI == idPegawai);
        if (anak is null) return NotFound(new { message = "Data anak tidak ditemukan." });

        return StreamDocument(anak.FILE_AKTA);
    }

    private IActionResult StreamDocument(string? relativePath)
    {
        var file = _documentResolver.Resolve(relativePath);
        if (file is null) return NotFound(new { message = "Dokumen belum tersedia." });

        var stream = System.IO.File.OpenRead(file.PhysicalPath);
        return File(stream, file.ContentType);
    }

    private async Task<bool> IsSdmAdminAsync()
    {
        var (user, pegawai) = await _currentUser.ResolveAsync(User);
        var nik = pegawai?.ID_KARYAWAN ?? user?.Nik;
        return await _access.IsSdmAdminAsync(nik);
    }
}

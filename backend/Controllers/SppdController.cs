using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Data;
using SsoBackend.Models.Dto;
using SsoBackend.Models.Gcs;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

[ApiController]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
[Route("personal/sppd")]
[ModuleGate("my-personal")]
[FeatureGate("my-personal:sppd")]
public class SppdController : ControllerBase
{
    private const string StatusDibuat = "Di Buat";
    private const string SourceWebEasy = "WEBEASY";

    // Nilai awal kode_sppd sebelum trigger menuliskannya ulang jadi ISP + yyyyMM + nomor urut.
    //
    // Enam nol di belakang WAJIB. Trigger menghitung nomor berikutnya dengan
    // MAX(CAST(RIGHT(kode_sppd, 6) AS INT)) atas seluruh baris berprefiks sama di bulan itu -
    // termasuk baris yang baru saja masuk ini. Kalau hanya diisi "ISP", RIGHT("ISP", 6)
    // menghasilkan "ISP" dan konversinya ke INT gagal, jadi INSERT-nya ditolak.
    private const string KodeAwal = "ISP000000";


    // Conventions of the intranet.web_ttd_elektronik document registry.
    private const string UnitDokumen = "SDM";
    private const string TipeDokumen = "SPPD";
    private const string StatusTerdaftar = "Open";
    private const string ValidasiBaseUrl = "https://service.gcs-gresik.com/validasi";

    private static readonly string[] AllowedJenis = ["Dalam Negeri", "Luar Negeri"];
    private static readonly string[] AllowedKendaraan = ["Umum", "Kendaraan Dinas", "Lain-lain"];
    private static readonly string[] AllowedPosisi = ["Ketua", "Anggota"];

    private readonly GcsDbContext _db;
    private readonly CurrentUserContext _currentUser;
    private readonly ApprovalService _approval;
    private readonly DinasBuktiService _bukti;
    private readonly PosisiResolver _posisi;

    public SppdController(
        GcsDbContext db, CurrentUserContext currentUser, ApprovalService approval, DinasBuktiService bukti,
        PosisiResolver posisi)
    {
        _db = db;
        _currentUser = currentUser;
        _approval = approval;
        _posisi = posisi;
        _bukti = bukti;
    }

    [HttpGet]
    public async Task<ActionResult<SppdListDto>> GetAll()
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        var rows = await _db.WebSdmSppd
            .Where(s => s.id_user == pegawai.ID_KARYAWAN)
            .OrderByDescending(s => s.id)
            .ToListAsync();

        var ids = rows.Select(r => r.id).ToList();

        // The list shows the leader (or, failing that, the first traveller) so a user can
        // recognise the trip without opening it.
        var details = await _db.WebSdmSppdDetail
            .Where(d => ids.Contains(d.id))
            .OrderBy(d => d.id_det)
            .ToListAsync();

        var pesertaNik = details.Select(d => d.id_user).Distinct().ToList();
        var nama = await _db.PegawaiSdm
            .Where(p => pesertaNik.Contains(p.Nik))
            .ToDictionaryAsync(p => p.Nik, p => p.nama);

        // Bukti dinas (rentang km + foto) hidup di db_mygcs (dinas.bukti), bukan di baris
        // legacy ini - dimuat sekaligus per (jenis="SPPD", refId) supaya tak N+1 query.
        var buktiByRefId = await _bukti.CariBanyakAsync("SPPD", rows.Select(r => r.id.ToString()).ToList());

        var items = rows.Select(s =>
        {
            // Every traveller is listed, not just the leader: an SPPD routinely carries
            // several people and showing only one made the others invisible in the table.
            // Ketua first, then the rest in the order they were added.
            var pesertaSppd = details
                .Where(d => d.id == s.id)
                .OrderBy(d => d.posisi == "Ketua" ? 0 : 1)
                .ThenBy(d => d.id_det)
                .ToList();

            buktiByRefId.TryGetValue(s.id.ToString(), out var b);

            return new SppdDto(
                s.id,
                s.kode_sppd,
                s.status,
                s.tgl_input,
                s.tujuan_sppd,
                s.keterangan,
                s.tgl_berangkat,
                s.tgl_pulang,
                s.lama_hari,
                s.kendaraan,
                s.jenis,
                pesertaSppd
                    .Select(d => nama.GetValueOrDefault(d.id_user) ?? d.id_user)
                    .ToList(),
                pesertaSppd.Select(d => d.tugas).Distinct().ToList(),
                b?.RentangKm,
                b is null ? null : $"/api/personal/dinas/foto/SPPD/{s.id}");
        }).ToList();

        return Ok(new SppdListDto(items));
    }

    [HttpPost]
    public async Task<ActionResult<SppdDto>> Create(SppdRequest request)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        if (Validate(request) is { } error)
        {
            return BadRequest(new { message = error });
        }
        if (string.IsNullOrWhiteSpace(request.Foto))
        {
            return BadRequest(new { message = "Foto bukti dinas wajib diambil terlebih dahulu." });
        }

        var atasan = await ResolveAtasanAsync(pegawai.ID_KARYAWAN);
        if (atasan is null)
        {
            return BadRequest(new { message = "Atasan penyetuju belum terdaftar untuk Anda." });
        }

        var sppd = new WebSdmSppd
        {
            // Trigger INSERT yang menuliskan kode_sppd sebenarnya.
            kode_sppd = KodeAwal,
            tgl_input = DateTime.Now,
            id_user = pegawai.ID_KARYAWAN,
            keterangan = request.Keterangan.Trim(),
            tujuan_sppd = request.Tujuan.Trim(),
            tgl_berangkat = request.TglBerangkat.ToDateTime(TimeOnly.MinValue),
            tgl_pulang = request.TglPulang.ToDateTime(TimeOnly.MinValue),
            lama_hari = LamaHari(request.TglBerangkat, request.TglPulang),
            kendaraan = request.Kendaraan,
            jenis = request.Jenis,
            status = StatusDibuat,
            source = SourceWebEasy,
            id_perintah = "-",
            masa_atasan = atasan,
        };

        _db.WebSdmSppd.Add(sppd);
        await _db.SaveChangesAsync();

        var (buktiOk, buktiError) = await _bukti.SimpanAsync(
            "SPPD", sppd.id.ToString(), pegawai.ID_KARYAWAN, request.RentangKm,
            request.Foto, request.Lat, request.Lng, request.Accuracy);
        if (!buktiOk)
        {
            // SPPD legacy SUDAH tercatat (GCS & db_mygcs beda database, tak ada transaksi
            // lintas-DB) - sangat jarang krn rentang km & foto sudah divalidasi di atas.
            return StatusCode(StatusCodes.Status500InternalServerError, new
            {
                message = $"SPPD tersimpan, tapi bukti dinas gagal disimpan: {buktiError} Hubungi IT, lalu coba Ubah SPPD ini untuk mengunggah ulang bukti."
            });
        }

        var ringkasan = $"SPPD {request.Jenis} ke {request.Tujuan.Trim()} · {request.TglBerangkat:dd MMM}–{request.TglPulang:dd MMM}";
        await _approval.CreateAsync("SPPD", sppd.id.ToString(), pegawai.ID_KARYAWAN, pegawai.NAMA_LENGKAP, ringkasan);

        // kode_sppd was rewritten by the trigger after the INSERT, so read the row back.
        var kode = await _db.WebSdmSppd
            .Where(s => s.id == sppd.id)
            .Select(s => s.kode_sppd)
            .FirstOrDefaultAsync();

        // Baru dibuat, jadi belum punya peserta.
        return Ok(ToDto(sppd, kode, [], []) with { RentangKm = request.RentangKm, FotoUrl = $"/api/personal/dinas/foto/SPPD/{sppd.id}" });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, SppdRequest request)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        if (Validate(request) is { } error)
        {
            return BadRequest(new { message = error });
        }

        var sppd = await FindOwnEditableAsync(id, pegawai.ID_KARYAWAN);
        if (sppd is null)
        {
            return NotFound(new { message = "SPPD tidak ditemukan atau sudah diproses sehingga tidak bisa diubah." });
        }

        sppd.keterangan = request.Keterangan.Trim();
        sppd.tujuan_sppd = request.Tujuan.Trim();
        sppd.tgl_berangkat = request.TglBerangkat.ToDateTime(TimeOnly.MinValue);
        sppd.tgl_pulang = request.TglPulang.ToDateTime(TimeOnly.MinValue);
        sppd.lama_hari = LamaHari(request.TglBerangkat, request.TglPulang);
        sppd.kendaraan = request.Kendaraan;
        sppd.jenis = request.Jenis;

        await _db.SaveChangesAsync();

        // Foto kosong = pertahankan foto lama (SimpanAsync sudah menangani ini).
        var (buktiOk, buktiError) = await _bukti.SimpanAsync(
            "SPPD", sppd.id.ToString(), pegawai.ID_KARYAWAN, request.RentangKm,
            request.Foto, request.Lat, request.Lng, request.Accuracy);
        if (!buktiOk)
        {
            return BadRequest(new { message = buktiError });
        }

        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        var sppd = await FindOwnEditableAsync(id, pegawai.ID_KARYAWAN);
        if (sppd is null)
        {
            return NotFound(new { message = "SPPD tidak ditemukan atau sudah diproses sehingga tidak bisa dihapus." });
        }

        // Peserta dihapus lebih dulu: ada foreign key dari web_sdm_sppd_detail ke induknya,
        // jadi menghapus induk sementara anaknya masih ada akan ditolak database.
        var details = await _db.WebSdmSppdDetail.AsTracking().Where(d => d.id == id).ToListAsync();
        _db.WebSdmSppdDetail.RemoveRange(details);
        _db.WebSdmSppd.Remove(sppd);

        await _db.SaveChangesAsync();
        await _bukti.HapusAsync("SPPD", id.ToString());
        return NoContent();
    }

    // --- Peserta (web_sdm_sppd_detail) ---

    [HttpGet("{id:int}/detail")]
    public async Task<ActionResult<IReadOnlyList<SppdDetailDto>>> GetDetail(int id)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        if (!await OwnsAsync(id, pegawai.ID_KARYAWAN))
        {
            return NotFound(new { message = "SPPD tidak ditemukan." });
        }

        return Ok(await LoadDetailAsync(id));
    }

    [HttpPost("{id:int}/detail")]
    public async Task<ActionResult<SppdDetailDto>> AddDetail(int id, SppdDetailRequest request)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        var sppd = await FindOwnEditableAsync(id, pegawai.ID_KARYAWAN);
        if (sppd is null)
        {
            return NotFound(new { message = "SPPD tidak ditemukan atau sudah diproses." });
        }

        if (!AllowedPosisi.Contains(request.Posisi))
        {
            return BadRequest(new { message = "Posisi harus Ketua atau Anggota." });
        }

        if (string.IsNullOrWhiteSpace(request.Tugas))
        {
            return BadRequest(new { message = "Tugas wajib diisi." });
        }

        var orang = await _db.PegawaiSdm.FirstOrDefaultAsync(p => p.Nik == request.Nik);
        if (orang is null)
        {
            return BadRequest(new { message = "Pegawai tidak ditemukan." });
        }

        if (await _db.WebSdmSppdDetail.AnyAsync(d => d.id == id && d.id_user == request.Nik))
        {
            return BadRequest(new { message = "Pegawai tersebut sudah ada dalam SPPD ini." });
        }

        // Jabatan/golongan/struktur are snapshotted, not joined at print time, so the letter
        // keeps reflecting the traveller's position on the day the trip was ordered. Jabatan
        // prefers the structural grading name (same source as the app header); falls back to
        // the legacy SDM label cleaned of "Pjs"/"Plt" prefixes if the traveller has no active
        // grading placement.
        var posisi = await _posisi.ResolveAsync(orang.Nik);
        var detail = new WebSdmSppdDetail
        {
            id = id,
            id_user = orang.Nik,
            struktur = orang.struktur?.Trim(),
            golongan = orang.GOL?.Trim(),
            jabatan = PosisiResolver.NamaJabatanTerbaik(posisi, orang.nm_jabatan)?.Trim(),
            tugas = request.Tugas.Trim(),
            posisi = request.Posisi,
            id_golongan = orang.id_golongan,
            id_jabatan = orang.id_jabatan,
            id_struktur = orang.id_struktur,
        };

        _db.WebSdmSppdDetail.Add(detail);
        await _db.SaveChangesAsync();

        return Ok(new SppdDetailDto(
            detail.id_det,
            detail.id_user,
            orang.nama,
            detail.golongan,
            detail.jabatan,
            detail.struktur,
            detail.posisi,
            detail.tugas));
    }

    // Pegawainya tidak bisa diganti - itu sama saja dengan menghapus lalu menambah orang lain,
    // dan snapshot golongan/jabatan/strukturnya ikut orang yang bersangkutan. Yang bisa diubah
    // hanya posisi dan tugasnya.
    [HttpPut("{id:int}/detail/{idDet:int}")]
    public async Task<IActionResult> UpdateDetail(int id, int idDet, SppdDetailRequest request)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        var sppd = await FindOwnEditableAsync(id, pegawai.ID_KARYAWAN);
        if (sppd is null)
        {
            return NotFound(new { message = "SPPD tidak ditemukan atau sudah diproses." });
        }

        if (!AllowedPosisi.Contains(request.Posisi))
        {
            return BadRequest(new { message = "Posisi harus Ketua atau Anggota." });
        }

        if (string.IsNullOrWhiteSpace(request.Tugas))
        {
            return BadRequest(new { message = "Tugas wajib diisi." });
        }

        var detail = await _db.WebSdmSppdDetail
            .AsTracking()
            .FirstOrDefaultAsync(d => d.id_det == idDet && d.id == id);
        if (detail is null)
        {
            return NotFound(new { message = "Peserta tidak ditemukan." });
        }

        detail.posisi = request.Posisi;
        detail.tugas = request.Tugas.Trim();

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}/detail/{idDet:int}")]
    public async Task<IActionResult> DeleteDetail(int id, int idDet)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        var sppd = await FindOwnEditableAsync(id, pegawai.ID_KARYAWAN);
        if (sppd is null)
        {
            return NotFound(new { message = "SPPD tidak ditemukan atau sudah diproses." });
        }

        var detail = await _db.WebSdmSppdDetail
            .AsTracking()
            .FirstOrDefaultAsync(d => d.id_det == idDet && d.id == id);
        if (detail is null)
        {
            return NotFound(new { message = "Peserta tidak ditemukan." });
        }

        _db.WebSdmSppdDetail.Remove(detail);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // Employee picker behind "Cari Data Pegawai". Scoped to the caller's own department:
    // an SPPD is raised for one's own team, so offering all ~300 active employees makes the
    // right person harder to find and the wrong person easier to pick by accident.
    [HttpGet("pegawai")]
    public async Task<ActionResult<IReadOnlyList<PegawaiPickerDto>>> CariPegawai([FromQuery] string? q)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        var saya = await _db.PegawaiSdm.FirstOrDefaultAsync(p => p.Nik == pegawai.ID_KARYAWAN);
        var bagian = saya?.BAGIAN?.Trim();

        if (string.IsNullOrEmpty(bagian))
        {
            // No department on file: return nothing rather than silently opening up the whole
            // company, so the gap is visible instead of looking like it worked.
            return Ok(Array.Empty<PegawaiPickerDto>());
        }

        // Sementara khusus tenaga kerja organik (Tetap) - lihat catatan di GajiService.CariPegawaiAsync.
        var query = _db.PegawaiSdm.Where(p => p.data_aktif == "Aktif" && p.jenis_pegawai == "Tetap" && p.BAGIAN == bagian);

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

    // Assembles the printed letter and registers the document for QR validation.
    [HttpPost("{id:int}/print")]
    public async Task<ActionResult<SppdPrintDto>> Print(int id)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        var sppd = await _db.WebSdmSppd
            .FirstOrDefaultAsync(s => s.id == id && s.id_user == pegawai.ID_KARYAWAN);
        if (sppd is null)
        {
            return NotFound(new { message = "SPPD tidak ditemukan." });
        }

        if (string.IsNullOrWhiteSpace(sppd.kode_sppd) || sppd.kode_sppd == KodeAwal)
        {
            return BadRequest(new { message = "Kode SPPD belum terbit, coba muat ulang halaman." });
        }

        var peserta = await LoadDetailAsync(id);
        if (peserta.Count == 0)
        {
            return BadRequest(new { message = "Tambahkan minimal satu peserta sebelum mencetak SPPD." });
        }

        _ = int.TryParse(User.FindFirstValue("gcs_uid"), out var gcsUid);
        var kodeLink = await EnsureRegisteredAsync(sppd, gcsUid);

        return Ok(new SppdPrintDto(
            sppd.kode_sppd!,
            sppd.tgl_input,
            sppd.tujuan_sppd,
            sppd.tgl_berangkat,
            sppd.tgl_pulang,
            sppd.lama_hari,
            sppd.kendaraan,
            peserta.Select(p => new SppdPrintDetailDto(
                p.Nama ?? p.Nik,
                p.Nik,
                p.Golongan,
                p.Jabatan,
                p.Posisi,
                p.Tugas)).ToList(),
            $"{ValidasiBaseUrl}/{kodeLink}",
            DateTime.Now));
    }

    // Re-printing reuses the original kode_link: minting a new one would invalidate the QR
    // on letters that have already been printed and signed.
    private async Task<Guid> EnsureRegisteredAsync(WebSdmSppd sppd, int idRegister)
    {
        var existing = await _db.TtdElektronik
            .Where(t => t.kode_dokumen == sppd.kode_sppd && t.tipe_dokumen == TipeDokumen)
            .Select(t => (Guid?)t.kode_link)
            .FirstOrDefaultAsync();

        if (existing is { } found)
        {
            return found;
        }

        var uraian = $"{sppd.jenis} :: {sppd.keterangan}. " +
                     $"{sppd.tgl_berangkat:dd-MM-yyyy} s/d {sppd.tgl_pulang:dd-MM-yyyy}";

        var doc = new TtdElektronik
        {
            unit_dokumen = UnitDokumen,
            kode_dokumen = sppd.kode_sppd!,
            tipe_dokumen = TipeDokumen,
            uraian_dokumen = uraian,
            uraian2_dokumen = string.Empty,
            tgl_register = sppd.tgl_berangkat.Date,
            tgl_approve = DateTime.Now,
            id_register = idRegister,
            id_approve = 0,
            status = StatusTerdaftar,
            // kode_link intentionally not set - the newid() default mints it.
        };

        _db.TtdElektronik.Add(doc);
        await _db.SaveChangesAsync();

        return doc.kode_link;
    }

    private async Task<List<SppdDetailDto>> LoadDetailAsync(int id)
    {
        var details = await _db.WebSdmSppdDetail
            .Where(d => d.id == id)
            // Ketua first, matching the order the letter prints them in.
            .OrderBy(d => d.posisi == "Ketua" ? 0 : 1)
            .ThenBy(d => d.id_det)
            .ToListAsync();

        var niks = details.Select(d => d.id_user).ToList();
        var nama = await _db.PegawaiSdm
            .Where(p => niks.Contains(p.Nik))
            .ToDictionaryAsync(p => p.Nik, p => p.nama);

        return details.Select(d => new SppdDetailDto(
            d.id_det,
            d.id_user,
            nama.GetValueOrDefault(d.id_user),
            d.golongan,
            d.jabatan,
            d.struktur,
            d.posisi,
            d.tugas)).ToList();
    }

    private Task<bool> OwnsAsync(int id, string idKaryawan) =>
        _db.WebSdmSppd.AnyAsync(s => s.id == id && s.id_user == idKaryawan);

    // Only the employee's own SPPD that nobody has acted on yet may be edited or removed.
    private Task<WebSdmSppd?> FindOwnEditableAsync(int id, string idKaryawan) =>
        _db.WebSdmSppd
            .AsTracking()
            .FirstOrDefaultAsync(s => s.id == id && s.id_user == idKaryawan && s.status == StatusDibuat);

    private async Task<string?> ResolveAtasanAsync(string idKaryawan) =>
        await _db.SdmApproval
            .Where(a => a.KodePegawai == idKaryawan && a.KodeAtasan != null)
            .OrderBy(a => a.Urut)
            .Select(a => a.KodeAtasan)
            .FirstOrDefaultAsync();

    private static SppdDto ToDto(WebSdmSppd s, string? kode, IReadOnlyList<string> nama, IReadOnlyList<string> tugas) =>
        new(s.id, kode, s.status, s.tgl_input, s.tujuan_sppd, s.keterangan, s.tgl_berangkat,
            s.tgl_pulang, s.lama_hari, s.kendaraan, s.jenis, nama, tugas);

    private string? Validate(SppdRequest request)
    {
        if (!AllowedJenis.Contains(request.Jenis))
        {
            return "Lokasi harus Dalam Negeri atau Luar Negeri.";
        }

        if (!AllowedKendaraan.Contains(request.Kendaraan))
        {
            return "Transportasi tidak dikenal.";
        }

        if (!_bukti.RentangValidUntuk("SPPD", request.RentangKm))
        {
            return _bukti.PesanRentangSalah("SPPD");
        }

        if (string.IsNullOrWhiteSpace(request.Tujuan))
        {
            return "Tujuan SPPD wajib diisi.";
        }

        if (string.IsNullOrWhiteSpace(request.Keterangan))
        {
            return "Keterangan wajib diisi.";
        }

        if (request.TglPulang < request.TglBerangkat)
        {
            return "Tanggal pulang tidak boleh sebelum tanggal berangkat.";
        }

        return null;
    }

    // Inclusive of both travel days: berangkat and pulang on the same date is 1 hari.
    private static int LamaHari(DateOnly berangkat, DateOnly pulang) =>
        pulang.DayNumber - berangkat.DayNumber + 1;
}

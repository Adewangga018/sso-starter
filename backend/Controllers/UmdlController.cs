using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Data;
using SsoBackend.Models.Dinas;
using SsoBackend.Models.Dto;
using SsoBackend.Models.Gcs;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

[ApiController]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
[Route("personal/umdl")]
[ModuleGate("my-personal")]
[FeatureGate("my-personal:umdl")]
public class UmdlController : ControllerBase
{
    private const string StatusDibuat = "Di Buat";
    private const string SourceWebEasy = "WEBEASY";

    // Uang makan hanya berlaku untuk izin meninggalkan pekerjaan atas urusan DINAS -
    // meninggalkan kantor untuk keperluan pribadi tidak berhak atas uang makan.
    private const string JenisIjinBerhak = "Meninggalkan Pekerjaan";
    private const string KepentinganBerhak = "Dinas";

    // Format kode EASy: "UL" + yyMM + 9 karakter acak (mis. UL2607Z9LMECTLB). Tidak ada
    // trigger yang membuatnya, jadi aplikasi yang mencetak kodenya.
    private const string KodePrefix = "UL";
    private const string KodeAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    private static readonly string[] AllowedPosisi = ["Ketua", "Anggota"];

    private readonly GcsDbContext _db;
    private readonly ApplicationDbContext _appDb;
    private readonly CurrentUserContext _currentUser;
    private readonly ApprovalService _approval;
    private readonly DinasBuktiService _bukti;

    public UmdlController(
        GcsDbContext db, ApplicationDbContext appDb, CurrentUserContext currentUser, ApprovalService approval,
        DinasBuktiService bukti)
    {
        _db = db;
        _appDb = appDb;
        _currentUser = currentUser;
        _approval = approval;
        _bukti = bukti;
    }

    [HttpGet]
    public async Task<ActionResult<UmdlListDto>> GetAll()
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        // Bukan hanya UMDL yang saya ajukan - juga UMDL orang lain yang menambahkan saya
        // sbg Ketua/Anggota (diminta 2026-08-24, mirror SPPD), supaya peserta ikut melihat
        // UMDL ini di akun mereka sendiri.
        var memberRefIds = await _appDb.UmdlAnggota.AsNoTracking()
            .Where(a => a.IdKaryawan == pegawai.ID_KARYAWAN)
            .Select(a => a.RefId)
            .ToListAsync();
        var memberIds = memberRefIds
            .Select(r => decimal.TryParse(r, out var d) ? d : (decimal?)null)
            .Where(d => d.HasValue)
            .Select(d => d!.Value)
            .ToList();

        var rows = await _db.WebSdmUmdl
            .Where(u => u.ID_USER == pegawai.ID_KARYAWAN || memberIds.Contains(u.ID))
            .OrderByDescending(u => u.ID)
            .ToListAsync();

        // Kode izin asalnya ikut ditampilkan, seperti di EASy. Baris lama dari GCSNET
        // membawa ID_IJIN = 0, jadi kolom itu memang kosong untuk mereka.
        var idIjin = rows.Select(r => r.ID_IJIN).Where(id => id > 0).Distinct().ToList();
        var kodeIjin = await _db.WebSdmSuratIjin
            .Where(i => idIjin.Contains(i.id))
            .ToDictionaryAsync(i => i.id, i => i.kode_ijin);

        // Bukti dinas (rentang km + foto) hidup di db_mygcs (dinas.bukti), bukan di baris
        // legacy ini - dimuat sekaligus per (jenis="UMDL", refId) supaya tak N+1 query.
        var refIds = rows.Select(r => r.ID.ToString()).ToList();
        var buktiByRefId = await _bukti.CariBanyakAsync("UMDL", refIds);

        // Ketua/anggota (dinas.umdl_anggota), sekaligus utk seluruh baris.
        var anggota = await _appDb.UmdlAnggota.AsNoTracking()
            .Where(a => refIds.Contains(a.RefId))
            .OrderBy(a => a.Id)
            .ToListAsync();
        var anggotaNiks = anggota.Select(a => a.IdKaryawan).Distinct().ToList();
        var namaAnggota = await _db.PegawaiSdm
            .Where(p => anggotaNiks.Contains(p.Nik))
            .ToDictionaryAsync(p => p.Nik, p => p.nama);

        // Status persetujuan MANAGER real-time (approval.pengajuan) - lihat catatan di
        // UmdlDto.StatusPersetujuan.
        var approvalByRefId = await _appDb.ApprovalPengajuan.AsNoTracking()
            .Where(a => a.Jenis == "UMDL" && refIds.Contains(a.RefId))
            .ToDictionaryAsync(a => a.RefId);

        var items = rows.Select(u =>
        {
            buktiByRefId.TryGetValue(u.ID.ToString(), out var b);
            approvalByRefId.TryGetValue(u.ID.ToString(), out var appr);

            var pesertaUmdl = anggota
                .Where(a => a.RefId == u.ID.ToString())
                .OrderBy(a => a.Posisi == "Ketua" ? 0 : 1)
                .ThenBy(a => a.Id)
                .Select(a => new UmdlDetailDto(a.Id, a.IdKaryawan, namaAnggota.GetValueOrDefault(a.IdKaryawan), a.Posisi))
                .ToList();

            var peranSaya = u.ID_USER == pegawai.ID_KARYAWAN
                ? "Pembuat"
                : pesertaUmdl.FirstOrDefault(p => p.Nik == pegawai.ID_KARYAWAN)?.Posisi ?? "Anggota";

            return new UmdlDto(
                (long)u.ID,
                u.KODE_UMDL,
                u.STATUS,
                u.TGL_UMDL,
                u.KETERANGAN,
                u.ID_IJIN > 0 ? kodeIjin.GetValueOrDefault(u.ID_IJIN) : null,
                u.SOURCE,
                b?.RentangKm,
                b is null ? null : $"/api/personal/dinas/foto/UMDL/{u.ID}",
                pesertaUmdl,
                peranSaya,
                appr?.Status,
                appr?.TglKeputusan);
        }).ToList();

        return Ok(new UmdlListDto(items));
    }

    // Isi modal "Cari Data SURAT IJIN": izin milik sendiri yang berhak atas uang makan dan
    // belum pernah dipakai untuk UMDL lain.
    [HttpGet("izin")]
    public async Task<ActionResult<IReadOnlyList<IjinUmdlDto>>> CariIjin()
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        var sudahDipakai = _db.WebSdmUmdl
            .Where(u => u.ID_IJIN > 0)
            .Select(u => u.ID_IJIN);

        var hasil = await _db.WebSdmSuratIjin
            .Where(i => i.id_user == pegawai.ID_KARYAWAN
                && i.jenis_ijin == JenisIjinBerhak
                && i.kepentingan_ijin == KepentinganBerhak
                && !sudahDipakai.Contains(i.id))
            .OrderByDescending(i => i.tgl_ijin)
            .Select(i => new IjinUmdlDto(
                (long)i.id,
                i.kode_ijin,
                i.tgl_ijin,
                i.tgl_ijin_sd ?? i.tgl_ijin,
                i.jenis_ijin,
                i.kepentingan_ijin,
                i.keterangan))
            .ToListAsync();

        return Ok(hasil);
    }

    [HttpPost]
    public async Task<ActionResult<UmdlDto>> Create(UmdlRequest request)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        var izin = await _db.WebSdmSuratIjin
            .FirstOrDefaultAsync(i => i.id == request.IdIjin && i.id_user == pegawai.ID_KARYAWAN);
        if (izin is null)
        {
            return NotFound(new { message = "Surat izin tidak ditemukan." });
        }

        // Syaratnya diperiksa ulang di sini, bukan hanya di daftar pencarian: daftar itu cuma
        // memudahkan memilih, sementara ini yang benar-benar menentukan hak uang makan.
        if (izin.jenis_ijin != JenisIjinBerhak || izin.kepentingan_ijin != KepentinganBerhak)
        {
            return BadRequest(new
            {
                message = "UMDL hanya bisa diajukan dari izin jenis \"Meninggalkan Pekerjaan\" dengan kepentingan \"Dinas\"."
            });
        }

        if (await _db.WebSdmUmdl.AnyAsync(u => u.ID_IJIN == izin.id))
        {
            return BadRequest(new { message = "Surat izin tersebut sudah dipakai untuk UMDL lain." });
        }

        // Rentang km + foto bukti divalidasi SEBELUM baris legacy dibuat (fail-fast) -
        // GCS dan db_mygcs adalah database terpisah, tidak ada transaksi lintas-DB, jadi
        // kesalahan yang bisa dicegah lebih awal HARUS dicegah sebelum baris legacy tercatat.
        if (!_bukti.RentangValidUntuk("UMDL", request.RentangKm))
        {
            return BadRequest(new { message = _bukti.PesanRentangSalah("UMDL") });
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

        var umdl = new WebSdmUmdl
        {
            KODE_UMDL = await GenerateKodeAsync(request.TglUmdl),
            TGL_INPUT = DateTime.Now,
            TGL_UMDL = request.TglUmdl.ToDateTime(TimeOnly.MinValue),
            KETERANGAN = request.Keterangan?.Trim(),
            STATUS = StatusDibuat,
            SOURCE = SourceWebEasy,
            ID_USER = pegawai.ID_KARYAWAN,
            // Legacy: kolom ini tetap 'Users' di seluruh baris EASy, jadi ikut apa adanya.
            ID_PENGGUNA = "Users",
            ID_IJIN = izin.id,
            masa_atasan = atasan,
        };

        _db.WebSdmUmdl.Add(umdl);
        await _db.SaveChangesAsync();

        var (buktiOk, buktiError) = await _bukti.SimpanAsync(
            "UMDL", umdl.ID.ToString(), pegawai.ID_KARYAWAN, request.RentangKm,
            request.Foto, request.Lat, request.Lng, request.Accuracy);
        if (!buktiOk)
        {
            // Baris UMDL legacy SUDAH tercatat (GCS & db_mygcs beda database, tak ada
            // transaksi lintas-DB) - kegagalan di sini paling sering I/O disk, sangat jarang
            // krn rentang km & foto sudah divalidasi di atas sebelum baris legacy dibuat.
            return StatusCode(StatusCodes.Status500InternalServerError, new
            {
                message = $"UMDL tersimpan, tapi bukti dinas gagal disimpan: {buktiError} Hubungi IT, lalu coba Ubah UMDL ini untuk mengunggah ulang bukti."
            });
        }

        var ringkasan = $"UMDL · {request.TglUmdl:dd MMM yyyy}"
            + (string.IsNullOrWhiteSpace(request.Keterangan) ? string.Empty : $": {request.Keterangan.Trim()}");
        await _approval.CreateAsync("UMDL", umdl.ID.ToString(), pegawai.ID_KARYAWAN, pegawai.NAMA_LENGKAP, ringkasan);

        return Ok(new UmdlDto(
            (long)umdl.ID,
            umdl.KODE_UMDL,
            umdl.STATUS,
            umdl.TGL_UMDL,
            umdl.KETERANGAN,
            izin.kode_ijin,
            umdl.SOURCE,
            request.RentangKm,
            $"/api/personal/dinas/foto/UMDL/{umdl.ID}"));
    }

    [HttpPut("{id:long}")]
    public async Task<IActionResult> Update(long id, UmdlRequest request)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        var umdl = await FindOwnEditableAsync(id, pegawai.ID_KARYAWAN);
        if (umdl is null)
        {
            return NotFound(new { message = "UMDL tidak ditemukan atau sudah diproses sehingga tidak bisa diubah." });
        }

        if (!_bukti.RentangValidUntuk("UMDL", request.RentangKm))
        {
            return BadRequest(new { message = _bukti.PesanRentangSalah("UMDL") });
        }

        // Surat izin asalnya tidak bisa dipindah - itu yang menentukan hak uang makannya.
        umdl.TGL_UMDL = request.TglUmdl.ToDateTime(TimeOnly.MinValue);
        umdl.KETERANGAN = request.Keterangan?.Trim();

        await _db.SaveChangesAsync();

        // Foto kosong = pertahankan foto lama (SimpanAsync sudah menangani ini).
        var (buktiOk, buktiError) = await _bukti.SimpanAsync(
            "UMDL", umdl.ID.ToString(), pegawai.ID_KARYAWAN, request.RentangKm,
            request.Foto, request.Lat, request.Lng, request.Accuracy);
        if (!buktiOk)
        {
            return BadRequest(new { message = buktiError });
        }

        return NoContent();
    }

    [HttpDelete("{id:long}")]
    public async Task<IActionResult> Delete(long id)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        var umdl = await FindOwnEditableAsync(id, pegawai.ID_KARYAWAN);
        if (umdl is null)
        {
            return NotFound(new { message = "UMDL tidak ditemukan atau sudah diproses sehingga tidak bisa dihapus." });
        }

        _db.WebSdmUmdl.Remove(umdl);
        await _db.SaveChangesAsync();
        await _bukti.HapusAsync("UMDL", id.ToString());
        await RemoveAnggotaAsync(id.ToString());
        return NoContent();
    }

    // --- Peserta (dinas.umdl_anggota) - mirror SppdController, diminta 2026-08-24 ---

    [HttpGet("{id:long}/detail")]
    public async Task<ActionResult<IReadOnlyList<UmdlDetailDto>>> GetDetail(long id)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        if (!await OwnsAsync(id, pegawai.ID_KARYAWAN))
        {
            return NotFound(new { message = "UMDL tidak ditemukan." });
        }

        return Ok(await LoadDetailAsync(id));
    }

    [HttpPost("{id:long}/detail")]
    public async Task<ActionResult<UmdlDetailDto>> AddDetail(long id, UmdlDetailRequest request)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        var umdl = await FindOwnEditableAsync(id, pegawai.ID_KARYAWAN);
        if (umdl is null)
        {
            return NotFound(new { message = "UMDL tidak ditemukan atau sudah diproses." });
        }

        if (!AllowedPosisi.Contains(request.Posisi))
        {
            return BadRequest(new { message = "Posisi harus Ketua atau Anggota." });
        }

        var orang = await _db.PegawaiSdm.FirstOrDefaultAsync(p => p.Nik == request.Nik);
        if (orang is null)
        {
            return BadRequest(new { message = "Pegawai tidak ditemukan." });
        }

        var refId = id.ToString();
        if (await _appDb.UmdlAnggota.AnyAsync(a => a.RefId == refId && a.IdKaryawan == request.Nik))
        {
            return BadRequest(new { message = "Pegawai tersebut sudah ada dalam UMDL ini." });
        }

        // Hanya satu Ketua per UMDL - Ketua lama diturunkan jadi Anggota (mirror trigger
        // web_sdm_sppd_detail_triu di SPPD, di sini dilakukan di kode krn tabelnya baru).
        if (request.Posisi == "Ketua")
        {
            var ketuaLama = await _appDb.UmdlAnggota.Where(a => a.RefId == refId && a.Posisi == "Ketua").ToListAsync();
            foreach (var k in ketuaLama) k.Posisi = "Anggota";
        }

        var detail = new UmdlAnggota
        {
            RefId = refId,
            IdKaryawan = orang.Nik,
            Posisi = request.Posisi,
            DibuatPada = DateTime.UtcNow,
        };

        _appDb.UmdlAnggota.Add(detail);
        await _appDb.SaveChangesAsync();

        return Ok(new UmdlDetailDto(detail.Id, detail.IdKaryawan, orang.nama, detail.Posisi));
    }

    // Pegawainya tidak bisa diganti, sama spt SPPD - hanya posisi yang bisa diubah.
    [HttpPut("{id:long}/detail/{idDet:int}")]
    public async Task<IActionResult> UpdateDetail(long id, int idDet, UmdlDetailRequest request)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        var umdl = await FindOwnEditableAsync(id, pegawai.ID_KARYAWAN);
        if (umdl is null)
        {
            return NotFound(new { message = "UMDL tidak ditemukan atau sudah diproses." });
        }

        if (!AllowedPosisi.Contains(request.Posisi))
        {
            return BadRequest(new { message = "Posisi harus Ketua atau Anggota." });
        }

        var refId = id.ToString();
        var detail = await _appDb.UmdlAnggota.AsTracking().FirstOrDefaultAsync(a => a.Id == idDet && a.RefId == refId);
        if (detail is null)
        {
            return NotFound(new { message = "Peserta tidak ditemukan." });
        }

        if (request.Posisi == "Ketua")
        {
            var ketuaLama = await _appDb.UmdlAnggota
                .Where(a => a.RefId == refId && a.Posisi == "Ketua" && a.Id != idDet)
                .ToListAsync();
            foreach (var k in ketuaLama) k.Posisi = "Anggota";
        }

        detail.Posisi = request.Posisi;
        await _appDb.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:long}/detail/{idDet:int}")]
    public async Task<IActionResult> DeleteDetail(long id, int idDet)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        var umdl = await FindOwnEditableAsync(id, pegawai.ID_KARYAWAN);
        if (umdl is null)
        {
            return NotFound(new { message = "UMDL tidak ditemukan atau sudah diproses." });
        }

        var refId = id.ToString();
        var detail = await _appDb.UmdlAnggota.AsTracking().FirstOrDefaultAsync(a => a.Id == idDet && a.RefId == refId);
        if (detail is null)
        {
            return NotFound(new { message = "Peserta tidak ditemukan." });
        }

        _appDb.UmdlAnggota.Remove(detail);
        await _appDb.SaveChangesAsync();
        return NoContent();
    }

    // Employee picker behind "Cari Data Pegawai" - mirror SppdController.CariPegawai, scoped
    // ke departemen sendiri.
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
            return Ok(Array.Empty<PegawaiPickerDto>());
        }

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

    private async Task<List<UmdlDetailDto>> LoadDetailAsync(long id)
    {
        var refId = id.ToString();
        var details = await _appDb.UmdlAnggota.AsNoTracking()
            .Where(a => a.RefId == refId)
            .OrderBy(a => a.Posisi == "Ketua" ? 0 : 1)
            .ThenBy(a => a.Id)
            .ToListAsync();

        var niks = details.Select(d => d.IdKaryawan).ToList();
        var nama = await _db.PegawaiSdm.Where(p => niks.Contains(p.Nik)).ToDictionaryAsync(p => p.Nik, p => p.nama);

        return details.Select(d => new UmdlDetailDto(d.Id, d.IdKaryawan, nama.GetValueOrDefault(d.IdKaryawan), d.Posisi)).ToList();
    }

    // Boleh LIHAT (bukan ubah): pembuat ATAU peserta (Ketua/Anggota) - diminta 2026-08-24,
    // mirror SppdController. Ubah/Hapus tetap FindOwnEditableAsync (pembuat saja).
    private async Task<bool> OwnsAsync(long id, string idKaryawan)
    {
        if (await _db.WebSdmUmdl.AnyAsync(u => u.ID == id && u.ID_USER == idKaryawan)) return true;
        var refId = id.ToString();
        return await _appDb.UmdlAnggota.AnyAsync(a => a.RefId == refId && a.IdKaryawan == idKaryawan);
    }

    private async Task RemoveAnggotaAsync(string refId)
    {
        var rows = await _appDb.UmdlAnggota.AsTracking().Where(a => a.RefId == refId).ToListAsync();
        if (rows.Count == 0) return;
        _appDb.UmdlAnggota.RemoveRange(rows);
        await _appDb.SaveChangesAsync();
    }

    // Pembuat ATAU peserta (Ketua/Anggota) boleh Ubah/Hapus, SELAMA belum diproses (status
    // masih "Di Buat") - diperluas dari pembuat-saja per permintaan 2026-08-24.
    private async Task<WebSdmUmdl?> FindOwnEditableAsync(long id, string idKaryawan)
    {
        var umdl = await _db.WebSdmUmdl.AsTracking().FirstOrDefaultAsync(u => u.ID == id && u.STATUS == StatusDibuat);
        if (umdl is null) return null;
        if (umdl.ID_USER == idKaryawan) return umdl;
        var refId = id.ToString();
        var ikutSerta = await _appDb.UmdlAnggota.AnyAsync(a => a.RefId == refId && a.IdKaryawan == idKaryawan);
        return ikutSerta ? umdl : null;
    }

    private async Task<string?> ResolveAtasanAsync(string idKaryawan) =>
        await _db.SdmApproval
            .Where(a => a.KodePegawai == idKaryawan && a.KodeAtasan != null)
            .OrderBy(a => a.Urut)
            .Select(a => a.KodeAtasan)
            .FirstOrDefaultAsync();

    private async Task<string> GenerateKodeAsync(DateOnly tglUmdl)
    {
        var prefix = $"{KodePrefix}{tglUmdl:yyMM}";

        for (var attempt = 0; attempt < 10; attempt++)
        {
            var kode = prefix + RandomNumberGenerator.GetString(KodeAlphabet, 9);
            if (!await _db.WebSdmUmdl.AnyAsync(u => u.KODE_UMDL == kode))
            {
                return kode;
            }
        }

        throw new InvalidOperationException("Gagal membuat kode UMDL yang unik.");
    }
}

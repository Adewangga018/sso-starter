using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SsoBackend.Data;
using SsoBackend.Models.Dto;
using SsoBackend.Models.Grading;

namespace SsoBackend.Services;

// Riwayat versi Struktur Organisasi terikat SK direksi (diminta 2026-08-24; status
// Draft/Berlaku ditambahkan sehari kemudian sesuai masukan manager - SK bisa dilampirkan
// dulu sbg draft sebelum resmi berlaku). grading.unit_organisasi/jabatan/penempatan/
// pejabat_sementara TETAP diedit spt biasa lewat OrgStrukturService (alur "edit dulu,
// terbitkan versi belakangan" - dikonfirmasi user, bukan staging area terpisah).
//
// Alur 2 langkah:
//   1) BuatDraftAsync   - admin melampirkan SK + pilih Minor/Major. Nomor versi
//                         DICADANGKAN saat ini, TAPI snapshot belum diambil (SnapshotJson
//                         null) - draft belum mengikat apa pun, live data masih bisa berubah.
//   2) BerlakukanVersiAsync - admin menekan "Berlakukan" saat draft ini SIAP resmi jadi
//                         versi berjalan. BARU PADA SAAT INI snapshot LIVE dibekukan &
//                         versi Berlaku lama dipindah ke Usang. Snapshot diambil di titik
//                         waktu ini (bukan saat draft dibuat) supaya selalu mencerminkan
//                         kondisi live TERBARU, meski ada edit lanjutan setelah draft dibuat.
// Minor/Major DIPILIH ADMIN (bukan dideteksi otomatis - SK dokumen legal, admin yang
// paling tahu levelnya).
public class OrgVersiService
{
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    private readonly ApplicationDbContext _db;

    public OrgVersiService(ApplicationDbContext db)
    {
        _db = db;
    }

    // Baseline v1.0 di-seed lazy (sama pola dgn CutiService.AkrualJikaSiklusBaruAsync /
    // OrgStrukturService.NaikkanPgOtomatisJikaSaatnyaAsync) - server dev SQL Server 2014
    // (compat 120) tidak mendukung T-SQL FOR JSON, jadi snapshot dibangun System.Text.Json
    // di C# (portable di semua versi SQL Server), bukan di skrip DDL.
    private async Task PastikanBaselineAsync()
    {
        if (await _db.GradingOrgVersi.AsNoTracking().AnyAsync()) return;
        var snapshot = await BangunSnapshotAsync();
        _db.GradingOrgVersi.Add(new GradingOrgVersi
        {
            VersiMajor = 1,
            VersiMinor = 0,
            Jenis = "Major",
            Ringkasan = "Versi awal (baseline sebelum sistem penerbitan SK diterapkan)",
            SnapshotJson = JsonSerializer.Serialize(snapshot),
            Status = "Berlaku",
        });
        try { await _db.SaveChangesAsync(); }
        catch (DbUpdateException)
        {
            // Race: proses lain sudah men-seed baseline duluan - abaikan, bukan error.
        }
    }

    private async Task<OrgSnapshot> BangunSnapshotAsync()
    {
        var unit = await _db.GradingUnitOrganisasi.AsNoTracking()
            .Select(u => new OrgSnapshotUnit
            {
                IdUnit = u.IdUnit, Nama = u.Nama, Tipe = u.Tipe, IdUnitInduk = u.IdUnitInduk,
                Wilayah = u.Wilayah, Keterangan = u.Keterangan,
            }).ToListAsync();
        var jabatan = await _db.GradingJabatan.AsNoTracking()
            .Select(j => new OrgSnapshotJabatan
            {
                IdJabatan = j.IdJabatan, Kode = j.Kode, NamaJabatan = j.NamaJabatan, IdBand = j.IdBand,
                Jg = j.Jg, IdUnit = j.IdUnit, IdAtasan = j.IdAtasan, Inti = j.Inti,
                KelompokFungsi = j.KelompokFungsi, JumlahFormasi = j.JumlahFormasi, Aktif = j.Aktif,
            }).ToListAsync();
        var penempatan = await _db.GradingPenempatan.AsNoTracking()
            .Where(p => p.Status == "Aktif")
            .Select(p => new OrgSnapshotPenempatan
            {
                Id = p.Id, IdJabatan = p.IdJabatan, IdKaryawan = p.IdKaryawan, Nama = p.Nama, Tmt = p.Tmt,
            }).ToListAsync();
        var pts = await _db.GradingPejabatSementara.AsNoTracking()
            .Where(p => p.Status == "Aktif")
            .Select(p => new OrgSnapshotPts
            {
                Id = p.Id, IdKaryawan = p.IdKaryawan, IdJabatanPengganti = p.IdJabatanPengganti, Tmt = p.Tmt,
            }).ToListAsync();
        return new OrgSnapshot { Unit = unit, Jabatan = jabatan, Penempatan = penempatan, Pts = pts };
    }

    private static string Label(int major, int minor) => $"v{major}.{minor}";

    public async Task<IReadOnlyList<OrgVersiRingkasDto>> ListVersiAsync()
    {
        await PastikanBaselineAsync();
        var rows = await _db.GradingOrgVersi.AsNoTracking()
            .OrderByDescending(v => v.VersiMajor).ThenByDescending(v => v.VersiMinor)
            .ToListAsync();
        return rows.Select(v => new OrgVersiRingkasDto(
            v.Id, v.VersiMajor, v.VersiMinor, Label(v.VersiMajor, v.VersiMinor), v.Jenis,
            v.NomorSk, v.TanggalSk, v.Ringkasan, v.Status,
            v.KontenSk is { Length: > 0 }, v.NamaFileSk, v.DiterbitkanOleh, v.NamaPenerbit,
            v.DiterbitkanPada, v.Status == "Berlaku")).ToList();
    }

    public async Task<OrgVersiRingkasDto?> GetVersiBerlakuAsync()
    {
        await PastikanBaselineAsync();
        var v = await _db.GradingOrgVersi.AsNoTracking()
            .Where(x => x.Status == "Berlaku")
            .OrderByDescending(x => x.VersiMajor).ThenByDescending(x => x.VersiMinor)
            .FirstOrDefaultAsync();
        if (v is null) return null;
        return new OrgVersiRingkasDto(
            v.Id, v.VersiMajor, v.VersiMinor, Label(v.VersiMajor, v.VersiMinor), v.Jenis,
            v.NomorSk, v.TanggalSk, v.Ringkasan, v.Status,
            v.KontenSk is { Length: > 0 }, v.NamaFileSk, v.DiterbitkanOleh, v.NamaPenerbit,
            v.DiterbitkanPada, true);
    }

    public async Task<OrgVersiSnapshotDto?> GetSnapshotAsync(int versiId)
    {
        var v = await _db.GradingOrgVersi.AsNoTracking().FirstOrDefaultAsync(x => x.Id == versiId);
        if (v?.SnapshotJson is null) return null;   // masih Draft, belum dibekukan
        var snap = JsonSerializer.Deserialize<OrgSnapshot>(v.SnapshotJson, JsonOpts) ?? new OrgSnapshot();
        var band = await _db.GradingBand.AsNoTracking()
            .Select(b => new OrgVersiBandDto(b.IdBand, b.Kode, b.Nama)).ToListAsync();
        return new OrgVersiSnapshotDto(
            v.Id, Label(v.VersiMajor, v.VersiMinor), v.Jenis, v.DiterbitkanPada, v.Ringkasan,
            band, snap.Unit, snap.Jabatan, snap.Penempatan, snap.Pts);
    }

    public async Task<(byte[] Konten, string? Tipe, string Nama)?> GetFileSkAsync(int versiId)
    {
        var v = await _db.GradingOrgVersi.AsNoTracking()
            .Where(x => x.Id == versiId)
            .Select(x => new { x.KontenSk, x.TipeFileSk, x.NamaFileSk })
            .FirstOrDefaultAsync();
        if (v?.KontenSk is not { Length: > 0 }) return null;
        return (v.KontenSk, v.TipeFileSk, v.NamaFileSk ?? "SK.pdf");
    }

    // Langkah 1: lampirkan SK sbg draft. Mencadangkan nomor versi (Minor = minor+1, Major =
    // major+1 & minor direset 0) TAPI belum membekukan snapshot apa pun - live data masih
    // bebas diedit sampai admin menekan "Berlakukan".
    public async Task<(bool Ok, string? Error, int? Id)> BuatDraftAsync(
        TerbitkanVersiRequest req, byte[] konten, string namaFile, string? tipeFile,
        string? nik, string? nama)
    {
        if (req.Jenis is not ("Minor" or "Major")) return (false, "Jenis versi harus Minor atau Major.", null);
        if (konten.Length == 0) return (false, "Berkas SK wajib diunggah.", null);

        await PastikanBaselineAsync();
        var terakhir = await _db.GradingOrgVersi.AsNoTracking()
            .OrderByDescending(v => v.VersiMajor).ThenByDescending(v => v.VersiMinor)
            .FirstAsync();

        int major = terakhir.VersiMajor;
        int minor = terakhir.VersiMinor;
        if (req.Jenis == "Major") { major += 1; minor = 0; }
        else { minor += 1; }

        var draft = new GradingOrgVersi
        {
            VersiMajor = major,
            VersiMinor = minor,
            Jenis = req.Jenis,
            NomorSk = string.IsNullOrWhiteSpace(req.NomorSk) ? null : req.NomorSk.Trim(),
            TanggalSk = req.TanggalSk,
            Ringkasan = string.IsNullOrWhiteSpace(req.Ringkasan) ? null : req.Ringkasan.Trim(),
            NamaFileSk = namaFile,
            TipeFileSk = tipeFile,
            KontenSk = konten,
            SnapshotJson = null,
            Status = "Draft",
            DiterbitkanOleh = nik,
            NamaPenerbit = nama,
        };
        _db.GradingOrgVersi.Add(draft);
        await _db.SaveChangesAsync();
        return (true, null, draft.Id);
    }

    // Langkah 2: resmikan sebuah draft jadi versi Berlaku - BARU DI SINI snapshot LIVE
    // dibekukan (mencerminkan kondisi TERKINI, bukan kondisi saat draft dibuat), dan versi
    // Berlaku lama (jika ada) dipindah ke Usang. Sekali dibekukan, tidak bisa diubah lagi.
    public async Task<(bool Ok, string? Error)> BerlakukanVersiAsync(int versiId)
    {
        var v = await _db.GradingOrgVersi.FirstOrDefaultAsync(x => x.Id == versiId);
        if (v is null) return (false, "Versi tidak ditemukan.");
        if (v.Status != "Draft") return (false, "Hanya versi berstatus Draft yang bisa diberlakukan.");

        var berlakuLama = await _db.GradingOrgVersi.Where(x => x.Status == "Berlaku").ToListAsync();
        foreach (var lama in berlakuLama) lama.Status = "Usang";

        v.SnapshotJson = JsonSerializer.Serialize(await BangunSnapshotAsync());
        v.Status = "Berlaku";
        await _db.SaveChangesAsync();
        return (true, null);
    }

    // Buang draft yang batal dipakai (mis. salah unggah SK). Hanya boleh draft (belum
    // pernah dibekukan) - versi Berlaku/Usang TIDAK boleh dihapus, itu riwayat resmi.
    public async Task<(bool Ok, string? Error)> HapusDraftAsync(int versiId)
    {
        var v = await _db.GradingOrgVersi.FirstOrDefaultAsync(x => x.Id == versiId);
        if (v is null) return (false, "Versi tidak ditemukan.");
        if (v.Status != "Draft") return (false, "Hanya draft yang bisa dihapus.");
        _db.GradingOrgVersi.Remove(v);
        await _db.SaveChangesAsync();
        return (true, null);
    }
}

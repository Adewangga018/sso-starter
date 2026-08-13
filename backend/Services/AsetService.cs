using Microsoft.EntityFrameworkCore;
using SsoBackend.Data;
using SsoBackend.Models.Dto;
using AsetEntity = SsoBackend.Models.Aset.Aset;
using MaintEntity = SsoBackend.Models.Aset.AsetMaintenance;
using TidakProduktifEntity = SsoBackend.Models.Aset.AsetTidakProduktif;
using AktivitasEntity = SsoBackend.Models.Aset.AsetTidakProduktifAktivitas;
using SsoBackend.Models.Gcs;

namespace SsoBackend.Services;

// My Asset. Inventaris + jadwal maintenance. Semua karyawan dapat MELIHAT inventaris
// & jadwal; hanya Admin Aset (Departemen Kepatuhan Kabag ke atas s/d GM SKP) yang
// boleh input/ubah/hapus.
//
// CATATAN ARSITEKTUR (Aug 2026): Inventaris sekarang sumber datanya GCS.dbo.assets
// (modul Aktiva Tetap ERP), BUKAN lagi aset.aset - lihat GetErpListAsync/GetErpDetailAsync
// di bawah & Models/Gcs/AsetErp.cs. aset.aset & method Get/Create/Update/DeleteAsync di
// bawah SENGAJA dibiarkan (tidak dihapus, tidak dipanggil controller lagi) sesuai
// keputusan: tabel db_mygcs yang sudah ada tidak diubah/dimigrasikan.
public class AsetService
{
    private readonly ApplicationDbContext _db;
    private readonly GcsDbContext _gcs;
    private readonly ModuleAccessService _access;

    public AsetService(ApplicationDbContext db, GcsDbContext gcs, ModuleAccessService access)
    {
        _db = db;
        _gcs = gcs;
        _access = access;
    }

    // ---- Inventaris (ERP, read-only) ----
    public async Task<AsetErpListDto> GetErpListAsync(string? q)
    {
        // nomor_internal hidup di db_mygcs (bukan ERP), jadi tidak bisa masuk 1 query SQL
        // dengan tabel dbo.assets - dicari duluan di sini, lalu OBJECTID yang cocok
        // digabung ke filter ERP-nya sebagai OR.
        var nomorInternal = await _db.AsetNomorInternal.AsNoTracking()
            .ToDictionaryAsync(x => x.ObjectId, x => x.NomorAset);

        var query = _gcs.AsetErp.AsQueryable();
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            var matchNomorInternal = nomorInternal
                .Where(kv => kv.Value.Contains(term, StringComparison.OrdinalIgnoreCase))
                .Select(kv => kv.Key).ToList();
            query = query.Where(a => (a.DESC_OBJECT != null && a.DESC_OBJECT.Contains(term))
                || a.OBJECTID.Contains(term)
                || (a.LOKASI != null && a.LOKASI.Contains(term))
                || (a.NOPOL != null && a.NOPOL.Contains(term))
                || matchNomorInternal.Contains(a.OBJECTID));
        }
        var rows = await query.OrderByDescending(a => a.LAST_UPDATED).ToListAsync();
        var (groups, kelompok, cc) = await ErpLookupsAsync();
        var picAktif = await PicAktifMapAsync();

        var items = rows.Select(a => MapErp(a, groups, kelompok, cc, nomorInternal, picAktif)).ToList();
        return new AsetErpListDto(items, items.Count);
    }

    public async Task<AsetErpDto?> GetErpDetailAsync(string objectId)
    {
        var a = await _gcs.AsetErp.FirstOrDefaultAsync(x => x.OBJECTID == objectId);
        if (a is null) return null;
        var (groups, kelompok, cc) = await ErpLookupsAsync();
        var nomor = await _db.AsetNomorInternal.AsNoTracking().FirstOrDefaultAsync(x => x.ObjectId == objectId);
        var nomorInternal = nomor is null ? new Dictionary<string, string>() : new Dictionary<string, string> { [objectId] = nomor.NomorAset };
        var picAktif = await PicAktifMapAsync();
        return MapErp(a, groups, kelompok, cc, nomorInternal, picAktif);
    }

    // objectid -> nama PIC aktif saat ini (orang atau bagian), untuk kolom/filter PIC di Inventaris.
    private async Task<Dictionary<string, string>> PicAktifMapAsync()
    {
        var rows = await _db.AsetPicAssignment.AsNoTracking()
            .Where(x => x.Status == "Aktif")
            .ToListAsync();
        return rows.ToDictionary(x => x.ObjectId, x => x.JenisPic == "Bagian" ? (x.NamaUnit ?? "") : (x.NamaPic ?? ""));
    }

    // dbo.assets.GROUP_ASSET/KELOMPOK/KODE_CC (varchar) TIDAK konsisten padding-nya - sebagian
    // baris polos ("A0501"), sebagian dipad spasi ("A0501     "). SQL Server menganggap
    // keduanya setara saat JOIN (trailing-space insensitive), tapi Dictionary<string,string>
    // C# tidak - makanya key & lookup-nya WAJIB di-Trim() dulu di kedua sisi.
    private async Task<(Dictionary<string, string> Groups, Dictionary<string, string> Kelompok, Dictionary<string, string> Cc)> ErpLookupsAsync()
    {
        var groupRows = await _gcs.AsetErpGroup.ToListAsync();
        var groups = groupRows.ToDictionary(g => g.GROUP_ASSET.Trim(), g => (g.ASSETS_DESC ?? g.GROUP_ASSET).Trim());
        var kelompokRows = await _gcs.AsetErpKelompok.ToListAsync();
        var kelompok = kelompokRows.ToDictionary(k => k.KELOMPOK.Trim(), k => (k.NAMA_KELOMPOK ?? k.KELOMPOK).Trim());
        var ccRows = await _gcs.AsetErpCc.ToListAsync();
        var cc = ccRows.Where(c => !string.IsNullOrWhiteSpace(c.WILAYAH))
            .ToDictionary(c => c.KODE_CC.Trim(), c => c.WILAYAH!.Trim());
        return (groups, kelompok, cc);
    }

    // Lokasi ditampilkan = WILAYAH dari dbo.akun_account_cc (join lewat KODE_CC), bukan
    // dbo.assets.LOKASI mentah - lebih deskriptif (mis. "Wilayah Produksi Malang" vs "Malang").
    // Fallback ke LOKASI mentah kalau KODE_CC tidak ketemu di lookup.
    private static AsetErpDto MapErp(AsetErp a, Dictionary<string, string> groups, Dictionary<string, string> kelompok, Dictionary<string, string> cc, Dictionary<string, string> nomorInternal, Dictionary<string, string> picAktif) => new(
        a.OBJECTID,
        nomorInternal.GetValueOrDefault(a.OBJECTID),
        a.DESC_OBJECT?.Trim(),
        a.GROUP_ASSET != null ? groups.GetValueOrDefault(a.GROUP_ASSET.Trim(), a.GROUP_ASSET.Trim()) : null,
        a.GROUP_ASSET?.Trim(),
        a.KELOMPOK != null ? kelompok.GetValueOrDefault(a.KELOMPOK.Trim(), a.KELOMPOK.Trim()) : null,
        a.KODE_CC != null && cc.TryGetValue(a.KODE_CC.Trim(), out var wilayah) ? wilayah : a.LOKASI?.Trim(),
        a.NOPOL?.Trim(),
        a.STATUS?.Trim(),
        a.AKTIF?.Trim(),
        a.QTY,
        a.SATUAN?.Trim(),
        a.NILAI_PEROLEHAN,
        a.NILAI_BUKU,
        a.TANGGAL.HasValue ? DateOnly.FromDateTime(a.TANGGAL.Value) : null,
        a.MASA,
        picAktif.TryGetValue(a.OBJECTID, out var pic) && !string.IsNullOrWhiteSpace(pic) ? pic : null,
        a.NOTE?.Trim());

    // ---- di bawah ini: aset.aset lama (db_mygcs) - lihat catatan arsitektur di atas ----
    public async Task<AsetListDto> GetListAsync(string nik, string? q)
    {
        var query = _db.Aset.AsNoTracking().Where(a => a.Status != "Dihapus");
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            query = query.Where(a => a.Nama.Contains(term) || a.Kode.Contains(term)
                || (a.Kategori != null && a.Kategori.Contains(term))
                || (a.NamaPic != null && a.NamaPic.Contains(term)));
        }
        var rows = await query.OrderBy(a => a.Kode).ToListAsync();

        var next = await NextMaintenanceMapAsync(rows.Select(r => r.Id).ToList());
        var isAdmin = await _access.IsAsetAdminAsync(nik);
        return new AsetListDto(rows.Select(a => Map(a, next.GetValueOrDefault(a.Id))).ToList(), isAdmin);
    }

    public async Task<AsetDetailDto?> GetDetailAsync(string nik, long id)
    {
        var a = await _db.Aset.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (a is null) return null;
        var maint = await _db.AsetMaintenance.AsNoTracking()
            .Where(m => m.IdAset == id)
            .OrderByDescending(m => m.TglJadwal).ThenByDescending(m => m.Id)
            .ToListAsync();
        var next = maint.Where(m => m.Status == "Terjadwal").OrderBy(m => m.TglJadwal).Select(m => (DateOnly?)m.TglJadwal).FirstOrDefault();
        var isAdmin = await _access.IsAsetAdminAsync(nik);
        return new AsetDetailDto(Map(a, next), maint.Select(MapMaint).ToList(), isAdmin);
    }

    // Jadwal maintenance global (semua aset), untuk halaman "Maintenance".
    public async Task<MaintenanceListDto> GetMaintenanceListAsync(string nik)
    {
        var rows = await (from m in _db.AsetMaintenance.AsNoTracking()
                          join a in _db.Aset.AsNoTracking() on m.IdAset equals a.Id
                          orderby m.Status, m.TglJadwal
                          select new MaintenanceRowDto(
                              m.Id, m.IdAset, a.Kode, a.Nama, m.Jenis, m.TglJadwal, m.TglSelesai,
                              m.Status, m.Pelaksana, m.Biaya, m.Catatan)).ToListAsync();
        var isAdmin = await _access.IsAsetAdminAsync(nik);
        return new MaintenanceListDto(rows, isAdmin);
    }

    // ---- mutasi (Admin Aset) ----
    public async Task<(bool Ok, string? Error, long Id)> CreateAsync(string nik, SimpanAsetRequest req)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return (false, ForbidMsg, 0);
        if (string.IsNullOrWhiteSpace(req.Kode)) return (false, "Kode aset wajib diisi.", 0);
        if (string.IsNullOrWhiteSpace(req.Nama)) return (false, "Nama aset wajib diisi.", 0);
        var kode = req.Kode.Trim();
        if (await _db.Aset.AnyAsync(a => a.Kode == kode)) return (false, $"Kode aset '{kode}' sudah dipakai.", 0);

        var a = new AsetEntity
        {
            Kode = kode,
            Nama = req.Nama.Trim(),
            Kategori = Clean(req.Kategori),
            Merk = Clean(req.Merk),
            NomorSeri = Clean(req.NomorSeri),
            Lokasi = Clean(req.Lokasi),
            IdPic = Clean(req.IdPic),
            NamaPic = Clean(req.NamaPic),
            Kondisi = ValidKondisi(req.Kondisi),
            Status = ValidStatus(req.Status),
            Nilai = req.Nilai,
            TglPerolehan = req.TglPerolehan,
            Catatan = Clean(req.Catatan),
            IdPembuat = nik,
            TglDibuat = DateTime.UtcNow,
        };
        _db.Aset.Add(a);
        await _db.SaveChangesAsync();
        return (true, null, a.Id);
    }

    public async Task<(bool Ok, string? Error)> UpdateAsync(string nik, long id, SimpanAsetRequest req)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return (false, ForbidMsg);
        var a = await _db.Aset.FirstOrDefaultAsync(x => x.Id == id);
        if (a is null) return (false, "Aset tidak ditemukan.");
        if (string.IsNullOrWhiteSpace(req.Kode)) return (false, "Kode aset wajib diisi.");
        var kode = req.Kode.Trim();
        if (await _db.Aset.AnyAsync(x => x.Kode == kode && x.Id != id)) return (false, $"Kode aset '{kode}' sudah dipakai.");

        a.Kode = kode;
        a.Nama = req.Nama.Trim();
        a.Kategori = Clean(req.Kategori);
        a.Merk = Clean(req.Merk);
        a.NomorSeri = Clean(req.NomorSeri);
        a.Lokasi = Clean(req.Lokasi);
        a.IdPic = Clean(req.IdPic);
        a.NamaPic = Clean(req.NamaPic);
        a.Kondisi = ValidKondisi(req.Kondisi);
        a.Status = ValidStatus(req.Status);
        a.Nilai = req.Nilai;
        a.TglPerolehan = req.TglPerolehan;
        a.Catatan = Clean(req.Catatan);
        a.TglDiubah = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> DeleteAsync(string nik, long id)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return (false, ForbidMsg);
        var a = await _db.Aset.FirstOrDefaultAsync(x => x.Id == id);
        if (a is null) return (false, "Aset tidak ditemukan.");
        var maint = await _db.AsetMaintenance.Where(m => m.IdAset == id).ToListAsync();
        _db.AsetMaintenance.RemoveRange(maint);
        _db.Aset.Remove(a);
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> AddMaintenanceAsync(string nik, long idAset, SimpanMaintenanceRequest req)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return (false, ForbidMsg);
        if (!await _db.Aset.AnyAsync(a => a.Id == idAset)) return (false, "Aset tidak ditemukan.");
        _db.AsetMaintenance.Add(new MaintEntity
        {
            IdAset = idAset,
            Jenis = ValidJenis(req.Jenis),
            TglJadwal = req.TglJadwal,
            TglSelesai = req.TglSelesai,
            Status = ValidMaintStatus(req.Status),
            Pelaksana = Clean(req.Pelaksana),
            Biaya = req.Biaya,
            Catatan = Clean(req.Catatan),
            IdPembuat = nik,
            TglDibuat = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> UpdateMaintenanceAsync(string nik, long id, SimpanMaintenanceRequest req)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return (false, ForbidMsg);
        var m = await _db.AsetMaintenance.FirstOrDefaultAsync(x => x.Id == id);
        if (m is null) return (false, "Data maintenance tidak ditemukan.");
        m.Jenis = ValidJenis(req.Jenis);
        m.TglJadwal = req.TglJadwal;
        m.TglSelesai = req.TglSelesai;
        m.Status = ValidMaintStatus(req.Status);
        m.Pelaksana = Clean(req.Pelaksana);
        m.Biaya = req.Biaya;
        m.Catatan = Clean(req.Catatan);
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> DeleteMaintenanceAsync(string nik, long id)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return (false, ForbidMsg);
        var m = await _db.AsetMaintenance.FirstOrDefaultAsync(x => x.Id == id);
        if (m is null) return (false, "Data maintenance tidak ditemukan.");
        _db.AsetMaintenance.Remove(m);
        await _db.SaveChangesAsync();
        return (true, null);
    }

    // ---- aset tidak produktif (register terpisah, lihat AsetEntities.cs) ----
    public async Task<AsetTidakProduktifListDto> GetTidakProduktifListAsync(string nik)
    {
        var rows = await _db.AsetTidakProduktif.AsNoTracking()
            .OrderByDescending(x => x.TglDibuat)
            .ToListAsync();
        var isAdmin = await _access.IsAsetAdminAsync(nik);
        return new AsetTidakProduktifListDto(rows.Select(MapTidakProduktif).ToList(), isAdmin);
    }

    public async Task<(bool Ok, string? Error, long Id)> CreateTidakProduktifAsync(string nik, SimpanAsetTidakProduktifRequest req)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return (false, ForbidMsg, 0);
        if (string.IsNullOrWhiteSpace(req.Jenis)) return (false, "Jenis aset wajib diisi.", 0);

        var row = new TidakProduktifEntity
        {
            Jenis = req.Jenis.Trim(),
            Nama = Clean(req.Nama),
            SertifikatHak = Clean(req.SertifikatHak),
            SertifikatJangkaWaktu = req.SertifikatJangkaWaktu,
            SertifikatNo = Clean(req.SertifikatNo),
            SertifikatTahun = req.SertifikatTahun,
            SertifikatKeterangan = Clean(req.SertifikatKeterangan),
            Lokasi = Clean(req.Lokasi),
            Qty = req.Qty,
            Satuan = string.IsNullOrWhiteSpace(req.Satuan) ? "M2" : req.Satuan.Trim(),
            StatusJaminan = Clean(req.StatusJaminan),
            HargaPasar = req.HargaPasar,
            AppraisalHarga = req.AppraisalHarga,
            AppraisalKjpp = Clean(req.AppraisalKjpp),
            AppraisalTahun = req.AppraisalTahun,
            AppraisalNo = Clean(req.AppraisalNo),
            PbbNop = Clean(req.PbbNop),
            PbbNominal = req.PbbNominal,
            PbbTglPembayaran = req.PbbTglPembayaran,
            CatatanAkt = ValidCatatanAkt(req.CatatanAkt),
            PerijinanPemegangSaham = Clean(req.PerijinanPemegangSaham),
            IdPembuat = nik,
            TglDibuat = DateTime.UtcNow,
        };
        _db.AsetTidakProduktif.Add(row);
        await _db.SaveChangesAsync();
        return (true, null, row.Id);
    }

    public async Task<(bool Ok, string? Error)> UpdateTidakProduktifAsync(string nik, long id, SimpanAsetTidakProduktifRequest req)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return (false, ForbidMsg);
        var row = await _db.AsetTidakProduktif.FirstOrDefaultAsync(x => x.Id == id);
        if (row is null) return (false, "Data tidak ditemukan.");
        if (string.IsNullOrWhiteSpace(req.Jenis)) return (false, "Jenis aset wajib diisi.");

        row.Jenis = req.Jenis.Trim();
        row.Nama = Clean(req.Nama);
        row.SertifikatHak = Clean(req.SertifikatHak);
        row.SertifikatJangkaWaktu = req.SertifikatJangkaWaktu;
        row.SertifikatNo = Clean(req.SertifikatNo);
        row.SertifikatTahun = req.SertifikatTahun;
        row.SertifikatKeterangan = Clean(req.SertifikatKeterangan);
        row.Lokasi = Clean(req.Lokasi);
        row.Qty = req.Qty;
        row.Satuan = string.IsNullOrWhiteSpace(req.Satuan) ? "M2" : req.Satuan.Trim();
        row.StatusJaminan = Clean(req.StatusJaminan);
        row.HargaPasar = req.HargaPasar;
        row.AppraisalHarga = req.AppraisalHarga;
        row.AppraisalKjpp = Clean(req.AppraisalKjpp);
        row.AppraisalTahun = req.AppraisalTahun;
        row.AppraisalNo = Clean(req.AppraisalNo);
        row.PbbNop = Clean(req.PbbNop);
        row.PbbNominal = req.PbbNominal;
        row.PbbTglPembayaran = req.PbbTglPembayaran;
        row.CatatanAkt = ValidCatatanAkt(req.CatatanAkt);
        row.PerijinanPemegangSaham = Clean(req.PerijinanPemegangSaham);
        row.IdPengubah = nik;
        row.TglDiubah = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> DeleteTidakProduktifAsync(string nik, long id)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return (false, ForbidMsg);
        var row = await _db.AsetTidakProduktif.FirstOrDefaultAsync(x => x.Id == id);
        if (row is null) return (false, "Data tidak ditemukan.");
        _db.AsetTidakProduktif.Remove(row);
        await _db.SaveChangesAsync();
        return (true, null);
    }

    private static AsetTidakProduktifDto MapTidakProduktif(TidakProduktifEntity x) => new(
        x.Id, x.Jenis, x.Nama, x.SertifikatHak, x.SertifikatJangkaWaktu, x.SertifikatNo, x.SertifikatTahun,
        x.SertifikatKeterangan, x.Lokasi, x.Qty, x.Satuan, x.StatusJaminan,
        x.HargaPasar, x.AppraisalHarga, x.AppraisalKjpp, x.AppraisalTahun, x.AppraisalNo,
        x.PbbNop, x.PbbNominal, x.PbbTglPembayaran, x.CatatanAkt,
        x.PerijinanPemegangSaham, x.TglDibuat, x.TglDiubah);

    private static string? ValidCatatanAkt(string? s) =>
        s is "Y" or "T" ? s : null;

    // ---- aktivitas aset tidak produktif ----
    public async Task<AsetTidakProduktifAktivitasListDto> GetAktivitasListAsync(string nik, long? idAset)
    {
        var asetRows = await _db.AsetTidakProduktif.AsNoTracking().ToListAsync();
        var asetLabel = asetRows.ToDictionary(a => a.Id, AsetLabelFor);

        var query = _db.AsetTidakProduktifAktivitas.AsNoTracking().AsQueryable();
        if (idAset is long id) query = query.Where(x => x.IdAset == id);
        var rows = await query.OrderByDescending(x => x.TglAktivitas).ThenByDescending(x => x.Id).ToListAsync();

        var isAdmin = await _access.IsAsetAdminAsync(nik);
        var items = rows.Select(x => new AsetTidakProduktifAktivitasDto(
            x.Id, x.IdAset, asetLabel.GetValueOrDefault(x.IdAset, "(aset tidak ditemukan)"), x.Jenis, x.TglAktivitas,
            x.Deskripsi, x.PihakTerkait, x.NilaiNego, x.TglDibuat, x.TglDiubah)).ToList();
        var daftarAset = asetRows.OrderBy(a => a.Lokasi).ThenBy(a => a.Id)
            .Select(a => new AsetPilihanDto(a.Id, AsetLabelFor(a))).ToList();

        return new AsetTidakProduktifAktivitasListDto(items, daftarAset, isAdmin);
    }

    public async Task<(bool Ok, string? Error, long Id)> CreateAktivitasAsync(string nik, SimpanAktivitasRequest req)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return (false, ForbidMsg, 0);
        if (string.IsNullOrWhiteSpace(req.Jenis)) return (false, "Jenis aktivitas wajib diisi.", 0);
        if (!await _db.AsetTidakProduktif.AnyAsync(a => a.Id == req.IdAset)) return (false, "Aset tidak ditemukan.", 0);

        var row = new AktivitasEntity
        {
            IdAset = req.IdAset,
            Jenis = req.Jenis.Trim(),
            TglAktivitas = req.TglAktivitas,
            Deskripsi = Clean(req.Deskripsi),
            PihakTerkait = Clean(req.PihakTerkait),
            NilaiNego = req.NilaiNego,
            IdPembuat = nik,
            TglDibuat = DateTime.UtcNow,
        };
        _db.AsetTidakProduktifAktivitas.Add(row);
        await _db.SaveChangesAsync();
        return (true, null, row.Id);
    }

    public async Task<(bool Ok, string? Error)> UpdateAktivitasAsync(string nik, long id, SimpanAktivitasRequest req)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return (false, ForbidMsg);
        var row = await _db.AsetTidakProduktifAktivitas.FirstOrDefaultAsync(x => x.Id == id);
        if (row is null) return (false, "Data tidak ditemukan.");
        if (string.IsNullOrWhiteSpace(req.Jenis)) return (false, "Jenis aktivitas wajib diisi.");
        if (!await _db.AsetTidakProduktif.AnyAsync(a => a.Id == req.IdAset)) return (false, "Aset tidak ditemukan.");

        row.IdAset = req.IdAset;
        row.Jenis = req.Jenis.Trim();
        row.TglAktivitas = req.TglAktivitas;
        row.Deskripsi = Clean(req.Deskripsi);
        row.PihakTerkait = Clean(req.PihakTerkait);
        row.NilaiNego = req.NilaiNego;
        row.IdPengubah = nik;
        row.TglDiubah = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> DeleteAktivitasAsync(string nik, long id)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return (false, ForbidMsg);
        var row = await _db.AsetTidakProduktifAktivitas.FirstOrDefaultAsync(x => x.Id == id);
        if (row is null) return (false, "Data tidak ditemukan.");
        _db.AsetTidakProduktifAktivitas.Remove(row);
        await _db.SaveChangesAsync();
        return (true, null);
    }

    private static string AsetLabelFor(TidakProduktifEntity a) =>
        $"{a.Jenis} — {(string.IsNullOrWhiteSpace(a.Lokasi) ? (a.Nama ?? $"Aset #{a.Id}") : a.Lokasi)}";

    // ---- helpers ----
    private const string ForbidMsg = "Hanya Admin Aset (Departemen Kepatuhan) yang dapat mengelola aset.";

    private async Task<Dictionary<long, DateOnly?>> NextMaintenanceMapAsync(List<long> ids)
    {
        if (ids.Count == 0) return new();
        var grouped = await _db.AsetMaintenance.AsNoTracking()
            .Where(m => m.Status == "Terjadwal" && ids.Contains(m.IdAset))
            .GroupBy(m => m.IdAset)
            .Select(g => new { Id = g.Key, Tgl = g.Min(x => x.TglJadwal) })
            .ToListAsync();
        return grouped.ToDictionary(x => x.Id, x => (DateOnly?)x.Tgl);
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
    private static string ValidKondisi(string? s) => s is "Baik" or "Rusak Ringan" or "Rusak Berat" or "Hilang" ? s : "Baik";
    private static string ValidStatus(string? s) => s is "Aktif" or "Dipinjam" or "Perbaikan" or "Dihapus" ? s : "Aktif";
    private static string ValidJenis(string? s) => s is "Rutin" or "Perbaikan" or "Inspeksi" ? s : "Rutin";
    private static string ValidMaintStatus(string? s) => s is "Terjadwal" or "Selesai" or "Batal" ? s : "Terjadwal";

    private static AsetDto Map(AsetEntity a, DateOnly? next) => new(
        a.Id, a.Kode, a.Nama, a.Kategori, a.Merk, a.NomorSeri, a.Lokasi, a.IdPic, a.NamaPic,
        a.Kondisi, a.Status, a.Nilai, a.TglPerolehan, a.Catatan, next, a.TglDibuat, a.TglDiubah);

    private static AsetMaintenanceDto MapMaint(MaintEntity m) => new(
        m.Id, m.IdAset, m.Jenis, m.TglJadwal, m.TglSelesai, m.Status, m.Pelaksana, m.Biaya, m.Catatan, m.TglDibuat);
}

using Microsoft.EntityFrameworkCore;
using SsoBackend.Data;
using SsoBackend.Models.Aset;
using SsoBackend.Models.Dto;
using TidakProduktifEntity = SsoBackend.Models.Aset.AsetTidakProduktif;
using AktivitasEntity = SsoBackend.Models.Aset.AsetTidakProduktifAktivitas;
using SsoBackend.Models.Gcs;

namespace SsoBackend.Services;

// My Asset. Inventaris. Semua karyawan dapat MELIHAT inventaris; hanya Admin Aset
// (Departemen Kepatuhan Kabag ke atas s/d GM SKP) yang boleh input/ubah/hapus.
//
// CATATAN ARSITEKTUR (Aug 2026): Inventaris sumber datanya GCS.dbo.assets (modul Aktiva
// Tetap ERP) - lihat GetErpListAsync/GetErpDetailAsync di bawah & Models/Gcs/AsetErp.cs.
// Tabel lama aset.aset & aset.maintenance (beserta CRUD/fitur Maintenance-nya) DIHAPUS
// total (bukan cuma disembunyikan) setelah dikonfirmasi kosong (0 baris) - lihat
// 16-drop-legacy-aset-maintenance.sql.
public class AsetService
{
    private readonly ApplicationDbContext _db;
    private readonly GcsDbContext _gcs;
    private readonly ModuleAccessService _access;
    private readonly ILogger<AsetService> _logger;

    public AsetService(ApplicationDbContext db, GcsDbContext gcs, ModuleAccessService access, ILogger<AsetService> logger)
    {
        _db = db;
        _gcs = gcs;
        _access = access;
        _logger = logger;
    }

    // ---- Inventaris (ERP, read-only) ----
    public async Task<AsetErpListDto> GetErpListAsync(string? q)
    {
        // nomor_internal & klasifikasi hidup di db_mygcs (bukan ERP), jadi tidak bisa masuk
        // 1 query SQL dengan tabel dbo.assets - dicari duluan di sini, lalu OBJECTID yang
        // cocok digabung ke filter ERP-nya sebagai OR.
        var nomorInternal = await _db.AsetNomorInternal.AsNoTracking()
            .ToDictionaryAsync(x => x.ObjectId, x => x.NomorAset);
        var klasifikasi = await KlasifikasiRowsAsync();

        var query = _gcs.AsetErp.AsQueryable();
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            var matchNomorInternal = nomorInternal
                .Where(kv => kv.Value.Contains(term, StringComparison.OrdinalIgnoreCase))
                .Select(kv => kv.Key).ToList();
            var matchKlasifikasi = klasifikasi
                .Where(kv => KlasifikasiStatus(kv.Value)?.Contains(term, StringComparison.OrdinalIgnoreCase) == true)
                .Select(kv => kv.Key).ToList();
            query = query.Where(a => (a.DESC_OBJECT != null && a.DESC_OBJECT.Contains(term))
                || a.OBJECTID.Contains(term)
                || (a.LOKASI != null && a.LOKASI.Contains(term))
                || (a.NOPOL != null && a.NOPOL.Contains(term))
                || matchNomorInternal.Contains(a.OBJECTID)
                || matchKlasifikasi.Contains(a.OBJECTID));
        }
        var rows = await query.OrderByDescending(a => a.LAST_UPDATED).ToListAsync();
        var (groups, kelompok, cc) = await ErpLookupsAsync();
        var picAktif = await PicAktifMapAsync();

        var items = rows.Select(a => MapErp(a, groups, kelompok, cc, nomorInternal, picAktif, klasifikasi)).ToList();
        return new AsetErpListDto(items, items.Count);
    }

    // Untuk export Excel/PDF - filter q SAMA seperti GetErpListAsync (query ke ERP), lalu
    // 4 filter dropdown (kelompok/lokasi/pic/klasifikasi) diterapkan di memori persis
    // seperti logika client-side di Inventaris.jsx, supaya hasil export sama persis dengan
    // yang tampil di layar tanpa menduplikasi query ERP-nya.
    public async Task<IReadOnlyList<AsetErpDto>> GetErpExportRowsAsync(
        string? q, string? kelompok, string? lokasi, string? pic, string? klasifikasi)
    {
        var items = (await GetErpListAsync(q)).Items;
        if (!string.IsNullOrWhiteSpace(kelompok) && kelompok != "Semua") items = items.Where(a => a.Kelompok == kelompok).ToList();
        if (!string.IsNullOrWhiteSpace(lokasi) && lokasi != "Semua") items = items.Where(a => a.Lokasi == lokasi).ToList();
        if (!string.IsNullOrWhiteSpace(pic) && pic != "Semua") items = items.Where(a => a.PicSaatIni == pic).ToList();
        if (!string.IsNullOrWhiteSpace(klasifikasi) && klasifikasi != "Semua") items = items.Where(a => a.Klasifikasi == klasifikasi).ToList();
        return items;
    }

    public async Task<AsetErpDto?> GetErpDetailAsync(string objectId)
    {
        var a = await _gcs.AsetErp.FirstOrDefaultAsync(x => x.OBJECTID == objectId);
        if (a is null) return null;
        var (groups, kelompok, cc) = await ErpLookupsAsync();
        var nomor = await _db.AsetNomorInternal.AsNoTracking().FirstOrDefaultAsync(x => x.ObjectId == objectId);
        var nomorInternal = nomor is null ? new Dictionary<string, string>() : new Dictionary<string, string> { [objectId] = nomor.NomorAset };
        // Difilter per objectId (bukan tarik seluruh tabel se-perusahaan) - halaman Detail
        // Aset cuma butuh 1 baris, tapi sebelumnya PicAktifMapAsync/KlasifikasiRowsAsync
        // tanpa filter menarik SEMUA baris PIC/klasifikasi tiap kali 1 aset dibuka.
        var picAktif = await PicAktifMapAsync(objectId);
        var klasifikasi = await KlasifikasiRowsAsync(objectId);
        return MapErp(a, groups, kelompok, cc, nomorInternal, picAktif, klasifikasi);
    }

    // objectid -> baris aset.klasifikasi (mis. status "Tidak Bergerak" + detail sertifikat/
    // appraisal/perijinan ke pemegang saham). Kalau 1 objectid suatu saat punya >1 baris,
    // status digabung "A, B" (KlasifikasiStatus) tapi detail cuma diambil dari baris pertama.
    // objectId opsional - kalau diisi, cuma tarik baris aset itu (dipakai GetErpDetailAsync).
    private async Task<Dictionary<string, List<AsetKlasifikasi>>> KlasifikasiRowsAsync(string? objectId = null)
    {
        var query = _db.AsetKlasifikasi.AsNoTracking().AsQueryable();
        if (objectId is not null) query = query.Where(x => x.ObjectId == objectId);
        var rows = await query.ToListAsync();
        return rows.GroupBy(x => x.ObjectId).ToDictionary(g => g.Key, g => g.ToList());
    }

    private static string? KlasifikasiStatus(List<AsetKlasifikasi> rows) =>
        rows.Count == 0 ? null : string.Join(", ", rows.Select(x => x.Status).Distinct());

    private static AsetKlasifikasiDetailDto? KlasifikasiDetail(Dictionary<string, List<AsetKlasifikasi>> map, string objectId)
    {
        if (!map.TryGetValue(objectId, out var rows) || rows.Count == 0) return null;
        var k = rows[0];
        return new AsetKlasifikasiDetailDto(k.Catatan, k.SertifikatHak, k.SertifikatJangkaWaktu, k.SertifikatNo,
            k.SertifikatTahun, k.NilaiPasar, k.NilaiAppraisal, k.StatusJaminan, k.Kjpp, k.KjppTahun, k.KjppNo,
            k.KeteranganPemegangSaham);
    }

    // ---- Pendaftaran aset baru (MyGCS -> dbo.assets) ----
    // KEPUTUSAN (Aug 2026, membalik keputusan lama "MyGCS tidak pernah menulis ke ERP"):
    // aset baru boleh didaftarkan dari MyGCS supaya dbo.assets tetap SSOT (tidak ada
    // register aset duplikat di db_mygcs), TAPI hanya identitas dasar yang diisi -
    // nilai/masa manfaat/dst tetap kosong, wajib dilengkapi akunting langsung di ERP.
    //
    // dbo.assets TIDAK PUNYA primary key/unique constraint/identity/trigger insert sama
    // sekali (diverifikasi lewat sys.indexes/sys.triggers - bukan asumsi) - semua validasi
    // murni di level aplikasi. OBJECTID dibuat meniru pola nyata data existing (verifikasi
    // manual: {yyyyMM}{counter 4-digit, GLOBAL naik terus lintas bulan/kategori, BUKAN
    // reset per bulan}) + dicek ulang "belum dipakai" tepat sebelum INSERT sebagai jaring
    // pengaman - tapi karena tidak ada unique constraint di database, risiko tabrakan
    // dengan input bersamaan dari aplikasi ERP tim akunting TIDAK bisa dihilangkan 100%.
    //
    // Default kolom status (AKTIF/STATUS/PROSES/METODE) diambil dari pola MAYORITAS data
    // existing (diverifikasi lewat query GROUP BY, bukan tebakan) - lihat komentar di
    // masing-masing field di bawah. NOASSET & CERE sengaja TIDAK diisi (maknanya belum
    // dipastikan ke tim akunting), dibiarkan NULL/default.
    public async Task<(bool Ok, string? Error, string? ObjectId)> DaftarAsetBaruAsync(string nik, SimpanAsetBaruRequest req)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return (false, ForbidMsg, null);
        if (string.IsNullOrWhiteSpace(req.Nama)) return (false, "Nama aset wajib diisi.", null);
        if (string.IsNullOrWhiteSpace(req.Lokasi)) return (false, "Lokasi wajib diisi.", null);
        if (string.IsNullOrWhiteSpace(req.GroupAsset)) return (false, "Kategori (Group Asset) wajib dipilih.", null);
        if (string.IsNullOrWhiteSpace(req.Kelompok)) return (false, "Kelompok wajib dipilih.", null);
        if (string.IsNullOrWhiteSpace(req.KodeCc)) return (false, "Kode CC / Wilayah wajib dipilih.", null);
        if (string.IsNullOrWhiteSpace(req.Satuan)) return (false, "Satuan wajib diisi.", null);

        // Validasi kode benar-benar ada di master ERP - jangan sampai simpan kode asal ketik.
        var groupAsset = req.GroupAsset.Trim();
        var kelompok = req.Kelompok.Trim();
        var kodeCc = req.KodeCc.Trim();
        if (!await _gcs.AsetErpGroup.AnyAsync(g => g.GROUP_ASSET.Trim() == groupAsset))
            return (false, "Kategori (Group Asset) tidak valid.", null);
        if (!await _gcs.AsetErpKelompok.AnyAsync(k => k.KELOMPOK.Trim() == kelompok))
            return (false, "Kelompok tidak valid.", null);
        if (!kelompok.StartsWith(groupAsset))
            return (false, "Kelompok yang dipilih bukan bagian dari kategori yang dipilih.", null);
        if (!await _gcs.AsetErpCc.AnyAsync(c => c.KODE_CC.Trim() == kodeCc))
            return (false, "Kode CC / Wilayah tidak valid.", null);

        if (!string.IsNullOrWhiteSpace(req.NomorInternal) &&
            await _db.AsetNomorInternal.AnyAsync(x => x.NomorAset == req.NomorInternal.Trim()))
            return (false, $"Nomor aset internal '{req.NomorInternal.Trim()}' sudah dipakai aset lain.", null);

        // Cari OBJECTID belum dipakai lalu insert - dilindungi application lock
        // (sp_getapplock) supaya 2 submit "Daftar Aset Baru" dari MyGCS sendiri yang
        // hampir bersamaan tidak berebut nomor yang sama. dbo.assets TIDAK punya primary
        // key/unique constraint sama sekali (diverifikasi lewat sys.indexes) dan MyGCS
        // TIDAK PERNAH mengubah skema ERP - jadi tanpa lock ini, cek "belum dipakai" di
        // bawah murni percuma di bawah beban bersamaan (check-then-insert klasik).
        // CATATAN: lock ini cuma melindungi antar-request MyGCS - TIDAK melindungi dari
        // tabrakan dengan aplikasi ERP akunting yang insert langsung ke dbo.assets di
        // luar MyGCS. Itu di luar kendali kita, sudah diketahui & tidak bisa dihilangkan
        // 100% tanpa constraint di level ERP (yang sengaja tidak kita sentuh).
        string? objectId;
        var conn = _gcs.Database.GetDbConnection();
        var mustCloseConn = conn.State != System.Data.ConnectionState.Open;
        if (mustCloseConn) await conn.OpenAsync();
        try
        {
            await using (var lockCmd = conn.CreateCommand())
            {
                lockCmd.CommandText = "EXEC @result = sp_getapplock @Resource = 'mygcs-aset-daftar-baru-objectid', @LockMode = 'Exclusive', @LockOwner = 'Session', @LockTimeout = 10000";
                var resultParam = lockCmd.CreateParameter();
                resultParam.ParameterName = "@result";
                resultParam.DbType = System.Data.DbType.Int32;
                resultParam.Direction = System.Data.ParameterDirection.Output;
                lockCmd.Parameters.Add(resultParam);
                await lockCmd.ExecuteNonQueryAsync();
                if (Convert.ToInt32(resultParam.Value) < 0)
                    return (false, "Sistem sedang sibuk mendaftarkan aset lain, coba lagi sebentar.", null);
            }

            var basis = await MaxObjectIdCounterAsync();
            objectId = null;
            for (var offset = 1; offset <= 20; offset++)
            {
                var kandidat = DateTime.Now.ToString("yyyyMM") + (basis + offset).ToString("0000");
                if (!await _gcs.AsetErp.AnyAsync(a => a.OBJECTID == kandidat)) { objectId = kandidat; break; }
            }
            if (objectId is null) return (false, "Gagal membuat nomor aset unik, coba lagi.", null);

            var row = new AsetErp
            {
                OBJECTID = objectId,
                DESC_OBJECT = req.Nama.Trim(),
                LOKASI = req.Lokasi.Trim(),
                GROUP_ASSET = groupAsset,
                KELOMPOK = kelompok,
                TANGGAL = req.Tanggal.ToDateTime(TimeOnly.MinValue),
                KODE_CC = kodeCc,
                SATUAN = req.Satuan.Trim(),
                AKTIF = "Y",   // pola mayoritas aset aktif baru (508/925 baris = 'Y')
                STATUS = "U",  // 918/925 baris existing = 'U'
                PROSES = "T",  // 919/925 baris existing = 'T'
                METODE = "S",  // 924/925 baris existing = 'S'
                LAST_UPDATED = DateTime.Now,
            };

            try
            {
                _gcs.AsetErp.Add(row);
                await _gcs.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Gagal mendaftarkan aset baru {ObjectId} ke dbo.assets", objectId);
                return (false, "Gagal menyimpan aset baru ke ERP. Coba lagi; kalau berulang, hubungi admin.", null);
            }
        }
        finally
        {
            await using (var unlockCmd = conn.CreateCommand())
            {
                unlockCmd.CommandText = "IF APPLOCK_MODE('public', 'mygcs-aset-daftar-baru-objectid', 'Session') <> 'NoLock' EXEC sp_releaseapplock @Resource = 'mygcs-aset-daftar-baru-objectid', @LockOwner = 'Session'";
                try { await unlockCmd.ExecuteNonQueryAsync(); } catch { /* lock mungkin belum sempat didapat - aman diabaikan */ }
            }
            if (mustCloseConn) await conn.CloseAsync();
        }

        // Nomor Internal (opsional) - kegagalan di sini TIDAK membatalkan aset yang sudah
        // kadung tersimpan di ERP (tidak ada transaksi lintas 2 database yang mungkin).
        // Kalau gagal, aset TETAP dianggap berhasil didaftarkan (ObjectId dikembalikan) -
        // supaya user tidak retry seluruh form dan bikin aset ERP duplikat; nomor internal
        // tinggal dilengkapi manual lewat Detail Aset.
        if (!string.IsNullOrWhiteSpace(req.NomorInternal))
        {
            try
            {
                _db.AsetNomorInternal.Add(new Models.Aset.AsetNomorInternal
                {
                    ObjectId = objectId,
                    NomorAset = req.NomorInternal.Trim(),
                    IdPengubah = nik,
                    TglDiubah = DateTime.UtcNow,
                });
                await _db.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Aset {ObjectId} berhasil didaftarkan ke ERP tapi gagal simpan Nomor Internal '{NomorInternal}'", objectId, req.NomorInternal);
                return (true, $"Aset berhasil didaftarkan (kode {objectId}), tapi Nomor Aset Internal '{req.NomorInternal.Trim()}' gagal disimpan (mungkin sudah dipakai). Lengkapi manual lewat Detail Aset.", objectId);
            }
        }

        return (true, null, objectId);
    }

    public async Task<IReadOnlyList<AsetGroupDto>> ListGroupAssetAsync() =>
        await _gcs.AsetErpGroup.AsNoTracking()
            .OrderBy(g => g.GROUP_ASSET)
            .Select(g => new AsetGroupDto(g.GROUP_ASSET.Trim(), (g.ASSETS_DESC ?? g.GROUP_ASSET).Trim()))
            .ToListAsync();

    // KELOMPOK selalu diawali 3 karakter GROUP_ASSET induknya (mis. "A0501" -> "A05") -
    // diverifikasi manual ke seluruh isi dbo.AssetS_KELOMPOK, bukan asumsi. Tanpa
    // groupAsset = semua kelompok.
    public async Task<IReadOnlyList<AsetKelompokDto>> ListKelompokAsync(string? groupAsset)
    {
        var query = _gcs.AsetErpKelompok.AsNoTracking().AsQueryable();
        var rows = await query.OrderBy(k => k.KELOMPOK).ToListAsync();
        if (!string.IsNullOrWhiteSpace(groupAsset))
            rows = rows.Where(k => k.KELOMPOK.Trim().StartsWith(groupAsset.Trim())).ToList();
        return rows.Select(k => new AsetKelompokDto(k.KELOMPOK.Trim(), (k.NAMA_KELOMPOK ?? k.KELOMPOK).Trim())).ToList();
    }

    public async Task<IReadOnlyList<AsetKodeCcDto>> ListKodeCcAsync() =>
        await _gcs.AsetErpCc.AsNoTracking()
            .Where(c => c.WILAYAH != null && c.WILAYAH != "")
            .OrderBy(c => c.WILAYAH)
            .Select(c => new AsetKodeCcDto(c.KODE_CC.Trim(), c.WILAYAH!.Trim()))
            .ToListAsync();

    // Counter global (bukan reset per bulan) dari 4 digit terakhir OBJECTID ber-format
    // {yyyyMM}{counter} - lihat catatan pola di DaftarAsetBaruAsync. CATATAN: asumsi
    // counter selalu 4 digit; kalau suatu saat tembus 9999 (>10 karakter), logika ini
    // perlu ditinjau ulang (tidak akan salah, tapi baris >10 karakter tidak ikut terhitung).
    private async Task<int> MaxObjectIdCounterAsync()
    {
        var semua = await _gcs.AsetErp.AsNoTracking().Select(a => a.OBJECTID).ToListAsync();
        var maxCounter = 0;
        foreach (var raw in semua)
        {
            var id = raw?.Trim() ?? "";
            if (id.Length != 10) continue;
            if (int.TryParse(id.Substring(6, 4), out var n) && n > maxCounter) maxCounter = n;
        }
        return maxCounter;
    }

    // objectid -> nama PIC aktif saat ini (orang atau bagian), untuk kolom/filter PIC di Inventaris.
    // objectId opsional - kalau diisi, cuma tarik PIC aktif aset itu (dipakai GetErpDetailAsync)
    // alih-alih PIC aktif SEMUA aset se-perusahaan.
    private async Task<Dictionary<string, string>> PicAktifMapAsync(string? objectId = null)
    {
        var query = _db.AsetPicAssignment.AsNoTracking().Where(x => x.Status == "Aktif");
        if (objectId is not null) query = query.Where(x => x.ObjectId == objectId);
        var rows = await query.ToListAsync();
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
    private static AsetErpDto MapErp(AsetErp a, Dictionary<string, string> groups, Dictionary<string, string> kelompok, Dictionary<string, string> cc, Dictionary<string, string> nomorInternal, Dictionary<string, string> picAktif, Dictionary<string, List<AsetKlasifikasi>> klasifikasi) => new(
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
        klasifikasi.TryGetValue(a.OBJECTID, out var klsRows) ? KlasifikasiStatus(klsRows) : null,
        a.NOTE?.Trim(),
        KlasifikasiDetail(klasifikasi, a.OBJECTID));

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
    private const string ForbidMsg = AsetShared.ForbidMsg;

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}

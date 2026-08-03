using Microsoft.EntityFrameworkCore;
using SsoBackend.Data;
using SsoBackend.Models.Dto;
using SsoBackend.Models.Prosedur;

namespace SsoBackend.Services;

// My Prosedur: repository SOP/Kebijakan + kontrol versi + pencarian + acknowledgement.
// Semua karyawan membaca dokumen berlaku & menyatakan sudah baca; hanya Admin
// Kepatuhan (Departemen Kepatuhan) yang mengunggah/mengelola.
public class ProsedurService
{
    private readonly ApplicationDbContext _db;
    private readonly ModuleAccessService _access;

    public ProsedurService(ApplicationDbContext db, ModuleAccessService access)
    {
        _db = db;
        _access = access;
    }

    public async Task<ProsedurListDto> GetListAsync(string nik, string? q, string? jenis, string? kompartemen, string? lingkup)
    {
        var isAdmin = await _access.IsProsedurAdminAsync(nik);
        var posisi = await ResolvePosisiAsync(nik);
        var pimpinan = posisi.Band is int bb && bb <= 3 && posisi.DeptId is not null;

        var query = _db.ProsedurDokumen.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(jenis)) query = query.Where(d => d.Jenis == jenis);
        if (!string.IsNullOrWhiteSpace(lingkup)) query = query.Where(d => d.Lingkup == lingkup);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var t = q.Trim();
            query = query.Where(d => d.Judul.Contains(t) || d.Kode.Contains(t)
                || (d.Kategori != null && d.Kategori.Contains(t))
                || (d.Deskripsi != null && d.Deskripsi.Contains(t))
                || (d.Unit != null && d.Unit.Contains(t)));
        }
        var docs = await query.OrderBy(d => d.Kode).ToListAsync();

        // Akses baca: dokumen 'Umum' untuk semua; 'Unit' hanya Admin Kepatuhan atau
        // anggota departemen pemilik.
        docs = docs.Where(d => d.Lingkup != "Unit" || isAdmin
            || (posisi.DeptId is not null && d.IdUnitPemilik == posisi.DeptId)).ToList();
        var ids = docs.Select(d => d.Id).ToList();

        // Versi berlaku (tanpa konten). Fallback: bila tak ada Berlaku, ambil versi terbaru.
        var versiRingkas = await _db.ProsedurVersi.AsNoTracking()
            .Where(v => ids.Contains(v.IdDokumen))
            .Select(v => new { v.Id, v.IdDokumen, v.Versi, v.Status, v.TglBerlaku, v.NamaFile, v.TglUnggah })
            .ToListAsync();
        var berlakuPerDok = versiRingkas.Where(v => v.Status == "Berlaku")
            .ToDictionary(v => v.IdDokumen);

        var berlakuVersiIds = berlakuPerDok.Values.Select(v => v.Id).ToList();
        var ackSet = (await _db.ProsedurAcknowledgement.AsNoTracking()
            .Where(a => a.Nik == nik && berlakuVersiIds.Contains(a.IdVersi))
            .Select(a => a.IdVersi).ToListAsync()).ToHashSet();

        var kompPerDok = await KompartemenPerDokAsync(ids);

        var items = docs.Select(d =>
        {
            berlakuPerDok.TryGetValue(d.Id, out var v);
            var sudahAck = v is not null && ackSet.Contains(v.Id);
            var komp = kompPerDok.TryGetValue(d.Id, out var list) ? list : new List<string>();
            var bisaKelola = isAdmin
                || (d.Lingkup == "Unit" && pimpinan && d.IdUnitPemilik == posisi.DeptId);
            return new ProsedurDokumenDto(
                d.Id, d.Kode, d.Judul, d.Jenis, d.Unit, d.Kategori, d.Deskripsi,
                d.SemuaKompartemen, komp,
                d.Lingkup, bisaKelola,
                v?.Versi, v is not null ? "Berlaku" : "Tidak Aktif", v?.TglBerlaku, v?.Id, v?.NamaFile,
                sudahAck, v?.TglUnggah);
        }).ToList();

        // Filter cakupan kompartemen: dokumen cocok bila berlaku semua kompartemen
        // atau memuat kompartemen yang dipilih.
        if (!string.IsNullOrWhiteSpace(kompartemen))
        {
            var k = kompartemen.Trim();
            items = items.Where(i => i.SemuaKompartemen || i.Kompartemen.Contains(k)).ToList();
        }

        var belumAck = items.Count(i => i.IdVersiBerlaku is not null && !i.SudahAck);
        return new ProsedurListDto(items, isAdmin, belumAck, pimpinan, posisi.DeptNama);
    }

    // Peta id_dokumen -> daftar kompartemen tertentu (tidak termasuk yang "semua kompartemen").
    private async Task<Dictionary<long, List<string>>> KompartemenPerDokAsync(IReadOnlyCollection<long> ids)
    {
        if (ids.Count == 0) return new();
        var rows = await _db.ProsedurDokumenKompartemen.AsNoTracking()
            .Where(k => ids.Contains(k.IdDokumen))
            .Select(k => new { k.IdDokumen, k.Kompartemen })
            .ToListAsync();
        return rows.GroupBy(r => r.IdDokumen)
            .ToDictionary(g => g.Key, g => g.Select(x => x.Kompartemen).OrderBy(x => x).ToList());
    }

    public async Task<ProsedurDetailDto?> GetDetailAsync(string nik, long id)
    {
        var d = await _db.ProsedurDokumen.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (d is null) return null;
        if (!await BisaBacaAsync(nik, d)) return null;   // dok privasi unit: bukan haknya

        var versi = await _db.ProsedurVersi.AsNoTracking()
            .Where(v => v.IdDokumen == id)
            .OrderByDescending(v => v.Versi)
            .Select(v => new { v.Id, v.Versi, v.Ringkasan, v.NamaFile, v.TipeFile, v.Status, v.TglBerlaku, v.NamaPenerbit, v.TglUnggah })
            .ToListAsync();

        var ackCounts = await _db.ProsedurAcknowledgement.AsNoTracking()
            .Where(a => a.IdDokumen == id)
            .GroupBy(a => a.IdVersi)
            .Select(g => new { IdVersi = g.Key, N = g.Count() })
            .ToDictionaryAsync(x => x.IdVersi, x => x.N);

        var berlaku = versi.FirstOrDefault(v => v.Status == "Berlaku");
        var sudahAckBerlaku = berlaku is not null &&
            await _db.ProsedurAcknowledgement.AsNoTracking().AnyAsync(a => a.IdVersi == berlaku.Id && a.Nik == nik);

        var versiDto = versi.Select(v => new ProsedurVersiDto(
            v.Id, v.Versi, v.Ringkasan, v.NamaFile, v.TipeFile, v.Status, v.TglBerlaku, v.NamaPenerbit, v.TglUnggah,
            ackCounts.TryGetValue(v.Id, out var n) ? n : 0)).ToList();

        var kompPerDok = await KompartemenPerDokAsync(new[] { id });
        var komp = kompPerDok.TryGetValue(id, out var list) ? list : new List<string>();

        var isAdmin = await _access.IsProsedurAdminAsync(nik);
        var bisaKelola = await BisaKelolaAsync(nik, d, isAdmin);
        return new ProsedurDetailDto(
            d.Id, d.Kode, d.Judul, d.Jenis, d.Unit, d.Kategori, d.Deskripsi,
            d.SemuaKompartemen, komp, d.Lingkup, bisaKelola, versiDto,
            berlaku?.Id, berlaku?.Versi, sudahAckBerlaku, isAdmin,
            berlaku is not null && ackCounts.TryGetValue(berlaku.Id, out var nb) ? nb : 0);
    }

    // Berkas satu versi (untuk unduh/lihat, termasuk versi USANG). Cek akses baca:
    // dokumen 'Umum' boleh semua; 'Unit' hanya anggota departemen pemilik / Admin Kepatuhan.
    public async Task<(byte[] Konten, string? Tipe, string Nama)?> GetFileAsync(string nik, long versiId)
    {
        var v = await _db.ProsedurVersi.AsNoTracking()
            .Where(x => x.Id == versiId)
            .Select(x => new { x.Konten, x.TipeFile, x.NamaFile, x.IdDokumen })
            .FirstOrDefaultAsync();
        if (v is null) return null;
        var dok = await _db.ProsedurDokumen.AsNoTracking().FirstOrDefaultAsync(x => x.Id == v.IdDokumen);
        if (dok is null || !await BisaBacaAsync(nik, dok)) return null;
        return (v.Konten, v.TipeFile, v.NamaFile);
    }

    // Karyawan menyatakan sudah baca versi berlaku dari sebuah dokumen.
    public async Task<(bool Ok, string? Error)> AckAsync(string nik, string? nama, long dokumenId)
    {
        var dok = await _db.ProsedurDokumen.AsNoTracking().FirstOrDefaultAsync(x => x.Id == dokumenId);
        if (dok is null) return (false, "Dokumen tidak ditemukan.");
        if (!await BisaBacaAsync(nik, dok)) return (false, "Anda tidak memiliki akses ke dokumen ini.");
        var berlaku = await _db.ProsedurVersi.AsNoTracking()
            .FirstOrDefaultAsync(v => v.IdDokumen == dokumenId && v.Status == "Berlaku");
        if (berlaku is null) return (false, "Dokumen ini tidak memiliki versi berlaku.");
        if (await _db.ProsedurAcknowledgement.AnyAsync(a => a.IdVersi == berlaku.Id && a.Nik == nik))
            return (true, null); // sudah, idempoten
        _db.ProsedurAcknowledgement.Add(new ProsedurAcknowledgement
        {
            IdVersi = berlaku.Id, IdDokumen = dokumenId, Nik = nik, Nama = nama, Tgl = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();
        return (true, null);
    }

    // Daftar orang yang sudah acknowledge versi berlaku (Admin Kepatuhan / pimpinan unit pemilik).
    public async Task<(bool Ok, string? Error, IReadOnlyList<ProsedurAckOrangDto>? Data)> GetAckOrangAsync(string nik, long dokumenId)
    {
        var dok = await _db.ProsedurDokumen.AsNoTracking().FirstOrDefaultAsync(x => x.Id == dokumenId);
        if (dok is null) return (false, "Dokumen tidak ditemukan.", null);
        if (!await BisaKelolaAsync(nik, dok)) return (false, ForbidMsg, null);
        var berlaku = await _db.ProsedurVersi.AsNoTracking()
            .FirstOrDefaultAsync(v => v.IdDokumen == dokumenId && v.Status == "Berlaku");
        if (berlaku is null) return (true, null, Array.Empty<ProsedurAckOrangDto>());
        var rows = await _db.ProsedurAcknowledgement.AsNoTracking()
            .Where(a => a.IdVersi == berlaku.Id).OrderBy(a => a.Nama)
            .Select(a => new ProsedurAckOrangDto(a.Nik, a.Nama, a.Tgl)).ToListAsync();
        return (true, null, rows);
    }

    // ---- Buat dokumen. 'Umum' -> Admin Kepatuhan. 'Unit' -> pimpinan unit (auto ke departemennya) ----
    public async Task<(bool Ok, string? Error, long Id)> CreateAsync(string nik, string? nama, UbahDokumenRequest meta,
        DateOnly? tglBerlaku, string? ringkasan, byte[] konten, string namaFile, string? tipeFile)
    {
        var lingkup = meta.Lingkup == "Unit" ? "Unit" : "Umum";
        var isAdmin = await _access.IsProsedurAdminAsync(nik);

        int? idUnitPemilik = null;
        string? unitDok = Clean(meta.Unit);
        var semuaKomp = meta.SemuaKompartemen;
        IReadOnlyList<string>? kompartemen = meta.Kompartemen;

        if (lingkup == "Unit")
        {
            // Dokumen privasi departemen: hanya pimpinan unit (Kabag ke atas) yang boleh,
            // ter-scope OTOMATIS ke departemennya. Cakupan kompartemen tidak berlaku.
            var posisi = await ResolvePosisiAsync(nik);
            var pimpinan = posisi.Band is int b && b <= 3 && posisi.DeptId is not null;
            if (!pimpinan) return (false, "Hanya pimpinan unit (Kepala Bagian ke atas) yang dapat mengunggah dokumen privasi unit.", 0);
            idUnitPemilik = posisi.DeptId;
            unitDok = posisi.DeptNama;
            semuaKomp = false;
            kompartemen = null;
        }
        else if (!isAdmin)
        {
            return (false, "Hanya Admin Kepatuhan yang dapat mengunggah dokumen terpusat.", 0);
        }

        var (valid, err) = ValidasiMeta(meta);
        if (!valid) return (false, err, 0);
        if (konten.Length == 0) return (false, "Berkas dokumen wajib diunggah.", 0);
        var kode = meta.Kode.Trim();
        if (await _db.ProsedurDokumen.AnyAsync(d => d.Kode == kode)) return (false, $"Kode dokumen '{kode}' sudah dipakai.", 0);

        var dok = new ProsedurDokumen
        {
            Kode = kode, Judul = meta.Judul.Trim(), Jenis = meta.Jenis,
            Unit = unitDok, Kategori = Clean(meta.Kategori), Deskripsi = Clean(meta.Deskripsi),
            SemuaKompartemen = semuaKomp, Lingkup = lingkup, IdUnitPemilik = idUnitPemilik,
            IdPembuat = nik, TglDibuat = DateTime.UtcNow,
        };
        _db.ProsedurDokumen.Add(dok);
        await _db.SaveChangesAsync();

        await SimpanKompartemenAsync(dok.Id, semuaKomp, kompartemen);

        _db.ProsedurVersi.Add(new ProsedurVersi
        {
            IdDokumen = dok.Id, Versi = 1, Ringkasan = Clean(ringkasan),
            NamaFile = namaFile, TipeFile = tipeFile, Konten = konten, Status = "Berlaku",
            TglBerlaku = tglBerlaku, IdPenerbit = nik, NamaPenerbit = nama, TglUnggah = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();
        return (true, null, dok.Id);
    }

    // Versi baru: versi lama 'Berlaku' → 'Usang', versi baru jadi 'Berlaku'.
    public async Task<(bool Ok, string? Error)> AddVersiAsync(string nik, string? nama, long dokumenId,
        DateOnly? tglBerlaku, string? ringkasan, byte[] konten, string namaFile, string? tipeFile)
    {
        if (konten.Length == 0) return (false, "Berkas dokumen wajib diunggah.");
        var dok = await _db.ProsedurDokumen.FirstOrDefaultAsync(d => d.Id == dokumenId);
        if (dok is null) return (false, "Dokumen tidak ditemukan.");
        if (!await BisaKelolaAsync(nik, dok)) return (false, ForbidMsg);

        var versiList = await _db.ProsedurVersi.Where(v => v.IdDokumen == dokumenId).ToListAsync();
        var next = (versiList.Count > 0 ? versiList.Max(v => v.Versi) : 0) + 1;
        foreach (var v in versiList.Where(v => v.Status == "Berlaku")) v.Status = "Usang";

        _db.ProsedurVersi.Add(new ProsedurVersi
        {
            IdDokumen = dokumenId, Versi = next, Ringkasan = Clean(ringkasan),
            NamaFile = namaFile, TipeFile = tipeFile, Konten = konten, Status = "Berlaku",
            TglBerlaku = tglBerlaku, IdPenerbit = nik, NamaPenerbit = nama, TglUnggah = DateTime.UtcNow,
        });
        dok.TglDiubah = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> UpdateMetaAsync(string nik, long id, UbahDokumenRequest meta)
    {
        var (valid, err) = ValidasiMeta(meta);
        if (!valid) return (false, err);
        var dok = await _db.ProsedurDokumen.FirstOrDefaultAsync(d => d.Id == id);
        if (dok is null) return (false, "Dokumen tidak ditemukan.");
        if (!await BisaKelolaAsync(nik, dok)) return (false, ForbidMsg);
        var kode = meta.Kode.Trim();
        if (await _db.ProsedurDokumen.AnyAsync(d => d.Kode == kode && d.Id != id)) return (false, $"Kode dokumen '{kode}' sudah dipakai.");
        dok.Kode = kode; dok.Judul = meta.Judul.Trim(); dok.Jenis = meta.Jenis;
        dok.Kategori = Clean(meta.Kategori); dok.Deskripsi = Clean(meta.Deskripsi);
        dok.TglDiubah = DateTime.UtcNow;
        // Lingkup & unit pemilik tidak diubah lewat edit. Unit/kompartemen hanya relevan utk 'Umum'.
        if (dok.Lingkup == "Umum")
        {
            dok.Unit = Clean(meta.Unit);
            dok.SemuaKompartemen = meta.SemuaKompartemen;
            await _db.SaveChangesAsync();
            await SimpanKompartemenAsync(dok.Id, meta.SemuaKompartemen, meta.Kompartemen);
        }
        else
        {
            await _db.SaveChangesAsync();
        }
        return (true, null);
    }

    // Ganti seluruh daftar kompartemen tertentu untuk dokumen. Bila "semua kompartemen"
    // aktif, daftar khusus dikosongkan (tidak relevan).
    private async Task SimpanKompartemenAsync(long idDokumen, bool semua, IReadOnlyList<string>? kompartemen)
    {
        var lama = await _db.ProsedurDokumenKompartemen.Where(k => k.IdDokumen == idDokumen).ToListAsync();
        if (lama.Count > 0) _db.ProsedurDokumenKompartemen.RemoveRange(lama);

        if (!semua && kompartemen is not null)
        {
            var bersih = kompartemen
                .Select(k => k?.Trim())
                .Where(k => !string.IsNullOrWhiteSpace(k))
                .Select(k => k!)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            foreach (var k in bersih)
                _db.ProsedurDokumenKompartemen.Add(new ProsedurDokumenKompartemen { IdDokumen = idDokumen, Kompartemen = k });
        }
        await _db.SaveChangesAsync();
    }

    // Tarik/aktifkan sebuah versi. Mengaktifkan (Berlaku) menonaktifkan versi berlaku lain.
    public async Task<(bool Ok, string? Error)> SetStatusVersiAsync(string nik, long versiId, string status)
    {
        if (status is not ("Berlaku" or "Usang" or "Ditarik")) return (false, "Status tidak valid.");
        var v = await _db.ProsedurVersi.FirstOrDefaultAsync(x => x.Id == versiId);
        if (v is null) return (false, "Versi tidak ditemukan.");
        var dokV = await _db.ProsedurDokumen.FirstOrDefaultAsync(d => d.Id == v.IdDokumen);
        if (dokV is null || !await BisaKelolaAsync(nik, dokV)) return (false, ForbidMsg);
        if (status == "Berlaku")
        {
            var lain = await _db.ProsedurVersi.Where(x => x.IdDokumen == v.IdDokumen && x.Status == "Berlaku" && x.Id != versiId).ToListAsync();
            foreach (var o in lain) o.Status = "Usang";
        }
        v.Status = status;
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> DeleteAsync(string nik, long id)
    {
        var dok = await _db.ProsedurDokumen.FirstOrDefaultAsync(d => d.Id == id);
        if (dok is null) return (false, "Dokumen tidak ditemukan.");
        if (!await BisaKelolaAsync(nik, dok)) return (false, ForbidMsg);
        var acks = await _db.ProsedurAcknowledgement.Where(a => a.IdDokumen == id).ToListAsync();
        _db.ProsedurAcknowledgement.RemoveRange(acks);
        var komp = await _db.ProsedurDokumenKompartemen.Where(k => k.IdDokumen == id).ToListAsync();
        _db.ProsedurDokumenKompartemen.RemoveRange(komp);
        var versi = await _db.ProsedurVersi.Where(v => v.IdDokumen == id).ToListAsync();
        _db.ProsedurVersi.RemoveRange(versi);
        _db.ProsedurDokumen.Remove(dok);
        await _db.SaveChangesAsync();
        return (true, null);
    }

    // Opsi dropdown form: seluruh Departemen (untuk kolom Unit) & Kompartemen dari grading.
    public async Task<ProsedurOpsiDto> GetOpsiAsync()
    {
        var dep = await NamaUnitAsync("Departemen");
        var komp = await NamaUnitAsync("Kompartemen");
        return new ProsedurOpsiDto(dep, komp);
    }

    private async Task<List<string>> NamaUnitAsync(string tipe)
    {
        var hasil = new List<string>();
        var conn = _db.Database.GetDbConnection();
        var mustClose = conn.State != System.Data.ConnectionState.Open;
        if (mustClose) await conn.OpenAsync();
        try
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT nama FROM grading.unit_organisasi WHERE tipe = @tipe ORDER BY nama";
            var p = cmd.CreateParameter();
            p.ParameterName = "@tipe";
            p.Value = tipe;
            cmd.Parameters.Add(p);
            await using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync())
                if (r[0] is string s && !string.IsNullOrWhiteSpace(s)) hasil.Add(s.Trim());
        }
        finally { if (mustClose) await conn.CloseAsync(); }
        return hasil;
    }

    // Departemen (ancestor terdekat) + band urutan dari penempatan aktif pegawai.
    // Dipakai untuk akses dokumen privasi unit: DeptId = departemen orang tsb;
    // Band <= 3 (Kepala Bagian ke atas) = pimpinan unit.
    private async Task<(int? DeptId, string? DeptNama, int? Band)> ResolvePosisiAsync(string? nik)
    {
        if (string.IsNullOrWhiteSpace(nik)) return (null, null, null);
        var conn = _db.Database.GetDbConnection();
        var mustClose = conn.State != System.Data.ConnectionState.Open;
        if (mustClose) await conn.OpenAsync();
        try
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                ;WITH up (id_unit, nama, tipe, id_unit_induk, lvl, urutan) AS (
                    SELECT u.id_unit, u.nama, u.tipe, u.id_unit_induk, 0, b.urutan
                    FROM grading.penempatan p
                    JOIN grading.jabatan j ON j.id_jabatan = p.id_jabatan
                    JOIN grading.band   b ON b.id_band    = j.id_band
                    JOIN grading.unit_organisasi u ON u.id_unit = j.id_unit
                    WHERE p.id_karyawan = @nik AND p.status = 'Aktif'
                    UNION ALL
                    SELECT pu.id_unit, pu.nama, pu.tipe, pu.id_unit_induk, up.lvl + 1, up.urutan
                    FROM grading.unit_organisasi pu
                    JOIN up ON pu.id_unit = up.id_unit_induk
                )
                SELECT TOP 1 id_unit, nama, urutan FROM up WHERE tipe = 'Departemen' ORDER BY lvl;";
            var p = cmd.CreateParameter(); p.ParameterName = "@nik"; p.Value = nik; cmd.Parameters.Add(p);
            await using var r = await cmd.ExecuteReaderAsync();
            if (await r.ReadAsync())
            {
                // id_unit (int) & urutan (tinyint/byte) — pakai Convert.ToInt32 agar aman
                // dari beda tipe numerik (GetInt32 melempar cast bila kolomnya tinyint).
                int? deptId = r.IsDBNull(0) ? null : Convert.ToInt32(r.GetValue(0));
                string? deptNama = r.IsDBNull(1) ? null : r.GetString(1);
                int? band = r.IsDBNull(2) ? null : Convert.ToInt32(r.GetValue(2));
                return (deptId, deptNama, band);
            }
            return (null, null, null);
        }
        finally { if (mustClose) await conn.CloseAsync(); }
    }

    // Boleh membaca dokumen? 'Umum' -> semua; 'Unit' -> Admin Kepatuhan atau anggota departemen pemilik.
    private async Task<bool> BisaBacaAsync(string nik, ProsedurDokumen dok)
    {
        if (dok.Lingkup != "Unit") return true;
        if (await _access.IsProsedurAdminAsync(nik)) return true;
        var posisi = await ResolvePosisiAsync(nik);
        return posisi.DeptId is not null && dok.IdUnitPemilik == posisi.DeptId;
    }

    // Boleh kelola (ubah/versi/status/hapus/daftar-baca)? Admin Kepatuhan, atau pimpinan
    // unit (band <= 3) di departemen pemilik dokumen 'Unit'.
    private async Task<bool> BisaKelolaAsync(string nik, ProsedurDokumen dok, bool? isAdmin = null)
    {
        if (isAdmin ?? await _access.IsProsedurAdminAsync(nik)) return true;
        if (dok.Lingkup != "Unit") return false;
        var posisi = await ResolvePosisiAsync(nik);
        return posisi.Band is int b && b <= 3 && posisi.DeptId is not null && dok.IdUnitPemilik == posisi.DeptId;
    }

    private const string ForbidMsg = "Anda tidak berwenang mengelola dokumen ini.";
    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static (bool, string?) ValidasiMeta(UbahDokumenRequest m)
    {
        if (string.IsNullOrWhiteSpace(m.Kode)) return (false, "Kode/nomor dokumen wajib diisi.");
        if (string.IsNullOrWhiteSpace(m.Judul)) return (false, "Judul dokumen wajib diisi.");
        if (m.Jenis is not ("SOP" or "Kebijakan" or "Instruksi Kerja" or "Formulir")) return (false, "Jenis dokumen tidak valid.");
        return (true, null);
    }
}

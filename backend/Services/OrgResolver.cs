using Microsoft.EntityFrameworkCore;
using SsoBackend.Data;

namespace SsoBackend.Services;

// Unit organisasi (Departemen + Kompartemen) hasil resolusi, ditelusuri lewat
// grading.penempatan -> jabatan -> unit_organisasi dan naik ke atas mengikuti
// id_unit_induk.
public record OrgUnit(int? IdDepartemen, string? NamaDepartemen, int? IdKompartemen, string? NamaKompartemen);

// Ringkas unit untuk dropdown Departemen Tujuan.
public record UnitRingkas(int Id, string Nama, string Tipe);

// Menentukan departemen & kompartemen (dari NIK atau dari unit), kepala unit
// (Manager/GM) untuk alur pengesahan, dan merangkai nomor registrasi inovasi.
// Semua data dari db_mygcs (grading.* + inovasi.*), lewat InovasiDbContext.
public class OrgResolver
{
    private readonly InovasiDbContext _db;

    public OrgResolver(InovasiDbContext db)
    {
        _db = db;
    }

    public async Task<OrgUnit> ResolveAsync(string? idKaryawan)
    {
        if (string.IsNullOrWhiteSpace(idKaryawan))
        {
            return new OrgUnit(null, null, null, null);
        }

        var unitId = await (
            from p in _db.Penempatan
            join j in _db.Jabatan on p.IdJabatan equals j.IdJabatan
            where p.IdKaryawan == idKaryawan && p.Status == "Aktif"
            select j.IdUnit).FirstOrDefaultAsync();

        if (unitId is not null) return await ResolveUnitAsync(unitId.Value);

        // Pegawai organik tak ditemukan di penempatan -> coba pegawai TKNO.
        var tkno = await _db.PegawaiTkno.AsNoTracking()
            .FirstOrDefaultAsync(t => t.IdKaryawan == idKaryawan);
        var tknoUnit = tkno?.IdDepartemen ?? tkno?.IdKompartemen;
        return tknoUnit is null ? new OrgUnit(null, null, null, null) : await ResolveUnitAsync(tknoUnit.Value);
    }

    // Resolusi dept+komp mulai dari sebuah unit organisasi (mis. Departemen Tujuan).
    public async Task<OrgUnit> ResolveUnitAsync(int idUnit)
    {
        var units = await LoadUnitsAsync();
        return ResolveFromUnits(units, idUnit);
    }

    // Resolusi org untuk banyak NIK sekaligus (dipakai memfilter cakupan anggota
    // pada pencarian pegawai). Satu query penempatan + satu muat unit.
    public async Task<Dictionary<string, OrgUnit>> ResolveManyAsync(IReadOnlyCollection<string> niks)
    {
        var result = new Dictionary<string, OrgUnit>();
        if (niks is null || niks.Count == 0) return result;
        var distinct = niks.Where(n => !string.IsNullOrWhiteSpace(n)).Distinct().ToList();
        if (distinct.Count == 0) return result;

        var pairs = await (
            from p in _db.Penempatan
            join j in _db.Jabatan on p.IdJabatan equals j.IdJabatan
            where distinct.Contains(p.IdKaryawan) && p.Status == "Aktif"
            select new { p.IdKaryawan, j.IdUnit }).ToListAsync();

        var units = await LoadUnitsAsync();
        foreach (var pr in pairs)
        {
            if (pr.IdUnit is int uid && !result.ContainsKey(pr.IdKaryawan))
                result[pr.IdKaryawan] = ResolveFromUnits(units, uid);
        }

        // NIK yang belum ter-resolve organik -> lengkapi dari pegawai TKNO.
        var sisa = distinct.Where(n => !result.ContainsKey(n)).ToList();
        if (sisa.Count > 0)
        {
            var tkno = await _db.PegawaiTkno.AsNoTracking()
                .Where(t => sisa.Contains(t.IdKaryawan))
                .Select(t => new { t.IdKaryawan, Unit = t.IdDepartemen ?? t.IdKompartemen })
                .ToListAsync();
            foreach (var t in tkno)
                if (t.Unit is int uid) result[t.IdKaryawan] = ResolveFromUnits(units, uid);
        }
        return result;
    }

    // Fallback resolusi departemen+kompartemen dari NAMA departemen (bukan NIK) - dipakai
    // saat seorang pegawai tidak punya baris di grading.penempatan maupun pegawai_tkno (mis.
    // sedang cuti panjang sehingga penempatannya nonaktif/dihapus), tapi PEGAWAI_SDM.BAGIAN
    // di GCS sudah menyebut nama departemennya secara eksplisit. Tanpa ini kolom
    // Departemen/Kompartemen pada Daftar Pegawai tampil kosong padahal datanya sebenarnya ada.
    public async Task<Dictionary<string, OrgUnit>> ResolveManyByDepartemenNamaAsync(IReadOnlyCollection<string> namaDepartemens)
    {
        var result = new Dictionary<string, OrgUnit>(StringComparer.OrdinalIgnoreCase);
        if (namaDepartemens is null || namaDepartemens.Count == 0) return result;
        var distinct = namaDepartemens.Where(n => !string.IsNullOrWhiteSpace(n)).Select(n => n.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        if (distinct.Count == 0) return result;

        var units = await LoadUnitsAsync();
        var byNama = units.Values
            .Where(u => u.Tipe is "Departemen" or "Region" or "Kelompok")
            .GroupBy(u => u.Nama, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First().IdUnit, StringComparer.OrdinalIgnoreCase);

        foreach (var nama in distinct)
        {
            if (byNama.TryGetValue(nama, out var idUnit))
                result[nama] = ResolveFromUnits(units, idUnit);
        }
        return result;
    }

    // Semua NIK penempatan aktif yang berada dalam cakupan sebuah unit
    // (departemen bila asDepartemen, atau kompartemen). Kebalikan dari ResolveAsync:
    // dipakai untuk menampilkan daftar pegawai default (tanpa mengetik) pada
    // pemilih anggota gugus & halaman Daftar Pegawai.
    public async Task<IReadOnlyList<string>> ListNiksInScopeAsync(int scopeUnitId, bool asDepartemen)
    {
        var units = await LoadUnitsAsync();
        var pairs = await (
            from p in _db.Penempatan
            join j in _db.Jabatan on p.IdJabatan equals j.IdJabatan
            where p.Status == "Aktif" && j.IdUnit != null
            select new { p.IdKaryawan, j.IdUnit }).ToListAsync();

        var niks = new HashSet<string>();
        foreach (var pr in pairs)
        {
            if (pr.IdUnit is not int uid || string.IsNullOrWhiteSpace(pr.IdKaryawan)) continue;
            var org = ResolveFromUnits(units, uid);
            var match = asDepartemen ? org.IdDepartemen == scopeUnitId : org.IdKompartemen == scopeUnitId;
            if (match) niks.Add(pr.IdKaryawan);
        }

        // Pegawai TKNO (di luar penempatan) - ikut disaring lewat unit-nya sendiri.
        var tkno = await _db.PegawaiTkno.AsNoTracking()
            .Select(t => new { t.IdKaryawan, Unit = t.IdDepartemen ?? t.IdKompartemen })
            .ToListAsync();
        foreach (var t in tkno)
        {
            if (t.Unit is not int uid || string.IsNullOrWhiteSpace(t.IdKaryawan)) continue;
            var org = ResolveFromUnits(units, uid);
            var match = asDepartemen ? org.IdDepartemen == scopeUnitId : org.IdKompartemen == scopeUnitId;
            if (match) niks.Add(t.IdKaryawan);
        }
        return niks.ToList();
    }

    // Nama jabatan aktif (grading) untuk mengisi kolom Jabatan anggota.
    public async Task<string?> ResolveJabatanNamaAsync(string? nik)
    {
        if (string.IsNullOrWhiteSpace(nik)) return null;
        return await (
            from p in _db.Penempatan
            join j in _db.Jabatan on p.IdJabatan equals j.IdJabatan
            where p.IdKaryawan == nik && p.Status == "Aktif"
            select j.NamaJabatan).FirstOrDefaultAsync();
    }

    // Kepala Bagian Sekretariat/Umum (id_jabatan 38) & Kepala Bagian Administrasi
    // & Pengembangan SDM dan Inovasi (id_jabatan 39) - keduanya diberi menu
    // tambahan "lihat semua" (lintas kompartemen & departemen) pada My Innovation,
    // di luar peran GM/Manager/Karyawan yang sudah ada.
    private static readonly int[] JabatanGlobalViewerInovasi = [38, 39];

    // Band 0 (Direksi - Direktur Utama & Direktur) - lihat semua inovasi (Sumbang
    // Gagasan & SS/5R/GIO) lintas kompartemen/departemen, read-only, sama pola dgn
    // JabatanGlobalViewerInovasi di atas (2026-08-11, diminta user).
    private const byte BandGlobalViewerInovasi = 0;

    public async Task<bool> IsGlobalInovasiViewerAsync(string? nik)
    {
        if (string.IsNullOrWhiteSpace(nik)) return false;
        return await (
            from p in _db.Penempatan
            join j in _db.Jabatan on p.IdJabatan equals j.IdJabatan
            where p.IdKaryawan == nik && p.Status == "Aktif"
                  && (JabatanGlobalViewerInovasi.Contains(p.IdJabatan) || j.IdBand == BandGlobalViewerInovasi)
            select p.IdKaryawan).AnyAsync();
    }

    // Verifikator Sumbang Gagasan khusus Departemen SDM bergilir tiap kuartal
    // antara dua Kepala Bagian (grading.penempatan id 24 & 25), menggantikan
    // Manager departemen (ResolveKepalaUnitAsync) yang saat ini kosong di sana
    // (lihat catatan ResolveKepalaUnitAsync di atas). Giliran: Apr-Jun & Okt-Des
    // -> id 24, Jul-Sep & Jan-Mar -> id 25. Kuartal fiskal (dimulai April) genap
    // selalu jatuh ke 24 karena tiap tahun selalu 4 kuartal (genap), jadi giliran
    // tidak pernah bergeser tanpa perlu tahun acuan.
    private const int VerifikatorSdmPenempatanGenap = 24;
    private const int VerifikatorSdmPenempatanGanjil = 25;

    public async Task<(string? Nik, string? Nama)?> ResolveVerifikatorRotasiSdmAsync()
    {
        var kuartalFiskal = ((DateTime.Now.Month - 4 + 12) % 12) / 3;   // 0=Apr-Jun,1=Jul-Sep,2=Okt-Des,3=Jan-Mar
        var idPenempatan = kuartalFiskal % 2 == 0 ? VerifikatorSdmPenempatanGenap : VerifikatorSdmPenempatanGanjil;
        var p = await _db.Penempatan.AsNoTracking().FirstOrDefaultAsync(x => x.Id == idPenempatan);
        return p is null ? null : (p.IdKaryawan, p.Nama);
    }

    private static OrgUnit ResolveFromUnits(Dictionary<int, UnitRow> units, int idUnit)
    {
        int? deptId = null; string? deptNama = null;
        int? kompId = null; string? kompNama = null;

        var cursor = units.GetValueOrDefault(idUnit);
        var guard = 0;
        while (cursor is not null && guard++ < 10)
        {
            switch (cursor.Tipe)
            {
                case "Departemen":
                case "Region":
                case "Kelompok":
                    deptId ??= cursor.IdUnit;
                    deptNama ??= cursor.Nama;
                    break;
                case "Kompartemen":
                    kompId ??= cursor.IdUnit;
                    kompNama ??= cursor.Nama;
                    break;
            }
            cursor = cursor.IdUnitInduk is { } indukId ? units.GetValueOrDefault(indukId) : null;
        }
        return new OrgUnit(deptId, deptNama, kompId, kompNama);
    }

    // Kepala (pangkat tertinggi = id_band terkecil, lalu id_jabatan terkecil) yang
    // jabatannya berada di unit tsb - dipakai sebagai Manager (Fasilitator /
    // Reviewer) untuk Departemen, atau GM (Verifikator / VP) untuk Kompartemen.
    //
    // Cakupannya termasuk unit ANAK (Bagian di bawah Departemen). Sebelum struktur
    // Bagian ada, seluruh Kepala Bagian menempel langsung di Departemen sehingga
    // pencarian satu tingkat sudah cukup; setelah Bagian dipisah, Departemen yang
    // tidak punya Manager terisi (mis. Departemen SDM & Region Lampung) menjadi
    // TIDAK punya kepala sama sekali - akibatnya Verifikator/GM pada rantai
    // pengesahan gagasan kosong dan gagasannya mandek karena tak seorang pun
    // berhak menandatangani.
    //
    // Urutan band didahulukan (sesuai keterangan di atas): tanpa itu urutan hanya
    // mengikuti id_jabatan, sehingga staf ber-id kecil bisa mengalahkan Manager.
    public async Task<(string? Nik, string? Nama)?> ResolveKepalaUnitAsync(int? idUnit)
    {
        if (idUnit is null) return null;
        var kepala = await (
            from p in _db.Penempatan
            join j in _db.Jabatan on p.IdJabatan equals j.IdJabatan
            join u in _db.UnitOrganisasi on j.IdUnit equals u.IdUnit
            where p.Status == "Aktif" && (u.IdUnit == idUnit || u.IdUnitInduk == idUnit)
            orderby j.IdBand, j.IdJabatan
            select new { p.IdKaryawan, p.Nama }).FirstOrDefaultAsync();
        return kepala is null ? null : (kepala.IdKaryawan, kepala.Nama);
    }

    // Direktorat yang menaungi sebuah unit, ditelusuri naik lewat id_unit_induk
    // (Departemen -> Kompartemen -> Direktorat). null bila unitnya memang tidak
    // bernaung di direktorat mana pun (mis. Departemen Audit Internal).
    public async Task<UnitRingkas?> ResolveDirektoratAsync(int? idUnit)
    {
        if (idUnit is null) return null;
        var units = await LoadUnitsAsync();

        var cursor = units.GetValueOrDefault(idUnit.Value);
        var guard = 0;
        while (cursor is not null && guard++ < 10)
        {
            if (cursor.Tipe == "Direktorat") return new UnitRingkas(cursor.IdUnit, cursor.Nama, cursor.Tipe);
            cursor = cursor.IdUnitInduk is { } indukId ? units.GetValueOrDefault(indukId) : null;
        }
        return null;
    }

    // Direktur yang membawahi sebuah unit - dipakai sebagai pengesah tambahan pada
    // Lembar Pengesahan GIO, mengikuti Departemen Tujuan gugus.
    //
    // Jabatan Direktur di grading.jabatan TIDAK punya id_unit (kolomnya NULL), jadi
    // tidak bisa dicari lewat ResolveKepalaUnitAsync. Pencocokannya lewat nama:
    // "Direktorat Keuangan" -> jabatan "Direktur Keuangan". Perbandingan nama persis,
    // supaya "Staf Khusus Direktur Keuangan" tidak ikut terambil.
    public async Task<(string Peran, string? Nik, string? Nama)?> ResolveDirekturAsync(int? idUnit)
    {
        var direktorat = await ResolveDirektoratAsync(idUnit);
        if (direktorat is null) return null;

        var peran = direktorat.Nama.Replace("Direktorat", "Direktur", StringComparison.OrdinalIgnoreCase).Trim();

        var orang = await (
            from j in _db.Jabatan
            join p in _db.Penempatan on j.IdJabatan equals p.IdJabatan
            where j.NamaJabatan == peran && p.Status == "Aktif"
            orderby j.IdJabatan
            select new { p.IdKaryawan, p.Nama }).FirstOrDefaultAsync();

        // Kursinya bisa saja sedang kosong; barisnya tetap dibuat supaya lembar
        // pengesahan menunjukkan tahap yang wajib dilalui.
        return (peran, orang?.IdKaryawan, orang?.Nama);
    }

    // Daftar unit yang bisa dipilih sebagai Departemen Tujuan gagasan.
    public async Task<IReadOnlyList<UnitRingkas>> ListDepartemenAsync()
    {
        return await _db.UnitOrganisasi
            .Where(u => u.Tipe == "Departemen" || u.Tipe == "Region" || u.Tipe == "Kelompok")
            .OrderBy(u => u.Nama)
            .Select(u => new UnitRingkas(u.IdUnit, u.Nama, u.Tipe))
            .ToListAsync();
    }

    // Daftar Kompartemen - untuk filter direktori pegawai.
    public async Task<IReadOnlyList<UnitRingkas>> ListKompartemenAsync()
    {
        return await _db.UnitOrganisasi
            .Where(u => u.Tipe == "Kompartemen")
            .OrderBy(u => u.Nama)
            .Select(u => new UnitRingkas(u.IdUnit, u.Nama, u.Tipe))
            .ToListAsync();
    }

    // Nomor registrasi gugus: {jenis}-{urut per-jenis di departemen}/{urut per-jenis
    // di kompartemen}/{tahun}. Urutan dihitung PER metodologi sehingga nomor
    // menunjukkan jumlah inovasi SS/5R/GIO dari departemen & kompartemen, plus tahun.
    // Contoh: "SS-03/07/2026" = SS ke-3 di departemen, ke-7 di kompartemen, tahun 2026.
    public async Task<string> GenerateNoRegistrasiAsync(string jenis, string periode, int? idDepartemen, int? idKompartemen)
    {
        var tahun = periode.Length >= 4 ? periode[..4] : DateTime.Now.Year.ToString();

        var deptSeq = idDepartemen is null
            ? 1
            : await _db.Gugus.CountAsync(g => g.Jenis == jenis && g.IdDepartemen == idDepartemen && g.NoRegistrasi != null) + 1;

        var kompSeq = idKompartemen is null
            ? 1
            : await _db.Gugus.CountAsync(g => g.Jenis == jenis && g.IdKompartemen == idKompartemen && g.NoRegistrasi != null) + 1;

        return $"{jenis}-{deptSeq:00}/{kompSeq:00}/{tahun}";
    }

    // Nomor registrasi gagasan: SG-{tahun}-{urut global}.
    public async Task<string> GenerateNoGagasanAsync()
    {
        var tahun = DateTime.Now.Year;
        var seq = await _db.Gagasan.CountAsync(g => g.NoRegistrasi != null) + 1;
        return $"SG-{tahun}-{seq:0000}";
    }

    private async Task<Dictionary<int, UnitRow>> LoadUnitsAsync()
    {
        var units = await _db.UnitOrganisasi
            .Select(u => new UnitRow(u.IdUnit, u.Nama, u.Tipe, u.IdUnitInduk))
            .ToListAsync();
        return units.ToDictionary(u => u.IdUnit);
    }

    private record UnitRow(int IdUnit, string Nama, string Tipe, int? IdUnitInduk);
}

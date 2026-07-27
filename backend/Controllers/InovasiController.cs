using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Data;
using SsoBackend.Models.Dto;
using SsoBackend.Models.Inovasi;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

// Modul My Innovation - sisi Karyawan (pengaju/gugus). Menangani Sistem Saran
// (SS) secara penuh (identitas gugus, PLAN P.1-P.8, pengesahan, DO/CHECK/ACTION)
// dan berbagi skema dengan GIO (yang untuk tahap ini digarap di frontend saja).
[ApiController]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
[Route("inovasi")]
[ModuleGate("my-innovation")]
public class InovasiController : ControllerBase
{
    private static readonly string[] Faktor4M1E = ["Man", "Method", "Machine", "Material", "Environment"];
    private static readonly string[] AllowedExt = [".pdf", ".png", ".jpg", ".jpeg", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"];
    private const long MaxUploadBytes = 15 * 1024 * 1024;

    private readonly InovasiDbContext _db;
    private readonly GcsDbContext _gcs;
    private readonly CurrentUserContext _currentUser;
    private readonly OrgResolver _org;
    private readonly IConfiguration _config;
    private readonly IWebHostEnvironment _env;

    public InovasiController(
        InovasiDbContext db, GcsDbContext gcs, CurrentUserContext currentUser,
        OrgResolver org, IConfiguration config, IWebHostEnvironment env)
    {
        _db = db;
        _gcs = gcs;
        _currentUser = currentUser;
        _org = org;
        _config = config;
        _env = env;
    }

    // ------------------------------------------------------------------ list
    // jenis kosong / "ALL" => semua metodologi (SS/GIO/5R). My Innovation kini
    // satu ruang kerja terpadu; risalah dibedakan lewat kolom metodologi.
    [HttpGet("gugus")]
    public async Task<ActionResult<GugusListDto>> List([FromQuery] string? jenis = null)
    {
        var (nik, nama) = await IdentitasAsync();
        if (nik is null) return Unauthorized(new { message = "Akun tidak tertaut ke NIK pegawai." });

        var semua = string.IsNullOrWhiteSpace(jenis) || jenis.Equals("ALL", StringComparison.OrdinalIgnoreCase);
        var jn = semua ? null : NormalizeJenis(jenis);

        // Cakupan atasan: Manager (band 2) melihat seluruh risalah di departemennya;
        // GM (band 1) melihat seluruh risalah di kompartemennya. Selain itu tetap
        // melihat risalah miliknya, tempat ia jadi anggota (termasuk Fasilitator),
        // atau yang menunggu tanda tangannya.
        var org = await _org.ResolveAsync(nik);
        var band = await (
            from p in _db.Penempatan
            join j in _db.Jabatan on p.IdJabatan equals j.IdJabatan
            where p.IdKaryawan == nik && p.Status == "Aktif"
            select (byte?)j.IdBand).FirstOrDefaultAsync();
        int? scopeDept = band == 2 ? org.IdDepartemen : null;   // Manager -> seluruh departemen
        int? scopeKomp = band == 1 ? org.IdKompartemen : null;  // GM -> seluruh kompartemen

        IQueryable<Models.Inovasi.Gugus> q = _db.Gugus.AsNoTracking();
        if (!semua) q = q.Where(g => g.Jenis == jn);

        var rows = await q
            .Where(g =>
                g.CreatedByNik == nik ||
                g.Anggota.Any(a => a.Nik == nik) ||
                g.Pengesahan.Any(p => p.Nik == nik) ||
                (scopeDept != null && g.IdDepartemen == scopeDept) ||
                (scopeKomp != null && g.IdKompartemen == scopeKomp) ||
                // Juri panel yang ditugaskan menilai risalah ini juga melihatnya.
                _db.PenilaianPenugasan.Any(pp => pp.IdGugus == g.Id
                    && _db.PenilaianStreamAnggota.Any(a => a.IdStream == pp.IdStream && a.Nik == nik)))
            .OrderByDescending(g => g.UpdatedAt ?? g.CreatedAt)
            .Select(g => new
            {
                g.Id, g.Jenis, g.NoRegistrasi, g.NamaGugus, g.TemaKe, g.Periode, g.Judul,
                g.NamaDepartemen, g.NamaKompartemen, g.Status, g.PlanDisahkan, g.CreatedByNik,
                g.IdDepartemen, g.IdKompartemen, g.CreatedAt, g.UpdatedAt,
                GagasanJudul = _db.Gagasan.Where(x => x.Id == g.IdGagasan).Select(x => x.Judul).FirstOrDefault(),
                KetuaNama = g.Anggota.Where(a => a.Peran == "Ketua").Select(a => a.Nama).FirstOrDefault(),
                PeranAnggota = g.Anggota.Where(a => a.Nik == nik).Select(a => a.Peran).FirstOrDefault(),
                PeranPengesah = g.Pengesahan.Where(p => p.Nik == nik).Select(p => p.Peran).FirstOrDefault(),
                // Juri bila NIK saya ada di panel penilai yang ditugaskan ke risalah ini.
                SayaJuri = _db.PenilaianPenugasan.Any(pp => pp.IdGugus == g.Id
                    && _db.PenilaianStreamAnggota.Any(a => a.IdStream == pp.IdStream && a.Nik == nik)),
                // Sudah dinilai bila ada penugasan juri yang memuat skor.
                SudahDinilai = _db.PenilaianPenugasan.Any(pp => pp.IdGugus == g.Id
                    && _db.PenilaianSkor.Any(s => s.IdPenugasan == pp.Id)),
            })
            .ToListAsync();

        var items = rows.Select(g => new GugusRingkasDto(
            g.Id, g.Jenis, g.NoRegistrasi, g.NamaGugus, g.TemaKe, g.Periode, g.Judul,
            g.NamaDepartemen, g.NamaKompartemen, g.Status, g.PlanDisahkan,
            PeranSaya:
                g.CreatedByNik == nik ? "Pengaju"
                : g.PeranAnggota ?? g.PeranPengesah
                    ?? (scopeDept != null && g.IdDepartemen == scopeDept ? "Verifikator"
                        : scopeKomp != null && g.IdKompartemen == scopeKomp ? "GM"
                        : g.SayaJuri ? "Juri" : "-"),
            g.KetuaNama, g.CreatedAt, g.UpdatedAt, g.GagasanJudul, g.SudahDinilai)).ToList();

        return Ok(new GugusListDto(items));
    }

    // -------------------------------------------------------- history approval
    // Jejak Lembar Pengesahan (PLAN & FINAL) risalah yang menyangkut pengguna:
    // miliknya, tempat ia jadi anggota, atau yang ia tandatangani. Satu baris =
    // satu langkah pengesahan, sehingga Manager/GM bisa menelusuri risalah apa
    // saja yang pernah ia verifikasi beserta waktunya.
    [HttpGet("history/gugus")]
    public async Task<ActionResult<RiwayatApprovalListDto>> HistoryApproval()
    {
        var (nik, _) = await IdentitasAsync();
        if (nik is null) return Unauthorized(new { message = "Akun tidak tertaut ke NIK pegawai." });

        var items = await _db.Gugus.AsNoTracking()
            .Where(g => g.CreatedByNik == nik || g.Anggota.Any(a => a.Nik == nik) || g.Pengesahan.Any(p => p.Nik == nik))
            .SelectMany(g => g.Pengesahan, (g, p) => new RiwayatApprovalDto(
                "Inovasi", g.Id, g.NoRegistrasi, g.Judul ?? g.NamaGugus, g.Jenis,
                g.NamaDepartemen ?? g.NamaKompartemen, p.Tahap,
                p.Peran, p.Nik, p.Nama, p.Status, p.Komentar, p.Tgl,
                g.Status, g.CreatedAt, p.Nik == nik))
            .ToListAsync();

        var sorted = items.OrderByDescending(x => x.Tgl ?? x.TargetCreatedAt).ToList();
        return Ok(new RiwayatApprovalListDto(sorted));
    }

    // ---------------------------------------------------------------- create
    [HttpPost("gugus")]
    public async Task<ActionResult<GugusDetailDto>> Create(CreateGugusRequest req)
    {
        var (nik, nama) = await IdentitasAsync();
        if (nik is null) return Unauthorized(new { message = "Akun tidak tertaut ke NIK pegawai." });

        var jenis = NormalizeJenis(req.Jenis);
        var periode = string.IsNullOrWhiteSpace(req.Periode) ? DefaultPeriode() : req.Periode.Trim();

        var org = await _org.ResolveAsync(nik);

        var gugus = new Gugus
        {
            Jenis = jenis,
            Periode = periode,
            TemaKe = req.TemaKe,
            NamaGugus = req.NamaGugus?.Trim(),
            IdDepartemen = org.IdDepartemen,
            NamaDepartemen = org.NamaDepartemen,
            IdKompartemen = org.IdKompartemen,
            NamaKompartemen = org.NamaKompartemen,
            Status = "Draft",
            CreatedByNik = nik,
            CreatedByNama = nama,
            CreatedAt = DateTime.Now,
        };

        // Ketua otomatis = pembuat.
        gugus.Anggota.Add(new Anggota
        {
            Peran = "Ketua", Nik = nik, Nama = nama ?? nik, Urutan = 1,
            Jabatan = await JabatanNamaAsync(nik),
            DepBagian = org.NamaDepartemen ?? org.NamaKompartemen,
        });

        _db.Gugus.Add(gugus);
        await _db.SaveChangesAsync();

        return await Detail(gugus.Id);
    }

    // -------------------------------------------------------------- get detail
    [HttpGet("gugus/{id:int}")]
    public async Task<ActionResult<GugusDetailDto>> Detail(int id)
    {
        var (nik, _) = await IdentitasAsync();
        if (nik is null) return Unauthorized(new { message = "Akun tidak tertaut ke NIK pegawai." });

        var g = await LoadFullAsync(id);
        if (g is null) return NotFound(new { message = "Inovasi tidak ditemukan." });
        if (!await MayViewScopeAsync(g, nik)) return Forbid();

        var bisaEdit = g.CreatedByNik == nik && (g.Status is "Draft" or "Revisi");

        var (idTujuan, namaTujuan) = await DepartemenTujuanAsync(g);

        var pengesahan = g.Pengesahan.OrderBy(p => p.Tahap).ThenBy(p => p.Urutan)
            .Select(p => new PengesahanDto(p.Id, p.Tahap, p.Peran, p.Nik, p.Nama, p.Urutan, p.Status, p.Komentar, p.Tgl,
                BisaSaya: BisaTandaTangan(g, p, nik)))
            .ToList();

        return Ok(new GugusDetailDto(
            g.Id, g.Jenis, g.NoRegistrasi, g.NamaGugus, g.TemaKe, g.Periode,
            g.IdDepartemen, g.NamaDepartemen, g.IdKompartemen, g.NamaKompartemen, g.BagianSeksi,
            g.Judul, g.LatarBelakang, g.MasalahUtama, g.VerifikasiAkar, g.VerifikasiStatistik,
            g.AreaLokasi, g.ProfilDenahPath, g.ProfilDenahNama, g.DampakPositif, g.DampakPositifLainnya,
            g.LimaRJadwal, g.LimaRCatatan, g.LimaRDokumentasi,
            g.IdGagasan, g.ActionTemaBerikutnya,
            g.Status, g.PlanDisahkan, g.CreatedByNik, g.CreatedByNama, bisaEdit,
            IsOwner: g.CreatedByNik == nik,
            g.CreatedAt, g.UpdatedAt, g.SubmittedAt,
            g.Anggota.OrderBy(a => a.Urutan).Select(a => new AnggotaDto(a.Id, a.Peran, a.Nik, a.Nama, a.Jabatan, a.DepBagian, a.Urutan)).ToList(),
            g.DataPendukung.OrderBy(x => x.Urutan).Select(x => new DataPendukungDto(x.Id, x.Indikator, x.KondisiAwal, x.SumberKeterangan, x.LampiranPath, x.LampiranNama, x.LampiranLink, x.Urutan)).ToList(),
            g.Jadwal.Select(x => new JadwalDto(x.Id, x.Tahapan, x.Jenis, x.Bulan, x.Jumlah, x.Rentang)).ToList(),
            g.Sasaran.OrderBy(x => x.Urutan).Select(x => new SasaranDto(x.Id, x.SasaranText, x.KondisiSebelum, x.Target, x.Indikator, x.Urutan)).ToList(),
            g.Pareto.OrderBy(x => x.Urutan).Select(x => new ParetoDto(x.Id, x.Kategori, x.Frekuensi, x.Urutan)).ToList(),
            g.Qcdse.Select(x => new QcdseDto(x.Id, x.Aspek, x.DampakKualitatif, x.DampakKuantitatif)).ToList(),
            g.Fishbone.Select(x => new FishboneDto(x.Id, x.Faktor, x.Penyebab, x.AkarDominan, x.Prioritas)).ToList(),
            g.RencanaPerbaikan.OrderBy(x => x.Urutan).Select(x => new RencanaPerbaikanDto(x.Id, x.AkarPenyebab, x.What, x.Why, x.Dimana, x.Kapan, x.Who, x.How, x.HowMuch, x.Urutan)).ToList(),
            pengesahan,
            g.DoPelaksanaan.OrderBy(x => x.Urutan).Select(x => new DoPelaksanaanDto(x.Id, x.TahapanKegiatan, x.MonitoringHasil, x.Tanggal, x.EvidencePath, x.EvidenceNama, x.Urutan)).ToList(),
            g.DoKendala.OrderBy(x => x.Urutan).Select(x => new DoKendalaDto(x.Id, x.Kendala, x.Solusi, x.Waktu, x.Pic, x.Urutan)).ToList(),
            g.CheckPerbandingan.OrderBy(x => x.Urutan).Select(x => new CheckPerbandinganDto(x.Id, x.Sebelum, x.Sesudah, x.Urutan)).ToList(),
            g.CheckSasaran.OrderBy(x => x.Urutan).Select(x => new CheckSasaranDto(x.Id, x.SasaranText, x.Sebelum, x.Target, x.Sesudah, x.PersenCapaian, x.Urutan)).ToList(),
            g.CheckBiaya.OrderBy(x => x.Urutan).Select(x => new CheckBiayaDto(x.Id, x.Komponen, x.Perhitungan, x.Nilai, x.Urutan)).ToList(),
            g.CheckRisiko.OrderBy(x => x.Urutan).Select(x => new CheckRisikoDto(x.Id, x.DampakNegatif, x.Mitigasi, x.Urutan)).ToList(),
            g.ActionStandarisasi.OrderBy(x => x.Urutan).Select(x => new ActionStandarisasiDto(x.Id, x.StandarBaru, x.NoDokumen, x.TglBerlaku, x.Pic, x.Urutan)).ToList(),
            g.ActionTindakLanjut.OrderBy(x => x.Urutan).Select(x => new ActionTindakLanjutDto(x.Id, x.Rencana, x.TargetWaktu, x.Pic, x.Status, x.Urutan)).ToList(),
            idTujuan, namaTujuan));
    }

    // ------------------------------------------------------------- save PLAN
    [HttpPut("gugus/{id:int}/plan")]
    public async Task<IActionResult> SavePlan(int id, SavePlanRequest req)
    {
        var (nik, _) = await IdentitasAsync();
        if (nik is null) return Unauthorized();

        var g = await LoadFullAsync(id, tracking: true);
        if (g is null) return NotFound(new { message = "Inovasi tidak ditemukan." });
        if (g.CreatedByNik != nik) return Forbid();
        if (g.Status is not ("Draft" or "Revisi"))
            return BadRequest(new { message = "Risalah sudah diajukan; tahap PLAN tidak bisa diubah lagi." });

        g.NamaGugus = req.NamaGugus?.Trim();
        g.TemaKe = req.TemaKe;
        g.BagianSeksi = req.BagianSeksi;
        if (!string.IsNullOrWhiteSpace(req.Periode)) g.Periode = req.Periode.Trim();
        g.Judul = req.Judul?.Trim();
        g.LatarBelakang = req.LatarBelakang;
        g.MasalahUtama = req.MasalahUtama?.Trim();
        g.VerifikasiAkar = req.VerifikasiAkar;
        // Bagian khusus 5R (diabaikan/null untuk SS & GIO).
        g.AreaLokasi = req.AreaLokasi;
        g.ProfilDenahPath = req.ProfilDenahPath;
        g.ProfilDenahNama = req.ProfilDenahNama;
        g.DampakPositif = req.DampakPositif;
        g.DampakPositifLainnya = req.DampakPositifLainnya;
        g.LimaRJadwal = req.LimaRJadwal;
        g.LimaRCatatan = req.LimaRCatatan;
        g.LimaRDokumentasi = req.LimaRDokumentasi;
        g.UpdatedAt = DateTime.Now;

        Replace(g.Anggota, req.Anggota, (a, d, i) =>
        {
            a.Peran = d.Peran; a.Nik = d.Nik; a.Nama = d.Nama; a.Jabatan = d.Jabatan; a.DepBagian = d.DepBagian; a.Urutan = d.Urutan == 0 ? i + 1 : d.Urutan;
        });
        Replace(g.DataPendukung, req.DataPendukung, (x, d, i) =>
        {
            x.Indikator = d.Indikator; x.KondisiAwal = d.KondisiAwal; x.SumberKeterangan = d.SumberKeterangan;
            x.LampiranPath = d.LampiranPath; x.LampiranNama = d.LampiranNama; x.LampiranLink = d.LampiranLink; x.Urutan = i;
        });
        Replace(g.Jadwal, req.Jadwal, (x, d, i) => { x.Tahapan = d.Tahapan; x.Jenis = d.Jenis; x.Bulan = d.Bulan; x.Jumlah = d.Jumlah; x.Rentang = d.Rentang; });
        Replace(g.Sasaran, req.Sasaran, (x, d, i) => { x.SasaranText = d.Sasaran; x.KondisiSebelum = d.KondisiSebelum; x.Target = d.Target; x.Indikator = d.Indikator; x.Urutan = i; });
        Replace(g.Pareto, req.Pareto, (x, d, i) => { x.Kategori = d.Kategori; x.Frekuensi = d.Frekuensi; x.Urutan = i; });
        Replace(g.Qcdse, req.Qcdse, (x, d, i) => { x.Aspek = d.Aspek; x.DampakKualitatif = d.DampakKualitatif; x.DampakKuantitatif = d.DampakKuantitatif; });
        Replace(g.Fishbone, req.Fishbone, (x, d, i) => { x.Faktor = d.Faktor; x.Penyebab = d.Penyebab; x.AkarDominan = d.AkarDominan; x.Prioritas = d.Prioritas; });
        Replace(g.RencanaPerbaikan, req.RencanaPerbaikan, (x, d, i) =>
        {
            x.AkarPenyebab = d.AkarPenyebab; x.What = d.What; x.Why = d.Why; x.Dimana = d.Where; x.Kapan = d.When; x.Who = d.Who; x.How = d.How; x.HowMuch = d.HowMuch; x.Urutan = i;
        });

        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ----------------------------------------------------------------- submit
    // Mengajukan risalah ke Lembar Pengesahan tahap PLAN. Membuat baris
    // pengesahan (Ketua auto-setuju), menerbitkan nomor registrasi, mengunci
    // PLAN sampai divalidasi.
    [HttpPost("gugus/{id:int}/submit")]
    public async Task<IActionResult> Submit(int id)
    {
        var (nik, nama) = await IdentitasAsync();
        if (nik is null) return Unauthorized();

        var g = await LoadFullAsync(id, tracking: true);
        if (g is null) return NotFound(new { message = "Inovasi tidak ditemukan." });
        if (g.CreatedByNik != nik) return Forbid();
        if (g.Status is not ("Draft" or "Revisi"))
            return BadRequest(new { message = "Risalah sudah diajukan." });

        if (string.IsNullOrWhiteSpace(g.NamaGugus))
            return BadRequest(new { message = "Nama gugus wajib diisi sebelum diajukan." });
        // 5R (F-5R-02) tidak memuat Judul; SS/GIO wajib.
        if (g.Jenis != "5R" && string.IsNullOrWhiteSpace(g.Judul))
            return BadRequest(new { message = "Judul inovasi wajib diisi sebelum diajukan." });
        if (!g.Anggota.Any(a => a.Peran == "Fasilitator"))
            return BadRequest(new { message = "Fasilitator wajib ditetapkan sebelum diajukan." });

        // Nomor registrasi diterbitkan sekali.
        if (string.IsNullOrWhiteSpace(g.NoRegistrasi))
        {
            g.NoRegistrasi = await _org.GenerateNoRegistrasiAsync(g.Jenis, g.Periode, g.IdDepartemen, g.IdKompartemen);
        }

        // Bangun ulang baris pengesahan tahap PLAN.
        var lama = g.Pengesahan.Where(p => p.Tahap == "PLAN").ToList();
        _db.Pengesahan.RemoveRange(lama);

        var fasil = g.Anggota.FirstOrDefault(a => a.Peran == "Fasilitator");
        var pembinaDept = await _org.ResolveKepalaUnitAsync(g.IdDepartemen);
        var pembinaKomp = await _org.ResolveKepalaUnitAsync(g.IdKompartemen);

        g.Pengesahan.Add(new Pengesahan { Tahap = "PLAN", Peran = "Ketua Gugus", Nik = nik, Nama = nama ?? nik, Urutan = 0, Status = "Disetujui", Tgl = DateTime.Now });
        g.Pengesahan.Add(new Pengesahan { Tahap = "PLAN", Peran = "Fasilitator", Nik = fasil?.Nik, Nama = fasil?.Nama, Urutan = 1, Status = "Menunggu" });
        g.Pengesahan.Add(new Pengesahan { Tahap = "PLAN", Peran = "Pembina Tk. Departemen", Nik = pembinaDept?.Nik, Nama = pembinaDept?.Nama, Urutan = 2, Status = "Menunggu" });
        g.Pengesahan.Add(new Pengesahan { Tahap = "PLAN", Peran = "Pembina Tk. Kompartemen", Nik = pembinaKomp?.Nik, Nama = pembinaKomp?.Nama, Urutan = 3, Status = "Menunggu" });
        await TambahDirekturGioAsync(g, "PLAN");

        g.Status = "Diajukan";
        g.PlanDisahkan = false;
        g.SubmittedAt = DateTime.Now;
        g.UpdatedAt = DateTime.Now;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Risalah diajukan ke Lembar Pengesahan tahap PLAN.", noRegistrasi = g.NoRegistrasi });
    }

    // ------------------------------------------------------- submit final
    // Mengajukan risalah ke Lembar Pengesahan AKHIR (tahap FINAL) setelah
    // DO/CHECK/ACTION terisi. Membuat baris pengesahan akhir (Ketua auto-setuju).
    [HttpPost("gugus/{id:int}/submit-final")]
    public async Task<IActionResult> SubmitFinal(int id)
    {
        var (nik, nama) = await IdentitasAsync();
        if (nik is null) return Unauthorized();

        var g = await LoadFullAsync(id, tracking: true);
        if (g is null) return NotFound(new { message = "Inovasi tidak ditemukan." });
        if (g.CreatedByNik != nik) return Forbid();
        if (!g.PlanDisahkan)
            return BadRequest(new { message = "PLAN belum disahkan; sahkan PLAN dahulu." });
        if (g.Status is "Pengesahan Akhir" or "Selesai")
            return BadRequest(new { message = "Pengesahan akhir sudah diajukan." });

        var adaTahap =
            g.DoPelaksanaan.Count > 0 || g.DoKendala.Count > 0 ||
            g.CheckPerbandingan.Count > 0 || g.CheckSasaran.Count > 0 ||
            g.ActionStandarisasi.Count > 0 || g.ActionTindakLanjut.Count > 0 ||
            !string.IsNullOrWhiteSpace(g.ActionTemaBerikutnya);
        if (!adaTahap)
            return BadRequest(new { message = "Isi tahap DO / CHECK / ACTION dahulu sebelum pengesahan akhir." });

        var lama = g.Pengesahan.Where(p => p.Tahap == "FINAL").ToList();
        _db.Pengesahan.RemoveRange(lama);

        var fasil = g.Anggota.FirstOrDefault(a => a.Peran == "Fasilitator");
        var pembinaDept = await _org.ResolveKepalaUnitAsync(g.IdDepartemen);
        var pembinaKomp = await _org.ResolveKepalaUnitAsync(g.IdKompartemen);

        g.Pengesahan.Add(new Pengesahan { Tahap = "FINAL", Peran = "Ketua Gugus", Nik = nik, Nama = nama ?? nik, Urutan = 0, Status = "Disetujui", Tgl = DateTime.Now });
        g.Pengesahan.Add(new Pengesahan { Tahap = "FINAL", Peran = "Fasilitator", Nik = fasil?.Nik, Nama = fasil?.Nama, Urutan = 1, Status = "Menunggu" });
        g.Pengesahan.Add(new Pengesahan { Tahap = "FINAL", Peran = "Pembina Tk. Departemen", Nik = pembinaDept?.Nik, Nama = pembinaDept?.Nama, Urutan = 2, Status = "Menunggu" });
        g.Pengesahan.Add(new Pengesahan { Tahap = "FINAL", Peran = "Pembina Tk. Kompartemen", Nik = pembinaKomp?.Nik, Nama = pembinaKomp?.Nama, Urutan = 3, Status = "Menunggu" });
        await TambahDirekturGioAsync(g, "FINAL");

        g.Status = "Pengesahan Akhir";
        g.UpdatedAt = DateTime.Now;
        await _db.SaveChangesAsync();
        return Ok(new { message = "Risalah diajukan ke Lembar Pengesahan Akhir." });
    }

    // Departemen Tujuan risalah: departemen yang menjadi sasaran perbaikan. Sumber
    // resminya ada di gagasan asalnya (bisa berbeda dari departemen pengaju bila
    // gagasannya lintas departemen); bila gagasan tidak menyebut tujuan, tujuannya
    // adalah departemen asal. Risalah tanpa gagasan (data lama) memakai departemen
    // gugus itu sendiri.
    private async Task<(int? Id, string? Nama)> DepartemenTujuanAsync(Gugus g)
    {
        if (g.IdGagasan is int gid)
        {
            var t = await _db.Gagasan.AsNoTracking()
                .Where(x => x.Id == gid)
                .Select(x => new { x.IdDepartemenTujuan, x.NamaDepartemenTujuan, x.IdDepartemenAsal, x.NamaDepartemenAsal })
                .FirstOrDefaultAsync();
            if (t is not null)
                return (t.IdDepartemenTujuan ?? t.IdDepartemenAsal, t.NamaDepartemenTujuan ?? t.NamaDepartemenAsal);
        }
        return (g.IdDepartemen, g.NamaDepartemen);
    }

    // GIO wajib disahkan pula oleh Direktur yang membawahi Departemen Tujuan
    // (Direktur Komersil atau Direktur Keuangan, mengikuti direktorat induknya).
    // SS & 5R berhenti di Pembina Tk. Kompartemen. Bila departemen tujuan tidak
    // bernaung di direktorat mana pun, barisnya dilewati - alur tetap jalan.
    private async Task TambahDirekturGioAsync(Gugus g, string tahap)
    {
        if (!string.Equals(g.Jenis, "GIO", StringComparison.OrdinalIgnoreCase)) return;

        var (idTujuan, _) = await DepartemenTujuanAsync(g);
        var direktur = await _org.ResolveDirekturAsync(idTujuan);
        if (direktur is null) return;

        g.Pengesahan.Add(new Pengesahan
        {
            Tahap = tahap,
            Peran = direktur.Value.Peran,
            Nik = direktur.Value.Nik,
            Nama = direktur.Value.Nama,
            Urutan = 4,
            Status = "Menunggu",
        });
    }

    // ------------------------------------------------------ pengesahan action
    // Fasilitator / Pembina menyetujui / menolak / meminta revisi baris
    // pengesahan miliknya. Setelah SEMUA baris PLAN 'Disetujui', DO/CHECK/ACTION
    // terbuka (plan_disahkan = 1). Setelah SEMUA baris FINAL 'Disetujui' -> Selesai.
    [HttpPost("gugus/{id:int}/pengesahan/{pid:int}")]
    public async Task<IActionResult> ActPengesahan(int id, int pid, PengesahanActionRequest req)
    {
        var (nik, _) = await IdentitasAsync();
        if (nik is null) return Unauthorized();

        var g = await LoadFullAsync(id, tracking: true);
        if (g is null) return NotFound(new { message = "Inovasi tidak ditemukan." });

        var row = g.Pengesahan.FirstOrDefault(p => p.Id == pid);
        if (row is null) return NotFound(new { message = "Baris pengesahan tidak ditemukan." });
        if (!BisaTandaTangan(g, row, nik))
            return Forbid();

        var aksi = req.Aksi?.Trim();
        if (aksi is not ("Disetujui" or "Ditolak" or "Revisi"))
            return BadRequest(new { message = "Aksi tidak dikenal." });

        row.Status = aksi;
        row.Komentar = req.Komentar?.Trim();
        row.Tgl = DateTime.Now;
        g.UpdatedAt = DateTime.Now;

        if (row.Tahap == "PLAN")
        {
            var planRows = g.Pengesahan.Where(p => p.Tahap == "PLAN").ToList();
            if (aksi == "Ditolak")
            {
                g.Status = "Ditolak";
                g.PlanDisahkan = false;
            }
            else if (aksi == "Revisi")
            {
                g.Status = "Revisi";  // pengaju bisa edit & ajukan ulang
                g.PlanDisahkan = false;
            }
            else if (planRows.All(p => p.Status == "Disetujui"))
            {
                g.PlanDisahkan = true;
                // 5R hanya punya SATU Lembar Pengesahan -> langsung Selesai.
                // SS/GIO lanjut ke tahap DO/CHECK/ACTION (Divalidasi).
                g.Status = g.Jenis == "5R" ? "Selesai" : "Divalidasi";
            }
            else if (row.Peran == "Fasilitator")
            {
                g.Status = "Diverifikasi";
            }
        }
        else if (row.Tahap == "FINAL")
        {
            var finalRows = g.Pengesahan.Where(p => p.Tahap == "FINAL").ToList();
            if (aksi == "Ditolak")
                g.Status = "Ditolak";
            else if (aksi == "Revisi")
                g.Status = "Revisi Akhir";   // pengaju bisa perbaiki DO/CHECK/ACTION lalu ajukan ulang
            else if (finalRows.All(p => p.Status == "Disetujui"))
                g.Status = "Selesai";
            // selain itu tetap "Pengesahan Akhir" (menunggu tanda tangan berikutnya)
        }

        await _db.SaveChangesAsync();
        return Ok(new { g.Status, g.PlanDisahkan });
    }

    // -------------------------------------------------------------- save DO
    [HttpPut("gugus/{id:int}/do")]
    public async Task<IActionResult> SaveDo(int id, SaveDoRequest req)
    {
        var g = await GateActionTahap(id);
        if (g.Result is not null) return g.Result;
        var gugus = g.Value!;

        Replace(gugus.DoPelaksanaan, req.DoPelaksanaan, (x, d, i) =>
        {
            x.TahapanKegiatan = d.TahapanKegiatan; x.MonitoringHasil = d.MonitoringHasil; x.Tanggal = d.Tanggal;
            x.EvidencePath = d.EvidencePath; x.EvidenceNama = d.EvidenceNama; x.Urutan = i;
        });
        Replace(gugus.DoKendala, req.DoKendala, (x, d, i) => { x.Kendala = d.Kendala; x.Solusi = d.Solusi; x.Waktu = d.Waktu; x.Pic = d.Pic; x.Urutan = i; });

        gugus.UpdatedAt = DateTime.Now;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ------------------------------------------------------------ save CHECK
    [HttpPut("gugus/{id:int}/check")]
    public async Task<IActionResult> SaveCheck(int id, SaveCheckRequest req)
    {
        var g = await GateActionTahap(id);
        if (g.Result is not null) return g.Result;
        var gugus = g.Value!;

        gugus.VerifikasiStatistik = req.VerifikasiStatistik;   // C.3, hanya diisi risalah GIO
        Replace(gugus.CheckPerbandingan, req.CheckPerbandingan, (x, d, i) => { x.Sebelum = d.Sebelum; x.Sesudah = d.Sesudah; x.Urutan = i; });
        Replace(gugus.CheckSasaran, req.CheckSasaran, (x, d, i) => { x.SasaranText = d.Sasaran; x.Sebelum = d.Sebelum; x.Target = d.Target; x.Sesudah = d.Sesudah; x.PersenCapaian = d.PersenCapaian; x.Urutan = i; });
        Replace(gugus.CheckBiaya, req.CheckBiaya, (x, d, i) => { x.Komponen = d.Komponen; x.Perhitungan = d.Perhitungan; x.Nilai = d.Nilai; x.Urutan = i; });
        Replace(gugus.CheckRisiko, req.CheckRisiko, (x, d, i) => { x.DampakNegatif = d.DampakNegatif; x.Mitigasi = d.Mitigasi; x.Urutan = i; });

        gugus.UpdatedAt = DateTime.Now;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ----------------------------------------------------------- save ACTION
    [HttpPut("gugus/{id:int}/action")]
    public async Task<IActionResult> SaveAction(int id, SaveActionRequest req)
    {
        var g = await GateActionTahap(id);
        if (g.Result is not null) return g.Result;
        var gugus = g.Value!;

        gugus.ActionTemaBerikutnya = req.ActionTemaBerikutnya;
        Replace(gugus.ActionStandarisasi, req.ActionStandarisasi, (x, d, i) => { x.StandarBaru = d.StandarBaru; x.NoDokumen = d.NoDokumen; x.TglBerlaku = d.TglBerlaku; x.Pic = d.Pic; x.Urutan = i; });
        Replace(gugus.ActionTindakLanjut, req.ActionTindakLanjut, (x, d, i) => { x.Rencana = d.Rencana; x.TargetWaktu = d.TargetWaktu; x.Pic = d.Pic; x.Status = d.Status; x.Urutan = i; });

        gugus.UpdatedAt = DateTime.Now;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ----------------------------------------------------------------- delete
    // Risalah selalu lahir dari satu Sumbang Gagasan, jadi gagasan sumbernya ikut
    // terhapus. Bila ditinggalkan, gagasan tetap berstatus "Terdaftar" sambil
    // menunjuk risalah yang sudah tidak ada: tidak bisa dihapus (Delete gagasan
    // menolak yang sudah terdaftar) maupun didaftarkan ulang - baris hantu di
    // Sumbang Gagasan.
    [HttpDelete("gugus/{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var (nik, _) = await IdentitasAsync();
        if (nik is null) return Unauthorized();

        var g = await _db.Gugus.FirstOrDefaultAsync(x => x.Id == id);
        if (g is null) return NotFound(new { message = "Inovasi tidak ditemukan." });
        if (g.CreatedByNik != nik) return Forbid();
        if (g.Status is not ("Draft" or "Revisi"))
            return BadRequest(new { message = "Hanya risalah berstatus Draft/Revisi yang bisa dihapus." });

        if (g.IdGagasan is int idGagasan)
        {
            var gagasan = await _db.Gagasan.FirstOrDefaultAsync(x => x.Id == idGagasan);
            if (gagasan is not null) _db.Gagasan.Remove(gagasan);   // cascade: rantai approval
        }

        _db.Gugus.Remove(g);   // cascade menghapus seluruh anak
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ----------------------------------------------------------------- upload
    [HttpPost("gugus/{id:int}/upload")]
    [RequestSizeLimit(MaxUploadBytes)]
    public async Task<ActionResult<InovasiUploadDto>> Upload(int id, IFormFile file)
    {
        var (nik, _) = await IdentitasAsync();
        if (nik is null) return Unauthorized();

        var g = await _db.Gugus.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (g is null) return NotFound(new { message = "Inovasi tidak ditemukan." });
        if (g.CreatedByNik != nik && !await _db.Anggota.AnyAsync(a => a.IdGugus == id && a.Nik == nik))
            return Forbid();

        if (file is null || file.Length == 0) return BadRequest(new { message = "Berkas kosong." });
        if (file.Length > MaxUploadBytes) return BadRequest(new { message = "Ukuran berkas maksimal 15 MB." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedExt.Contains(ext))
            return BadRequest(new { message = "Format berkas tidak didukung." });

        var dir = Path.Combine(UploadRoot(), id.ToString());
        Directory.CreateDirectory(dir);
        var fileName = $"{Guid.NewGuid():N}{ext}";
        var full = Path.Combine(dir, fileName);
        await using (var stream = System.IO.File.Create(full))
        {
            await file.CopyToAsync(stream);
        }

        var rel = $"{id}/{fileName}";
        var url = $"/api/inovasi/gugus/{id}/file?path={Uri.EscapeDataString(rel)}";
        return Ok(new InovasiUploadDto(rel, file.FileName, url));
    }

    // ---------------------------------------------------------------- file get
    [HttpGet("gugus/{id:int}/file")]
    public async Task<IActionResult> GetFile(int id, [FromQuery] string path)
    {
        var (nik, _) = await IdentitasAsync();
        if (nik is null) return Unauthorized();

        var g = await _db.Gugus.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (g is null) return NotFound();
        if (!MayViewNik(g, nik) && !await _db.Anggota.AnyAsync(a => a.IdGugus == id && a.Nik == nik)
            && !await _db.Pengesahan.AnyAsync(p => p.IdGugus == id && p.Nik == nik))
            return Forbid();

        // Path harus milik folder gugus ini - tolak traversal.
        if (string.IsNullOrWhiteSpace(path) || !path.StartsWith($"{id}/") || path.Contains("..") || Path.IsPathRooted(path))
            return BadRequest(new { message = "Path berkas tidak valid." });

        var full = Path.Combine(UploadRoot(), path.Replace('/', Path.DirectorySeparatorChar));
        if (!System.IO.File.Exists(full)) return NotFound();

        var ext = Path.GetExtension(full).ToLowerInvariant();
        return PhysicalFile(full, ContentType(ext));
    }

    // ------------------------------------------------------------- pegawai cari
    // gugusId (opsional) membatasi kandidat sesuai cakupan anggota metodologi:
    //   SS  -> hanya departemen yang sama dengan gugus
    //   5R  -> hanya kompartemen yang sama dengan gugus
    //   GIO -> bebas (tanpa filter)
    // q nullable + default null: tanpa `?` parameter dianggap WAJIB oleh [ApiController]
    // (nullable reference types), sehingga `?q=` kosong ditolak 400 sebelum masuk aksi -
    // itulah sebab daftar default (tanpa mengetik) sempat kosong.
    [HttpGet("pegawai")]
    public async Task<ActionResult<IReadOnlyList<InovasiPegawaiDto>>> CariPegawai([FromQuery] string? q = null, [FromQuery] int? gugusId = null)
    {
        var term = (q ?? string.Empty).Trim();

        // Tanpa kata kunci: tampilkan daftar default sesuai cakupan (departemen /
        // kompartemen) agar pengguna tidak harus mengetik lebih dulu.
        if (term.Length < 2) return Ok(await DefaultPegawaiAsync(gugusId));

        var rows = await _gcs.PegawaiSdm
            .Where(p => p.data_aktif == "Aktif" && (p.nama!.Contains(term) || p.Nik.Contains(term)))
            .OrderBy(p => p.nama)
            .Take(50)
            .Select(p => new InovasiPegawaiDto(p.Nik, p.nama ?? p.Nik, p.nm_jabatan, p.UNIT_KERJA ?? p.BAGIAN))
            .ToListAsync();

        if (gugusId is int gid)
        {
            var g = await _db.Gugus.AsNoTracking().FirstOrDefaultAsync(x => x.Id == gid);
            if (g is not null && (g.Jenis == "SS" || g.Jenis == "5R"))
            {
                // Filter ketat: SS hanya departemen yang sama, 5R hanya kompartemen
                // yang sama. Hanya diberlakukan bila cakupan gugus diketahui.
                var scopeId = g.Jenis == "SS" ? g.IdDepartemen : g.IdKompartemen;
                if (scopeId is not null)
                {
                    var map = await _org.ResolveManyAsync(rows.Select(r => r.Nik).ToList());
                    rows = rows.Where(r =>
                        map.TryGetValue(r.Nik, out var o) &&
                        (g.Jenis == "SS" ? o.IdDepartemen == scopeId : o.IdKompartemen == scopeId)
                    ).ToList();
                }
            }
        }

        return Ok(rows.Take(20).ToList());
    }

    // --------------------------------------------------- direktori pegawai (semua)
    // Halaman "Daftar Pegawai": seluruh pegawai aktif, dapat disaring per Departemen
    // / Kompartemen (dari data org grading) dan dicari via nama/NIK. Kolom departemen
    // & kompartemen diisi hasil resolusi org (kosong untuk pegawai non-organik).
    [HttpGet("pegawai-direktori")]
    public async Task<ActionResult<IReadOnlyList<InovasiPegawaiDirektoriDto>>> Direktori(
        [FromQuery] string? q = null, [FromQuery] int? departemenId = null, [FromQuery] int? kompartemenId = null)
    {
        var term = (q ?? string.Empty).Trim();

        IQueryable<Models.Gcs.PegawaiSdm> query = _gcs.PegawaiSdm.Where(p => p.data_aktif == "Aktif");
        if (term.Length >= 2)
            query = query.Where(p => p.nama!.Contains(term) || p.Nik.Contains(term));

        // Saring per cakupan org (departemen lebih spesifik daripada kompartemen).
        if (departemenId is int dId)
        {
            var arr = (await _org.ListNiksInScopeAsync(dId, true)).ToArray();
            query = query.Where(p => arr.Contains(p.Nik));
        }
        else if (kompartemenId is int kId)
        {
            var arr = (await _org.ListNiksInScopeAsync(kId, false)).ToArray();
            query = query.Where(p => arr.Contains(p.Nik));
        }

        var roster = await query
            .OrderBy(p => p.nama)
            .Take(500)
            .Select(p => new { p.Nik, Nama = p.nama, Jabatan = p.nm_jabatan, Unit = p.UNIT_KERJA ?? p.BAGIAN })
            .ToListAsync();

        // Resolusi departemen/kompartemen untuk kolom (kosong bila pegawai non-organik).
        var orgMap = await _org.ResolveManyAsync(roster.Select(r => r.Nik).ToList());
        var items = roster.Select(r =>
        {
            orgMap.TryGetValue(r.Nik, out var o);
            return new InovasiPegawaiDirektoriDto(r.Nik, r.Nama ?? r.Nik, r.Jabatan, r.Unit, o?.NamaDepartemen, o?.NamaKompartemen);
        }).ToList();

        return Ok(items);
    }

    // Daftar pegawai default (tanpa kata kunci) sesuai cakupan:
    //   - dengan gugusId : cakupan gugus (5R -> kompartemen; SS/GIO -> departemen asal)
    //   - tanpa gugusId  : cakupan departemen (fallback kompartemen) pengguna login
    // Grading (penempatan/jabatan/unit) hanya memuat pegawai organik; bila cakupan
    // tak dapat ditentukan atau kosong (mis. akun tak tertaut grading), turunkan ke
    // daftar pegawai aktif umum agar tabel tidak kosong - kecuali cakupan ketat
    // (SS/5R) yang memang harus terbatas pada satu departemen/kompartemen.
    private async Task<IReadOnlyList<InovasiPegawaiDto>> DefaultPegawaiAsync(int? gugusId)
    {
        int? scopeId = null;
        var asDept = true;
        var strict = false;

        if (gugusId is int gid)
        {
            var g = await _db.Gugus.AsNoTracking().FirstOrDefaultAsync(x => x.Id == gid);
            // Hanya SS (satu departemen) & 5R (satu kompartemen) yang dibatasi cakupan.
            // GIO bebas: scopeId dibiarkan null -> jatuh ke daftar umum (semua pegawai).
            if (g is not null && (g.Jenis == "SS" || g.Jenis == "5R"))
            {
                asDept = g.Jenis == "SS";
                scopeId = asDept ? g.IdDepartemen : g.IdKompartemen;
                strict = true;
            }
        }
        else
        {
            var (nik, _) = await IdentitasAsync();
            if (nik is not null)
            {
                var org = await _org.ResolveAsync(nik);
                if (org.IdDepartemen is not null) { scopeId = org.IdDepartemen; asDept = true; }
                else if (org.IdKompartemen is not null) { scopeId = org.IdKompartemen; asDept = false; }
            }
        }

        if (scopeId is int sid)
        {
            var niks = await _org.ListNiksInScopeAsync(sid, asDept);
            if (niks.Count > 0)
            {
                var nikArr = niks.ToArray();
                var scoped = await _gcs.PegawaiSdm
                    .Where(p => p.data_aktif == "Aktif" && nikArr.Contains(p.Nik))
                    .OrderBy(p => p.nama)
                    .Take(100)
                    .Select(p => new InovasiPegawaiDto(p.Nik, p.nama ?? p.Nik, p.nm_jabatan, p.UNIT_KERJA ?? p.BAGIAN))
                    .ToListAsync();
                if (scoped.Count > 0) return scoped;
            }
            // Cakupan ketat tetap terbatas: kembalikan kosong bila tak ada kandidat.
            if (strict) return Array.Empty<InovasiPegawaiDto>();
        }

        // Fallback: pegawai aktif umum (akun tak tertaut grading / cakupan kosong).
        return await _gcs.PegawaiSdm
            .Where(p => p.data_aktif == "Aktif")
            .OrderBy(p => p.nama)
            .Take(100)
            .Select(p => new InovasiPegawaiDto(p.Nik, p.nama ?? p.Nik, p.nm_jabatan, p.UNIT_KERJA ?? p.BAGIAN))
            .ToListAsync();
    }

    // =======================================================================
    // Helpers
    // =======================================================================

    private async Task<(string? Nik, string? Nama)> IdentitasAsync()
    {
        var (user, pegawai) = await _currentUser.ResolveAsync(User);
        var nik = pegawai?.ID_KARYAWAN ?? user?.Nik;
        var nama = pegawai?.NAMA_LENGKAP ?? user?.Name;
        return (string.IsNullOrWhiteSpace(nik) ? null : nik, nama);
    }

    private static string NormalizeJenis(string? jenis) => (jenis?.Trim().ToUpperInvariant()) switch
    {
        "GIO" => "GIO",
        "5R" => "5R",
        _ => "SS",
    };

    // Periode inovasi ditentukan dari tahun berjalan saja: 2026 -> "2026/2027",
    // 2027 -> "2027/2028".
    private static string DefaultPeriode()
    {
        var awal = DateTime.Now.Year;
        return $"{awal}/{awal + 1}";
    }

    private Task<Gugus?> LoadFullAsync(int id, bool tracking = false)
    {
        var query = _db.Gugus
            .Include(g => g.Anggota)
            .Include(g => g.DataPendukung)
            .Include(g => g.Jadwal)
            .Include(g => g.Sasaran)
            .Include(g => g.Pareto)
            .Include(g => g.Qcdse)
            .Include(g => g.Fishbone)
            .Include(g => g.RencanaPerbaikan)
            .Include(g => g.Pengesahan)
            .Include(g => g.DoPelaksanaan)
            .Include(g => g.DoKendala)
            .Include(g => g.CheckPerbandingan)
            .Include(g => g.CheckSasaran)
            .Include(g => g.CheckBiaya)
            .Include(g => g.CheckRisiko)
            .Include(g => g.ActionStandarisasi)
            .Include(g => g.ActionTindakLanjut)
            .Where(g => g.Id == id);
        if (!tracking) query = query.AsNoTracking();
        return query.FirstOrDefaultAsync();
    }

    // Pemilik + anggota + pengesah boleh melihat.
    private static bool MayView(Gugus g, string nik) =>
        g.CreatedByNik == nik || g.Anggota.Any(a => a.Nik == nik) || g.Pengesahan.Any(p => p.Nik == nik);

    // MayView + cakupan atasan: Manager (band 2) boleh melihat seluruh risalah di
    // departemennya; GM (band 1) di kompartemennya. Dipakai untuk lihat detail
    // (read-only) - endpoint ubah/simpan tetap terbatas pada pemilik.
    private async Task<bool> MayViewScopeAsync(Gugus g, string nik)
    {
        if (MayView(g, nik)) return true;
        var org = await _org.ResolveAsync(nik);
        var band = await (
            from p in _db.Penempatan
            join j in _db.Jabatan on p.IdJabatan equals j.IdJabatan
            where p.IdKaryawan == nik && p.Status == "Aktif"
            select (byte?)j.IdBand).FirstOrDefaultAsync();
        if (band == 2 && g.IdDepartemen != null && g.IdDepartemen == org.IdDepartemen) return true;
        if (band == 1 && g.IdKompartemen != null && g.IdKompartemen == org.IdKompartemen) return true;
        // Juri yang ditugaskan menilai gugus ini boleh melihat risalah (read-only).
        var juri = await (
            from pp in _db.PenilaianPenugasan
            join a in _db.PenilaianStreamAnggota on pp.IdStream equals a.IdStream
            where pp.IdGugus == g.Id && a.Nik == nik
            select a.Id).AnyAsync();
        if (juri) return true;
        return false;
    }

    private static bool MayViewNik(Gugus g, string nik) => g.CreatedByNik == nik;

    // Boleh menandatangani jika baris ini miliknya, masih Menunggu, dan seluruh
    // baris tahap sama dengan urutan lebih kecil sudah Disetujui (giliran).
    private static bool BisaTandaTangan(Gugus g, Pengesahan row, string nik)
    {
        if (row.Nik != nik || row.Status != "Menunggu") return false;
        return g.Pengesahan
            .Where(p => p.Tahap == row.Tahap && p.Urutan < row.Urutan)
            .All(p => p.Status == "Disetujui");
    }

    // Gate umum untuk simpan DO/CHECK/ACTION: hanya pemilik & hanya setelah
    // PLAN disahkan.
    private async Task<(IActionResult? Result, Gugus? Value)> GateActionTahap(int id)
    {
        var (nik, _) = await IdentitasAsync();
        if (nik is null) return (Unauthorized(), null);

        var g = await LoadFullAsync(id, tracking: true);
        if (g is null) return (NotFound(new { message = "Inovasi tidak ditemukan." }), null);
        if (g.CreatedByNik != nik) return (Forbid(), null);
        if (!g.PlanDisahkan)
            return (BadRequest(new { message = "Tahap PLAN belum disahkan (diverifikasi & divalidasi)." }), null);
        return (null, g);
    }

    // Ganti isi koleksi anak: hapus semua, sisipkan ulang dari DTO. File/path ikut
    // di DTO sehingga tidak hilang.
    private void Replace<TEntity, TDto>(List<TEntity> current, IReadOnlyList<TDto>? incoming, Action<TEntity, TDto, int> apply)
        where TEntity : class, new()
    {
        _db.Set<TEntity>().RemoveRange(current);
        current.Clear();
        if (incoming is null) return;
        for (var i = 0; i < incoming.Count; i++)
        {
            var e = new TEntity();
            apply(e, incoming[i], i);
            current.Add(e);
        }
    }

    private async Task<string?> JabatanNamaAsync(string nik)
    {
        return await (
            from p in _db.Penempatan
            join j in _db.Jabatan on p.IdJabatan equals j.IdJabatan
            where p.IdKaryawan == nik && p.Status == "Aktif"
            select j.NamaJabatan).FirstOrDefaultAsync()
            ?? await _gcs.PegawaiSdm.Where(x => x.Nik == nik).Select(x => x.nm_jabatan).FirstOrDefaultAsync();
    }

    private string UploadRoot()
    {
        var configured = _config["Inovasi:UploadPath"];
        return string.IsNullOrWhiteSpace(configured)
            ? Path.Combine(_env.ContentRootPath, "uploads", "inovasi")
            : configured;
    }

    private static string ContentType(string ext) => ext switch
    {
        ".pdf" => "application/pdf",
        ".png" => "image/png",
        ".jpg" or ".jpeg" => "image/jpeg",
        ".doc" => "application/msword",
        ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".xls" => "application/vnd.ms-excel",
        ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".ppt" => "application/vnd.ms-powerpoint",
        ".pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        _ => "application/octet-stream",
    };
}

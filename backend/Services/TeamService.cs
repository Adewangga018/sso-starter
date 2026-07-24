using System.Data;
using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using SsoBackend.Data;
using SsoBackend.Models;
using SsoBackend.Models.Dto;

namespace SsoBackend.Services;

// My Team: menyusun konteks tim seorang pegawai dari data grading yang sudah ada
// (jabatan + penempatan + jabatan_hirarki + band + unit_organisasi) + kehadiran (attendances)
// + tugas (myteam.tugas). Berlaku untuk atasan (punya bawahan) maupun anggota biasa
// (punya atasan & rekan setim), jadi tidak pernah kosong.
//
// Skema grading & myteam dibuat manual; grading dibaca lewat SQL mentah pada koneksi
// ApplicationDbContext (db_mygcs), sedangkan tugas lewat EF (entity Tugas, ExcludeFromMigrations).
public class TeamService
{
    private static readonly string[] StatusValid = ["Baru", "Dikerjakan", "Selesai", "Batal"];

    private readonly ApplicationDbContext _db;
    private readonly GcsDbContext _gcs;

    public TeamService(ApplicationDbContext db, GcsDbContext gcs)
    {
        _db = db;
        _gcs = gcs;
    }

    public async Task<TeamDto> GetTeamAsync(string idKaryawan, bool semua)
    {
        var conn = _db.Database.GetDbConnection();
        var mustClose = conn.State != ConnectionState.Open;
        if (mustClose)
        {
            await conn.OpenAsync();
        }

        try
        {
            // Tugas untuk saya selalu ditampilkan (walau tak berjabatan).
            var tugasUntukSaya = await GetTugasAsync(t => t.IdPenerima == idKaryawan);

            // 1) Jabatan yang saya duduki + atasannya.
            int myJabatan;
            int? idAtasanJab;
            string? jabatanSaya, bandSaya;
            int? jgSaya;
            await using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = @"
                    SELECT TOP 1 j.id_jabatan, j.nama_jabatan, b.kode, j.jg, j.id_atasan
                    FROM grading.penempatan p
                    JOIN grading.jabatan j ON j.id_jabatan = p.id_jabatan
                    JOIN grading.band    b ON b.id_band    = j.id_band
                    WHERE p.id_karyawan = @nik AND p.status = 'Aktif'";
                AddParam(cmd, "@nik", idKaryawan);
                await using var r = await cmd.ExecuteReaderAsync();
                if (!await r.ReadAsync())
                {
                    // Tak menduduki jabatan apa pun: di luar struktur. Tetap tampilkan tugas untuk saya.
                    return new TeamDto(false, false, null, null, null, null, 0, 0, 0,
                        [], [], tugasUntukSaya, []);
                }
                myJabatan = Convert.ToInt32(r.GetValue(0));
                jabatanSaya = r.IsDBNull(1) ? null : r.GetString(1);
                bandSaya = r.IsDBNull(2) ? null : r.GetString(2);
                jgSaya = r.IsDBNull(3) ? null : Convert.ToInt32(r.GetValue(3));
                idAtasanJab = r.IsDBNull(4) ? null : Convert.ToInt32(r.GetValue(4));
            }

            // 2) Atasan langsung.
            AtasanDto? atasan = null;
            if (idAtasanJab is not null)
            {
                await using var cmd = conn.CreateCommand();
                cmd.CommandText = @"
                    SELECT j.nama_jabatan, b.kode, j.jg, p.id_karyawan, p.nama
                    FROM grading.jabatan j
                    JOIN grading.band    b ON b.id_band = j.id_band
                    LEFT JOIN grading.penempatan p ON p.id_jabatan = j.id_jabatan AND p.status = 'Aktif'
                    WHERE j.id_jabatan = @jab";
                AddParam(cmd, "@jab", idAtasanJab.Value);
                await using var r = await cmd.ExecuteReaderAsync();
                if (await r.ReadAsync())
                {
                    atasan = new AtasanDto(
                        r.GetString(0),
                        r.IsDBNull(1) ? null : r.GetString(1),
                        r.IsDBNull(2) ? null : Convert.ToInt32(r.GetValue(2)),
                        r.IsDBNull(3) ? null : r.GetString(3),
                        r.IsDBNull(4) ? null : r.GetString(4));
                }
            }

            // 3) Anggota tim (bawahan) dari closure hierarki.
            var maxDepth = semua ? 100 : 1;
            List<MemberRow> bawahanRows;
            await using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = @"
                    SELECT h.kedalaman, j.id_jabatan, j.nama_jabatan, b.kode, j.jg,
                           p.id_karyawan, p.nama, u.nama
                    FROM grading.jabatan_hirarki h
                    JOIN grading.jabatan j ON j.id_jabatan = h.id_jabatan_bawahan
                    JOIN grading.band    b ON b.id_band    = j.id_band
                    LEFT JOIN grading.unit_organisasi u ON u.id_unit = j.id_unit
                    LEFT JOIN grading.penempatan p ON p.id_jabatan = j.id_jabatan AND p.status = 'Aktif'
                    WHERE h.id_jabatan_atasan = @jab AND h.kedalaman BETWEEN 1 AND @depth
                    ORDER BY h.kedalaman, j.id_band, j.nama_jabatan";
                AddParam(cmd, "@jab", myJabatan);
                AddParam(cmd, "@depth", maxDepth);
                bawahanRows = await ReadMembers(cmd);
            }

            // 4) Rekan setim (peers): sesama bawahan langsung dari atasan yang sama, kecuali saya.
            List<MemberRow> peerRows = [];
            if (idAtasanJab is not null)
            {
                await using var cmd = conn.CreateCommand();
                cmd.CommandText = @"
                    SELECT 0 AS kedalaman, j.id_jabatan, j.nama_jabatan, b.kode, j.jg,
                           p.id_karyawan, p.nama, u.nama
                    FROM grading.jabatan j
                    JOIN grading.band    b ON b.id_band = j.id_band
                    LEFT JOIN grading.unit_organisasi u ON u.id_unit = j.id_unit
                    LEFT JOIN grading.penempatan p ON p.id_jabatan = j.id_jabatan AND p.status = 'Aktif'
                    WHERE j.id_atasan = @atasan AND j.id_jabatan <> @me AND j.aktif = 1
                    ORDER BY j.nama_jabatan";
                AddParam(cmd, "@atasan", idAtasanJab.Value);
                AddParam(cmd, "@me", myJabatan);
                peerRows = await ReadMembers(cmd);
            }

            // 5) Kehadiran hari ini (WIB) untuk bawahan + rekan yang terisi.
            var ids = bawahanRows.Concat(peerRows).Where(m => m.IdKaryawan is not null)
                .Select(m => m.IdKaryawan!).Distinct().ToList();
            var hadir = await KehadiranHariIni(ids);

            var anggota = bawahanRows.Select(m => ToMember(m, hadir)).ToList();
            var rekan = peerRows.Select(m => ToMember(m, hadir)).ToList();
            var terisi = anggota.Count(a => a.Terisi);

            // Punya tim? cek ada bawahan langsung (independen dari toggle "semua").
            var punyaTim = await ExistsBawahanLangsung(conn, myJabatan);

            var tugasDiberikan = punyaTim ? await GetTugasAsync(t => t.IdPemberi == idKaryawan) : [];

            return new TeamDto(
                PunyaTim: punyaTim,
                DalamStruktur: true,
                JabatanSaya: jabatanSaya, BandSaya: bandSaya, JgSaya: jgSaya,
                Atasan: atasan,
                JumlahAnggota: terisi,
                JumlahKosong: anggota.Count - terisi,
                JumlahHadir: anggota.Count(a => a.HadirHariIni),
                Anggota: anggota,
                RekanSetim: rekan,
                TugasUntukSaya: tugasUntukSaya,
                TugasDiberikan: tugasDiberikan);
        }
        finally
        {
            if (mustClose)
            {
                await conn.CloseAsync();
            }
        }
    }

    // ---- Laporan tim (unduh CSV) ----

    private static readonly string[] BulanId =
        ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

    // Menyusun laporan tim lengkap (seluruh level bawahan, memakai closure hierarki) sebagai
    // CSV siap-Excel. Hanya untuk atasan yang punya bawahan langsung; return null bila bukan atasan
    // atau di luar struktur — controller menerjemahkannya jadi 400 yang ramah.
    public async Task<(byte[] Content, string FileName)?> BuildLaporanTimAsync(string idKaryawan)
    {
        var conn = _db.Database.GetDbConnection();
        var mustClose = conn.State != ConnectionState.Open;
        if (mustClose)
        {
            await conn.OpenAsync();
        }

        try
        {
            // 1) Jabatan yang saya duduki.
            int myJabatan;
            string? jabatanSaya, bandSaya;
            int? jgSaya;
            await using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = @"
                    SELECT TOP 1 j.id_jabatan, j.nama_jabatan, b.kode, j.jg
                    FROM grading.penempatan p
                    JOIN grading.jabatan j ON j.id_jabatan = p.id_jabatan
                    JOIN grading.band    b ON b.id_band    = j.id_band
                    WHERE p.id_karyawan = @nik AND p.status = 'Aktif'";
                AddParam(cmd, "@nik", idKaryawan);
                await using var r = await cmd.ExecuteReaderAsync();
                if (!await r.ReadAsync())
                {
                    return null; // di luar struktur
                }
                myJabatan = Convert.ToInt32(r.GetValue(0));
                jabatanSaya = r.IsDBNull(1) ? null : r.GetString(1);
                bandSaya = r.IsDBNull(2) ? null : r.GetString(2);
                jgSaya = r.IsDBNull(3) ? null : Convert.ToInt32(r.GetValue(3));
            }

            // Bukan atasan (tak ada bawahan langsung) -> tak ada laporan.
            if (!await ExistsBawahanLangsung(conn, myJabatan))
            {
                return null;
            }

            // 2) Seluruh anggota lintas level (kedalaman 1..N).
            List<MemberRow> rows;
            await using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = @"
                    SELECT h.kedalaman, j.id_jabatan, j.nama_jabatan, b.kode, j.jg,
                           p.id_karyawan, p.nama, u.nama
                    FROM grading.jabatan_hirarki h
                    JOIN grading.jabatan j ON j.id_jabatan = h.id_jabatan_bawahan
                    JOIN grading.band    b ON b.id_band    = j.id_band
                    LEFT JOIN grading.unit_organisasi u ON u.id_unit = j.id_unit
                    LEFT JOIN grading.penempatan p ON p.id_jabatan = j.id_jabatan AND p.status = 'Aktif'
                    WHERE h.id_jabatan_atasan = @jab AND h.kedalaman >= 1
                    ORDER BY h.kedalaman, j.id_band, j.nama_jabatan";
                AddParam(cmd, "@jab", myJabatan);
                rows = await ReadMembers(cmd);
            }

            var ids = rows.Where(m => m.IdKaryawan is not null).Select(m => m.IdKaryawan!).Distinct().ToList();
            var hadir = await KehadiranHariIni(ids);

            // 3) Beban tugas per anggota (semua tugas yang ditujukan kepadanya).
            Dictionary<string, (int Aktif, int Selesai)> beban = new();
            if (ids.Count > 0)
            {
                var agg = await _db.Tugas
                    .Where(t => ids.Contains(t.IdPenerima))
                    .GroupBy(t => t.IdPenerima)
                    .Select(g => new
                    {
                        Id = g.Key,
                        Aktif = g.Count(x => x.Status == "Baru" || x.Status == "Dikerjakan"),
                        Selesai = g.Count(x => x.Status == "Selesai"),
                    })
                    .ToListAsync();
                beban = agg.ToDictionary(x => x.Id, x => (x.Aktif, x.Selesai));
            }

            var wib = DateTime.UtcNow.AddHours(7);
            var tanggal = $"{wib.Day:D2} {BulanId[wib.Month - 1]} {wib.Year} {wib:HH:mm}";

            var sb = new System.Text.StringBuilder();
            // sep=; -> memaksa Excel memakai titik-koma sebagai pemisah, apa pun locale-nya.
            sb.Append("sep=;\r\n");
            sb.Append("LAPORAN TIM — MyGCS\r\n");
            Line(sb, "Disusun oleh", $"{jabatanSaya}");
            Line(sb, "Band / JG", $"{bandSaya ?? "-"} / {(jgSaya?.ToString() ?? "-")}");
            Line(sb, "Tanggal cetak", $"{tanggal} WIB");
            Line(sb, "Cakupan", "Seluruh level bawahan");
            sb.Append("\r\n");

            // Ringkasan keseluruhan.
            var totalTerisi = rows.Count(m => m.IdKaryawan is not null);
            var totalKosong = rows.Count - totalTerisi;
            var totalHadir = rows.Count(m => m.IdKaryawan is not null && hadir.Contains(m.IdKaryawan!));
            sb.Append("RINGKASAN\r\n");
            Line(sb, "Total formasi", rows.Count.ToString());
            Line(sb, "Terisi", totalTerisi.ToString());
            Line(sb, "Kosong", totalKosong.ToString());
            Line(sb, "Hadir hari ini", $"{totalHadir} dari {totalTerisi}");
            sb.Append("\r\n");

            // Rekap per level.
            sb.Append("REKAP PER LEVEL\r\n");
            sb.Append("Level;Formasi;Terisi;Kosong;Hadir\r\n");
            foreach (var grp in rows.GroupBy(m => m.Kedalaman).OrderBy(g => g.Key))
            {
                var terisi = grp.Count(m => m.IdKaryawan is not null);
                var kosong = grp.Count() - terisi;
                var h = grp.Count(m => m.IdKaryawan is not null && hadir.Contains(m.IdKaryawan!));
                var label = grp.Key == 1 ? "1 (langsung)" : grp.Key.ToString();
                sb.Append($"{Csv(label)};{grp.Count()};{terisi};{kosong};{h}\r\n");
            }
            sb.Append("\r\n");

            // Detail anggota.
            sb.Append("DETAIL ANGGOTA\r\n");
            sb.Append("Level;Jabatan;Unit;Band;JG;Nama;Status;Hadir Hari Ini;Tugas Aktif;Tugas Selesai\r\n");
            foreach (var m in rows)
            {
                var terisi = m.IdKaryawan is not null;
                var isHadir = terisi && hadir.Contains(m.IdKaryawan!);
                var (aktif, selesai) = terisi && beban.TryGetValue(m.IdKaryawan!, out var b) ? b : (0, 0);
                sb.Append(string.Join(';',
                    m.Kedalaman,
                    Csv(m.Jabatan),
                    Csv(m.Unit ?? "-"),
                    Csv(m.Band ?? "-"),
                    m.Jg?.ToString() ?? "-",
                    Csv(terisi ? m.Nama ?? "-" : "(kosong)"),
                    terisi ? "Terisi" : "Formasi kosong",
                    terisi ? (isHadir ? "Hadir" : "Belum absen") : "-",
                    terisi ? aktif.ToString() : "-",
                    terisi ? selesai.ToString() : "-"));
                sb.Append("\r\n");
            }

            var preamble = System.Text.Encoding.UTF8.GetPreamble(); // BOM agar Excel membaca UTF-8
            var body = System.Text.Encoding.UTF8.GetBytes(sb.ToString());
            var bytes = preamble.Concat(body).ToArray();

            var namaFile = $"Laporan-Tim-{Slug(jabatanSaya)}-{wib:yyyyMMdd}.csv";
            return (bytes, namaFile);
        }
        finally
        {
            if (mustClose)
            {
                await conn.CloseAsync();
            }
        }
    }

    // ---- Rekap Tim (monitoring operasional) ----

    // Menyusun rekap kehadiran + produktivitas tugas seluruh level bawahan dari data yang ada.
    // Return null bila di luar struktur atau bukan atasan (tak punya bawahan langsung).
    public async Task<TeamRekapDto?> RekapTimAsync(string idKaryawan)
    {
        var conn = _db.Database.GetDbConnection();
        var mustClose = conn.State != ConnectionState.Open;
        if (mustClose)
        {
            await conn.OpenAsync();
        }

        try
        {
            int myJabatan;
            await using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = @"
                    SELECT TOP 1 j.id_jabatan
                    FROM grading.penempatan p
                    JOIN grading.jabatan j ON j.id_jabatan = p.id_jabatan
                    WHERE p.id_karyawan = @nik AND p.status = 'Aktif'";
                AddParam(cmd, "@nik", idKaryawan);
                var res = await cmd.ExecuteScalarAsync();
                if (res is null)
                {
                    return null;
                }
                myJabatan = Convert.ToInt32(res);
            }

            if (!await ExistsBawahanLangsung(conn, myJabatan))
            {
                return null;
            }

            List<MemberRow> rows;
            await using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = @"
                    SELECT h.kedalaman, j.id_jabatan, j.nama_jabatan, b.kode, j.jg,
                           p.id_karyawan, p.nama, u.nama
                    FROM grading.jabatan_hirarki h
                    JOIN grading.jabatan j ON j.id_jabatan = h.id_jabatan_bawahan
                    JOIN grading.band    b ON b.id_band    = j.id_band
                    LEFT JOIN grading.unit_organisasi u ON u.id_unit = j.id_unit
                    LEFT JOIN grading.penempatan p ON p.id_jabatan = j.id_jabatan AND p.status = 'Aktif'
                    WHERE h.id_jabatan_atasan = @jab AND h.kedalaman >= 1
                    ORDER BY h.kedalaman, j.id_band, j.nama_jabatan";
                AddParam(cmd, "@jab", myJabatan);
                rows = await ReadMembers(cmd);
            }

            var ids = rows.Where(m => m.IdKaryawan is not null).Select(m => m.IdKaryawan!).Distinct().ToList();
            var todayWib = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

            var hadirIni = await KehadiranHariIni(ids);

            // Periode rekap: minggu ini (mulai Senin) & bulan ini (mulai tanggal 1). Hari kerja
            // = Senin–Jumat saja. Pembilang = jumlah hari kerja BERJALAN (s/d hari ini).
            var diffSenin = ((int)todayWib.DayOfWeek + 6) % 7; // Minggu=0 -> 6, Senin -> 0
            var awalMinggu = todayWib.AddDays(-diffSenin);
            var awalBulan = new DateOnly(todayWib.Year, todayWib.Month, 1);
            var hariKerjaMinggu = HitungHariKerja(awalMinggu, todayWib);
            var hariKerjaBulan = HitungHariKerja(awalBulan, todayWib);

            // Kehadiran per anggota pada HARI KERJA, gabungan kedua sumber (kamera + fingerprint/SDM),
            // dihitung unik per (pegawai, tanggal) agar tak dobel.
            Dictionary<string, int> hadirMinggu = new();
            Dictionary<string, int> hadirBulan = new();
            if (ids.Count > 0)
            {
                var sejak = awalMinggu < awalBulan ? awalMinggu : awalBulan;
                var sejakDt = sejak.ToDateTime(TimeOnly.MinValue);
                var besokDt = todayWib.AddDays(1).ToDateTime(TimeOnly.MinValue);

                var kameraDays = await _db.Attendances
                    .Where(a => a.Tanggal >= sejak && a.Tanggal <= todayWib && a.CheckIn != null && ids.Contains(a.KodePegawai))
                    .Select(a => new { a.KodePegawai, a.Tanggal })
                    .Distinct()
                    .ToListAsync();

                var sdmDays = await _gcs.AbsensiLog
                    .Where(a => a.Tanggal >= sejakDt && a.Tanggal < besokDt && a.CheckIn != null && ids.Contains(a.KodePegawai))
                    .Select(a => new { a.KodePegawai, a.Tanggal })
                    .ToListAsync();

                var pairs = new HashSet<(string Kode, DateOnly Tgl)>();
                foreach (var r in kameraDays) pairs.Add((r.KodePegawai, r.Tanggal));
                foreach (var r in sdmDays) pairs.Add((r.KodePegawai, DateOnly.FromDateTime(r.Tanggal)));

                foreach (var (kode, tgl) in pairs)
                {
                    // Hanya hari kerja (Sen–Jum) yang dihitung dalam rekap kehadiran.
                    if (tgl.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
                    {
                        continue;
                    }
                    if (tgl >= awalMinggu)
                    {
                        hadirMinggu[kode] = hadirMinggu.GetValueOrDefault(kode) + 1;
                    }
                    if (tgl >= awalBulan)
                    {
                        hadirBulan[kode] = hadirBulan.GetValueOrDefault(kode) + 1;
                    }
                }
            }

            // Beban tugas per anggota (aktif / selesai / terlambat).
            Dictionary<string, (int Aktif, int Selesai, int Terlambat)> beban = new();
            if (ids.Count > 0)
            {
                var agg = await _db.Tugas
                    .Where(t => ids.Contains(t.IdPenerima))
                    .GroupBy(t => t.IdPenerima)
                    .Select(g => new
                    {
                        Id = g.Key,
                        Aktif = g.Count(x => x.Status == "Baru" || x.Status == "Dikerjakan"),
                        Selesai = g.Count(x => x.Status == "Selesai"),
                        Terlambat = g.Count(x => (x.Status == "Baru" || x.Status == "Dikerjakan")
                            && x.Tenggat != null && x.Tenggat < todayWib),
                    })
                    .ToListAsync();
                beban = agg.ToDictionary(x => x.Id, x => (x.Aktif, x.Selesai, x.Terlambat));
            }

            var anggota = rows.Select(m =>
            {
                var terisi = m.IdKaryawan is not null;
                var (aktif, selesai, terlambat) = terisi && beban.TryGetValue(m.IdKaryawan!, out var b) ? b : (0, 0, 0);
                return new RekapAnggotaDto(
                    m.Kedalaman, m.IdKaryawan, terisi ? m.Nama ?? "-" : "(kosong)", m.Jabatan, m.Unit, m.Band, m.Jg,
                    Terisi: terisi,
                    HadirHariIni: terisi && hadirIni.Contains(m.IdKaryawan!),
                    HadirMinggu: terisi && hadirMinggu.TryGetValue(m.IdKaryawan!, out var hm) ? hm : 0,
                    HadirBulan: terisi && hadirBulan.TryGetValue(m.IdKaryawan!, out var hb) ? hb : 0,
                    TugasAktif: aktif, TugasSelesai: selesai, TugasTerlambat: terlambat);
            }).ToList();

            var terisiCount = anggota.Count(a => a.Terisi);
            var kosong = anggota.Count - terisiCount;
            var hadirCount = anggota.Count(a => a.HadirHariIni);
            var belumAbsen = terisiCount - hadirCount;
            var totalTerlambat = anggota.Sum(a => a.TugasTerlambat);
            var totalAktif = anggota.Sum(a => a.TugasAktif);
            var totalSelesai = anggota.Sum(a => a.TugasSelesai);

            var peringatan = new List<string>();
            if (totalTerlambat > 0)
            {
                peringatan.Add($"{totalTerlambat} tugas melewati tenggat dan belum selesai.");
            }
            if (belumAbsen > 0)
            {
                peringatan.Add($"{belumAbsen} anggota belum tercatat hadir hari ini.");
            }
            if (kosong > 0)
            {
                peringatan.Add($"{kosong} formasi jabatan masih kosong.");
            }

            return new TeamRekapDto(
                TotalFormasi: anggota.Count, Terisi: terisiCount, Kosong: kosong,
                HadirHariIni: hadirCount, BelumAbsen: belumAbsen, FormasiKosong: kosong,
                HariKerjaMinggu: hariKerjaMinggu, HariKerjaBulan: hariKerjaBulan,
                TugasAktif: totalAktif, TugasSelesai: totalSelesai, TugasTerlambat: totalTerlambat,
                Anggota: anggota, Peringatan: peringatan);
        }
        finally
        {
            if (mustClose)
            {
                await conn.CloseAsync();
            }
        }
    }

    // Jumlah hari kerja (Senin–Jumat) dalam rentang inklusif [dari, sampai].
    private static int HitungHariKerja(DateOnly dari, DateOnly sampai)
    {
        var n = 0;
        for (var d = dari; d <= sampai; d = d.AddDays(1))
        {
            if (d.DayOfWeek is not (DayOfWeek.Saturday or DayOfWeek.Sunday))
            {
                n++;
            }
        }
        return n;
    }

    private static void Line(System.Text.StringBuilder sb, string label, string value)
        => sb.Append($"{Csv(label)};{Csv(value)}\r\n");

    // Escape CSV: bungkus tanda kutip bila mengandung ; " atau newline; gandakan kutip internal.
    private static string Csv(string? s)
    {
        s ??= "";
        if (s.IndexOfAny([';', '"', '\n', '\r']) < 0)
        {
            return s;
        }
        return $"\"{s.Replace("\"", "\"\"")}\"";
    }

    private static string Slug(string? s)
    {
        if (string.IsNullOrWhiteSpace(s))
        {
            return "tim";
        }
        var chars = s.Trim().Select(c => char.IsLetterOrDigit(c) ? c : '-').ToArray();
        var slug = new string(chars);
        while (slug.Contains("--"))
        {
            slug = slug.Replace("--", "-");
        }
        return slug.Trim('-');
    }

    // ---- Tugas (delegasi) ----

    public async Task<(bool Ok, string? Error, TugasDto? Tugas)> CreateTugasAsync(string pemberiNik, string? pemberiNama, TugasCreateRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Judul))
        {
            return (false, "Judul tugas wajib diisi.", null);
        }
        if (string.IsNullOrWhiteSpace(req.IdPenerima))
        {
            return (false, "Penerima tugas wajib dipilih.", null);
        }
        if (!await IsBawahanAsync(pemberiNik, req.IdPenerima))
        {
            return (false, "Tugas hanya bisa diberikan ke bawahan Anda.", null);
        }

        var now = DateTime.UtcNow;
        var t = new Tugas
        {
            IdPemberi = pemberiNik,
            NamaPemberi = pemberiNama,
            IdPenerima = req.IdPenerima,
            NamaPenerima = await NamaPenempatan(req.IdPenerima),
            Judul = req.Judul.Trim(),
            Deskripsi = string.IsNullOrWhiteSpace(req.Deskripsi) ? null : req.Deskripsi.Trim(),
            Tenggat = req.Tenggat,
            Status = "Baru",
            DibuatPada = now,
            DiperbaruiPada = now,
        };
        _db.Tugas.Add(t);
        await _db.SaveChangesAsync();
        return (true, null, Map(t));
    }

    public async Task<(bool Ok, string? Error)> UpdateStatusAsync(int id, string nik, string status)
    {
        if (!StatusValid.Contains(status))
        {
            return (false, "Status tidak valid.");
        }
        var t = await _db.Tugas.FirstOrDefaultAsync(x => x.Id == id);
        if (t is null)
        {
            return (false, "Tugas tidak ditemukan.");
        }
        if (t.IdPemberi != nik && t.IdPenerima != nik)
        {
            return (false, "Anda tidak berhak mengubah tugas ini.");
        }
        t.Status = status;
        t.DiperbaruiPada = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> DeleteTugasAsync(int id, string nik)
    {
        var t = await _db.Tugas.FirstOrDefaultAsync(x => x.Id == id);
        if (t is null)
        {
            return (false, "Tugas tidak ditemukan.");
        }
        if (t.IdPemberi != nik)
        {
            return (false, "Hanya pemberi tugas yang bisa menghapus.");
        }
        _db.Tugas.Remove(t);
        await _db.SaveChangesAsync();
        return (true, null);
    }

    // ---- helper ----

    private record struct MemberRow(int Kedalaman, int IdJabatan, string Jabatan, string? Band, int? Jg, string? IdKaryawan, string? Nama, string? Unit);

    private static async Task<List<MemberRow>> ReadMembers(DbCommand cmd)
    {
        var list = new List<MemberRow>();
        await using var r = await cmd.ExecuteReaderAsync();
        while (await r.ReadAsync())
        {
            list.Add(new MemberRow(
                Convert.ToInt32(r.GetValue(0)),
                Convert.ToInt32(r.GetValue(1)),
                r.GetString(2),
                r.IsDBNull(3) ? null : r.GetString(3),
                r.IsDBNull(4) ? null : Convert.ToInt32(r.GetValue(4)),
                r.IsDBNull(5) ? null : r.GetString(5),
                r.IsDBNull(6) ? null : r.GetString(6),
                r.IsDBNull(7) ? null : r.GetString(7)));
        }
        return list;
    }

    private static TeamMemberDto ToMember(MemberRow m, HashSet<string> hadir) => new(
        m.Kedalaman, m.IdJabatan, m.Jabatan, m.Band, m.Jg, m.IdKaryawan, m.Nama, m.Unit,
        Terisi: m.IdKaryawan is not null,
        HadirHariIni: m.IdKaryawan is not null && hadir.Contains(m.IdKaryawan));

    // Hadir hari ini = tercatat check-in di SALAH SATU sumber, sama seperti My Personal:
    // absensi kamera (db_mygcs.attendances) ATAU fingerprint/SDM (GCS.vw_web_sdm_absensi).
    private async Task<HashSet<string>> KehadiranHariIni(List<string> ids)
    {
        if (ids.Count == 0)
        {
            return [];
        }
        var todayWib = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        var startWib = todayWib.ToDateTime(TimeOnly.MinValue);
        var endWib = startWib.AddDays(1);

        var kamera = await _db.Attendances
            .Where(a => a.Tanggal == todayWib && a.CheckIn != null && ids.Contains(a.KodePegawai))
            .Select(a => a.KodePegawai)
            .Distinct()
            .ToListAsync();

        var sdm = await _gcs.AbsensiLog
            .Where(a => a.Tanggal >= startWib && a.Tanggal < endWib && a.CheckIn != null && ids.Contains(a.KodePegawai))
            .Select(a => a.KodePegawai)
            .Distinct()
            .ToListAsync();

        var present = kamera.ToHashSet();
        present.UnionWith(sdm);
        return present;
    }

    private static async Task<bool> ExistsBawahanLangsung(DbConnection conn, int myJabatan)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT TOP 1 1 FROM grading.jabatan_hirarki WHERE id_jabatan_atasan = @jab AND kedalaman = 1";
        AddParam(cmd, "@jab", myJabatan);
        var res = await cmd.ExecuteScalarAsync();
        return res is not null;
    }

    private async Task<bool> IsBawahanAsync(string atasanNik, string penerimaNik)
    {
        var conn = _db.Database.GetDbConnection();
        var mustClose = conn.State != ConnectionState.Open;
        if (mustClose)
        {
            await conn.OpenAsync();
        }
        try
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                SELECT TOP 1 1
                FROM grading.penempatan pm
                JOIN grading.jabatan_hirarki h ON h.id_jabatan_atasan = pm.id_jabatan AND h.kedalaman > 0
                JOIN grading.penempatan pp ON pp.id_jabatan = h.id_jabatan_bawahan AND pp.status = 'Aktif'
                WHERE pm.id_karyawan = @me AND pm.status = 'Aktif' AND pp.id_karyawan = @penerima";
            AddParam(cmd, "@me", atasanNik);
            AddParam(cmd, "@penerima", penerimaNik);
            var res = await cmd.ExecuteScalarAsync();
            return res is not null;
        }
        finally
        {
            if (mustClose)
            {
                await conn.CloseAsync();
            }
        }
    }

    private async Task<string?> NamaPenempatan(string nik)
    {
        var conn = _db.Database.GetDbConnection();
        var mustClose = conn.State != ConnectionState.Open;
        if (mustClose)
        {
            await conn.OpenAsync();
        }
        try
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT TOP 1 nama FROM grading.penempatan WHERE id_karyawan = @nik AND status = 'Aktif'";
            AddParam(cmd, "@nik", nik);
            var res = await cmd.ExecuteScalarAsync();
            return res as string;
        }
        finally
        {
            if (mustClose)
            {
                await conn.CloseAsync();
            }
        }
    }

    private async Task<IReadOnlyList<TugasDto>> GetTugasAsync(System.Linq.Expressions.Expression<Func<Tugas, bool>> where)
    {
        var rows = await _db.Tugas.Where(where).OrderByDescending(t => t.Id).ToListAsync();
        return rows.Select(Map).ToList();
    }

    private static TugasDto Map(Tugas t) => new(
        t.Id, t.IdPemberi, t.NamaPemberi, t.IdPenerima, t.NamaPenerima,
        t.Judul, t.Deskripsi, t.Tenggat, t.Status, t.DibuatPada);

    private static void AddParam(DbCommand cmd, string name, object value)
    {
        var p = cmd.CreateParameter();
        p.ParameterName = name;
        p.Value = value;
        cmd.Parameters.Add(p);
    }
}

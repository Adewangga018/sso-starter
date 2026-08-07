/* ============================================================================
   Tarif SATU DIMENSI (Band / JG / PG saja) untuk komponen "Pendapatan Dasar":
   - Gaji Pokok          -> per Band  (0=Direksi .. 6=Pelaksana Junior)
   - Tunjangan Jabatan   -> per JG    (7..21)
   - Tunjangan Perumahan -> per PG    (7..21)
   - Tunjangan Pangan    -> per Band
   - Tunjangan Angkutan  -> per Band
   Menggantikan matriks JG x PG (gaji.tarif) UNTUK KELIMA komponen ini saja -
   komponen JG_PG lain (BPJS, DPLK, dst) TIDAK terpengaruh, tetap di gaji.tarif.
   Admin SDM cukup input satu nominal per nilai Band/JG/PG, bukan per sel JG x PG.

   "Band" di sini = grading.band.urutan (identik dgn grading.band.id_band di
   dataset ini - 0..6), sama dgn nilai Band yang sudah tampil di slip gaji.

   NON-DESTRUKTIF & idempoten. gaji.tarif untuk kelima komponen ini kosong saat
   skrip ini ditulis (basis-nya baru dipindah dari JG_PG), jadi aman dibersihkan.
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
IF DB_NAME() <> 'db_mygcs'
BEGIN RAISERROR('BATAL: jalankan di db_mygcs.',16,1); SET NOEXEC ON; END
GO
IF OBJECT_ID('gaji.komponen','U') IS NULL
BEGIN RAISERROR('gaji.komponen belum ada - jalankan gaji-schema.sql dulu.',16,1); SET NOEXEC ON; END
GO

/* 1) Tabel tarif satu-dimensi ------------------------------------------------ */
IF OBJECT_ID('gaji.tarif_tunggal', 'U') IS NULL
BEGIN
    CREATE TABLE gaji.tarif_tunggal
    (
        id            INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_gaji_tarif_tunggal PRIMARY KEY,
        id_komponen   INT      NOT NULL,
        nilai         SMALLINT NOT NULL,             -- nilai Band (0-6) / JG / PG tergantung komponen.basis
        tahun_berlaku SMALLINT NOT NULL,
        nominal       DECIMAL(18,2) NOT NULL CONSTRAINT df_gaji_tarif_tunggal_nominal DEFAULT (0),
        CONSTRAINT fk_gaji_tarif_tunggal_komponen FOREIGN KEY (id_komponen) REFERENCES gaji.komponen (id_komponen),
        CONSTRAINT uq_gaji_tarif_tunggal UNIQUE (id_komponen, nilai, tahun_berlaku)
    );
    PRINT 'Tabel gaji.tarif_tunggal dibuat.';
END
ELSE PRINT 'LEWATI: gaji.tarif_tunggal sudah ada.';
GO

/* 2) Perluas CHECK basis. Daftar SELALU superset final (termasuk 'PendapatanDasar'
      dari gaji-formula-bpjs-kes.sql & 'Flat' dari gaji-potongan-flat.sql) supaya
      skrip ini idempoten & aman dijalankan dalam urutan apa pun relatif skrip
      basis lain - tidak pernah menyempitkan constraint di bawah nilai yang
      sudah dipakai data. */
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_gaji_komponen_basis')
    ALTER TABLE gaji.komponen DROP CONSTRAINT ck_gaji_komponen_basis;
GO
ALTER TABLE gaji.komponen ADD CONSTRAINT ck_gaji_komponen_basis
    CHECK (basis IN ('Karyawan_Periode','JG_PG','Band','JG','PG','PendapatanDasar','Flat'));
GO

/* 3) Pindahkan basis 5 komponen "Pendapatan Dasar" dari JG_PG -> dimensi tunggal */
UPDATE gaji.komponen SET basis = 'Band' WHERE kode = 'GAPOK';
UPDATE gaji.komponen SET basis = 'JG'   WHERE kode = 'TJ_JABATAN';
UPDATE gaji.komponen SET basis = 'PG'   WHERE kode = 'TJ_PERUMAHAN';
UPDATE gaji.komponen SET basis = 'Band' WHERE kode = 'TJ_PANGAN';
UPDATE gaji.komponen SET basis = 'Band' WHERE kode = 'TJ_ANGKUTAN';

/* 4) Bersihkan sisa tarif JG x PG kelima komponen itu (kosong saat ditulis,
      dijaga agar skrip ini aman diulang / dijalankan setelah ada isian salah). */
DELETE t FROM gaji.tarif t
    JOIN gaji.komponen k ON k.id_komponen = t.id_komponen
    WHERE k.kode IN ('GAPOK','TJ_JABATAN','TJ_PERUMAHAN','TJ_PANGAN','TJ_ANGKUTAN');

PRINT 'Pendapatan Dasar (Gaji Pokok/Tunjangan Jabatan/Perumahan/Pangan/Angkutan) kini bertarif satu dimensi (Band/JG/PG).';
GO
SET NOEXEC OFF;
GO

/* ============================================================================
   Perbaikan struktur dbo.web_sdm_spl di db_mygcs
   ----------------------------------------------------------------------------
   LATAR BELAKANG
   Tabel web_sdm_spl dipindahkan dari database GCS ke db_mygcs, tetapi hanya
   DATA-nya yang ikut (11.968 baris) - strukturnya tidak. Pola ini khas hasil
   "SELECT * INTO", yang memang hanya menyalin kolom + data dan membuang:

     - IDENTITY pada kolom id
     - PRIMARY KEY pada kolom id
     - SELURUH default constraint (newid(), getdate(), 'Lembur', dst)
     - NOT NULL pada id, id_user, kode_spl, id_pengguna, status_pengguna
     - Trigger web_sdm_spl_tri dan web_sdm_spl_tru

   AKIBATNYA submit SPL baru dari aplikasi PASTI GAGAL:
     - Entity WebSdmSpl sengaja TIDAK memuat kolom ROWID karena mengandalkan
       default newid(). Default itu hilang, padahal ROWID NOT NULL -> INSERT
       ditolak.
     - GcsDbContext memetakan id sebagai ValueGeneratedOnAdd (mengharapkan
       IDENTITY). IDENTITY-nya hilang -> EF tidak mengirim id -> id NULL.

   Skrip ini mengembalikan struktur agar identik dengan GCS.dbo.web_sdm_spl.

   CATATAN PENTING soal trigger web_sdm_spl_tru:
   Trigger UPDATE ini BUKAN sekadar audit - ia melakukan POSTING SPL yang
   disetujui ke sistem penggajian (GCSSDM.dbo.LEMBUR_PEGAWAI_TAB) dan
   me-rollback-nya kalau status dikembalikan ke 'Di Buat'. Ia memanggil objek
   lintas-database di GCSSDM (CHECKPERIODE, GETIDPERIODEGAJI, dst). Karena
   GCSSDM ada di server yang sama, trigger ini tetap berfungsi dari db_mygcs.
   Kalau Anda TIDAK ingin SPL dari db_mygcs ikut ter-posting ke penggajian,
   JANGAN jalankan BAGIAN 5 (pembuatan trigger) - lihat catatan di sana.

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i backend\Database\fix-web-sdm-spl.sql

   Skrip idempoten-aman: berhenti sendiri kalau struktur sudah benar, dan
   seluruh rebuild dibungkus transaksi (gagal di tengah -> ROLLBACK penuh).
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* ---------------------------------------------------------------------------
   BAGIAN 0 - Pengaman: pastikan kita benar-benar di db_mygcs
   --------------------------------------------------------------------------- */
IF DB_NAME() <> 'db_mygcs'
BEGIN
    DECLARE @db SYSNAME = DB_NAME();   -- RAISERROR tidak menerima pemanggilan fungsi sebagai argumen
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs, bukan %s.', 16, 1, @db);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('dbo.web_sdm_spl', 'U') IS NULL
BEGIN
    RAISERROR('BATAL: tabel dbo.web_sdm_spl tidak ditemukan di db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

/* Kalau id sudah IDENTITY, struktur sudah pernah diperbaiki - jangan ulangi. */
IF EXISTS (SELECT 1 FROM sys.identity_columns
           WHERE object_id = OBJECT_ID('dbo.web_sdm_spl') AND name = 'id')
BEGIN
    PRINT 'LEWATI: dbo.web_sdm_spl sudah punya IDENTITY - struktur sudah diperbaiki.';
    SET NOEXEC ON;
END
GO

/* ---------------------------------------------------------------------------
   BAGIAN 1 - Backup tabel apa adanya
   Backup ini TIDAK dihapus otomatis. Simpan sampai submit SPL terbukti jalan,
   lalu buang manual:  DROP TABLE dbo.web_sdm_spl_bak;
   --------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.web_sdm_spl_bak', 'U') IS NOT NULL
BEGIN
    RAISERROR('BATAL: dbo.web_sdm_spl_bak sudah ada. Periksa/hapus dulu agar backup lama tidak tertimpa.', 16, 1);
    SET NOEXEC ON;
END
GO

SELECT * INTO dbo.web_sdm_spl_bak FROM dbo.web_sdm_spl;
PRINT 'Backup dibuat: dbo.web_sdm_spl_bak (' + CAST(@@ROWCOUNT AS VARCHAR(20)) + ' baris).';
GO

/* ---------------------------------------------------------------------------
   BAGIAN 2 - Bangun tabel baru dengan struktur asli dari GCS
   Tipe, panjang, nullability, dan default di bawah ini disalin persis dari
   GCS.dbo.web_sdm_spl.
   --------------------------------------------------------------------------- */
CREATE TABLE dbo.web_sdm_spl_new
(
    id                    NUMERIC(25, 0)   IDENTITY(1, 1) NOT NULL,
    tgl_spl               SMALLDATETIME    NOT NULL CONSTRAINT DF_web_sdm_spl_tgl_spl         DEFAULT (GETDATE()),
    keterangan            NVARCHAR(254)    NULL     CONSTRAINT DF_web_sdm_spl_keterangan      DEFAULT ('Lembur'),
    jam_mulai             NVARCHAR(5)      NULL     CONSTRAINT DF_web_sdm_spl_jam_mulai       DEFAULT ('00:00'),
    jam_selesai           NVARCHAR(5)      NULL     CONSTRAINT DF_web_sdm_spl_jam_selesai     DEFAULT ('00:00'),
    jenis_spl             NVARCHAR(15)     NULL     CONSTRAINT DF_web_sdm_spl_jenis_spl       DEFAULT ('Biasa'),
    status                NVARCHAR(15)     NULL     CONSTRAINT DF_web_sdm_spl_status          DEFAULT ('Di Buat'),
    ROWID                 UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_web_sdm_spl_ROWID           DEFAULT (NEWID()),
    id_user               NVARCHAR(50)     NOT NULL CONSTRAINT DF_web_sdm_spl_id_user         DEFAULT ('Users'),
    id_approve            NVARCHAR(50)     NULL,
    tgl_approve           DATETIME         NULL,
    kode_spl              NVARCHAR(10)     NOT NULL CONSTRAINT DF_web_sdm_spl_kode_spl        DEFAULT (''),
    source                NVARCHAR(8)      NULL     CONSTRAINT DF_web_sdm_spl_source          DEFAULT ('GCSNET'),
    tgl_spl2              SMALLDATETIME    NOT NULL CONSTRAINT DF_web_sdm_spl_tgl_spl2        DEFAULT (GETDATE()),
    tgl_input             DATETIME         NOT NULL CONSTRAINT DF_web_sdm_spl_tgl_input       DEFAULT (GETDATE()),
    id_pengguna           NVARCHAR(50)     NOT NULL CONSTRAINT DF_web_sdm_spl_id_pengguna     DEFAULT (''),
    status_pengguna       NVARCHAR(15)     NOT NULL CONSTRAINT DF_web_sdm_spl_status_pengguna DEFAULT (''),
    tgl_approve_pengguna  DATE             NULL,
    id_approve_pengguna   NVARCHAR(50)     NULL,
    masa_atasan           NVARCHAR(10)     NULL,
    CONSTRAINT PK_web_sdm_spl PRIMARY KEY CLUSTERED (id)
);
PRINT 'Tabel dbo.web_sdm_spl_new dibuat.';
GO

/* ---------------------------------------------------------------------------
   BAGIAN 3 - Pindahkan data, pertahankan id dan ROWID asli
   Sudah diverifikasi sebelum skrip ini dibuat: tidak ada NULL di kolom yang
   akan jadi NOT NULL, id unik (11.968 baris), ROWID unik.
   --------------------------------------------------------------------------- */
BEGIN TRANSACTION;

SET IDENTITY_INSERT dbo.web_sdm_spl_new ON;

INSERT INTO dbo.web_sdm_spl_new
(
    id, tgl_spl, keterangan, jam_mulai, jam_selesai, jenis_spl, status, ROWID,
    id_user, id_approve, tgl_approve, kode_spl, source, tgl_spl2, tgl_input,
    id_pengguna, status_pengguna, tgl_approve_pengguna, id_approve_pengguna, masa_atasan
)
SELECT
    id, tgl_spl, keterangan, jam_mulai, jam_selesai, jenis_spl, status, ROWID,
    id_user, id_approve, tgl_approve, kode_spl, source, tgl_spl2, tgl_input,
    id_pengguna, status_pengguna, tgl_approve_pengguna, id_approve_pengguna, masa_atasan
FROM dbo.web_sdm_spl;

SET IDENTITY_INSERT dbo.web_sdm_spl_new OFF;

/* Verifikasi jumlah baris cocok sebelum menyentuh tabel lama. */
DECLARE @old INT = (SELECT COUNT(*) FROM dbo.web_sdm_spl);
DECLARE @new INT = (SELECT COUNT(*) FROM dbo.web_sdm_spl_new);

IF @old <> @new
BEGIN
    ROLLBACK TRANSACTION;
    RAISERROR('BATAL: jumlah baris tidak cocok (lama=%d, baru=%d). Tidak ada perubahan disimpan.', 16, 1, @old, @new);
    SET NOEXEC ON;
END
ELSE
BEGIN
    PRINT 'Data dipindahkan: ' + CAST(@new AS VARCHAR(20)) + ' baris (id asli dipertahankan).';
END

/* ---------------------------------------------------------------------------
   BAGIAN 4 - Tukar tabel lama dengan yang baru
   --------------------------------------------------------------------------- */
DROP TABLE dbo.web_sdm_spl;
EXEC sp_rename 'dbo.web_sdm_spl_new', 'web_sdm_spl';

COMMIT TRANSACTION;
PRINT 'Tabel ditukar. dbo.web_sdm_spl kini punya IDENTITY, PK, dan seluruh default.';
GO

/* Selaraskan seed IDENTITY dengan id tertinggi yang ada, supaya INSERT
   berikutnya tidak menabrak id lama. */
DECLARE @maxid NUMERIC(25, 0) = (SELECT ISNULL(MAX(id), 0) FROM dbo.web_sdm_spl);
DBCC CHECKIDENT ('dbo.web_sdm_spl', RESEED, @maxid) WITH NO_INFOMSGS;
PRINT 'IDENTITY di-reseed ke ' + CAST(@maxid AS VARCHAR(20)) + '. SPL berikutnya memakai id ' + CAST(@maxid + 1 AS VARCHAR(20)) + '.';
GO

/* ---------------------------------------------------------------------------
   BAGIAN 5 - Buat ulang trigger (disalin persis dari GCS)

   >>> BACA DULU SEBELUM MENJALANKAN BAGIAN INI <<<
   web_sdm_spl_tru mem-posting SPL berstatus 'Di Setujui' ke tabel penggajian
   GCSSDM.dbo.LEMBUR_PEGAWAI_TAB (dan menghapusnya lagi kalau status di-rollback
   ke 'Di Buat'). Artinya persetujuan SPL lewat aplikasi ini akan langsung
   memengaruhi data penggajian di GCSSDM - sama seperti perilaku lama di GCS.

   Kalau itu MEMANG yang diinginkan (perilaku identik dengan sistem lama),
   jalankan apa adanya.
   Kalau db_mygcs masih tahap uji coba dan Anda belum mau menyentuh penggajian,
   HAPUS/komentari blok web_sdm_spl_tru di bawah. Tabel tetap berfungsi; hanya
   posting otomatis ke penggajian yang tidak aktif.

   Catatan: GcsDbContext mendeklarasikan HasTrigger("web_sdm_spl_tri") dan
   HasTrigger("web_sdm_spl_tru"). Deklarasi itu membuat EF memakai jalur INSERT
   tanpa klausa OUTPUT (SQL Server melarang OUTPUT pada tabel bertrigger).
   Deklarasi tersebut aman meski trigger tidak dibuat, jadi kode tidak perlu
   diubah apa pun Anda pilih.
   --------------------------------------------------------------------------- */
GO
CREATE TRIGGER [dbo].[web_sdm_spl_tri] ON [dbo].[web_sdm_spl]
WITH EXECUTE AS CALLER
FOR INSERT
AS
BEGIN
  /* Trigger body */
  DECLARE @id NUMERIC(25,0), @id_pengguna NVARCHAR(50);
  SELECT @id = id, @id_pengguna = id_pengguna FROM INSERTED;
  IF (@id_pengguna != '' OR @id_pengguna != NULL) BEGIN
  	UPDATE dbo.web_sdm_spl SET status_pengguna = 'OPEN' WHERE id = @id;
  END
END
GO
PRINT 'Trigger dbo.web_sdm_spl_tri dibuat.';
GO
CREATE TRIGGER [dbo].[web_sdm_spl_tru] ON [dbo].[web_sdm_spl]
WITH EXECUTE AS CALLER
FOR UPDATE
AS
/* HISTORY                                                     */
/* ARIK : 20200311 -> Pembuatan posting untuk menyimpan data   */
/*					  spl disetujui masuk ke aplikasi gcs      */
/* *********************************************************** */
BEGIN
  DECLARE @STATUS_OLD NVARCHAR(15), @STATUS_NEW NVARCHAR(15), @ID_PERIODE INT;
  DECLARE @ID_SPL INT, @ID_USER NVARCHAR(10), @TGL_SPL SMALLDATETIME, @TGL_SPL2 SMALLDATETIME,
  	@JAM_MULAI NVARCHAR(5), @JAM_SELESAI NVARCHAR(5), @JENIS_SPL NVARCHAR(15), @KODE_SPL NVARCHAR(10),
    @KETERANGAN nvarchar(254), @id_pengguna NVARCHAR(50), @status_pengguna_old NVARCHAR(15),
    @status_pengguna_new NVARCHAR(15);
  DECLARE @ID_LEMBUR_PEGAWAI INT, @KODE_LEMBUR_PEGAWAI nvarchar(15), @ID_PEGAWAI INT, @PEGAWAI_SHIFT NVARCHAR(5);

  SELECT @STATUS_OLD = RTRIM(STATUS), @status_pengguna_old = status_pengguna FROM DELETED;
  SELECT @ID_SPL = ID, @ID_USER = ID_USER, @TGL_SPL = TGL_SPL, @TGL_SPL2 = TGL_SPL2,
  	@JAM_MULAI = JAM_MULAI, @JAM_SELESAI = JAM_SELESAI, @JENIS_SPL = JENIS_SPL,
    @KODE_SPL = RTRIM(KODE_SPL), @STATUS_NEW = RTRIM(STATUS), @KETERANGAN = RTRIM(KETERANGAN),
    @status_pengguna_new = status_pengguna FROM INSERTED;

  EXEC GCSSDM.dbo.CHECKPERIODE @TGL_SPL;

  /* POSTING SPL */
  IF @STATUS_OLD = 'Di Buat' AND @STATUS_NEW = 'Di Setujui' BEGIN
  	SET @ID_PERIODE = GCSSDM.dbo.GETIDPERIODEGAJI(@TGL_SPL);
    SELECT @ID_PEGAWAI = ID_PEGAWAI, @PEGAWAI_SHIFT=PEGAWAI_SHIFT FROM GCSSDM.dbo.PEGAWAI WHERE KODE_PEGAWAI = @ID_USER;
	/* MENCEK APAKAH HEADER DATA LEMBUR SUDAH ADA DI APLIKASI GCS */
  	SELECT @ID_LEMBUR_PEGAWAI = ID_LEMBUR_PEGAWAI FROM GCSSDM.dbo.LEMBUR_PEGAWAI
    WHERE KODE_PEGAWAI = @ID_USER AND ID_PERIODE = @ID_PERIODE AND SOURCE = 'GCSNET';
    IF @@ROWCOUNT = 0 BEGIN
    	SET @KODE_LEMBUR_PEGAWAI = GCSSDM.dbo.GETGENNOLEMBUR(YEAR(@TGL_SPL), MONTH(@TGL_SPL), 'SPL');
    	/* INSERT HEADER LEMBUR PEGAWAI */
    	INSERT INTO GCSSDM.dbo.LEMBUR_PEGAWAI_TAB (
        	KODE_LEMBUR_PEGAWAI,TGL_INPUT,ID_PERIODE,ID_PEGAWAI,STATUS,ID_PEMBUAT,SOURCE
        ) VALUES (
        	@KODE_LEMBUR_PEGAWAI, GETDATE(), @ID_PERIODE, @ID_PEGAWAI, 'Di Posting', @ID_USER, 'GCSNET'
        );
        SELECT @ID_LEMBUR_PEGAWAI = ID_LEMBUR_PEGAWAI FROM GCSSDM.dbo.LEMBUR_PEGAWAI
		WHERE KODE_PEGAWAI = @ID_USER AND ID_PERIODE = @ID_PERIODE AND
        	KODE_LEMBUR_PEGAWAI = @KODE_LEMBUR_PEGAWAI;
    END

	/* 20201109 ---> PERGANTIAN JENIS SPL JIKA BUKAN PEGAWAI SHIFT */
    IF (@PEGAWAI_SHIFT = 'Tidak' AND @JENIS_SPL = 'Mengganti') BEGIN
    	SET @JENIS_SPL = 'Biasa';
   	END

    IF @ID_LEMBUR_PEGAWAI > 0 BEGIN
      /* INSERT DETAIL LEMBUR PEGAWAI */
      SET @JAM_SELESAI = GCSSDM.dbo.getJamSelesaiSpl(@TGL_SPL, @TGL_SPL2, @JAM_MULAI, @JAM_SELESAI);
      INSERT INTO GCSSDM.dbo.LEMBUR_PEGAWAI_DETAIL_TAB (
          ID_LEMBUR_PEGAWAI,TGL_LEMBUR,KETERANGAN,JAM_MULAI,JAM_SELESAI,JENIS_LEMBUR,ID_PEMBUAT,ID_SPL
      ) VALUES (
          @ID_LEMBUR_PEGAWAI, @TGL_SPL, LEFT(@KETERANGAN + ' [ SPL-' + @KODE_SPL + ' ]', 254),
          @JAM_MULAI, @JAM_SELESAI, @JENIS_SPL, @ID_USER, @ID_SPL
      );
    END
    /* CROSS DATA SPL GCSNET DAN SPL MEMO */
    /*    UPDATE GCSSDM.dbo.LEMBUR_PEGAWAI_DETAIL_MEMO_TAB SET ID_SPL = @ID_SPL
        WHERE ID_PEGAWAI = @ID_PEGAWAI AND CONVERT(DATE, TGL_LEMBUR) = CONVERT(DATE, @TGL_SPL);
    */
  END

  /* ROLLBACK STATUS SPL */
  IF @STATUS_OLD = 'Di Setujui' AND @STATUS_NEW = 'Di Buat' BEGIN
  	SELECT @ID_LEMBUR_PEGAWAI = ID_LEMBUR_PEGAWAI FROM GCSSDM.dbo.LEMBUR_PEGAWAI_DETAIL_TAB
    	WHERE ID_SPL = @ID_SPL;
    IF @ID_LEMBUR_PEGAWAI > 0 BEGIN
  		DELETE FROM GCSSDM.dbo.LEMBUR_PEGAWAI_DETAIL_TAB WHERE ID_SPL = @ID_SPL;
	    SELECT @ID_SPL = COUNT(ID_LEMBUR_PEGAWAI) FROM GCSSDM.dbo.LEMBUR_PEGAWAI_DETAIL_TAB
    	WHERE ID_LEMBUR_PEGAWAI = @ID_LEMBUR_PEGAWAI;
		IF @@ROWCOUNT = 0 OR @ID_SPL = 0 BEGIN
        	DELETE FROM GCSSDM.dbo.LEMBUR_PEGAWAI_TAB WHERE ID_LEMBUR_PEGAWAI = @ID_LEMBUR_PEGAWAI;
        END
    END
    /* CROSS DATA SPL GCSNET DAN SPL MEMO */
    /*    UPDATE GCSSDM.dbo.LEMBUR_PEGAWAI_DETAIL_MEMO_TAB SET ID_SPL = 0
        WHERE ID_PEGAWAI = @ID_PEGAWAI AND CONVERT(DATE, TGL_LEMBUR) = CONVERT(DATE, @TGL_SPL);    */
  END

END
GO
PRINT 'Trigger dbo.web_sdm_spl_tru dibuat (posting ke penggajian GCSSDM aktif).';
GO

/* ---------------------------------------------------------------------------
   BAGIAN 6 - Verifikasi hasil
   --------------------------------------------------------------------------- */
PRINT '';
PRINT '=== HASIL AKHIR dbo.web_sdm_spl ===';
SELECT
    (SELECT COUNT(*) FROM dbo.web_sdm_spl)                                                   AS jml_baris,
    (SELECT COUNT(*) FROM dbo.web_sdm_spl_bak)                                               AS jml_backup,
    (SELECT MAX(id) FROM dbo.web_sdm_spl)                                                    AS max_id,
    (SELECT COUNT(*) FROM sys.identity_columns    WHERE object_id = OBJECT_ID('dbo.web_sdm_spl'))                        AS punya_identity,
    (SELECT COUNT(*) FROM sys.indexes             WHERE object_id = OBJECT_ID('dbo.web_sdm_spl') AND is_primary_key = 1) AS punya_pk,
    (SELECT COUNT(*) FROM sys.default_constraints WHERE parent_object_id = OBJECT_ID('dbo.web_sdm_spl'))                 AS jml_default,
    (SELECT COUNT(*) FROM sys.triggers            WHERE parent_id = OBJECT_ID('dbo.web_sdm_spl'))                        AS jml_trigger;
PRINT 'Harapan: jml_baris = jml_backup = 11968, punya_identity=1, punya_pk=1, jml_default=12, jml_trigger=2.';
PRINT 'Kalau submit SPL sudah terbukti jalan, backup boleh dibuang:  DROP TABLE dbo.web_sdm_spl_bak;';
GO

SET NOEXEC OFF;
GO

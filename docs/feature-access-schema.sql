/* ============================================================================
   dbo.feature_access - lock/unlock per FITUR (item menu sidebar) tiap modul.
   Override seperti dbo.module_access, tapi granular ke fitur. Baris hanya ada
   bila Admin IT pernah mengubah; fitur tanpa baris = default aktif (terbuka).
   NON-DESTRUKTIF & idempoten.
   ============================================================================ */
SET NOCOUNT ON;
GO
IF DB_NAME() <> 'db_mygcs'
BEGIN RAISERROR('BATAL: jalankan di db_mygcs.',16,1); SET NOEXEC ON; END
GO

IF OBJECT_ID('dbo.feature_access', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.feature_access
    (
        FeatureKey NVARCHAR(80)  NOT NULL CONSTRAINT pk_feature_access PRIMARY KEY,
        Enabled    BIT           NOT NULL CONSTRAINT df_feature_access_enabled DEFAULT (1),
        UpdatedAt  DATETIME2     NULL,
        UpdatedBy  NVARCHAR(256) NULL
    );
    PRINT 'Tabel dbo.feature_access dibuat.';
END
ELSE PRINT 'LEWATI: dbo.feature_access sudah ada.';
GO

SET NOEXEC OFF;
GO

<#
.SYNOPSIS
    Build + deploy MyGCS (backend ASP.NET Core & frontend React) ke IIS lewat network share.

.DESCRIPTION
    Menggantikan langkah manual: publish -> app_offline -> hapus file -> copy -> hapus app_offline.
    Backend memakai trik app_offline.htm agar IIS melepas kunci file (tanpa perlu IIS Manager).
    web.config di server SELALU dipertahankan (berisi env var/rahasia: connection string,
    thumbprint sertifikat, issuer).

    Sebelum backend di-deploy, skema DB produksi dimigrasi otomatis dengan menjalankan
    docs\prod-migrasi.sql (NON-DESTRUKTIF & idempoten). Connection string dibaca langsung
    dari web.config di server (env var ConnectionStrings__DefaultConnection) — tidak ada
    kredensial yang disimpan di skrip/repo. Migrasi berjalan SEBELUM app dioffline-kan;
    bila gagal, deploy dibatalkan tanpa downtime (situs tetap versi lama).

.EXAMPLE
    .\deploy.ps1 -DryRun          # lihat apa yang akan dilakukan, tanpa mengubah apa pun
    .\deploy.ps1                  # migrasi DB + build + deploy backend & frontend
    .\deploy.ps1 -BackendOnly     # hanya backend (+ migrasi DB)
    .\deploy.ps1 -SkipBuild       # deploy artifact yang sudah ada (tanpa build ulang)
    .\deploy.ps1 -SkipMigrate     # deploy tanpa menjalankan migrasi DB
#>
[CmdletBinding()]
param(
    # ---- SESUAIKAN PATH INI SEKALI SAJA ----
    [string]$BackendShare  = '\\192.168.100.240\web_apps$\backend-mygcs',
    [string]$FrontendShare = '\\192.168.100.240\web_apps$\mygcs',
    # ----------------------------------------

    [switch]$BackendOnly,
    [switch]$FrontendOnly,
    [switch]$SkipBuild,
    [switch]$SkipMigrate,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$root         = $PSScriptRoot
$backendSrc   = Join-Path $root 'backend'
$frontendSrc  = Join-Path $root 'frontend'
$publishDir   = Join-Path $backendSrc 'publish'
$distDir      = Join-Path $frontendSrc 'dist'
$appOffline   = Join-Path $root 'app_offline.htm'
$migrationSql = Join-Path $root 'docs\prod-migrasi.sql'

function Info($msg) { Write-Host "[deploy] $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "[  ok  ] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "[ warn ] $msg" -ForegroundColor Yellow }

# Migrasi skema DB produksi (non-destruktif). Connection string dibaca dari web.config
# server yang sudah ada — TIDAK ada kredensial di skrip/repo. Dipanggil sebelum app
# di-offline-kan agar kegagalan tidak menyebabkan downtime.
function Invoke-DbMigration {
    param([string]$WebConfigPath, [string]$SqlFile, [switch]$DryRun)

    if (-not (Test-Path $SqlFile))       { throw "Berkas migrasi tidak ditemukan: $SqlFile" }
    if (-not (Test-Path $WebConfigPath)) { throw "web.config server tidak ditemukan: $WebConfigPath" }

    Info 'Membaca connection string db_mygcs dari web.config server...'
    [xml]$cfg = Get-Content -LiteralPath $WebConfigPath -Raw
    $node = $cfg.SelectSingleNode("//environmentVariable[@name='ConnectionStrings__DefaultConnection']")
    if (-not $node -or [string]::IsNullOrWhiteSpace($node.value)) {
        throw "ConnectionStrings__DefaultConnection tidak ada di web.config server."
    }
    $cs = $node.value
    if ($cs -notmatch 'Connect Timeout') { $cs = $cs.TrimEnd(';') + ';Connect Timeout=60' }

    $dbName = ([regex]::Match($cs, 'Database=([^;]+)')).Groups[1].Value
    Info "  migrasi -> database: $dbName (non-destruktif, idempoten)"
    if ($DryRun) { Warn '  (DryRun) migrasi tidak dijalankan.'; return }

    $batches = (Get-Content -LiteralPath $SqlFile -Raw) -split "(?m)^\s*GO\s*$"
    $conn = New-Object System.Data.SqlClient.SqlConnection $cs
    $conn.add_InfoMessage([System.Data.SqlClient.SqlInfoMessageEventHandler] {
        param($s, $e) Write-Host "        $($e.Message)" -ForegroundColor DarkGray
    })
    $conn.Open()
    $i = 0
    try {
        foreach ($b in $batches) {
            if ($b.Trim().Length -eq 0) { continue }
            $i++
            $cmd = $conn.CreateCommand(); $cmd.CommandText = $b; $cmd.CommandTimeout = 180
            $cmd.ExecuteNonQuery() | Out-Null
        }
    } catch {
        throw "Migrasi DB GAGAL pada batch #${i}: $($_.Exception.Message)"
    } finally {
        $conn.Close()
    }
    Ok "Migrasi DB selesai ($i batch)."
}

if ($DryRun) { Warn 'DRY RUN - tidak ada file yang benar-benar diubah.' }

$doBackend  = -not $FrontendOnly
$doFrontend = -not $BackendOnly

# ---------------------------------------------------------------- pre-flight
if ($doBackend -and -not (Test-Path $BackendShare)) {
    throw "Folder backend di server tidak terjangkau: $BackendShare"
}
if ($doFrontend -and -not (Test-Path $FrontendShare)) {
    throw "Folder frontend di server tidak terjangkau: $FrontendShare"
}
if ($doBackend -and -not (Test-Path $appOffline)) {
    throw "app_offline.htm tidak ditemukan di $appOffline"
}

# ---------------------------------------------------------------- build
if (-not $SkipBuild) {
    if ($doBackend) {
        Info 'Build backend (dotnet publish -c Release)...'
        if (-not $DryRun) {
            if (Test-Path $publishDir) { Remove-Item $publishDir -Recurse -Force }
            & dotnet publish $backendSrc -c Release -o $publishDir --nologo | Out-Null
            if ($LASTEXITCODE -ne 0) { throw 'dotnet publish GAGAL.' }
        }
        Ok 'Backend ter-publish.'
    }
    if ($doFrontend) {
        Info 'Build frontend (npm run build)...'
        if (-not $DryRun) {
            Push-Location $frontendSrc
            try {
                & npm run build | Out-Null
                if ($LASTEXITCODE -ne 0) { throw 'npm run build GAGAL.' }
            } finally { Pop-Location }
        }
        Ok 'Frontend ter-build.'
    }
}

# ---------------------------------------------------------------- backend deploy
if ($doBackend) {
    if (-not (Test-Path $publishDir)) { throw "Folder publish tidak ada: $publishDir (jangan pakai -SkipBuild)" }

    # Migrasi DB DULU, selagi app masih online. Non-destruktif; bila gagal, deploy batal
    # tanpa downtime (situs tetap versi lama). Skema baru bersifat aditif, jadi aman
    # diterapkan sebelum kode baru masuk.
    if (-not $SkipMigrate) {
        Invoke-DbMigration -WebConfigPath (Join-Path $BackendShare 'web.config') -SqlFile $migrationSql -DryRun:$DryRun
    } else {
        Warn 'Migrasi DB dilewati (-SkipMigrate).'
    }

    # File yang TIDAK boleh disentuh di server (rahasia & penanda offline)
    $keep = @('web.config', 'app_offline.htm')

    Info "Menonaktifkan aplikasi (copy app_offline.htm ke server)..."
    if (-not $DryRun) {
        Copy-Item $appOffline -Destination (Join-Path $BackendShare 'app_offline.htm') -Force
        Start-Sleep -Seconds 3   # beri waktu IIS mematikan worker & melepas kunci file
    }
    Ok 'Aplikasi offline - kunci file dilepas.'

    Info "Menghapus file lama (kecuali: $($keep -join ', '))..."
    $stale = Get-ChildItem -LiteralPath $BackendShare -Force | Where-Object { $keep -notcontains $_.Name }
    Info "  $($stale.Count) item akan dihapus."
    if (-not $DryRun) {
        foreach ($item in $stale) { Remove-Item -LiteralPath $item.FullName -Recurse -Force }
    }

    Info 'Menyalin hasil publish baru (kecuali web.config)...'
    $newItems = Get-ChildItem -LiteralPath $publishDir -Force | Where-Object { $_.Name -ne 'web.config' }
    Info "  $($newItems.Count) item akan disalin."
    if (-not $DryRun) {
        foreach ($item in $newItems) {
            Copy-Item -LiteralPath $item.FullName -Destination $BackendShare -Recurse -Force
        }
    }

    Info 'Mengaktifkan aplikasi kembali (hapus app_offline.htm)...'
    if (-not $DryRun) {
        Remove-Item -LiteralPath (Join-Path $BackendShare 'app_offline.htm') -Force
    }
    Ok 'Backend ter-deploy & aplikasi online kembali.'
}

# ---------------------------------------------------------------- frontend deploy
if ($doFrontend) {
    if (-not (Test-Path $distDir)) { throw "Folder dist tidak ada: $distDir (jangan pakai -SkipBuild)" }

    # Frontend adalah file statis (tidak pernah terkunci) dan web.config-nya ikut dari dist
    # (aturan rewrite SPA, bukan rahasia) — jadi seluruh isi boleh diganti.
    Info 'Menghapus isi folder frontend lama...'
    $oldFe = Get-ChildItem -LiteralPath $FrontendShare -Force
    Info "  $($oldFe.Count) item akan dihapus."
    if (-not $DryRun) {
        foreach ($item in $oldFe) { Remove-Item -LiteralPath $item.FullName -Recurse -Force }
    }

    Info 'Menyalin build frontend baru...'
    if (-not $DryRun) {
        Copy-Item -Path (Join-Path $distDir '*') -Destination $FrontendShare -Recurse -Force
    }
    Ok 'Frontend ter-deploy.'
}

Write-Host ''
if ($DryRun) {
    Warn 'DRY RUN selesai - tidak ada perubahan. Jalankan tanpa -DryRun untuk deploy sungguhan.'
} else {
    Ok 'DEPLOY SELESAI.'
    Write-Host '      Verifikasi: https://my.gcs-gresik.com/api/health  lalu buka https://my.gcs-gresik.com/' -ForegroundColor Gray
}

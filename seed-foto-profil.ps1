<#
.SYNOPSIS
    Isi foto profil default (My Personal) untuk seluruh karyawan dari backend/SeedData/foto-karyawan/.

.DESCRIPTION
    Backend membaca foto profil dari Profile:PhotoPath (lihat backend/appsettings.json - SAMA
    persis dipakai dev maupun prod, share EASy produksi, tidak ada folder lokal terpisah kecuali
    di-override lewat user-secrets), nama berkas HARUS {SafeKode(ID_KARYAWAN)}.jpg atau .png -
    SafeKode membuang semua karakter selain huruf/angka (lihat PersonalController.SafeKode), jadi
    ID_KARYAWAN "P.217002" -> nama berkas "P217002.jpg" (BUKAN "P.217002.jpg" spt di SeedData/).

    Skrip ini, untuk tiap berkas di folder sumber (nama = "{ID_KARYAWAN}.ext"):
      1. Melewati berkas yang bukan gambar (mis. "useless").
      2. Kalau satu ID punya lebih dari satu berkas (ekstensi beda), pilih SATU: .png
         diutamakan (master resolusi lebih tinggi di dataset ini), sisanya diabaikan.
      3. Crop persegi area wajah (foto sumber = poster ID card GCS penuh, bukan headshot
         rapat - lihat param FaceCropWidthPct/FaceTopPct) + resize sisi terpanjang <= MaxDim
         (default 900px - dataset asli ~3700x5500px/~10 MB per foto) + re-encode JPEG
         kualitas 85 - turun jadi puluhan-ratusan KB per foto.
      4. Simpan sebagai {Dest}\{SafeKode}.jpg. LEWATI (tidak menimpa) ID yang di {Dest} sudah
         py .jpg/.png - foto ini DEFAULT, bukan boleh menimpa foto yg sudah diupload sendiri
         oleh karyawan. Pakai -Overwrite kalau sengaja ingin menimpa.

    Jalankan dari MESIN yang punya akses tulis ke share EASy produksi
    (\\192.168.100.240\web_apps$\easy\storage\app\profile).

.EXAMPLE
    .\seed-foto-profil.ps1 -DryRun
    .\seed-foto-profil.ps1
    .\seed-foto-profil.ps1 -Dest 'C:\temp\foto-profil-dev' -MaxDim 900
#>
[CmdletBinding()]
param(
    [string]$Source = (Join-Path $PSScriptRoot 'backend\SeedData\foto-karyawan'),
    [string]$Dest   = '\\192.168.100.240\web_apps$\easy\storage\app\profile',
    [int]$MaxDim    = 900,
    [int]$JpegQuality = 85,
    # Foto sumber adalah poster ID card GCS (logo + wajah + nama besar di bawah), BUKAN
    # headshot rapat - semua pakai template yang sama (diverifikasi manual di ~9 sampel),
    # jadi wajah selalu ada di area yang sama secara relatif: crop persegi selebar
    # FaceCropWidthPct dari lebar asli, dimulai dari FaceTopPct dari tinggi asli, tengah
    # horizontal - menangkap kepala+sedikit bahu, bukan dada/logo di tengah gambar penuh.
    [double]$FaceCropWidthPct = 0.60,
    [double]$FaceTopPct = 0.05,
    [switch]$NoCrop,
    # Foto ini dimaksudkan sbg DEFAULT - karyawan yg sudah pernah upload foto sendiri
    # (lewat My Personal > Profil) TIDAK boleh ketiban/ketimpa. Default true = lewati ID
    # yg sudah punya .jpg ATAU .png di $Dest. Pakai -Overwrite kalau sengaja ingin menimpa.
    [switch]$Overwrite,
    [switch]$DryRun
)

Add-Type -AssemblyName System.Drawing

function Get-SafeKode([string]$raw) {
    -join ($raw.ToCharArray() | Where-Object { [char]::IsLetterOrDigit($_) })
}

if (-not (Test-Path $Source)) {
    Write-Error "Folder sumber tidak ditemukan: $Source"
    exit 1
}

if (-not $DryRun) {
    if (-not (Test-Path $Dest)) {
        try { New-Item -ItemType Directory -Path $Dest -Force | Out-Null }
        catch { Write-Error "Gagal membuat/menjangkau folder tujuan: $Dest`n$_"; exit 1 }
    }
}

$imgExt = @('.png', '.jpg', '.jpeg')
$files = Get-ChildItem -Path $Source -File | Where-Object { $imgExt -contains $_.Extension.ToLowerInvariant() }

# Grup per SafeKode(ID_KARYAWAN); kalau lebih dari satu berkas, prioritaskan .png.
$groups = $files | Group-Object { Get-SafeKode ([System.IO.Path]::GetFileNameWithoutExtension($_.Name)) }

$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$encParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [int64]$JpegQuality)

$ok = 0; $skipped = 0; $failed = 0
foreach ($g in $groups) {
    $safeKode = $g.Name
    if ([string]::IsNullOrWhiteSpace($safeKode)) { $skipped++; continue }

    $chosen = $g.Group | Where-Object { $_.Extension -match '(?i)\.png' } | Select-Object -First 1
    if (-not $chosen) { $chosen = $g.Group | Select-Object -First 1 }
    $ignored = $g.Group | Where-Object { $_.FullName -ne $chosen.FullName }
    foreach ($ig in $ignored) { Write-Verbose "  (diabaikan, duplikat $safeKode) $($ig.Name)" }

    $outPath = Join-Path $Dest "$safeKode.jpg"

    if (-not $Overwrite) {
        $existingJpg = Join-Path $Dest "$safeKode.jpg"
        $existingPng = Join-Path $Dest "$safeKode.png"
        if ((Test-Path $existingJpg) -or (Test-Path $existingPng)) {
            $skipped++
            Write-Output "LEWATI $safeKode (sudah ada foto - pakai -Overwrite kalau ingin menimpa)"
            continue
        }
    }
    if ($DryRun) {
        Write-Output "[DRYRUN] $($chosen.Name) -> $outPath"
        $ok++
        continue
    }

    try {
        $img = [System.Drawing.Image]::FromFile($chosen.FullName)
        try {
            if ($NoCrop) {
                $srcRect = New-Object System.Drawing.Rectangle(0, 0, $img.Width, $img.Height)
            } else {
                # Persegi selebar FaceCropWidthPct dari lebar asli, mulai dari FaceTopPct
                # dari tinggi asli, tengah horizontal. Diclamp ke batas gambar - kalau
                # ternyata sebuah foto beda proporsi dari template biasa, tidak sampai error.
                $side = [int]([Math]::Round($img.Width * $FaceCropWidthPct))
                $side = [Math]::Min($side, [Math]::Min($img.Width, $img.Height))
                $cropX = [int]([Math]::Round(($img.Width - $side) / 2.0))
                $cropY = [int]([Math]::Round($img.Height * $FaceTopPct))
                if ($cropY + $side -gt $img.Height) { $cropY = [Math]::Max(0, $img.Height - $side) }
                $srcRect = New-Object System.Drawing.Rectangle($cropX, $cropY, $side, $side)
            }

            $scale = [Math]::Min(1.0, $MaxDim / [Math]::Max($srcRect.Width, $srcRect.Height))
            $w = [Math]::Max(1, [int]($srcRect.Width * $scale))
            $h = [Math]::Max(1, [int]($srcRect.Height * $scale))

            $bmp = New-Object System.Drawing.Bitmap($w, $h)
            try {
                $gfx = [System.Drawing.Graphics]::FromImage($bmp)
                try {
                    $gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                    $destRect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
                    $gfx.DrawImage($img, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
                } finally { $gfx.Dispose() }

                $bmp.Save($outPath, $jpegCodec, $encParams)
            } finally { $bmp.Dispose() }
        } finally { $img.Dispose() }

        # Satu foto per pegawai - buang varian .png lama punya ID yg sama kalau ada.
        $stalePng = Join-Path $Dest "$safeKode.png"
        if (Test-Path $stalePng) { Remove-Item $stalePng -Force -ErrorAction SilentlyContinue }

        $ok++
        Write-Output "OK  $($chosen.Name) -> $safeKode.jpg ($([Math]::Round((Get-Item $outPath).Length / 1KB)) KB)"
    } catch {
        $failed++
        Write-Warning "GAGAL $($chosen.Name): $_"
    }
}

Write-Output ""
Write-Output "Selesai. Berhasil: $ok, Gagal: $failed, Dilewati: $skipped (dari $($groups.Count) ID karyawan)."
if ($DryRun) { Write-Output "(-DryRun aktif, tidak ada berkas yang benar-benar ditulis.)" }

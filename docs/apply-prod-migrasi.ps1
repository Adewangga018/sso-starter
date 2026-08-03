<#
    apply-prod-migrasi.ps1 - Menjalankan docs\prod-migrasi.sql ke DB PRODUKSI
    dengan aman (batch per GO, berhenti bila ada error, menampilkan pesan server).
    NON-DESTRUKTIF: hanya membuat objek/kolom yang belum ada.

    Contoh:
      .\apply-prod-migrasi.ps1 -Server "10.0.0.5,1433" -Password "RAHASIA"
      .\apply-prod-migrasi.ps1 -Server "SRV\INST" -User sa -Password "RAHASIA" -Database db_mygcs

    Catatan: kredensial TIDAK disimpan di berkas mana pun; berikan lewat parameter.
#>
param(
    [Parameter(Mandatory = $true)] [string] $Server,
    [string] $Database = "db_mygcs",
    [string] $User = "sa",
    [Parameter(Mandatory = $true)] [string] $Password,
    [string] $SqlFile = (Join-Path $PSScriptRoot "prod-migrasi.sql")
)

if (-not (Test-Path $SqlFile)) { Write-Error "Berkas SQL tidak ditemukan: $SqlFile"; exit 1 }

$cs = "Server=$Server;Database=$Database;User Id=$User;Password=$Password;TrustServerCertificate=True;Encrypt=False;Connect Timeout=60"
$sql = Get-Content $SqlFile -Raw
$batches = $sql -split "(?m)^\s*GO\s*$"

$conn = New-Object System.Data.SqlClient.SqlConnection $cs
$conn.add_InfoMessage([System.Data.SqlClient.SqlInfoMessageEventHandler] { param($s, $e) Write-Host "  $($e.Message)" -ForegroundColor DarkGray })

try {
    $conn.Open()
    Write-Host "Terhubung ke [$Server].[$Database]. Menjalankan migrasi..." -ForegroundColor Cyan
} catch {
    Write-Error "Gagal terhubung: $($_.Exception.Message)"; exit 1
}

$i = 0; $err = 0
foreach ($b in $batches) {
    if ($b.Trim().Length -eq 0) { continue }
    $i++
    $cmd = $conn.CreateCommand(); $cmd.CommandText = $b; $cmd.CommandTimeout = 180
    try {
        $cmd.ExecuteNonQuery() | Out-Null
    } catch {
        $err++
        Write-Host "ERROR pada batch #${i}: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Migrasi DIHENTIKAN. Tidak ada tabel yang di-drop (skrip non-destruktif)." -ForegroundColor Yellow
        $conn.Close(); exit 1
    }
}
$conn.Close()
Write-Host "SELESAI. $i batch dijalankan, $err error." -ForegroundColor Green
Write-Host "Muat ulang aplikasi produksi (halaman Cuti dll)." -ForegroundColor Green

#requires -Version 5.1
<#
.SYNOPSIS
  Dry-run-first static deployment for the Fatortak landing page.

.DESCRIPTION
  Reads InterServer FTPS credentials from a file outside the repository
  (default: %USERPROFILE%\.config\fatortak\plesk.env), backs up the current
  remote landing files, uploads the static site, and verifies the public page.

  The default mode is a dry run. Pass -Live to upload.

.EXAMPLE
  .\deploy-static.ps1
  .\deploy-static.ps1 -Live
  .\deploy-static.ps1 -Live -ConfigPath "C:\Users\me\.config\fatortak\plesk.env"
#>
[CmdletBinding()]
param(
  [string]$ConfigPath = (Join-Path $HOME ".config\fatortak\plesk.env"),
  [string]$Source = "",
  [string]$PublicUrl = "https://fatortak.rabbeh.com/",
  [switch]$Live,
  [switch]$NoSsl,
  [switch]$Insecure
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Source)) {
  $Source = Join-Path $PSScriptRoot "..\landing"
}
$Source = (Resolve-Path $Source).Path

function Read-EnvFile {
  param([string]$Path)
  if (-not (Test-Path $Path)) {
    throw "Config file not found: $Path. Copy plesk.env.example to plesk.env and fill it in."
  }
  $values = @{}
  foreach ($line in Get-Content $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
    $index = $trimmed.IndexOf("=")
    if ($index -lt 1) { continue }
    $key = $trimmed.Substring(0, $index).Trim()
    $value = $trimmed.Substring($index + 1).Trim()
    $values[$key] = $value
  }
  return $values
}

function Join-RemotePath {
  param([string]$Root, [string]$Relative)
  $root = if ([string]::IsNullOrWhiteSpace($Root)) { "/" } else { $Root.Trim() }
  if (-not $root.StartsWith("/")) { $root = "/" + $root }
  if (-not $root.EndsWith("/")) { $root += "/" }
  $relative = $Relative.TrimStart("/")
  return ($root + $relative).Replace("//", "/")
}

function New-FtpRequest {
  param(
    [string]$HostName,
    [int]$Port,
    [string]$Path,
    [string]$Method,
    [System.Net.NetworkCredential]$Credential,
    [bool]$UseSsl
  )
  $uri = "ftp://${HostName}:${Port}$Path"
  $request = [System.Net.FtpWebRequest]::Create($uri)
  $request.Method = $Method
  $request.Credentials = $Credential
  $request.UseBinary = $true
  $request.UsePassive = $true
  $request.KeepAlive = $false
  $request.EnableSsl = $UseSsl
  $request.Timeout = 45000
  $request.ReadWriteTimeout = 45000
  return $request
}

function Ensure-RemoteDirectory {
  param(
    [string]$HostName,
    [int]$Port,
    [string]$Path,
    [System.Net.NetworkCredential]$Credential,
    [bool]$UseSsl
  )
  try {
    $request = New-FtpRequest -HostName $HostName -Port $Port -Path $Path -Method ([System.Net.WebRequestMethods+Ftp]::MakeDirectory) -Credential $Credential -UseSsl $UseSsl
    $response = $request.GetResponse()
    $response.Close()
    Write-Host "  created $Path"
  } catch [System.Net.WebException] {
    $response = $_.Exception.Response
    if ($response -and [int]$response.StatusCode -eq 550) {
      return
    }
    throw
  }
}

function Backup-RemoteFile {
  param(
    [string]$HostName,
    [int]$Port,
    [string]$RemotePath,
    [string]$LocalPath,
    [System.Net.NetworkCredential]$Credential,
    [bool]$UseSsl
  )
  try {
    $request = New-FtpRequest -HostName $HostName -Port $Port -Path $RemotePath -Method ([System.Net.WebRequestMethods+Ftp]::DownloadFile) -Credential $Credential -UseSsl $UseSsl
    $response = $request.GetResponse()
    $stream = $response.GetResponseStream()
    $file = [System.IO.File]::Create($LocalPath)
    $stream.CopyTo($file)
    $file.Close()
    $stream.Close()
    $response.Close()
    Write-Host "  backed up $RemotePath -> $LocalPath"
  } catch [System.Net.WebException] {
    $response = $_.Exception.Response
    if ($response -and [int]$response.StatusCode -eq 550) {
      Write-Host "  no remote file to back up: $RemotePath"
      return
    }
    throw
  }
}

function Upload-File {
  param(
    [string]$HostName,
    [int]$Port,
    [string]$RemotePath,
    [string]$LocalPath,
    [System.Net.NetworkCredential]$Credential,
    [bool]$UseSsl
  )
  $request = New-FtpRequest -HostName $HostName -Port $Port -Path $RemotePath -Method ([System.Net.WebRequestMethods+Ftp]::UploadFile) -Credential $Credential -UseSsl $UseSsl
  $request.ContentLength = (Get-Item $LocalPath).Length
  $stream = $request.GetRequestStream()
  $file = [System.IO.File]::OpenRead($LocalPath)
  $file.CopyTo($stream)
  $file.Close()
  $stream.Close()
  $response = $request.GetResponse()
  $response.Close()
}

# Files that make up the public page. The screenshots list intentionally
# excludes dashboard-ar.png and the legacy logo-mark assets.
$rootFiles = @(
  "index.html",
  "styles.css",
  "app.js",
  "site.webmanifest",
  "robots.txt",
  "sitemap.xml",
  "privacy.html",
  "demo.mp4",
  "demo-poster.jpg"
)
$assetFiles = @(
  "assets/favicon.png",
  "assets/fatortak-logo-white.png",
  "assets/fatortak-logo.png",
  "assets/og.png"
)
$screenshotFiles = @(
  "assets/screenshots/dashboard.png",
  "assets/screenshots/ai-chat.png",
  "assets/screenshots/ai-chat-chart.png",
  "assets/screenshots/ai-chat-receivables.png",
  "assets/screenshots/ocr-invoice.png",
  "assets/screenshots/sell-invoices.png",
  "assets/screenshots/clients.png",
  "assets/screenshots/projects.png",
  "assets/screenshots/project-profitability.png",
  "assets/screenshots/income-statement.png"
)
$relativeFiles = @($rootFiles + $assetFiles + $screenshotFiles)

Write-Host "Fatortak landing deployment" -ForegroundColor Cyan
Write-Host "Source: $Source"
Write-Host "Mode:   $(if ($Live) { 'LIVE' } else { 'DRY RUN (pass -Live to upload)' })"

$missing = @()
$totalBytes = 0
$fileList = @()
foreach ($relative in $relativeFiles) {
  $local = Join-Path $Source $relative
  if (-not (Test-Path $local)) {
    $missing += $relative
    continue
  }
  $size = (Get-Item $local).Length
  $totalBytes += $size
  $fileList += [pscustomobject]@{ Relative = $relative; Local = $local; Size = $size }
}

if ($missing.Count -gt 0) {
  throw "Missing files: $($missing -join ', ')"
}

Write-Host ("Files:  {0} ({1:N2} MB)" -f $fileList.Count, ($totalBytes / 1MB))

$config = Read-EnvFile -Path $ConfigPath
$ftpHost = $config["FTP_HOST"]
$ftpPort = if ($config["FTP_PORT"]) { [int]$config["FTP_PORT"] } else { 21 }
$ftpUser = $config["FTP_USER"]
$ftpPass = $config["FTP_PASSWORD"]
$ftpTarget = if ($config["FTP_TARGET"]) { $config["FTP_TARGET"] } else { "/" }
$useSsl = -not $NoSsl

foreach ($key in @("FTP_HOST", "FTP_USER", "FTP_PASSWORD")) {
  if ([string]::IsNullOrWhiteSpace($config[$key])) {
    throw "Missing $key in $ConfigPath"
  }
}

if (-not $Live) {
  Write-Host ""
  Write-Host "Remote target: ftp://${ftpHost}:${ftpPort}$ftpTarget" -ForegroundColor Yellow
  Write-Host "Planned uploads:" -ForegroundColor Yellow
  $fileList | ForEach-Object {
    Write-Host ("  {0,-52} {1,10:N0} bytes" -f $_.Relative, $_.Size)
  }
  Write-Host ""
  Write-Host "Dry run complete. No remote changes were made." -ForegroundColor Green
  return
}

if ($ftpHost -match "fatortak\.net$") {
  throw "Refusing to deploy to fatortak.net: it currently does not resolve. Use fatortak.rabbeh.com."
}

$credential = New-Object System.Net.NetworkCredential($ftpUser, $ftpPass)
if ($Insecure) {
  Write-Warning "TLS certificate validation is disabled for this deployment (self-signed Plesk certificate)."
  [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
}
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $HOME ".config\fatortak\backups\$stamp"
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null

Write-Host ""
Write-Host "Testing FTPS connection..." -ForegroundColor Cyan
try {
  $request = New-FtpRequest -HostName $ftpHost -Port $ftpPort -Path (Join-RemotePath $ftpTarget "") -Method ([System.Net.WebRequestMethods+Ftp]::ListDirectory) -Credential $credential -UseSsl $useSsl
  $response = $request.GetResponse()
  $response.Close()
  Write-Host "  connection OK" -ForegroundColor Green
} catch {
  throw "FTPS connection failed: $($_.Exception.Message)"
}

Write-Host "Backing up current root files to $backupRoot" -ForegroundColor Cyan
$backupRootLocal = Join-Path $backupRoot ""
Backup-RemoteFile -HostName $ftpHost -Port $ftpPort -RemotePath (Join-RemotePath $ftpTarget "index.html") -LocalPath (Join-Path $backupRootLocal "index.html") -Credential $credential -UseSsl $useSsl
Backup-RemoteFile -HostName $ftpHost -Port $ftpPort -RemotePath (Join-RemotePath $ftpTarget "web.config") -LocalPath (Join-Path $backupRootLocal "web.config") -Credential $credential -UseSsl $useSsl

Write-Host "Ensuring remote directories..." -ForegroundColor Cyan
Ensure-RemoteDirectory -HostName $ftpHost -Port $ftpPort -Path (Join-RemotePath $ftpTarget "assets") -Credential $credential -UseSsl $useSsl
Ensure-RemoteDirectory -HostName $ftpHost -Port $ftpPort -Path (Join-RemotePath $ftpTarget "assets/screenshots") -Credential $credential -UseSsl $useSsl

Write-Host "Uploading..." -ForegroundColor Cyan
foreach ($item in $fileList) {
  $remote = Join-RemotePath $ftpTarget $item.Relative
  Upload-File -HostName $ftpHost -Port $ftpPort -RemotePath $remote -LocalPath $item.Local -Credential $credential -UseSsl $useSsl
  Write-Host ("  uploaded {0}" -f $item.Relative) -ForegroundColor Green
}

Write-Host ""
Write-Host "Verifying public page..." -ForegroundColor Cyan
try {
  $response = Invoke-WebRequest -Uri $PublicUrl -UseBasicParsing -TimeoutSec 30
  if ($response.Content -match "Fatortak" -and $response.Content -match "styles.css") {
    Write-Host "  public page OK: $PublicUrl" -ForegroundColor Green
  } else {
    Write-Warning "  page responded, but the expected Fatortak markup was not found."
  }
} catch {
  Write-Warning "  verification failed: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "Deployment complete. Backup: $backupRoot" -ForegroundColor Green

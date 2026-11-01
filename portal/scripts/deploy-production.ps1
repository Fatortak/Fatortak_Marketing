param(
  [string]$BuildDir = "",
  [switch]$SkipProvision,
  [switch]$ForceData,
  [switch]$ForceEnv,
  [switch]$Restart
)

$ErrorActionPreference = "Stop"
$portalRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $BuildDir) { $BuildDir = Join-Path $portalRoot "deploy\build" }
$BuildDir = [System.IO.Path]::GetFullPath($BuildDir)
if (-not (Test-Path $BuildDir)) { throw "Build directory not found: $BuildDir. Run build-production.ps1 first." }

$credFile = Join-Path $env:USERPROFILE ".config\fatortak\portal-production.txt"
$pleskEnv = Join-Path $env:USERPROFILE ".config\fatortak\plesk.env"
if (-not (Test-Path $credFile)) { throw "Missing $credFile" }
if (-not (Test-Path $pleskEnv)) { throw "Missing $pleskEnv" }

$cfg = @{}
Get-Content $pleskEnv | ForEach-Object { if ($_ -match '^([A-Z0-9_]+)=(.*)$') { $cfg[$matches[1]] = $matches[2] } }
$ftpHost = $cfg['FTP_HOST']; $ftpPort = $cfg['FTP_PORT']; $ftpUser = $cfg['FTP_USER']; $ftpPass = $cfg['FTP_PASSWORD']
if (-not $ftpHost -or -not $ftpUser -or -not $ftpPass) { throw "FTP credentials incomplete in $pleskEnv" }

$creds = @{}
Get-Content $credFile | ForEach-Object { if ($_ -match '^([A-Z0-9_]+)=(.*)$') { $creds[$matches[1]] = $matches[2] } }
$password = $creds['PASSWORD']
$provisionFile = $creds['PROVISION_FILE']
$provisionKey = $creds['PROVISION_KEY']
if (-not $password) { throw "No portal password in $credFile" }

[System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
$cred = New-Object System.Net.NetworkCredential($ftpUser, $ftpPass)
$baseUrl = "ftp://${ftpHost}:${ftpPort}"

function New-FtpRequest([string]$path, [string]$method) {
  $r = [System.Net.FtpWebRequest]::Create("$baseUrl$path")
  $r.Method = $method
  $r.Credentials = $cred
  $r.UseBinary = $true
  $r.UsePassive = $true
  $r.KeepAlive = $false
  $r.EnableSsl = $true
  $r.Timeout = 60000
  return $r
}

function Ensure-FtpDir([string]$path) {
  $parts = $path.Trim('/').Split('/') | Where-Object { $_ }
  $current = ""
  foreach ($part in $parts) {
    $current += "/$part"
    try {
      $r = New-FtpRequest $current ([System.Net.WebRequestMethods+Ftp]::MakeDirectory)
      $r.GetResponse().Close()
    } catch { }
  }
}

function Upload-FtpFile([string]$local, [string]$remote) {
  $remoteDir = ($remote -replace '/[^/]+$', '')
  if ($remoteDir -and $remoteDir -ne $remote) { Ensure-FtpDir $remoteDir }
  $r = New-FtpRequest $remote ([System.Net.WebRequestMethods+Ftp]::UploadFile)
  $file = Get-Item $local
  $r.ContentLength = $file.Length
  $stream = $r.GetRequestStream()
  $fs = [System.IO.File]::OpenRead($file.FullName)
  try { $fs.CopyTo($stream) } finally { $fs.Close(); $stream.Close() }
  $r.GetResponse().Close()
  Write-Output "uploaded $remote"
}

function Remove-FtpFile([string]$remote) {
  try {
    $r = New-FtpRequest $remote ([System.Net.WebRequestMethods+Ftp]::DeleteFile)
    $r.GetResponse().Close()
    Write-Output "deleted $remote"
  } catch { Write-Output "delete skipped $remote" }
}

function Remote-Exists([string]$remote) {
  try {
    $r = New-FtpRequest $remote ([System.Net.WebRequestMethods+Ftp]::GetFileSize)
    $size = $r.GetResponse().ContentLength
    return $size -ge 0
  } catch { return $false }
}

Write-Output "=== static front controller ==="
Get-ChildItem (Join-Path $BuildDir "web") -Recurse -File | ForEach-Object {
  $relative = $_.FullName.Substring((Join-Path $BuildDir "web").Length).Replace('\', '/')
  Upload-FtpFile $_.FullName $relative
}

Write-Output "=== node app ==="
$appLocal = Join-Path $BuildDir "app"
Get-ChildItem $appLocal -Recurse -File | ForEach-Object {
  $relative = $_.FullName.Substring($appLocal.Length).Replace('\', '/')
  $remote = "/App_Data/portal-app$relative"
  if ($relative -like "/data/*" -and -not $ForceData) {
    if (Remote-Exists $remote) { Write-Output "keep data $remote"; return }
  }
  if ($relative -eq "/marketing/portal/.env" -and -not $ForceEnv) {
    if (Remote-Exists $remote) { Write-Output "keep env $remote"; return }
  }
  Upload-FtpFile $_.FullName $remote
}

if (-not $SkipProvision) {
  if (-not $provisionFile -or -not $provisionKey) { throw "No provision file/key in $credFile" }
  $url = "https://fatortak.rabbeh.com/portal/$provisionFile`?key=$provisionKey"
  Write-Output "=== provisioning login ==="
  $provisionResult = & curl.exe -sS -m 60 -X POST --data-urlencode "password=$password" $url
  Write-Output $provisionResult
  if (($provisionResult -join "") -notmatch '"ok":true') { throw "Provisioning failed: $provisionResult" }
}
Remove-FtpFile "/portal/$provisionFile"

Write-Output "=== start node ==="
& curl.exe -sS -m 60 "https://fatortak.rabbeh.com/portal/?ping=1"
Write-Output ""

Write-Output "=== login test ==="
$cookie = Join-Path $BuildDir "cookies.txt"
if (Test-Path $cookie) { Remove-Item $cookie -Force -ErrorAction SilentlyContinue }
$loginHtml = & curl.exe -sS -m 30 -c $cookie "https://fatortak.rabbeh.com/portal/"
$csrf = [regex]::Match(($loginHtml -join "`n"), 'name="csrf" value="([^"]+)"').Groups[1].Value
if (-not $csrf) { throw "Could not read CSRF token from login page" }
$status = & curl.exe -sS -m 30 -o NUL -w "%{http_code}" -b $cookie -c $cookie -X POST `
  --data-urlencode "user=fatortak" --data-urlencode "pass=$password" --data-urlencode "csrf=$csrf" `
  "https://fatortak.rabbeh.com/portal/"
Write-Output "login status: $status"
$overview = & curl.exe -sS -m 30 -b $cookie "https://fatortak.rabbeh.com/portal/index.php/api/overview"
$overviewText = $overview -join "`n"
Write-Output "overview: $($overviewText.Substring(0, [Math]::Min(300, $overviewText.Length)))"
Write-Output ""
$health = & curl.exe -sS -m 30 -b $cookie "https://fatortak.rabbeh.com/portal/index.php/api/health"
Write-Output "health: $health"

if ($Restart) {
  Write-Output "=== restart node ==="
  $restart = & curl.exe -sS -m 60 -b $cookie "https://fatortak.rabbeh.com/portal/?restart=1"
  Write-Output "restart: $restart"
  Start-Sleep -Seconds 2
  $health2 = & curl.exe -sS -m 30 -b $cookie "https://fatortak.rabbeh.com/portal/index.php/api/health"
  Write-Output "health after restart: $health2"
}

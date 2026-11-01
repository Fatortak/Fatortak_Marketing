param(
  [string]$OutDir = "",
  [string]$PortalPassword = "",
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$portalRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$marketingRoot = (Resolve-Path (Join-Path $portalRoot "..")).Path
if (-not $OutDir) { $OutDir = Join-Path $portalRoot "deploy\build" }
$OutDir = [System.IO.Path]::GetFullPath($OutDir)

$secretsDir = Join-Path $env:USERPROFILE ".config\fatortak"
$credFile = Join-Path $secretsDir "portal-production.txt"
New-Item -ItemType Directory -Force -Path $secretsDir | Out-Null

function New-RandomPassword {
  $chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
  $bytes = New-Object byte[] 24
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $body = -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
  return "$body!7"
}

function New-RandomHex([int]$Bytes) {
  $buffer = New-Object byte[] $Bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
  return (-join ($buffer | ForEach-Object { $_.ToString("x2") }))
}

if (-not $PortalPassword) {
  if ((Test-Path $credFile) -and -not $Force) {
    $existing = Get-Content $credFile | Where-Object { $_ -match "^PASSWORD=" } | Select-Object -First 1
    if ($existing) { $PortalPassword = $existing.Substring(9) }
  }
  if (-not $PortalPassword) { $PortalPassword = New-RandomPassword }
}

if (Test-Path $OutDir) { Remove-Item -Recurse -Force $OutDir }
$webDir = Join-Path $OutDir "web\portal"
$appDir = Join-Path $OutDir "app"
$portalApp = Join-Path $appDir "marketing\portal"
$automationDir = Join-Path $appDir "marketing\automation\src"
$publicDir = Join-Path $portalApp "public"
$dataDir = Join-Path $appDir "data"
foreach ($dir in @($webDir, $portalApp, $automationDir, $publicDir, $dataDir)) {
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
}

Copy-Item (Join-Path $portalRoot "deploy\index.php") (Join-Path $webDir "index.php")
Copy-Item (Join-Path $portalRoot "public\app.js") (Join-Path $webDir "app.js")
Copy-Item (Join-Path $portalRoot "public\styles.css") (Join-Path $webDir "styles.css")
Copy-Item (Join-Path $portalRoot "public\favicon.png") (Join-Path $webDir "favicon.png")
$webIcons = Join-Path $webDir "icons"
New-Item -ItemType Directory -Force -Path $webIcons | Out-Null
Copy-Item (Join-Path $portalRoot "public\icons\*") $webIcons
Copy-Item (Join-Path $portalRoot "server.mjs") $portalApp
Copy-Item (Join-Path $portalRoot "adapters.mjs") $portalApp
Copy-Item (Join-Path $portalRoot "public\*") $publicDir -Recurse
Copy-Item (Join-Path $portalRoot ".env") (Join-Path $portalApp ".env")
Copy-Item (Join-Path $portalRoot "data\portal.json") (Join-Path $dataDir "portal.json")
Copy-Item (Join-Path $marketingRoot "config.example.json") (Join-Path $appDir "marketing\config.example.json")
Copy-Item (Join-Path $marketingRoot "automation\src\*.mjs") $automationDir

$nodeToken = New-RandomHex 32
Set-Content -Path (Join-Path $appDir "node.token") -Value $nodeToken -NoNewline -Encoding ascii

$provisionKey = New-RandomHex 16
$provision = @"
<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
`$key = '$provisionKey';
if (!hash_equals(`$key, (string)(`$_GET['key'] ?? ''))) { http_response_code(403); echo '{"ok":false}'; exit; }
`$password = (string)(`$_POST['password'] ?? '');
if (strlen(`$password) < 16) { http_response_code(400); echo '{"ok":false,"error":"password too short"}'; exit; }
`$app = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'App_Data' . DIRECTORY_SEPARATOR . 'portal-app';
`$dir = dirname(`$app);
if (!is_dir(`$app)) { http_response_code(500); echo '{"ok":false,"error":"app dir missing"}'; exit; }
`$authFile = `$app . DIRECTORY_SEPARATOR . 'auth.json';
if (is_file(`$authFile) && !isset(`$_GET['force'])) { http_response_code(409); echo '{"ok":false,"error":"already provisioned"}'; exit; }
`$secret = bin2hex(random_bytes(32));
`$auth = ['user' => 'fatortak', 'hash' => password_hash(`$password, PASSWORD_DEFAULT), 'secret' => `$secret, 'createdAt' => gmdate('c')];
`$tmp = `$authFile . '.tmp';
file_put_contents(`$tmp, json_encode(`$auth, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
rename(`$tmp, `$authFile);
@unlink(__FILE__);
echo json_encode(['ok' => true, 'user' => 'fatortak'], JSON_UNESCAPED_SLASHES);
"@
$provisionName = "_provision_$provisionKey.php"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $webDir $provisionName), $provision, $utf8NoBom)

$credText = @"
# Fatortak production portal credentials
# Keep this file private. It is outside the repository.
URL=https://fatortak.rabbeh.com/portal/
USER=fatortak
PASSWORD=$PortalPassword
PROVISION_FILE=$provisionName
PROVISION_KEY=$provisionKey
BUILD=$OutDir
CREATED=$(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
"@
Set-Content -Path $credFile -Value $credText -Encoding utf8
Set-Content -Path (Join-Path $OutDir "PROVISION.txt") -Value "file=$provisionName`nkey=$provisionKey" -Encoding utf8

Write-Output "Built: $OutDir"
Write-Output "Portal URL: https://fatortak.rabbeh.com/portal/"
Write-Output "Username: fatortak"
Write-Output "Password: $PortalPassword"
Write-Output "Provision file: $provisionName"
Write-Output "Credentials saved to: $credFile"

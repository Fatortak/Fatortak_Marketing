param(
  [string]$Dir = (Join-Path $PSScriptRoot "..\assets\screenshots"),
  [int]$Quality = 92
)

# Instagram's Content Publishing API accepts JPEG images, not PNG.
# Keep the PNGs for the portal preview and generate JPEG publish variants.
Add-Type -AssemblyName System.Drawing
$Dir = [System.IO.Path]::GetFullPath($Dir)
if (-not (Test-Path $Dir)) { throw "Screenshot directory not found: $Dir" }
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
if (-not $codec) { throw "No JPEG encoder available" }

$count = 0
$skipped = 0
foreach ($png in Get-ChildItem $Dir -Filter *.png) {
  $jpg = Join-Path $Dir ($png.BaseName + ".jpg")
  if ((Test-Path $jpg) -and ((Get-Item $jpg).LastWriteTime -ge $png.LastWriteTime)) {
    $skipped += 1
    continue
  }
  $image = [System.Drawing.Image]::FromFile($png.FullName)
  $bitmap = New-Object System.Drawing.Bitmap($image.Width, $image.Height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear([System.Drawing.Color]::FromArgb(6, 8, 22))
  $graphics.DrawImage($image, 0, 0, $image.Width, $image.Height)
  $params = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, $Quality)
  $bitmap.Save($jpg, $codec, $params)
  $graphics.Dispose()
  $bitmap.Dispose()
  $image.Dispose()
  $count += 1
}
Write-Output "Converted $count PNG file(s) to JPEG; skipped $skipped existing file(s)."

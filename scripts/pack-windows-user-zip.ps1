# Assemble the Windows end-user ZIP from build outputs.
# Run on Windows after:
#   1) PyInstaller → apps/api/dist/sc-roi-api.exe
#      copy to apps/desktop/src-tauri/binaries/sc-roi-api-x86_64-pc-windows-msvc.exe
#   2) cd apps/desktop; npm run build
#
# Usage (from repo root):
#   .\scripts\pack-windows-user-zip.ps1

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$OutDir = Join-Path $Root "dist\windows-user-pack"
$Stage = Join-Path $OutDir "SC-ROI-Forge"

Write-Host "Staging user pack → $Stage"
if (Test-Path $OutDir) { Remove-Item -Recurse -Force $OutDir }
New-Item -ItemType Directory -Path $Stage | Out-Null

Copy-Item (Join-Path $Root "deploy\windows\安装并启动.bat") $Stage
Copy-Item (Join-Path $Root "deploy\windows\启动.bat") $Stage
Copy-Item (Join-Path $Root "deploy\windows\README-用户.txt") $Stage

# Prefer NSIS/MSI-adjacent loose EXE; fall back to release binary name
$candidates = @(
  (Join-Path $Root "apps\desktop\src-tauri\target\release\sc-roi-forge-desktop.exe"),
  (Join-Path $Root "apps\desktop\src-tauri\target\release\SC-ROI-Forge.exe"),
  (Join-Path $Root "apps\desktop\src-tauri\target\release\bundle\nsis\*\*.exe")
)

$ui = $null
foreach ($c in $candidates) {
  $hit = Get-Item $c -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($hit -and $hit.Name -notmatch "setup") {
    $ui = $hit.FullName
    break
  }
}
if (-not $ui) {
  Write-Error "UI EXE not found. Build desktop first: cd apps/desktop; npm run build"
}

Copy-Item $ui (Join-Path $Stage "SC-ROI-Forge.exe")

$sidecarSrc = Join-Path $Root "apps\desktop\src-tauri\binaries\sc-roi-api-x86_64-pc-windows-msvc.exe"
$sidecarAlt = Join-Path $Root "apps\api\dist\sc-roi-api.exe"
if (Test-Path $sidecarSrc) {
  Copy-Item $sidecarSrc (Join-Path $Stage "sc-roi-api.exe")
} elseif (Test-Path $sidecarAlt) {
  Copy-Item $sidecarAlt (Join-Path $Stage "sc-roi-api.exe")
} else {
  Write-Warning "sc-roi-api.exe not found — pack UI only. Sidecar must sit next to EXE for Tauri externalBin."
}

# Also copy sidecar next to EXE under Tauri's expected sidecar name if present in release dir
$releaseSidecar = Get-ChildItem (Join-Path $Root "apps\desktop\src-tauri\target\release") -Filter "sc-roi-api*.exe" -ErrorAction SilentlyContinue
foreach ($s in $releaseSidecar) {
  Copy-Item $s.FullName (Join-Path $Stage $s.Name) -Force
}

$zip = Join-Path $OutDir "SC-ROI-Forge-windows.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path $Stage -DestinationPath $zip
Write-Host "OK: $zip"
Write-Host "Give users the ZIP. They unzip and double-click 安装并启动.bat"

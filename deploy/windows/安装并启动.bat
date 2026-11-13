@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

set "APP_EXE=SC-ROI-Forge.exe"
set "MARKER=.installed"
set "WV2_URL=https://go.microsoft.com/fwlink/p/?LinkId=2124703"

echo.
echo  === SC-ROI Forge 首次安装 / 启动 ===
echo.

if not exist "%APP_EXE%" (
  echo [错误] 找不到 %APP_EXE%。
  echo 请确认你解压了完整用户包，并且本脚本与 EXE 在同一文件夹。
  echo.
  pause
  exit /b 1
)

call :check_webview2
if errorlevel 1 (
  echo.
  echo [需要安装] 本机似乎没有 Microsoft Edge WebView2。
  echo 即将打开官方安装页。装好后请再双击本脚本一次。
  echo.
  start "" "%WV2_URL%"
  pause
  exit /b 1
)

if not exist "%MARKER%" (
  echo 正在创建桌面快捷方式…
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$desk=[Environment]::GetFolderPath('Desktop'); $p=Join-Path $desk 'SC-ROI Forge.lnk'; $s=(New-Object -ComObject WScript.Shell).CreateShortcut($p); $s.TargetPath='%~dp0%APP_EXE%'; $s.WorkingDirectory='%~dp0'; $s.Description='SC-ROI Forge'; $s.Save()" 2>nul
  if errorlevel 1 (
    echo [提示] 桌面快捷方式创建失败，可稍后手动把 EXE 拖到桌面。
  ) else (
    echo 已在桌面创建「SC-ROI Forge」快捷方式。
  )
  type nul > "%MARKER%"
  echo.
)

echo 正在启动…
start "" "%APP_EXE%"
exit /b 0

:check_webview2
reg query "HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" /v pv >nul 2>&1 && exit /b 0
reg query "HKLM\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" /v pv >nul 2>&1 && exit /b 0
reg query "HKCU\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" /v pv >nul 2>&1 && exit /b 0
if exist "%ProgramFiles(x86)%\Microsoft\EdgeWebView\Application\msedgewebview2.exe" exit /b 0
if exist "%ProgramFiles%\Microsoft\EdgeWebView\Application\msedgewebview2.exe" exit /b 0
exit /b 1

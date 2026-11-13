@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist "SC-ROI-Forge.exe" (
  echo [错误] 找不到 SC-ROI-Forge.exe，请把本脚本与 EXE 放在同一文件夹。
  pause
  exit /b 1
)

start "" "SC-ROI-Forge.exe"
exit /b 0

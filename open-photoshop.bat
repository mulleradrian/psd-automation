@echo off
setlocal
cd /d "%~dp0"
set "REPO=%~dp0"
if "%REPO:~-1%"=="\" set "REPO=%REPO:~0,-1%"

echo.
echo  ========================================
echo   Opening Photoshop + UXP Developer Tools
echo  ========================================
echo.

set "UXP="
if exist "%ProgramFiles%\Adobe\Adobe UXP Developer Tools\Adobe UXP Developer Tools.exe" (
  set "UXP=%ProgramFiles%\Adobe\Adobe UXP Developer Tools\Adobe UXP Developer Tools.exe"
)
if exist "%ProgramFiles(x86)%\Adobe\Adobe UXP Developer Tools\Adobe UXP Developer Tools.exe" (
  set "UXP=%ProgramFiles(x86)%\Adobe\Adobe UXP Developer Tools\Adobe UXP Developer Tools.exe"
)

set "PS="
for %%V in (2026 2025 2024 2023) do (
  if not defined PS if exist "%ProgramFiles%\Adobe\Adobe Photoshop %%V\Photoshop.exe" (
    set "PS=%ProgramFiles%\Adobe\Adobe Photoshop %%V\Photoshop.exe"
  )
)

if defined UXP (
  echo  Starting UXP Developer Tools...
  start "" "%UXP%"
) else (
  echo  Could not find Adobe UXP Developer Tools.
  echo  Install it from Creative Cloud, then run this again.
  echo.
)

if defined PS (
  echo  Starting Photoshop...
  start "" "%PS%"
) else (
  echo  Could not find Photoshop 2023–2026.
  echo  Install Photoshop, then run this again.
  echo.
)

echo.
echo  -----------------------------------------
echo   Load the panel ^(one-time^)
echo  -----------------------------------------
echo.
echo  1. In UXP Developer Tools: enable Developer Mode ^(gear icon^)
echo  2. Click Add Plugin
echo  3. Select this folder:
echo.
echo     %REPO%\packages\uxp-plugin
echo.
echo  4. Click Load / Watch ^(target Photoshop^)
echo  5. In Photoshop: Plugins → P10 Templater
echo  6. In the panel: click "Repo folder…" and choose:
echo.
echo     %REPO%
echo.
echo  7. Click Pull Content_DB, then Apply this row
echo.
echo  Tip: copy the plugin path above, then paste into Add Plugin.
echo.
powershell -NoProfile -Command "Set-Clipboard -Value '%REPO%\packages\uxp-plugin'"
echo  Plugin path copied to clipboard.
echo.
pause

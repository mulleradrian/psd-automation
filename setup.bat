@echo off
setlocal
cd /d "%~dp0"

echo.
echo  ========================================
echo   PSD Automation — one-click setup
echo  ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo  Node.js is not installed.
  echo  Opening the installer page...
  start "" "https://nodejs.org/en/download"
  echo.
  echo  1. Download the Windows LTS installer
  echo  2. Run it ^(defaults are fine^)
  echo  3. Close this window and double-click setup.bat again
  echo.
  pause
  exit /b 1
)

echo  [1/4] Installing dependencies...
call npm install
if errorlevel 1 (
  echo.
  echo  npm install failed. See messages above.
  pause
  exit /b 1
)

echo.
echo  [2/4] Building packages...
call npm run build
if errorlevel 1 (
  echo.
  echo  Build failed. See messages above.
  pause
  exit /b 1
)

echo.
echo  [3/4] Creating local env file...
if not exist ".env.local" (
  copy /Y ".env.example" ".env.local" >nul
  echo  Created .env.local from .env.example
) else (
  echo  .env.local already exists — left unchanged
)

echo.
echo  [4/4] Generating templater test dataset...
node scripts\generate-templater-dataset.mjs
if errorlevel 1 (
  echo  Dataset step skipped or failed ^(you can re-run setup later^).
)

echo.
echo  ========================================
echo   Setup complete
echo  ========================================
echo.
echo  Next: double-click  open-photoshop.bat
echo  Then follow the on-screen panel steps.
echo.
echo  Full guide: README.md
echo.
pause

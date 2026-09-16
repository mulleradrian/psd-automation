# PSD Automation — one-click setup (PowerShell)
# Prefer double-clicking setup.bat instead of running this manually.

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host ""
Write-Host " ========================================"
Write-Host "  PSD Automation — one-click setup"
Write-Host " ========================================"
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host " Node.js is not installed. Opening download page..."
  Start-Process "https://nodejs.org/en/download"
  Write-Host " Install the Windows LTS build, then re-run setup.bat"
  exit 1
}

Write-Host " [1/4] Installing dependencies..."
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

Write-Host ""
Write-Host " [2/4] Building packages..."
npm run build
if ($LASTEXITCODE -ne 0) { throw "build failed" }

Write-Host ""
Write-Host " [3/4] Creating local env file..."
if (-not (Test-Path ".env.local")) {
  Copy-Item ".env.example" ".env.local"
  Write-Host " Created .env.local from .env.example"
} else {
  Write-Host " .env.local already exists — left unchanged"
}

Write-Host ""
Write-Host " [4/4] Generating templater test dataset..."
try {
  node "scripts\generate-templater-dataset.mjs"
} catch {
  Write-Host " Dataset step skipped or failed (you can re-run setup later)."
}

Write-Host ""
Write-Host " Setup complete. Next: double-click open-photoshop.bat"
Write-Host ""

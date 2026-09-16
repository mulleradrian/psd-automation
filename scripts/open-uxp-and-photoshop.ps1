# Prefer double-clicking open-photoshop.bat at the repo root.
# This script keeps the same flow with paths relative to the repo.

$repoRoot = Split-Path -Parent $PSScriptRoot
$pluginPath = Join-Path $repoRoot "packages\uxp-plugin"

$uxpCandidates = @(
  "${env:ProgramFiles}\Adobe\Adobe UXP Developer Tools\Adobe UXP Developer Tools.exe",
  "${env:ProgramFiles(x86)}\Adobe\Adobe UXP Developer Tools\Adobe UXP Developer Tools.exe"
)
$uxp = $uxpCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

$ps = $null
foreach ($year in 2026, 2025, 2024, 2023) {
  $candidate = "${env:ProgramFiles}\Adobe\Adobe Photoshop $year\Photoshop.exe"
  if (Test-Path $candidate) { $ps = $candidate; break }
}

if ($uxp) {
  Write-Host "Opening Adobe UXP Developer Tools..."
  Start-Process $uxp
  Start-Sleep -Seconds 2
} else {
  Write-Host "Adobe UXP Developer Tools not found under Program Files."
}

if ($ps) {
  Write-Host "Opening Photoshop..."
  Start-Process $ps
} else {
  Write-Host "Photoshop 2023–2026 not found under Program Files."
}

Write-Host ""
Write-Host "In UXP Developer Tools:"
Write-Host "  1. Enable Developer Mode (gear)"
Write-Host "  2. Add Plugin -> select:"
Write-Host "     $pluginPath"
Write-Host "  3. Load / Watch the plugin against Photoshop"
Write-Host "  4. In the panel, Repo folder… -> select:"
Write-Host "     $repoRoot"
Set-Clipboard -Value $pluginPath
Write-Host ""
Write-Host "Plugin path copied to clipboard."

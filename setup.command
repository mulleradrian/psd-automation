#!/bin/bash
# Double-click this file in Finder (setup.command) to install.
# If macOS says it can't be opened: right-click → Open → Open.

set -e
cd "$(dirname "$0")"
REPO="$(pwd)"

echo ""
echo " ========================================"
echo "  PSD Automation — one-click setup (Mac)"
echo " ========================================"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo " Node.js is not installed."
  echo " Opening the download page..."
  open "https://nodejs.org/en/download"
  echo ""
  echo " 1. Download the macOS LTS installer (.pkg)"
  echo " 2. Run it (defaults are fine)"
  echo " 3. Close this window and double-click setup.command again"
  echo ""
  read -r -p " Press Enter to close..."
  exit 1
fi

echo " [1/4] Installing dependencies..."
npm install

echo ""
echo " [2/4] Building packages..."
npm run build

echo ""
echo " [3/4] Creating local env file..."
if [ ! -f ".env.local" ]; then
  cp ".env.example" ".env.local"
  echo " Created .env.local from .env.example"
else
  echo " .env.local already exists — left unchanged"
fi

echo ""
echo " [4/4] Generating templater test dataset..."
if ! node "scripts/generate-templater-dataset.mjs"; then
  echo " Dataset step skipped or failed (you can re-run setup later)."
fi

echo ""
echo " ========================================"
echo "  Setup complete"
echo " ========================================"
echo ""
echo " Next: double-click  open-photoshop.command"
echo " Then follow the on-screen panel steps."
echo ""
echo " Full guide: README.md"
echo ""
read -r -p " Press Enter to close..."

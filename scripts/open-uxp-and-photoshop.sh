#!/bin/bash
# Prefer double-clicking open-photoshop.command at the repo root.
# Paths are relative to this repo (no hard-coded user folders).

REPO="$(cd "$(dirname "$0")/.." && pwd)"
PLUGIN="$REPO/packages/uxp-plugin"

UXP=""
for candidate in \
  "/Applications/Adobe UXP Developer Tools/Adobe UXP Developer Tools.app" \
  "/Applications/UXP Developer Tools.app" \
  "/Applications/Adobe UXP Developer Tools.app"
do
  if [ -d "$candidate" ]; then
    UXP="$candidate"
    break
  fi
done

PS=""
for year in 2026 2025 2024 2023; do
  candidate="/Applications/Adobe Photoshop ${year}/Adobe Photoshop ${year}.app"
  if [ -d "$candidate" ]; then
    PS="$candidate"
    break
  fi
done

if [ -n "$UXP" ]; then
  echo "Opening Adobe UXP Developer Tools..."
  open "$UXP"
  sleep 2
else
  echo "Adobe UXP Developer Tools not found under /Applications."
fi

if [ -n "$PS" ]; then
  echo "Opening Photoshop..."
  open "$PS"
else
  echo "Photoshop 2023–2026 not found under /Applications."
fi

printf '%s' "$PLUGIN" | pbcopy

echo ""
echo "In UXP Developer Tools:"
echo "  1. Enable Developer Mode (gear)"
echo "  2. Add Plugin -> select:"
echo "     $PLUGIN"
echo "  3. Load / Watch the plugin against Photoshop"
echo "  4. In the panel, Repo folder… -> select:"
echo "     $REPO"
echo ""
echo "Plugin path copied to clipboard."

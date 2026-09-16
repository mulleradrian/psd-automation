#!/bin/bash
# Double-click this file in Finder to open Photoshop + UXP Developer Tools.
# If macOS blocks it: right-click → Open → Open.

cd "$(dirname "$0")"
REPO="$(pwd)"
PLUGIN="$REPO/packages/uxp-plugin"

echo ""
echo " ========================================"
echo "  Opening Photoshop + UXP Developer Tools"
echo " ========================================"
echo ""

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
  echo " Starting UXP Developer Tools..."
  open "$UXP"
else
  echo " Could not find Adobe UXP Developer Tools in /Applications."
  echo " Install it from Creative Cloud, then run this again."
  echo ""
fi

if [ -n "$PS" ]; then
  echo " Starting Photoshop..."
  open "$PS"
else
  echo " Could not find Photoshop 2023–2026 in /Applications."
  echo " Install Photoshop, then run this again."
  echo ""
fi

# Copy plugin path for Add Plugin
printf '%s' "$PLUGIN" | pbcopy

echo ""
echo " -----------------------------------------"
echo "  Load the panel (one-time)"
echo " -----------------------------------------"
echo ""
echo " 1. In UXP Developer Tools: enable Developer Mode (gear icon)"
echo " 2. Click Add Plugin"
echo " 3. Select this folder (also copied to clipboard):"
echo ""
echo "    $PLUGIN"
echo ""
echo " 4. Click Load / Watch (target Photoshop)"
echo " 5. In Photoshop: Plugins → P10 Templater"
echo " 6. In the panel: click \"Repo folder…\" and choose:"
echo ""
echo "    $REPO"
echo ""
echo " 7. Click Pull Content_DB, then Apply this row"
echo ""
echo " Plugin path copied to clipboard."
echo ""
read -r -p " Press Enter to close..."

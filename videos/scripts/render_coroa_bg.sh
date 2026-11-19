#!/bin/bash
# Renders only the 3D frames of CoroaBG as a JPEG sequence (the science shots and the end are 2D).
# Usage: scripts/render_coroa_bg.sh [range ...]   (default: every 3D range)
set -e
cd "$(dirname "$0")/.."
B=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
OUT=out/coroa/bgseq; mkdir -p $OUT
RANGES=${@:-"0-1073 1539-2009 2325-2785"}
for r in $RANGES; do
  echo "== range $r $(date +%T)"
  npx remotion render src/index.ts CoroaBG $OUT --sequence --image-format=jpeg --jpeg-quality=94 --frames=$r \
    --gl=swangle --browser-executable=$B --concurrency=4 --timeout=300000 --log=error
done
echo "== done $(date +%T)"

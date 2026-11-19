#!/bin/bash
# Renders only the 3D frames of EscudeiroBG as a JPEG sequence (2D-only shots are filled with black), then encodes
# public/escudeiro_bg.mp4. Usage: scripts/render_bg.sh [range ...]   (default: every 3D range)
set -e
cd "$(dirname "$0")/.."
B=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
OUT=out/bgseq; mkdir -p $OUT
RANGES=${@:-"0-539 960-1529 1890-3299"}
for r in $RANGES; do
  echo "== range $r $(date +%T)"
  npx remotion render src/index.ts EscudeiroBG $OUT --sequence --image-format=jpeg --jpeg-quality=94 --frames=$r \
    --gl=swangle --browser-executable=$B --concurrency=4 --timeout=300000 --log=error
done
echo "== done $(date +%T)"

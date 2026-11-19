#!/bin/bash
# After scripts/render_bg.sh: fill the 2D-only frames with black, encode public/escudeiro_bg.mp4, render the 2D layers on
# top (EscudeiroEp1 with bg=video) and mux the sound from audio/mix.wav -> out/escudeiro_ep1.mp4
set -e
cd "$(dirname "$0")/.."
B=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
SEQ=out/bgseq
# remotion pads frame numbers per rendered range (element-000 / element-0960): link them all as f-NNNN.jpeg
rm -rf out/bgnorm; mkdir -p out/bgnorm
ffmpeg -v error -y -f lavfi -i color=c=black:s=1080x1920 -frames:v 1 -q:v 2 out/black.jpg
for f in $SEQ/element-*.jpeg; do n=$(basename "$f" .jpeg); n=$((10#${n#element-})); ln -sf "$(realpath "$f")" out/bgnorm/f-$(printf %04d $n).jpeg; done
for i in $(seq 0 3299); do g=out/bgnorm/f-$(printf %04d $i).jpeg; [ -e "$g" ] || ln -sf "$(realpath out/black.jpg)" "$g"; done
mkdir -p public
ffmpeg -v error -y -framerate 30 -i "out/bgnorm/f-%04d.jpeg" -c:v libx264 -crf 12 -preset slow -pix_fmt yuv420p public/escudeiro_bg.mp4
[ -f audio/mix.wav ] || (cd audio && python3 escudeiro_audio.py)
npx remotion render src/index.ts EscudeiroEp1 out/escudeiro_video.mp4 --props='{"bg":"video"}' --codec h264 --crf 16 \
  --gl=swangle --browser-executable=$B --concurrency=4 --log=error
ffmpeg -v error -y -i out/escudeiro_video.mp4 -i audio/mix.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart out/escudeiro_ep1.mp4
ffprobe -v error -show_entries format=duration:stream=width,height,codec_name -of compact out/escudeiro_ep1.mp4

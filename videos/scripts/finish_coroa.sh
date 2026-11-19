#!/bin/bash
# After scripts/render_coroa_bg.sh: fill the 2D-only frames with black, encode public/coroa_bg.mp4, render the 2D layers
# on top (CoroaP1 with bg=video) and mux the sound from audio/coroa/mix.wav -> out/coroa/coroa_p1.mp4
set -e
cd "$(dirname "$0")/.."
B=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
SEQ=out/coroa/bgseq; NORM=out/coroa/bgnorm
rm -rf $NORM; mkdir -p $NORM
ffmpeg -v error -y -f lavfi -i color=c=black:s=1080x1920 -frames:v 1 -q:v 2 out/coroa/black.jpg
for f in $SEQ/element-*.jpeg; do n=$(basename "$f" .jpeg); n=$((10#${n#element-})); ln -sf "$(realpath "$f")" $NORM/f-$(printf %04d $n).jpeg; done
for i in $(seq 0 2969); do g=$NORM/f-$(printf %04d $i).jpeg; [ -e "$g" ] || ln -sf "$(realpath out/coroa/black.jpg)" "$g"; done
mkdir -p public
ffmpeg -v error -y -framerate 30 -i "$NORM/f-%04d.jpeg" -c:v libx264 -crf 12 -preset slow -pix_fmt yuv420p public/coroa_bg.mp4
[ -f audio/coroa/mix.wav ] || (cd audio/coroa && python3 coroa_audio.py)
npx remotion render src/index.ts CoroaP1 out/coroa/video.mp4 --props='{"bg":"video"}' --codec h264 --crf 16 \
  --gl=swangle --browser-executable=$B --concurrency=4 --log=error
ffmpeg -v error -y -i out/coroa/video.mp4 -i audio/coroa/mix.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart out/coroa/coroa_p1.mp4
ffprobe -v error -show_entries format=duration:stream=width,height,codec_name -of compact out/coroa/coroa_p1.mp4

# Vídeos (skill desenho-animado)

Projeto Remotion + three.js. Episódio pronto: **André no VRMMO — Ep. 1: Escudeiro** (`src/videos/escudeiro/`, composição `EscudeiroEp1`, 110 s, 1080x1920).

- `src/videos/escudeiro/story.ts`: linha do tempo, câmeras, desfoque, legendas, balões.
- `world.ts` (quarto, praça, floresta), `cast.ts` (André, Kael, javali, jogadores), `toon.ts` (desenho dos bonecos), `science.tsx` (cenas de raio-X), `Escudeiro.tsx` (composição, painéis, tela A/B).
- `audio/escudeiro_audio.py`: trilha e efeitos por código → `mix.wav`.

Render (Linux, sem GPU):
1. `npm install`
2. `scripts/render_bg.sh` → quadros 3D em `out/bgseq/` (lento, ~2h40)
3. `scripts/finish.sh` → junta o fundo, renderiza as camadas 2D e mistura o som em `out/escudeiro_ep1.mp4`

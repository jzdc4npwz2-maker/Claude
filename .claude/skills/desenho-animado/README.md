# Animated 2D/3D Xavier

A skill grátis do vídeo **"Como Fazer Shorts Animados Virais Usando o Claude (Fluxo Completo)"**, em português.

Ela faz shorts animados verticais contando uma história: bonecos 2D chapados num mundo 3D colorido, com contorno preto,
cidade pintada, fundo desfocado, câmera deslizando, narração e sons. Tudo é feito com código (three.js dentro do Remotion),
no seu computador, sem gerador de vídeo de IA.

Exemplo pronto: **A Torre de Pisa** (`templates/pisa/`), o desenho mostrado no vídeo.

## Como instalar (3 passos)
1. Abra o **Claude Code** e cole:
   > instala essa skill: https://github.com/davixavier-coder/Animated-23D-Xavier
2. Ele copia a pasta para `~/.claude/skills/desenho-animado/` e prepara o projeto (`templates/projeto/`: Remotion,
   three.js, Node e ffmpeg).
3. Peça o vídeo:
   > faz um desenho animado contando a história de …

O Claude escreve a história, monta o mundo, anima os bonecos, confere foto por foto e te entrega o vídeo.

Você precisa de: um computador, o **Claude Code**, o **Node** e o **ffmpeg**.

## O que tem aqui dentro
| Pasta | O que é |
|---|---|
| `SKILL.md` | O passo a passo completo pro Claude: todas as regras, os consertos e os valores do visual |
| `templates/pisa/` | O desenho da Torre de Pisa inteiro (mundo, torre andar por andar, bonecos, câmera, tempos da narração) |
| `templates/bridge/` | O primeiro exemplo do estilo (a ponte), já com o conserto da tela em branco |
| `templates/projeto/` | Um projeto Remotion pronto pra rodar (`package.json`, `src/index.ts`, `src/Root.tsx`, script de fotos) |
| `templates/audio/` | Os sons e a música feitos por código, com a mixagem |
| `templates/scripts/` | Ajudantes: fotos de conferência, comparação lado a lado, conferência quadro a quadro |
| `references/STYLE_BIBLE.md` | O livro de regras do estilo: a fórmula da história e do visual, medida em 20 shorts |
| `references/reports/` | Os 7 relatórios de medição: movimento, profundidade, textura, bonecos, luz, contorno e cor |
| `references/frames/` e `references/sheets/` | 38 quadros e 20 folhas de 60 fotos pra comparar com o seu |

## Dicas
- A história, os bonecos e a voz são sempre seus. As referências servem só pro visual.
- Cada render do Remotion copia arquivos pra pasta temporária. Use uma pasta num disco com espaço (`TMPDIR=...`).
- No Mac, renderize com o Chrome instalado e `--gl=angle`.

## Licença
O código e os textos são MIT (veja `LICENSE`). Os quadros de referência estão aqui só para estudo do estilo.

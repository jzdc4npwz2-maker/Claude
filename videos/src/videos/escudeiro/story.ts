// "André no VRMMO — Ep. 1: Escudeiro": 110 s vertical short in the flat-characters-in-a-3D-toon-world style.
// Captions only (no narration). Timeline in seconds on the 30 fps grid; 3D shots are posed per frame from here,
// the 2D layers (captions, HUD, x-ray science scenes, the A/B split) read the same tables in Escudeiro.tsx.
export const FPS = 30;
export const TOTAL = 110 * FPS;
export const D0 = 0;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
export const S = (s: number) => Math.round(s * FPS);

/** world origins of the three sets */
export const RX = 1000;  // bedroom (x offset)
export const FZ = 400;   // forest clearing (z offset); the plaza sits at the origin

// key times (s)
export const T = {
  deitou: 15.4, helmetOn: 14.6, blackout: 17.2,
  pick: 39.2,            // finger taps "Escudeiro"
  shieldIn: 47.4,        // shield materialises
  scrape: 64.8, charge: 67.9, freeze: 69.0,
  resume: 75.0, raise: 75.0, impact: 75.3,
  kaelIn: 81.8, kaelStop: 84.8, clapEnd: 87.6,
};

// ---------------- shots ----------------
export type Light = "day" | "golden" | "night";
export type Env = "room" | "plaza" | "forest" | "none";
export type ShotDef = { id: number; a: number; b: number; light: Light; env: Env };
export const SHOTS: ShotDef[] = [
  { id: 1, a: S(0), b: S(6), light: "night", env: "room" },
  { id: 2, a: S(6), b: S(13), light: "night", env: "room" },
  { id: 3, a: S(13), b: S(18), light: "night", env: "room" },
  { id: 4, a: S(18), b: S(32), light: "day", env: "none" },     // science: the brain never saw anything
  { id: 5, a: S(32), b: S(42), light: "day", env: "plaza" },
  { id: 6, a: S(42), b: S(47), light: "day", env: "plaza" },
  { id: 7, a: S(47), b: S(51), light: "day", env: "plaza" },
  { id: 8, a: S(51), b: S(63), light: "day", env: "none" },     // science: muscle spindles
  { id: 9, a: S(63), b: S(69), light: "day", env: "forest" },
  { id: 10, a: S(69), b: S(75), light: "day", env: "forest" },  // science over the frozen frame: reaction time
  { id: 11, a: S(75), b: S(81), light: "day", env: "forest" },
  { id: 12, a: S(81), b: S(104), light: "day", env: "forest" },
  { id: 13, a: S(104), b: TOTAL, light: "day", env: "forest" }, // A/B split, bottom half
];
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const is3D = (id: number) => SHOTS[id - 1].env !== "none";
/** frame the 3D world is posed at (shot 10 freezes the charge mid-air) */
export const poseFrame = (f: number) => (f >= S(T.freeze) && f < S(T.resume) ? S(T.freeze) : f);

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mix = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mix(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
/** every hold creeps in: a slow zoom (the lens stays put, so the foreground cast never leaves the frame) */
const dolly = (pos: V3, look: V3, f: number, f0: number, rate = 0.0025, rest: Partial<Cam> = {}): Shot => {
  const k = Math.exp(-rate * Math.max(0, f - f0)), fov = rest.fov ?? 40;
  return { pos, look, ...rest, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k) };
};
const R = (x: number, y: number, z: number): V3 => [RX + x, y, z];
const F = (x: number, y: number, z: number): V3 => [x, y, FZ + z];

/** the boar's charge (shared with cast.ts): x of its card and leap height, time excluding the freeze */
export const BOAR = { v: 4.0, x0: 4.6 };
export const boarX = (t: number) => {
  const tt = t < T.freeze ? t - T.charge : T.freeze - T.charge + Math.max(0, t - T.resume);
  return BOAR.x0 - BOAR.v * Math.max(0, tt);
};
const CAMS: Record<number, Key[]> = {
  // hook: André opens the box, the helmet lights his face; slow push on the helmet
  1: [{ f: 0, s: (f) => dolly(R(0.2, 1.45, -2.6), R(0.55, 1.25, 0.8), f, 0, 0.003, { fov: 42, roll: 0.02 }) }],
  // the friend bails: André sitting on the floor against the bed with the phone
  2: [{ f: S(6), s: (f) => dolly(R(-0.55, 1.0, -2.0), R(-1.1, 0.68, 0.9), f, S(6), 0.003, { fov: 40, roll: -0.03 }) }],
  // goes in alone: helmet on, then from above as he lies back on the bed
  3: [
    { f: S(13), s: (f) => dolly(R(-0.45, 1.0, -1.9), R(-1.12, 0.72, 0.9), f, S(13), 0.003, { fov: 40 }) },
    { f: S(T.deitou), cut: true, s: (f) => dolly(R(-0.62, 2.95, 1.8), R(-1.3, 0.6, 1.8), f, S(T.deitou), 0.004, { fov: 52, roll: 0.0 }) },
  ],
  // the plaza: wide establishing over the crowd, glide down to André facing his class menu (kept low in frame)
  5: [
    { f: S(32), s: (f) => dolly([-4, 3.4, -16], [0, 2.2, 4], f, S(32), 0.0015, { fov: 50, roll: 0.02 }) },
    { f: S(35), dur: 40, s: (f) => dolly([0.3, 1.75, -5.2], [0, 2.0, 0], f, S(35), 0.0015, { fov: 46 }) },
  ],
  6: [{ f: S(42), s: (f) => dolly([0.3, 1.75, -5.0], [0, 2.0, 0], f, S(42), 0.0015, { fov: 46 }) }],
  7: [{ f: S(47), s: (f) => dolly([-0.5, 1.4, -3.7], [-0.2, 1.3, 0], f, S(47), 0.003, { fov: 42, roll: -0.03 }) }],
  // the boar: André waits, the boar scrapes, André's face, then the lens rides along with the charge
  9: [
    { f: S(63), s: (f) => dolly(F(-2.0, 1.5, -5.0), F(-2.1, 1.35, 0), f, S(63), 0.002, { fov: 44 }) },
    { f: S(64.5), cut: true, s: (f) => dolly(F(3.5, 0.75, -3.4), F(4.7, 0.6, 0.5), f, S(64.5), 0.003, { fov: 40, roll: 0.04 }) },
    { f: S(66.6), cut: true, s: (f) => dolly(F(-2.4, 1.5, -3.4), F(-2.2, 1.45, 0), f, S(66.6), 0.004, { fov: 40, roll: -0.03 }) },
    { f: S(T.charge), cut: true, s: (f) => { const x = boarX(f / FPS); return { pos: F(x - 0.6, 0.9, -5.2), look: F(x - 1.1, 0.75, 0.5), fov: 44, roll: 0.05 }; } },
  ],
  // frozen frame: the two-shot (the boar in the air, screen-left; André screen-right), slow creep
  10: [{ f: S(69), s: (f) => dolly(F(-1.1, 1.25, -7.4), F(-1.1, 1.15, 0.5), f, S(69), 0.0005, { fov: 54, roll: 0.03 }) }],
  11: [
    { f: S(75), s: (f) => dolly(F(-1.1, 1.25, -7.4), F(-1.1, 1.15, 0.5), f, S(69), 0.0005, { fov: 54, roll: 0.03 }) },
    { f: S(77.0), dur: 50, s: (f) => dolly(F(-1.1, 1.3, -6.9), F(-1.1, 1.2, 0.5), f, S(77), 0.0008, { fov: 54 }) },
  ],
  // Kael (x -0.5, screen-left of André): wide as he walks in, then singles and two-shots for the dialogue
  12: [
    { f: S(81), s: (f) => dolly(F(-1.2, 1.6, -9.0), F(-1.3, 1.25, 1), f, S(81), 0.0012, { fov: 50 }) },
    { f: S(86.8), cut: true, s: (f) => dolly(F(-0.95, 1.55, -3.9), F(-0.5, 1.6, 0), f, S(86.8), 0.003, { fov: 42, roll: -0.03 }) },
    { f: S(89), cut: true, s: (f) => dolly(F(-1.85, 1.5, -3.9), F(-2.2, 1.55, 0), f, S(89), 0.003, { fov: 42, roll: 0.03 }) },
    { f: S(93), cut: true, s: (f) => dolly(F(-1.35, 1.55, -7.0), F(-1.35, 1.35, 0.5), f, S(93), 0.0015, { fov: 48 }) },
    { f: S(97), cut: true, s: (f) => dolly(F(-0.95, 1.45, -3.9), F(-0.5, 1.6, 0), f, S(97), 0.003, { fov: 42, roll: -0.03 }) },
    { f: S(101), cut: true, s: (f) => dolly(F(-1.85, 1.5, -3.6), F(-2.2, 1.55, 0), f, S(101), 0.004, { fov: 42, roll: 0.04 }) },
  ],
  // bottom half of the A/B split (only the middle half of this frame is shown): André between two boars
  13: [{ f: S(104), s: (f) => dolly(F(0, 1.0, -8.0), F(0, 0.95, 0.5), f, S(104), 0.0015, { fov: 48 }) }],
};
/** impact kicks: flip sign every frame, decay over 7 frames */
const KICKS = [T.impact, 1.05];
export const kickAt = (t: number) => {
  for (const k of KICKS) { const n = Math.round((t - k) * FPS); if (n >= 0 && n < 7) return (n % 2 ? -1 : 1) * (1 - n / 7); }
  return 0;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id] ?? CAMS[1], f), a = kickAt(f / FPS);
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a * 2.5;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.006 };
};

// ---------------- lens blur per beat (cInf px at 1080; 0 = sharp) ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 12, focus: () => R(0.55, 1.3, 0.8) },
  { f: S(6), cInf: 14, focus: () => R(-1.15, 0.6, 0.9) },
  { f: S(13), cInf: 10 },
  { f: S(32), cInf: 0 },
  { f: S(35), dur: 30, cInf: 11, focus: () => [0, 1.4, 0] },
  { f: S(42), dur: 15, cInf: 22, focus: () => [0, 1.4, 0] },
  { f: S(47), cInf: 13, focus: () => [-0.25, 1.1, 0] },
  { f: S(63), cInf: 6 },
  { f: S(64.5), cInf: 14 },
  { f: S(66.6), cInf: 13 },
  { f: S(T.charge), cInf: 8 },
  { f: S(69), cInf: 6, focus: () => F(-0.8, 1.0, 0) },
  { f: S(81), cInf: 7 },
  { f: S(86.8), cInf: 14 },
  { f: S(93), cInf: 9 },
  { f: S(97), cInf: 14 },
  { f: S(104), cInf: 6 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};

// ---------------- captions ("/" = next card, *word* = yellow) ----------------
type Line = { a: number; b: number; text: string };
const spread = (a: number, b: number, text: string): Line[] => {
  const parts = text.split("/").map((x) => x.trim()), w = parts.map((x) => x.replace(/\*/g, "").length + 7), tot = w.reduce((x, y) => x + y, 0);
  let t = a; const span = b - a - 0.25;
  return parts.map((p, i) => { const d = (span * w[i]) / tot, l = { a: t, b: t + d, text: p }; t += d; return l; });
};
const timed = (rows: [number, string][], end: number): Line[] => rows.map(([a, text], i) => ({ a, b: i + 1 < rows.length ? rows[i + 1][0] : end, text }));
export const CAPTIONS: Line[] = [
  ...spread(0.3, 6, "O ANDRÉ JUNTOU / TRÊS MESES / DE *SALÁRIO* / PRA COMPRAR / UM *VRMMO.*"),
  ...spread(6, 13, "A IDEIA ERA / JOGAR COM O *LUCAS.* / MAS NO DIA / DO LANÇAMENTO… / FOI MAL, MANO, / NÃO VOU *CONSEGUIR.*"),
  ...spread(13, 18, "O ANDRÉ OLHOU / PRO CAPACETE… / DEITOU… / E ENTROU *SOZINHO.*"),
  ...spread(18, 32, "E ISSO FUNCIONA / POR UM MOTIVO / MEIO *ASSUSTADOR:* / O SEU CÉREBRO / NUNCA *VIU* NADA. / ELE VIVE / NO *ESCURO* / SÓ RECEBENDO / SINAIS *ELÉTRICOS.* / SE O CAPACETE / MANDA O MESMO SINAL… / ELE NÃO SABE / A *DIFERENÇA.*"),
  ...spread(32, 42, "QUANDO ABRIU / OS OLHOS… / NUMA PRAÇA / CHEIA DE *JOGADORES.* / MAGO, ARQUEIRO, / ASSASSINO… / E ELE ESCOLHEU / *ESCUDEIRO.* / A CLASSE QUE / *NINGUÉM* ESCOLHE."),
  ...spread(42, 47, "*DEFESA* LÁ EM CIMA, / VIGOR ALTO… / E DANO / QUASE *ZERO.*"),
  ...spread(47, 51, "QUANDO O ESCUDO / APARECEU NO BRAÇO, / ELE SENTIU / O *PESO.* / DE *VERDADE.*"),
  ...spread(51, 63, "DENTRO DOS MÚSCULOS / EXISTEM SENSORES / CHAMADOS / *FUSOS MUSCULARES.* / ELES AVISAM / O QUANTO O MÚSCULO / ESTÁ *ESTICADO.* / O JOGO SÓ MANDOU / O *SINAL.* / E O BRAÇO *PESOU.*"),
  ...spread(63, 69, "PRIMEIRO INIMIGO: / UM *JAVALI* / NÍVEL 3. / RASPOU A PATA… / E *AVANÇOU.*"),
  ...spread(69, 75, "UM HUMANO LEVA / *250 MILISSEGUNDOS* / PRA REAGIR. / O JAVALI CHEGAVA / EM *300.*"),
  ...spread(75, 79.5, "ELE LEVANTOU / O ESCUDO / COM *50* DE SOBRA."),
  ...timed([
    [81.2, "ALGUÉM TINHA"], [82.3, "VISTO A *LUTA.*"], [83.5, "UM MAGO NÍVEL 24"], [84.8, "CHEGOU *APLAUDINDO.*"],
    [86.2, "BLOQUEIO PERFEITO"], [87.4, "NO *NÍVEL 1?*"], [89.2, "O ANDRÉ CONTOU"], [90.6, "QUE O AMIGO *FUROU.*"],
    [93.1, "AÍ O MAGO"], [94.2, "FALOU DE UMA *MASMORRA*"], [95.7, "AQUI PERTO…"], [97.1, "COM UM CHEFE"], [98.4, "*NÍVEL 30.*"],
    [101.1, "O ANDRÉ É"], [102.2, "*NÍVEL 1.*"],
  ], 103.9),
  ...timed([[104.1, "ELE VAI ATÉ / A *MASMORRA*…"], [105.6, "OU CONTINUA CAÇANDO / *JAVALIS*"], [107.0, "PRA SUBIR / DE NÍVEL?"]], 108.2),
];

/** speech balloons in shot 12: who, text, screen anchor (fraction of the frame: x, y of the tail tip) */
export const BALLOONS: { a: number; b: number; who: "kael" | "andre"; text: string; at: [number, number] }[] = [
  { a: 86.1, b: 88.9, who: "kael", text: "Bloqueio perfeito no nível 1?!", at: [0.5, 0.36] },
  { a: 89.1, b: 92.9, who: "andre", text: "Era pra eu jogar com um amigo… ele furou.", at: [0.5, 0.36] },
  { a: 93.1, b: 96.9, who: "kael", text: "Então escuta: tem uma masmorra aqui perto.", at: [0.36, 0.43] },
  { a: 97.1, b: 99.0, who: "kael", text: "O chefe é nível 30. Sozinho, ninguém passa.", at: [0.5, 0.38] },
  { a: 101.1, b: 103.9, who: "andre", text: "…e eu sou nível 1.", at: [0.5, 0.36] },
];

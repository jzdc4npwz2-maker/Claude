// "Coroa de Ferro — Parte 1": ~99 s vertical short, flat characters in a dark 3D castle hall, narrated.
// Every time comes from the narration (words.json: one entry per spoken word, seconds). The 3D shots are posed per
// frame from here; the 2D layers (captions, HUD, the two science scenes, the end card) read the same tables.
import WORDS from "./words.json";
export const FPS = 30;
export const TOTAL = 99 * FPS;
export const D0 = 0;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
export const S = (s: number) => Math.round(s * FPS);

/** the bedroom sits at x + RX; the castle hall is at the origin (back wall at z = WALL_Z, cameras mostly look +z) */
export const RX = 1000;
export const WALL_Z = 16;
export const COLS: [number, number][] = [[-4.2, -4], [4.2, -4], [-4.2, 2], [4.2, 2], [-4.2, 8], [4.2, 8]];

// key times (s), from the narration
export const T = {
  helmetOn: 9.75, lightsOut: 10.55, land: 12.45, eyesOn: 14.3, bossCard: 15.45,
  raise: 22.7, jump: 24.0, slam: 25.2, hit1: 25.42,
  swing2: 26.95, hit2: 27.72, roll: 27.5,
  swing3: 29.35, sweep: 29.95, duck: 29.8,
  notice: 32.4, tired: 33.6,
  plan: 53.9, sheath: 55.2, beckon: 56.1, runOff: 57.3,
  kite: 58.0, lap2: 59.8, lap3: 60.14, drain: 60.6, stopKite: 62.4,
  atWall: 63.6, charge: 65.2, gap0: 67.0, gap1: 77.5,
  side: 78.2, impact: 81.21, crit: 83.89, poof: 85.1, lvl: 86.9, hole: 89.0, eyes: 94.45, end: 95.6,
};

// ---------------- shots ----------------
export type Light = "day" | "golden" | "night" | "hall";
export type Env = "room" | "hall" | "none";
export type ShotDef = { id: number; a: number; b: number; light: Light; env: Env };
const SH: [number, number, Light, Env][] = [
  [0, 4.05, "hall", "hall"],       // 1 hook: flash-forward, the knight stuck in the wall
  [4.05, 9.15, "night", "room"],   // 2 the helmet in the bedroom
  [9.15, 11.65, "night", "room"],  // 3 helmet on, lights out
  [11.65, 14.1, "hall", "hall"],   // 4 drops into the boss hall
  [14.1, 18.7, "hall", "hall"],    // 5 the knight wakes up
  [18.7, 21.9, "hall", "hall"],    // 6 Léo, level 2
  [21.9, 26.4, "hall", "hall"],    // 7 first blow: jump back, the floor cracks
  [26.4, 28.6, "hall", "hall"],    // 8 second: roll
  [28.6, 31.85, "hall", "hall"],   // 9 third: the blade over his head
  [31.85, 35.8, "hall", "hall"],   // 10 he notices: the knight is panting
  [35.8, 51.3, "hall", "none"],    // 11 science: armour weight, treadmill, breathing
  [51.3, 58.0, "hall", "hall"],    // 12 the plan
  [58.0, 63.1, "hall", "hall"],    // 13 laps around the column
  [63.1, 67.0, "hall", "hall"],    // 14 at the wall; the charge
  [67.0, 77.5, "hall", "none"],    // 15 science: momentum, truck vs bike
  [77.5, 79.4, "hall", "hall"],    // 16 the side step
  [79.4, 83.85, "hall", "hall"],   // 17 into the wall
  [83.85, 85.05, "hall", "hall"],  // 18 CRÍTICO
  [85.05, 89.0, "hall", "hall"],   // 19 boss defeated, level 15
  [89.0, 92.85, "hall", "hall"],   // 20 the hidden passage
  [92.85, 99.0, "hall", "none"],   // 21 eyes in the dark + end card
];
export const SHOTS: ShotDef[] = SH.map(([a, b, light, env], i) => ({ id: i + 1, a: S(a), b: S(b), light, env }));
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const is3D = (id: number) => SHOTS[id - 1].env !== "none";
/** story time the world is posed at: the hook borrows the aftermath of the crash */
export const poseTime = (id: number, t: number) => (id === 1 ? 84.3 + t * 0.15 : t);

// ---------------- the knight's charge (shared with cast.ts) ----------------
/** charge clock: runs from T.charge, paused while the science scene covers it */
export const chargeClock = (t: number) => (t < T.gap0 ? t - T.charge : T.gap0 - T.charge + Math.max(0, t - T.gap1));
export const CHARGE = { x0: 3, z0: 0, v: 2.8, zHit: WALL_Z - 0.6 };
export const chargePos = (t: number): [number, number] => {
  const c = Math.max(0, chargeClock(t)), z = Math.min(CHARGE.zHit, CHARGE.z0 + CHARGE.v * c);
  return [CHARGE.x0 * (1 - smooth(c / 4.5)), z];
};

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
/** every hold creeps in: a slow zoom */
const dolly = (pos: V3, look: V3, f: number, f0: number, rate = 0.0025, rest: Partial<Cam> = {}): Shot => {
  const k = Math.exp(-rate * Math.max(0, f - f0)), fov = rest.fov ?? 40;
  return { pos, look, ...rest, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k) };
};
const R = (x: number, y: number, z: number): V3 => [RX + x, y, z];
const st = (s: number) => S(s);

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: (f) => dolly([0.2, 1.9, 8.4], [0.9, 2.0, 15.5], f, 0, 0.003, { fov: 52, roll: 0.03 }) }],
  2: [{ f: st(4.05), s: (f) => dolly(R(0.2, 1.45, -2.6), R(0.55, 1.25, 0.8), f, st(4.05), 0.003, { fov: 42, roll: 0.02 }) }],
  3: [{ f: st(9.15), s: (f) => dolly(R(-0.45, 1.0, -1.9), R(-1.12, 0.72, 0.9), f, st(9.15), 0.004, { fov: 40 }) }],
  4: [{ f: st(11.65), s: (f) => dolly([0.9, 1.4, -3.8], [0, 2.1, 6], f, st(11.65), 0.002, { fov: 52, roll: -0.02 }) }],
  5: [
    { f: st(14.1), s: (f) => dolly([0.7, 0.55, 1.6], [0, 2.9, 7], f, st(14.1), 0.0025, { fov: 50, roll: 0.03 }) },
    { f: st(16.3), cut: true, s: (f) => dolly([0.5, 2.6, 3.2], [0, 3.4, 7], f, st(16.3), 0.002, { fov: 40 }) },
    { f: st(17.45), dur: 22, s: (f) => dolly([0.5, 1.6, 3.2], [0, 0.5, 7], f, st(16.3), 0.002, { fov: 40 }) },
  ],
  6: [{ f: st(18.7), s: (f) => dolly([-0.35, 1.45, 0.5], [0, 1.3, 2.5], f, st(18.7), 0.003, { fov: 40, roll: -0.02 }) }],
  7: [{ f: st(21.9), s: (f) => dolly([-7.5, 1.9, 5.0], [0, 1.9, 2.9], f, st(21.9), 0.0015, { fov: 50 }) }],
  8: [{ f: st(26.4), s: (f) => dolly([0.2, 1.6, -3.4], [-0.1, 1.8, 3.6], f, st(26.4), 0.002, { fov: 50 }) }],
  9: [
    { f: st(28.6), s: (f) => dolly([0.9, 1.0, -1.6], [0.85, 1.8, 3.6], f, st(28.6), 0.002, { fov: 58, roll: 0.04 }) },
  ],
  10: [
    { f: st(31.85), s: (f) => dolly([1.5, 1.5, -1.0], [1.2, 1.35, 1.6], f, st(31.85), 0.003, { fov: 44, roll: 0.02 }) },
    { f: st(T.tired), cut: true, s: (f) => dolly([0.4, 2.1, 0.6], [0, 2.5, 4.6], f, st(T.tired), 0.003, { fov: 46 }) },
  ],
  12: [
    { f: st(51.3), s: (f) => dolly([1.5, 1.5, -1.0], [1.2, 1.35, 1.6], f, st(51.3), 0.003, { fov: 44, roll: -0.02 }) },
    { f: st(55.0), cut: true, s: (f) => dolly([0.2, 1.9, -3.4], [0.5, 1.8, 3.4], f, st(55.0), 0.002, { fov: 54, roll: 0.02 }) },
  ],
  13: [{ f: st(58.0), s: (f) => dolly([8.5, 8.0, -5.5], [4.2, 0.4, 2.3], f, st(58.0), 0.0012, { fov: 52 }) }],
  14: [
    { f: st(63.1), s: (f) => dolly([2.4, 1.6, 10.6], [-0.2, 1.4, 15.2], f, st(63.1), 0.003, { fov: 44 }) },
    { f: st(T.charge), cut: true, s: (f) => dolly([0.6, 1.0, 13.8], [2.0, 2.0, -2], f, st(T.charge), 0.004, { fov: 48, roll: -0.03 }) },
  ],
  16: [{ f: st(77.5), s: (f) => dolly([-0.6, 3.4, 2.6], [0.4, 1.5, 15.0], f, st(77.5), 0.002, { fov: 48 }) }],
  17: [
    { f: st(79.4), s: (f) => dolly([-4.6, 1.3, 10.4], [0.4, 2.0, 15.4], f, st(79.4), 0.001, { fov: 54 }) },
    { f: st(82.0), dur: 40, s: (f) => dolly([-2.6, 1.7, 11.0], [0.4, 2.1, 15.6], f, st(82.0), 0.002, { fov: 50 }) },
  ],
  18: [{ f: st(83.85), s: (f) => dolly([-0.6, 1.5, 11.3], [0, 2.4, 15.8], f, st(83.85), 0.005, { fov: 50, roll: 0.05 }) }],
  19: [{ f: st(85.05), s: (f) => dolly([1.5, 1.7, 10.4], [1.3, 1.6, 15.4], f, st(85.05), 0.002, { fov: 50 }) }],
  20: [
    { f: st(89.0), s: (f) => ({ pos: [0, 1.75, 10.2], look: [0, 1.7, 20], fov: 46 }) },
    { f: st(89.3), dur: 100, s: (f) => ({ pos: [0, 1.75, 13.0], look: [0, 1.75, 20], fov: 46 }) },
  ],
};
/** impact kicks: flip sign every frame, decay over 7 frames */
const KICKS = [T.land, T.hit1, T.hit2, T.impact];
export const kickAt = (t: number) => {
  for (const k of KICKS) { const n = Math.round((t - k) * FPS); if (n >= 0 && n < 7) return (n % 2 ? -1 : 1) * (1 - n / 7) * (k === T.impact ? 1.6 : 1); }
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
  { f: 0, cInf: 9, focus: () => [0.9, 1.6, 15.2] },
  { f: st(4.05), cInf: 12, focus: () => R(0.55, 1.3, 0.8) },
  { f: st(9.15), cInf: 12, focus: () => R(-1.15, 0.8, 0.9) },
  { f: st(11.65), cInf: 6, focus: () => [0, 1.0, 2.5] },
  { f: st(14.1), cInf: 8, focus: () => [0, 2.6, 7] },
  { f: st(18.7), cInf: 16, focus: () => [0, 1.4, 2.5] },
  { f: st(21.9), cInf: 5 },
  { f: st(26.4), cInf: 7, focus: () => [0, 1.2, 1.8] },
  { f: st(28.6), cInf: 9, focus: () => [1.2, 1.2, 1.6] },
  { f: st(31.85), cInf: 15, focus: () => [1.2, 1.4, 1.6] },
  { f: st(T.tired), cInf: 9, focus: () => [0, 2.4, 4.6] },
  { f: st(51.3), cInf: 15, focus: () => [1.2, 1.4, 1.6] },
  { f: st(55.0), cInf: 7, focus: () => [1.2, 1.2, 1.6] },
  { f: st(58.0), cInf: 4 },
  { f: st(63.1), cInf: 10, focus: () => [0, 1.3, 15.2] },
  { f: st(T.charge), cInf: 6 },
  { f: st(77.5), cInf: 7 },
  { f: st(79.4), cInf: 5 },
  { f: st(83.85), cInf: 12, focus: () => [0, 2.2, 15.7] },
  { f: st(85.05), cInf: 10, focus: () => [1.9, 1.4, 15.0] },
  { f: st(89.0), cInf: 4 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};

// ---------------- captions: 1-3 spoken words per card, keywords in yellow ----------------
type Word = { w: string; s: number; e: number };
export const WORDS_: Word[] = (WORDS as { words: Word[] }).words;
const KEY = new Set(["LÉO", "CHEFE", "QUARENTA", "GOLPE", "COROA", "FERRO", "VIRTUAL", "CAPACETE", "LUZ", "SALÃO", "CAVALEIRO", "AÇO", "PÉS", "DOIS",
  "ADAGA", "COURO", "ESPADA", "CHÃO", "LADO", "CABEÇA", "OFEGANTE", "CINQUENTA", "QUILOS", "ESTEIRA", "DOBRO", "ENERGIA", "CURTA", "FÍSICA", "PLANO",
  "CORRER", "COLUNAS", "DUAS", "TRÊS", "FÔLEGO", "PAREDE", "TUDO", "PESADA", "MASSA", "VELOCIDADE", "FREAR", "CAMINHÃO", "BICICLETA", "PASSO",
  "PEDRA", "CRÍTICO", "DERROTADO", "QUINZE", "PASSAGEM", "OLHOS", "ESCURO"]);
const SMALL = new Set(["O", "A", "E", "UM", "UMA", "DE", "DA", "DO", "NO", "NA", "PRA", "PRO", "QUE", "OS", "AS", "EM", "DAS", "AOS"]);
export type Line = { a: number; b: number; text: string };
export const CAPTIONS: Line[] = (() => {
  const cards: Word[][] = [];
  let cur: Word[] = [];
  WORDS_.forEach((w, i) => {
    cur.push(w);
    const up = w.w.toUpperCase(), next = WORDS_[i + 1], len = cur.map((x) => x.w).join(" ").length;
    const punct = /[.,:?!]$/.test(w.w), gap = next ? next.s - w.e : 9;
    const nextSmall = next && SMALL.has(next.w.toUpperCase().replace(/[.,:?!]/g, ""));
    if (!next || punct || gap > 0.25 || cur.length >= 3 || (len >= 11 && !SMALL.has(up)) || (cur.length === 2 && nextSmall && len >= 8)) { cards.push(cur); cur = []; }
  });
  return cards.map((c, i) => {
    const a = c[0].s - 0.04, nx = cards[i + 1]?.[0].s ?? c[c.length - 1].e + 0.6;
    const b = Math.min(nx - 0.04, c[c.length - 1].e + 0.55);
    const text = c.map((w) => { const u = w.w.toUpperCase(), bare = u.replace(/[.,:?!]/g, ""); return KEY.has(bare) ? `*${u}*` : u; }).join(" ");
    return { a, b, text };
  });
})();

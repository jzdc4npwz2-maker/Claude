// "O navio que não aguentou 20 minutos" (Vasa, 1628): 47.5 s short in the flat-characters-in-a-3D-toon-world style.
// Times are the narration's word onsets from audio/vasa/words.json (ElevenLabs voice, pauses tightened, x1.3).
//   S1 hook: the Vasa heeling over in the harbour        | "O navio de guerra mais poderoso da Suécia afundou…"
//   S2 1628: the town on the quay, the ship dressed      | "É 1628, em Estocolmo… ver o Vasa partir."
//   S3 the gun ports open, two rows                      | "Sessenta e quatro canhões, em dois andares."
//   S4 on deck: 30 sailors run side to side, it rolls    | "Antes, fizeram um teste… mandaram parar."
//   S5 the ship sails off anyway, crowd cheers           | "E soltaram ele mesmo assim."
//   S6 the breeze: heel, water in the ports, down        | "Mil e trezentos metros depois…foi pro fundo."
//   S7 the bike with a fridge on the head                | "Sabe por quê?… qualquer ventinho te derruba."
//   S8 the crowd stares at the mast tops                 | "Por azar, ele afundou na frente da cidade inteira."
//   S9 underwater: the shipworm turns away               | "Por sorte… verme que come madeira."
//   S10 1961: the hull comes up                          | "Trezentos e trinta e três anos depois…"
//   S11 today: the museum, tourists                      | "E hoje… museu mais visitado da Escandinávia."
export const FPS = 30;
export const TOTAL = 1426;
export const D0 = 0; // water level (m)
export const QY = 1.6; // quay top
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
export const easeIn = (u: number) => clamp01(u) ** 2.2;

/** narration word onsets (s) */
export const T_GUNS = 10.16;   // "canhões"
export const T_FLOORS = 10.9;  // "dois andares"
export const T_RUN = 13.47;    // "correndo"
export const T_THIRD = 15.35;  // "terceira"
export const T_ROLL = 16.42;   // "balançou"
export const T_STOP = 17.65;   // "parar"
export const T_LET = 18.12;    // "soltaram"
export const T_BREEZE = 21.47; // "brisa"
export const T_HEEL = 22.28;   // "deitou"
export const T_WATER = 23.21;  // "água"
export const T_DOWN = 25.18;   // "foi pro fundo"
export const T_TOP = 26.62;    // "demais (lá em cima)"
export const T_LOW = 27.79;    // "pouco (peso embaixo)"
export const T_BIKE = 29.33;   // "bicicleta"
export const T_FRIDGE = 30.07; // "geladeira"
export const T_WIND = 31.41;   // "ventinho"
export const T_FALL = 31.97;   // "derruba"
export const T_SALT = 37.19;   // "pouco sal"
export const T_LIFT = 40.8;    // "tiraram"
export const T_MUSEUM = 45.07; // "museu"

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type Crowd = "watchers" | "cheer" | "sailors" | "bike" | "stare" | "worm" | "modern" | "tourists" | "none";
export type ShotDef = { id: number; a: number; b: number; light: Light; crowd: Crowd };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 141, light: "day", crowd: "watchers" },
  { id: 2, a: 141, b: 280, light: "day", crowd: "cheer" },
  { id: 3, a: 280, b: 346, light: "day", crowd: "none" },
  { id: 4, a: 346, b: 539, light: "day", crowd: "sailors" },
  { id: 5, a: 539, b: 584, light: "day", crowd: "cheer" },
  { id: 6, a: 584, b: 772, light: "day", crowd: "watchers" },
  { id: 7, a: 772, b: 969, light: "day", crowd: "bike" },
  { id: 8, a: 969, b: 1046, light: "day", crowd: "stare" },
  { id: 9, a: 1046, b: 1166, light: "day", crowd: "worm" },
  { id: 10, a: 1166, b: 1280, light: "day", crowd: "modern" },
  { id: 11, a: 1280, b: TOTAL, light: "golden", crowd: "tourists" },
];
// no crossfades: a second WebGL canvas breaks the shared materials in a long render. Time/place jumps blink white.
export const XFADE: Record<number, number> = {};
export const BLINKS = [1046, 1166, 1280];
export const FLASH_AT = 141;
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- the ship ----------------
// local frame: origin at the waterline amidships, bow toward +x, port side toward -z, y up. Heel > 0 = rolls to port
// (the masts lean toward -z, toward the quay cameras). sails 0 = furled/none, 1 = set; bulge = wind in them.
export type ShipState = {
  x: number; y: number; z: number; yaw: number; heel: number; pitch: number;
  sails: number; bulge: number; ports: number; guns: number; rig: "full" | "lower" | "museum"; flag: number;
};
const base: ShipState = { x: 0, y: 0, z: 0, yaw: 0, heel: 0, pitch: 0, sails: 1, bulge: 0.35, ports: 0, guns: 0, rig: "full", flag: 1 };
/** gentle harbour bob */
const bob = (t: number) => 0.6 * Math.sin(t * 1.3) + 0.3 * Math.sin(t * 2.1 + 1);
/** port i (0..31, along the hull, both rows) opens over 0.25 s, staggered from the stern */
export const portOpen = (i: number, t: number, t0: number) => smooth((t - t0 - (i % 16) * 0.025 - (i >= 16 ? 0.25 : 0)) / 0.25);
export const shipState = (id: number, t: number): ShipState => {
  switch (id) {
    case 1: { // the hook: already heeling, water pouring in
      const k = smooth((t - 0.2) / 3.6), s = easeIn((t - 2.2) / 2.6);
      return { ...base, x: 20, heel: 9 + 31 * k, y: -3.5 * s, ports: 1, guns: 1, bulge: 0.9, pitch: 1.5 * k };
    }
    case 2: return { ...base, heel: bob(t) * 0.6, bulge: 0.3 };
    case 3: return { ...base, heel: bob(t) * 0.6, bulge: 0.3, ports: -1, guns: -1 }; // -1: staggered by portOpen
    case 4: { // the stability test: the roll grows with every run, the third one is huge, then it settles
      const a = t < T_THIRD ? 2 + 4 * smooth((t - T_RUN) / 1.8) : t < T_STOP + 0.2 ? 6 + 8 * smooth((t - T_THIRD) / 0.9) : 14 * Math.exp(-(t - T_STOP - 0.2) * 1.4);
      return { ...base, heel: a * Math.sin((t - T_RUN + 0.35) * Math.PI * 2 / 1.9), sails: 0, flag: 1 };
    }
    case 5: { const u = t - 539 / FPS; return { ...base, x: 4 + u * 3.5, heel: 2 + bob(t) * 0.5, bulge: 0.6 }; }
    case 6: { // the breeze, the heel, the water, the bottom
      const h = 3 + 6 * smooth((t - T_BREEZE) / 0.7) + 33 * smooth((t - T_HEEL) / 1.5);
      const s = easeIn((t - T_DOWN + 0.6) / 1.3);
      return { ...base, x: 30, heel: h, y: -16 * s, ports: 1, guns: 1, bulge: 0.35 + 0.65 * smooth((t - T_BREEZE) / 0.5), pitch: 2 * s };
    }
    case 8: return { ...base, x: 33, z: -13, y: -45, heel: 6, ports: 1, guns: 1, bulge: 0, sails: 0.0, flag: 1 };
    case 9: return { ...base, x: 0, y: -29.8, heel: 7, pitch: -1.5, ports: 1, guns: 0, sails: 0, rig: "lower", flag: 0 };
    case 10: { const u = smooth((t - T_LIFT + 1.6) / 3.2); return { ...base, y: -9.5 + 8.2 * u, heel: 1.5, sails: 0, rig: "lower", flag: 0, ports: 1 }; }
    case 11: return { ...base, y: 5.4, sails: 0, rig: "museum", flag: 0, ports: 0 };
    default: return { ...base };
  }
};

// ---------------- bike (S7) ----------------
export const BIKE: V3 = [70, QY, -58];
/** lean (deg, + = toward screen right), fridge fall progress */
export const bikeState = (t: number) => {
  const w = 3 + 4 * smooth((t - T_FRIDGE) / 1.0) + 6 * smooth((t - T_WIND + 0.1) / 0.5);
  const lean = t < T_FALL ? w * Math.sin(t * 6.2) * (0.6 + 0.4 * Math.sin(t * 2.3)) + (t > T_WIND ? 10 * smooth((t - T_WIND) / 0.55) : 0)
    : 16 + 64 * easeIn((t - T_FALL) / 0.32);
  return { lean: Math.min(80, lean), fall: clamp01((t - T_FALL) / 0.32), down: t > T_FALL + 0.32 };
};

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number; ship?: boolean };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mix = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k, ship: b.ship,
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
const fr = (t: number) => Math.round(t * FPS);
const B = BIKE;

const CAMS: Record<number, Key[]> = {
  // hook: from the quay, port bow quarter, the whole ship heeling toward us
  1: [{ f: 0, s: (f) => dolly([74, QY + 2.4, -84], [16, 10, 0], f, 0, 0.0022, { fov: 52, roll: 0.02 }) }],
  // 1628: low behind the cheering crowd at the quay edge, the ship dressed behind them
  2: [
    { f: 141, s: (f) => dolly([30, QY + 1.5, -58], [2, 12, 0], f, 141, 0.0016, { fov: 56, roll: -0.02 }) },
    { f: 215, dur: 50, s: (f) => dolly([24, QY + 2.0, -56], [-2, 17, 0], f, 215, 0.0012, { fov: 54, roll: -0.03 }) },
  ],
  // the gun ports: close along the port side, slide aft-to-fore as they open
  3: [
    { f: 280, s: (f) => dolly([14, 2.4, -17], [-2, 3.4, -6], f, 280, 0.002, { fov: 48, roll: 0.04 }) },
    { f: 300, dur: 46, s: (f) => dolly([10, 2.8, -18.5], [-4, 3.6, -6], f, 300, 0.002, { fov: 50, roll: 0.03 }) },
  ],
  // on deck, aboard (ship frame): from the quarterdeck rail looking forward over the waist
  4: [
    { f: 346, s: (f) => dolly([-10.2, 14.6, -3.0], [6, 6.6, 1.4], f, 346, 0.0018, { fov: 60, ship: true }) },
    { f: fr(T_STOP) - 6, dur: 22, s: (f) => dolly([-10.2, 14.6, -3.0], [-4, 7.4, -3.4], f, fr(T_STOP) - 6, 0.002, { fov: 54, ship: true }) },
  ],
  // she sails anyway: wide over the cheering crowd
  5: [{ f: 539, s: (f) => dolly([40, QY + 2.4, -66], [14, 13, 0], f, 539, 0.002, { fov: 58, roll: 0.02 }) }],
  // 1300 m out: low wide from the water's edge, then push in on the heel
  6: [
    { f: 584, s: (f) => dolly([88, QY + 1.6, -64], [34, 14, 0], f, 584, 0.0015, { fov: 54 }) },
    { f: fr(T_HEEL) - 4, dur: 30, s: (f) => dolly([88, QY + 1.6, -64], [32, 9, -3], f, fr(T_HEEL) - 4, 0.0025, { fov: 48, roll: -0.04 }) },
    { f: fr(T_DOWN) - 10, dur: 26, s: (f) => dolly([88, QY + 1.6, -64], [32, 4, 0], f, fr(T_DOWN) - 10, 0.002, { fov: 52, roll: 0.02 }) },
  ],
  // the bike: 3/4 front, tilt up to the fridge on "lá em cima", down to the wheels on "embaixo", wide for the fall
  7: [
    { f: 772, s: (f) => dolly([B[0] + 3.2, B[1] + 1.3, B[2] + 5.8], [B[0], B[1] + 1.6, B[2]], f, 772, 0.0018, { fov: 46 }) },
    { f: fr(T_TOP) - 4, dur: 20, s: (f) => dolly([B[0] + 2.6, B[1] + 2.1, B[2] + 4.4], [B[0], B[1] + 2.9, B[2]], f, fr(T_TOP) - 4, 0.002, { fov: 44, roll: 0.03 }) },
    { f: fr(T_LOW) - 4, dur: 20, s: (f) => dolly([B[0] + 2.4, B[1] + 0.7, B[2] + 4.0], [B[0], B[1] + 0.55, B[2]], f, fr(T_LOW) - 4, 0.002, { fov: 44, roll: -0.03 }) },
    { f: fr(T_BIKE) - 8, dur: 26, s: (f) => dolly([B[0] + 3.6, B[1] + 1.5, B[2] + 6.6], [B[0], B[1] + 1.55, B[2]], f, fr(T_BIKE) - 8, 0.0015, { fov: 50 }) },
  ],
  // the crowd staring at the mast tops sticking out of the water (from the water, looking back at the quay)
  8: [{ f: 969, s: (f) => dolly([38, 3.6, -8], [25, 3.6, -37], f, 969, 0.0022, { fov: 38, roll: 0.03 }) }],
  // underwater: along the hull on the bottom
  9: [
    { f: 1046, s: (f) => dolly([24, -26, -16], [2, -26.5, 0], f, 1046, 0.002, { fov: 54, roll: 0.03 }) },
    { f: fr(T_SALT) - 10, dur: 30, s: (f) => dolly([20, -26.5, -13], [7, -27.2, -4], f, fr(T_SALT) - 10, 0.002, { fov: 50, roll: 0.03 }) },
  ],
  // 1961: behind the modern crowd, the hull breaking the surface
  10: [{ f: 1166, s: (f) => dolly([30, QY + 3.2, -56], [-2, 3, 0], f, 1166, 0.0018, { fov: 50, roll: 0.02 }) }],
  // the museum: low in front of the tourists, the ship towering behind, tilt up
  11: [
    { f: 1280, s: (f) => dolly([16, 1.5, -40], [2, 7, 0], f, 1280, 0.0014, { fov: 58, roll: 0.02 }) },
    { f: fr(T_MUSEUM) - 6, dur: 40, s: (f) => dolly([18, 1.7, -42], [0, 15, 0], f, fr(T_MUSEUM) - 6, 0.001, { fov: 60, roll: 0.02 }) },
  ],
};
/** impact kicks: flip sign every frame, decay over 7 frames */
const KICKS = [T_STOP, T_HEEL, T_FALL, T_FALL + 0.33, T_GUNS + 0.3];
export const kickAt = (t: number) => {
  for (const k of KICKS) { const n = Math.round((t - k) * FPS); if (n >= 0 && n < 7) return (n % 2 ? -1 : 1) * (1 - n / 7); }
  return 0;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(f / FPS);
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a * 2.5;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.006 };
};

// ---------------- lens blur per beat (cInf px at 1080; 0 = sharp) ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 0 },
  { f: 141, cInf: 8, focus: () => [22, QY + 1.2, -44] },
  { f: 280, cInf: 10 },
  { f: 346, cInf: 0 },
  { f: 539, cInf: 6, focus: () => [30, QY + 1.2, -48] },
  { f: 584, cInf: 0 },
  { f: 772, cInf: 12, focus: () => [B[0], B[1] + 1.6, B[2]] },
  { f: 969, cInf: 6, focus: () => [27, QY + 1.2, -38] },
  { f: 1046, cInf: 0 },
  { f: 1166, cInf: 7, focus: () => [24, QY + 1.2, -44] },
  { f: 1280, cInf: 9, focus: () => [12, 1.5, -32] },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};

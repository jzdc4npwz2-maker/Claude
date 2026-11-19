// The Iron Knight (Cavaleiro de Ferro): a hulking flat boss drawn in the same 600 x 1000 design space as the cast
// (soles at y = 975), shown at ~1.6x. Front view for every fighting pose, back view for the charge into the wall
// and the splat. Steel plates with gold trim, a dark red tabard with the iron crown, a bucket helm whose visor
// slit glows red.
import { Pen, INK, mix } from "./toon";

type P2 = [number, number];
const rad = (d: number) => (d * Math.PI) / 180;
const ell = (cx: number, cy: number, rx: number, ry: number, n = 40): P2[] =>
  Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as P2; });
const rr = (x0: number, y0: number, x1: number, y1: number, r: number): P2[] => {
  const out: P2[] = [];
  for (const [cx, cy, a] of [[x1 - r, y0 + r, -90], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180]])
    for (let i = 0; i <= 6; i++) out.push([cx + r * Math.cos(rad(a + 15 * i)), cy + r * Math.sin(rad(a + 15 * i))]);
  return out;
};
const lerp = (a: P2, b: P2, t: number): P2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

const STEEL = "#aab5c3", STEEL_L = "#d5dde6", STEEL_D = "#6a7686", GOLD = "#d0a646", CLOTH = "#7d1f2b", CLOTH_D = "#5a1520", EYE = "#ff3b2a";

export type KnightPose = "idle" | "raise" | "slam" | "swingA" | "swingB" | "run" | "tired" | "brake" | "back" | "splat";
const swLen = (pose: KnightPose) => (pose === "idle" || pose === "tired" ? 250 : pose === "raise" ? 380 : pose === "swingA" || pose === "swingB" ? 400 : 430);
export type KnightOpts = { pose: KnightPose; phase?: number; heave?: number; eyes?: number; light?: number; dent?: number };

/** plate: shaded fill (lit toward the light side) with an ink rim and a highlight streak */
const plate = (p: Pen, pts: P2[], base = STEEL, light = rad(-120), ol = 7) => {
  p.gradFill(pts, mix(base, "#ffffff", 0.25), mix(base, STEEL_D, 0.7), light, 0.25);
  p.poly(pts, null, ol);
};
const limb = (p: Pen, a: P2, b: P2, w: number, col = STEEL) => { p.band([a, b], col, w, 6, "round"); };
const gauntlet = (p: Pen, c: P2, r = 30) => { p.ell(c[0], c[1], r, r * 0.9, STEEL_D, 7); p.arc(c[0], c[1] - 4, r * 0.6, r * 0.45, 200, 340, 5, STEEL_L); };

const sword = (p: Pen, hilt: P2, ang: number, len = 470) => {
  // ang: direction from the hilt toward the tip (canvas radians)
  const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx, w = 20;
  const g0: P2 = [hilt[0] - dx * 70, hilt[1] - dy * 70]; // pommel end of the grip
  const b0: P2 = [hilt[0] + dx * 22, hilt[1] + dy * 22], tip: P2 = [b0[0] + dx * len, b0[1] + dy * len];
  const blade: P2[] = [[b0[0] + nx * w, b0[1] + ny * w], [tip[0] - dx * 50 + nx * w * 0.9, tip[1] - dy * 50 + ny * w * 0.9], tip,
    [tip[0] - dx * 50 - nx * w * 0.9, tip[1] - dy * 50 - ny * w * 0.9], [b0[0] - nx * w, b0[1] - ny * w]];
  p.poly(blade, "#e6ebf1", 7);
  p.stroke([lerp(b0, tip, 0.02), lerp(b0, tip, 0.86)], 5, "#a9b3be");
  p.band([g0, hilt], "#4a2c1e", 22, 5, "round");
  p.band([[b0[0] + nx * 70, b0[1] + ny * 70], [b0[0] - nx * 70, b0[1] - ny * 70]], GOLD, 20, 6, "round");
  p.ell(g0[0] - dx * 10, g0[1] - dy * 10, 20, 20, GOLD, 6);
};

const helm = (p: Pen, cx: number, cy: number, eyes: number, light: number, back = false, dent = 0) => {
  // plume
  p.poly([[cx - 10, cy - 70], [cx + 10, cy - 70], [cx + 40, cy - 150], [cx + 4, cy - 118], [cx - 30, cy - 160], [cx - 16, cy - 100]], CLOTH, 7);
  const pts = rr(cx - 66, cy - 78, cx + 66, cy + 70, 34);
  if (dent) for (const q of pts) if (q[1] < cy - 40) q[1] += dent * 18 * Math.max(0, 1 - Math.abs(q[0] - cx) / 60);
  plate(p, pts, STEEL, light, 8);
  p.band([[cx - 66, cy - 18], [cx + 66, cy - 18]], GOLD, 10, 4);
  if (back) { p.stroke([[cx, cy - 76], [cx, cy + 66]], 6, STEEL_D); return; }
  p.stroke([[cx, cy - 76], [cx, cy - 22]], 6, STEEL_D);
  // visor slit with glowing eyes
  p.poly(rr(cx - 54, cy - 4, cx + 54, cy + 18, 10), "#14101a", 6);
  if (eyes > 0) {
    const g = p.g; g.save(); g.globalAlpha = 0.45 * eyes;
    for (const sx of [-1, 1]) { p.dot(cx + sx * 26, cy + 7, 30, EYE); }
    g.globalAlpha = eyes;
    for (const sx of [-1, 1]) { p.ell(cx + sx * 26, cy + 7, 14, 6, EYE, 0); p.dot(cx + sx * 26, cy + 7, 3.5, "#ffd2c8"); }
    g.restore();
  }
  for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) p.dot(cx + sx * (16 + i * 14), cy + 42, 4.5, "#2a2433");
};

const torso = (p: Pen, cx: number, top: number, bot: number, light: number, back = false) => {
  const w = 150;
  // faulds (skirt) + tabard
  const fy = bot - 10;
  plate(p, [[cx - w + 20, fy], [cx + w - 20, fy], [cx + w + 10, fy + 90], [cx - w - 10, fy + 90]], STEEL, light, 7);
  p.stroke([[cx - w + 2, fy + 45], [cx + w - 2, fy + 45]], 5, STEEL_D);
  p.poly([[cx - 52, fy - 20], [cx + 52, fy - 20], [cx + 62, fy + 130], [cx, fy + 150], [cx - 62, fy + 130]], CLOTH, 7);
  // breastplate (barrel)
  const bp: P2[] = [[cx - w, top + 40], [cx - w + 30, top], [cx + w - 30, top], [cx + w, top + 40], [cx + w - 12, bot - 40], [cx + w - 50, bot], [cx - w + 50, bot], [cx - w + 12, bot - 40]];
  plate(p, bp, STEEL, light, 8);
  if (back) { p.stroke([[cx, top + 10], [cx, bot - 10]], 6, STEEL_D); p.band([[cx - w + 20, bot - 20], [cx + w - 20, bot - 20]], "#4a2c1e", 18, 5); return; }
  // tabard panel with the iron crown
  p.poly([[cx - 70, top + 10], [cx + 70, top + 10], [cx + 64, bot - 6], [cx - 64, bot - 6]], CLOTH, 6);
  p.poly([[cx - 70, top + 10], [cx + 70, top + 10], [cx + 64, bot - 6], [cx - 64, bot - 6]], null, 0);
  const cy = (top + bot) / 2;
  p.poly([[cx - 38, cy + 22], [cx - 42, cy - 18], [cx - 20, cy + 2], [cx, cy - 30], [cx + 20, cy + 2], [cx + 42, cy - 18], [cx + 38, cy + 22]], GOLD, 5);
  p.band([[cx - w + 20, bot - 18], [cx + w - 20, bot - 18]], "#4a2c1e", 18, 5);
  p.poly(rr(cx - 18, bot - 30, cx + 18, bot - 6, 4), GOLD, 4);
};
const pauldron = (p: Pen, c: P2, side: number, light: number, lift = 0) => {
  for (let i = 2; i >= 0; i--) {
    const y = c[1] + i * 24 - lift;
    p.poly(ell(c[0] + side * i * 4, y, 82 - i * 6, 52 - i * 4), i ? STEEL_D : null, 0);
    plate(p, ell(c[0] + side * i * 4, y, 82 - i * 6, 52 - i * 4), STEEL, light, 7);
  }
  p.band([[c[0] - 70, c[1] + 20 - lift], [c[0] + 70, c[1] + 20 - lift]].map(([x, y]) => [x, y] as P2), GOLD, 7, 3);
};
const leg = (p: Pen, hip: P2, foot: P2, light: number, side: number) => {
  const knee = lerp(hip, foot, 0.48);
  limb(p, hip, knee, 70, STEEL_D);
  limb(p, knee, foot, 62, STEEL);
  p.ell(knee[0], knee[1], 34, 28, STEEL_L, 7);
  p.poly([[foot[0] - 44, foot[1] - 22], [foot[0] + 44, foot[1] - 22], [foot[0] + 52 * (side || 1) * 0 + 50, foot[1] + 4], [foot[0] - 50, foot[1] + 4]], STEEL_D, 7);
};

/** drawn into the WIDE card (1000 x 1000 design units, soles at y = 975, centre x = 500) at 0.8 for headroom */
export const knight = (p: Pen, o: KnightOpts) => {
  const g = p.g; g.save(); g.translate(500, 975); g.scale(0.8, 0.8); g.translate(-300, -975);
  knightBody(p, o);
  g.restore();
};
const knightBody = (p: Pen, o: KnightOpts) => {
  const { pose, phase = 0, heave = 0, eyes = 1, light = rad(-120), dent = 0 } = o;
  const cx = 300, sole = 975, two = Math.PI * 2;
  const back = pose === "back" || pose === "splat";
  // vertical layout (tired: everything sinks and the shoulders heave)
  const sink = pose === "tired" ? 26 + 10 * heave : 0, bob = pose === "run" || pose === "back" ? 14 * Math.abs(Math.cos(two * phase)) : 0;
  const hipY = 720 + sink - bob, top = 430 + sink * 1.4 - bob, shY = 470 + sink * 1.5 - bob - (pose === "tired" ? 8 * heave : 0);
  const headY = 345 + sink * 1.9 - bob + (pose === "tired" ? 16 : 0);
  const L: P2 = [cx - 150, shY], R: P2 = [cx + 150, shY];
  // ---- legs ----
  let fl: P2 = [cx - 70, sole - 4], fr: P2 = [cx + 70, sole - 4];
  if (pose === "run" || pose === "back") {
    const a = Math.sin(two * phase);
    fl = [cx - 66 - 8 * a, sole - 4 - Math.max(0, a) * 70]; fr = [cx + 66 - 8 * a, sole - 4 - Math.max(0, -a) * 70];
  }
  if (pose === "brake") { fl = [cx - 120, sole - 2]; fr = [cx + 120, sole - 2]; }
  if (pose === "splat") { fl = [cx - 150, sole - 60]; fr = [cx + 150, sole - 60]; }
  if (pose === "slam" || pose === "swingB") { fl = [cx - 95, sole - 4]; fr = [cx + 90, sole - 4]; }
  leg(p, [cx - 60, hipY + 40], fl, light, -1);
  leg(p, [cx + 60, hipY + 40], fr, light, 1);
  // ---- hands per pose ----
  type Arms = { l: P2; r: P2; sw?: { hilt: P2; ang: number; front: boolean } };
  let A: Arms;
  switch (pose) {
    case "raise": A = { l: [cx - 30, headY - 150], r: [cx + 30, headY - 150], sw: { hilt: [cx, headY - 160], ang: rad(-95), front: true } }; break;
    case "slam": A = { l: [cx + 30, 760], r: [cx + 70, 770], sw: { hilt: [cx + 50, 770], ang: rad(52), front: true } }; break;
    case "swingA": A = { l: [cx + 160, shY - 40], r: [cx + 200, shY - 60], sw: { hilt: [cx + 190, shY - 60], ang: rad(-160), front: false } }; break;
    case "swingB": A = { l: [cx - 170, shY + 30], r: [cx - 210, shY + 20], sw: { hilt: [cx - 200, shY + 25], ang: rad(-178), front: true } }; break;
    case "run": { const a = Math.sin(two * phase) * 40; A = { l: [cx - 190, shY + 170 + a], r: [cx + 200, shY + 150 - a], sw: { hilt: [cx + 200, shY + 150 - a], ang: rad(120), front: false } }; break; }
    case "back": { const a = Math.sin(two * phase) * 40; A = { l: [cx - 190, shY + 160 - a], r: [cx + 200, shY + 160 + a], sw: { hilt: [cx + 200, shY + 160 + a], ang: rad(-110), front: true } }; break; }
    case "brake": A = { l: [cx - 250, shY - 150], r: [cx + 250, shY - 160], sw: { hilt: [cx + 250, shY - 160], ang: rad(-60), front: false } }; break;
    case "splat": A = { l: [cx - 260, shY - 130], r: [cx + 260, shY - 130] }; break;
    case "tired": A = { l: [cx - 22, 700 + sink], r: [cx + 22, 700 + sink], sw: { hilt: [cx, 690 + sink], ang: rad(90), front: true } }; break;
    default: A = { l: [cx - 24, 680], r: [cx + 24, 680], sw: { hilt: [cx, 672], ang: rad(90), front: true } };
  }
  if (A.sw && !A.sw.front) sword(p, A.sw.hilt, A.sw.ang, swLen(pose));
  const elbow = (s: P2, h: P2, side: number): P2 => [ (s[0] + h[0]) / 2 + side * 46, (s[1] + h[1]) / 2 + 20 ];
  const armBehind = pose === "splat" || pose === "back";
  const drawArms = () => {
    for (const [s, h, sd] of [[L, A.l, -1], [R, A.r, 1]] as [P2, P2, number][]) {
      const e = elbow(s, h, sd);
      limb(p, s, e, 64, STEEL_D); limb(p, e, h, 58, STEEL);
      p.ell(e[0], e[1], 30, 26, STEEL_L, 7);
      gauntlet(p, h);
    }
  };
  if (armBehind) drawArms();
  torso(p, cx, top, hipY, light, back);
  pauldron(p, L, -1, light, pose === "tired" ? 10 * heave : 0);
  pauldron(p, R, 1, light, pose === "tired" ? 10 * heave : 0);
  helm(p, cx, headY, back ? 0 : eyes, light, back, dent);
  if (!armBehind) drawArms();
  if (A.sw && A.sw.front) sword(p, A.sw.hilt, A.sw.ang, swLen(pose));
  if (A.sw) gauntlet(p, A.sw.hilt);
  if (pose === "tired") { // sweat drops
    for (const [dx, dy] of [[-90, -10], [96, 20], [-60, 40]]) { const x = cx + dx, y = headY + dy; p.poly([[x, y - 22], [x + 12, y + 2], [x, y + 12], [x - 12, y + 2]], "#9fe4ff", 4); }
  }
  if (pose === "splat") for (const [x, y] of [[cx - 30, headY - 120], [cx + 40, headY - 140], [cx + 5, headY - 170]]) {
    const s: P2[] = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * two - Math.PI / 2, r = i % 2 ? 9 : 22; s.push([x + r * Math.cos(a), y + r * Math.sin(a)]); }
    p.poly(s, "#ffd84a", 4);
  }
  void INK;
};

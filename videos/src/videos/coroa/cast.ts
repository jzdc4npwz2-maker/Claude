// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, fxBurst, fxStars, fxPuff, fxShadow, fxContact,
  Outfit, Expr, FrontOpts, SideOpts, Prop,
} from "./toon";
import { FPS, D0, SHOTS, V3, smooth, clamp01, T, RX, S, WALL_Z, chargePos, chargeClock, poseTime } from "./story";
import { knight, KnightPose } from "./knight";
import { LIGHTS } from "./lights";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
export const SU_SWING = 2.3 / 1830; // swing canvas: rope of 1830 units = 2.3 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);
/** wide card for the knight: 1000 x 1000 design units, soles at y = 975, centre x = 500 */
export const WIDE = (() => { const g = new THREE.PlaneGeometry(1000 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
/** world roots that hold actors (to find the scene's sun when world.ts does not pass it) */
const ROOTS = new Set<THREE.Object3D>();

/** lit flat character: cardShade() material, receives shadows (dims to the bright floor only), casts its silhouette
 *  when world.ts says so (golden). Drawn after the contact blobs (renderOrder 1). */
export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    // rim width is in output pixels: tell the card shader the render height (1920 = 1080 x 1920 frame)
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
    ROOTS.add(parent);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
/** unlit effect card: hard cut-out (ink drawings), soft see-through (dust, mist) or a multiply ground blob */
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      // no mipmaps: at grazing views the mip chain averages the blob with its white surround and it fades out
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    }
    else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 0; }
  }
}

// ---------------- placements ----------------
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; geo?: "body" | "swing" | "wide"; roll?: number; pitch?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean };
/** sun = world direction TOWARD the sun (optional: when absent the scene's shadow-casting light is used) */
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
const vOf = (i: number) => (i * 7 + (i >> 2)) % 4;
/** head-shape seed: 7 shapes, so marching soldiers in step still share canvases */
const seedOf = (i: number) => ((i * 5 + 3) % 7) + 1;
/** drawing resolution by distance: [canvas w, h, scale from the 600 x 1000 design]; sized for the 1440 x 2560 final */
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

// ---------------- light ----------------
const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const tmp = new THREE.Vector3();
let LNAME: "day" | "golden" | "night" | "hall" = "day";
const sunOf = (root: THREE.Object3D) => {
  let s: THREE.DirectionalLight | null = null;
  root.traverse((o) => { if (!s && o instanceof THREE.DirectionalLight && o.castShadow) s = o; });
  return s as THREE.DirectionalLight | null;
};
/** the sun of the world that is calling: the attached root whose sun target sits on this camera's view axis */
const findSun = (cam: CamInfo, out: THREE.Vector3) => {
  if (cam.sun) return out.copy(cam.sun).normalize();
  let best: THREE.DirectionalLight | null = null, err = Infinity;
  for (const r of ROOTS) {
    if (!r.parent) continue;
    const s = sunOf(r);
    if (!s) continue;
    const d = tmp.copy(s.target.position).sub(cam.pos), e = Math.abs(d.dot(cam.right)) / (d.length() || 1);
    if (e < err) { err = e; best = s; }
  }
  return best ? out.copy(best.position).sub(best.target.position).normalize() : out;
};
/** canvas angle the sun comes FROM on an upright card facing the camera, in 45-degree steps (small texture cache) */
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};

/** front / side view and mirroring for someone at (x, z) walking along (dx, dz); fs = foreshortening of the walk */
const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return { side: c < 0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};

// ---------------- life: blinks and reaction timing ----------------
/** reference expression and action changes land 0-3 f before the word onset */
const LEAD = 2 / FPS;
/** eyelid 0 open .. 1 shut. Reference: gaps 0.5-2.3 s, 4-frame blink half / shut / shut / half, plus a blink across
 *  every expression swap (the shut frames hide the swap) */
const LID = [0.5, 1, 1, 0.5];
const SWAPS: Record<number, number[]> = {};
const lidAt = (t: number, i: number, swaps: number[] = []) => {
  const f = Math.round(t * FPS);
  for (const ts of swaps) { const k = f - Math.round((ts - LEAD) * FPS) + 1; if (k >= 0 && k < 4) return LID[k]; }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13)); // next blink 0.5-2.3 s later
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

type Who = { i: number; o: Outfit; okey: string };
/** one character drawing in the 600 x 1000 design space, sized by distance, lit from the scene's sun */
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts, scale = 1): Place & { tierKey: string } => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = seedOf(who.i);
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return {
    key, x, y, z, scale, mirror, tierKey: `${w}`,
    draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)),
    size: [w, h, k],
  };
};

/** ground shadow under a standing / sitting card (review rounds 2-4), multiply, blue-violet: a TIGHT contact pool right under
 *  the feet (~.5 on screen at the core) so nobody floats, plus by day (cards cast no real shadow) a lighter soft tail
 *  stretched AWAY from the sun, length ~1.6 m / tan(sun elevation), capped. Golden: world.ts casts real card shadows. */
const CONTACT: Record<"day" | "golden" | "night" | "hall", [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33], night: [0.3, 0.3, 0.45], hall: [0.22, 0.22, 0.34] };
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME !== "golden") {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h; // feet at v = .2 of the card
    const tc = hexOf(TAIL, k);
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c,
      w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc,
    w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};

// ---------------- crowd by shot ----------------
export type Stage = { places: Place[]; fx: FxPlace[] };



// ---------------- Coroa de Ferro cast ----------------
const SK = "#d9a47a";
const LEO_HOME: Outfit = { jacket: "#3f6b55", pants: "#33394d", boots: "#e9e6df", hat: "hair", hair: "#2a1d16", skin: SK };
const LEO_VR: Outfit = { ...LEO_HOME, hat: "vr" };
const LEO_GAME: Outfit = { jacket: "#8a5a38", pants: "#3b3446", boots: "#5a3b2a", hat: "hood", hood: "#3c4763", belt: "#4a3020", pads: "#6b4a30", skin: SK };

type PersonArgs = { i: number; o: Outfit; okey: string; x: number; y?: number; z: number; fo: FrontOpts; scale?: number; roll?: number; pitch?: number; yaw?: number; noBlob?: boolean };
const put = (cam: CamInfo, t: number, out: Stage, a: PersonArgs) => {
  const who: Who = { i: a.i, o: a.o, okey: a.okey };
  const fo: FrontOpts = { blink: lidAt(t, a.i), ...a.fo };
  const pl = person(cam, who, a.x, a.y ?? D0, a.z, { side: false, mirror: false }, fo, {}, a.scale ?? 1);
  if (a.roll) pl.roll = a.roll;
  if (a.pitch !== undefined) { pl.pitch = a.pitch; pl.yaw = a.yaw ?? 0; }
  out.places.push(pl);
  if (!a.noBlob) blob(out, a.x, D0, a.z, a.scale ?? 1, a.y ? Math.max(0.3, 1 - a.y / 3) : 1);
};
const at = (t: number, rows: [number, Expr][], def: Expr): Expr => { let e = def; for (const [s0, x] of rows) if (t >= s0 - LEAD) e = x; return e; };
const fx = (out: Stage, key: string, draw: (p: Pen) => void, x: number, y: number, z: number, w: number, h = w, soft = false) =>
  out.fx.push({ key, cw: 500, ch: 500, draw, x, y, z, w, h, soft });
const flatFx = (out: Stage, key: string, draw: (p: Pen) => void, x: number, z: number, w: number, rot = 0) =>
  out.fx.push({ key, cw: 512, ch: 512, draw, x, y: D0 + 0.03, z, w, h: w, flat: true, rot });

// ---- effect drawings (500 x 500 unless noted) ----
const fxCrack = (p: Pen, seed: number) => {
  const g = p.g, r = (i: number) => hh(seed * 13 + i, 3);
  g.lineCap = "round"; g.lineJoin = "round";
  for (let k = 0; k < 9; k++) {
    let x = 256, y = 256, a = (k / 9) * Math.PI * 2 + r(k) * 0.6;
    const pts: [number, number][] = [[x, y]];
    for (let s = 0; s < 6; s++) { a += (r(k * 7 + s) - 0.5) * 0.9; const l = 22 + 26 * r(k * 5 + s); x += Math.cos(a) * l; y += Math.sin(a) * l; pts.push([x, y]); }
    g.strokeStyle = "#120c14"; g.lineWidth = 11 - k % 3 * 2;
    g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke();
  }
  g.fillStyle = "#120c14"; g.beginPath(); g.ellipse(256, 256, 34, 26, 0.3, 0, 7); g.fill();
};
const fxSlash = (p: Pen, t: number) => {
  const g = p.g, a0 = Math.PI * (1.05 + 0.8 * t), a1 = a0 + Math.PI * 0.75, o = 1 - t;
  g.save(); g.globalAlpha = Math.max(0, o);
  for (const [w, c] of [[60, "rgba(160,230,255,.55)"], [30, "rgba(235,250,255,.95)"]] as const) {
    g.strokeStyle = c; g.lineWidth = w; g.lineCap = "round"; g.beginPath(); g.ellipse(256, 300, 220, 120, 0, a0, a1); g.stroke();
  }
  g.restore();
};
const fxChunks = (p: Pen, t: number) => {
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI * (0.15 + 0.7 * hh(i, 4)), v = 160 + 140 * hh(i, 5), x = 250 + Math.cos(a) * v * t, y = 260 + Math.sin(a) * v * t + 380 * t * t;
    const s = 16 + 14 * hh(i, 6);
    p.poly([[x - s, y - s * 0.6], [x + s * 0.7, y - s], [x + s, y + s * 0.5], [x - s * 0.4, y + s]], i % 2 ? "#8b8798" : "#6c6878", 5);
  }
};
const fxEyesGlow = (p: Pen) => { const g = p.g; const gr = g.createRadialGradient(250, 250, 10, 250, 250, 240); gr.addColorStop(0, "rgba(255,120,60,.9)"); gr.addColorStop(1, "rgba(255,120,60,0)"); g.fillStyle = gr; g.fillRect(0, 0, 500, 500); };

// ---- Léo (story time t) ----
type LeoS = { x: number; z: number; y: number; mode: FrontOpts["mode"]; phase: number; facing: -1 | 0 | 1; roll: number; prop: Prop; wave?: number; look: number };
const COL_X = 4.2, COL_Z = 2;
const kiteAngle = (t: number) => -Math.PI / 2 + ((t - T.kite) * Math.PI * 2) / 1.45;
const leoAt = (t: number): LeoS => {
  const base: LeoS = { x: 0, z: 2.5, y: 0, mode: "stand", phase: 0, facing: 0, roll: 0, prop: t >= 19.95 ? "dagger" : null, look: 0 };
  if (t < T.land) { const u = clamp01((t - 11.65) / (T.land - 11.65)); return { ...base, y: 6 * (1 - u * u), mode: "fall" }; }
  if (t < T.jump) return { ...base, z: t >= 21.9 ? 2.4 : 2.5 };
  if (t < T.jump + 0.5) { const u = (t - T.jump) / 0.5; return { ...base, z: 2.4 - 1.2 * smooth(u), y: 0.65 * Math.sin(Math.PI * u), mode: "fall" }; }
  if (t < 26.4) return { ...base, z: 1.2 };
  if (t < T.roll) return { ...base, x: -0.5, z: 1.2 };
  if (t < T.roll + 0.45) { const u = (t - T.roll) / 0.45; return { ...base, x: -0.5 + 1.7 * smooth(u), z: 1.2 + 0.2 * u, y: 0.25 * Math.sin(Math.PI * u), roll: -Math.PI * 2 * smooth(u), mode: "sit" }; }
  if (t < T.runOff) {
    const duck = t >= T.duck && t < T.duck + 0.75;
    const prop: Prop = t >= T.sheath ? null : "dagger";
    const wave = t >= T.beckon && t < T.runOff ? q(0.5 + 0.5 * Math.sin((t - T.beckon) * 12), 10) : undefined;
    return { ...base, x: 1.2, z: 1.4, mode: duck ? "sit" : "stand", prop, wave };
  }
  if (t < T.kite) { const u = (t - T.runOff) / (T.kite - T.runOff), a0 = kiteAngle(T.kite); return { ...base, prop: null, x: 1.2 + (COL_X + 1.7 * Math.cos(a0) - 1.2) * u, z: 1.4 + (COL_Z + 1.7 * Math.sin(a0) - 1.4) * u, mode: "march", phase: (t * 2.6) % 1, facing: -1 }; }
  if (t < T.stopKite + 0.2) { const a = kiteAngle(t); return { ...base, prop: null, x: COL_X + 1.7 * Math.cos(a), z: COL_Z + 1.7 * Math.sin(a), mode: "march", phase: (t * 2.8) % 1, facing: Math.sin(a) > 0 ? 1 : -1 }; }
  if (t < 63.1) { const a = kiteAngle(T.stopKite + 0.2), u = (t - T.stopKite - 0.2) / 0.5; return { ...base, prop: null, x: COL_X + 1.7 * Math.cos(a) - 2 * u, z: COL_Z + 1.7 * Math.sin(a) + 4 * u, mode: "march", phase: (t * 2.8) % 1, facing: 1 }; }
  // at the wall
  const wall = { ...base, prop: null as Prop, z: 15.2 };
  if (t < T.side) return { ...wall, wave: t >= T.atWall && t < T.charge - 0.2 ? q(0.5 + 0.5 * Math.sin((t - T.atWall) * 11), 10) : undefined, look: 0 };
  if (t < T.side + 0.4) { const u = (t - T.side) / 0.4; return { ...wall, x: 1.9 * smooth(u), z: 15.2 - 0.2 * u, y: 0.4 * Math.sin(Math.PI * u), mode: "fall" }; }
  const cheer = t >= T.poof && t < T.poof + 3.2 ? q(0.5 + 0.5 * Math.sin((t - T.poof) * 10), 10) : undefined;
  return { ...wall, x: 1.9, z: 15.0, wave: cheer, y: t >= T.lvl && t < T.lvl + 0.5 ? 0.4 * Math.sin(Math.PI * (t - T.lvl) / 0.5) : 0 };
};
const leoExpr = (t: number): Expr => at(t, [
  [11.65, "shock"], [T.land + 0.2, "dazed"], [13.3, "neutral"], [14.4, "shock"], [16.0, "nervous"], [19.3, "nervous"], [20.4, "stern"],
  [22.7, "shock"], [T.jump + 0.5, "nervous"], [T.roll + 0.45, "pained"], [28.6, "stern"], [T.duck, "shock"], [T.duck + 0.8, "relief"],
  [32.4, "stern"], [32.9, "smile"], [T.plan, "grin"], [55.2, "smile"], [T.beckon, "grin"], [T.kite, "laugh"], [60.6, "grin"],
  [T.atWall, "smile"], [T.charge, "nervous"], [T.side, "shock"], [T.impact + 0.3, "shock"], [T.crit, "grin"], [T.poof, "laugh"], [T.hole, "shock"],
], "neutral");

// ---- the knight (story time t) ----
type KnS = { x: number; z: number; pose: KnightPose; phase: number; heave: number; eyes: number; dent: number; mirror: boolean; sy: number; on: boolean };
const KS = 2.45;
const knightAt = (t: number, id: number): KnS => {
  const k: KnS = { x: 0, z: 7, pose: "idle", phase: 0, heave: 0, eyes: smooth((t - T.eyesOn) / 0.35), dent: 0, mirror: false, sy: 1, on: true };
  if (t < 21.9) return k;
  if (t < T.runOff + 0.1) {
    const kk = { ...k, z: 4.6, mirror: id === 7 };
    if (t < T.raise) return kk;
    if (t < T.slam + 0.12) return { ...kk, pose: "raise" };
    if (t < T.swing2) return { ...kk, pose: "slam" };
    if (t < T.hit2 - 0.1) return { ...kk, pose: "raise" };
    if (t < T.swing3) return { ...kk, pose: "slam" };
    if (t < T.sweep) return { ...kk, pose: "swingA" };
    if (t < 31.85) return { ...kk, pose: "swingB" };
    if (t < T.beckon + 0.6) return { ...kk, pose: "tired", heave: 0.5 + 0.5 * Math.sin(t * 7) };
    return { ...kk, pose: "idle" };
  }
  if (t < T.kite) { const u = (t - T.runOff) / (T.kite - T.runOff), a0 = kiteAngle(T.kite) - 1.6; return { ...k, x: COL_X * u + 2.6 * Math.cos(a0) * u, z: 4.6 + (COL_Z + 2.6 * Math.sin(a0) - 4.6) * u, pose: "run", phase: (t * 2.2) % 1 }; }
  if (t < T.stopKite) {
    const slow = 1 - 0.3 * smooth((t - T.drain) / 1.8), a = kiteAngle(T.kite) - 1.6 + (kiteAngle(t) - kiteAngle(T.kite)) * slow;
    return { ...k, x: COL_X + 2.6 * Math.cos(a), z: COL_Z + 2.6 * Math.sin(a), pose: "run", phase: (t * 2.2 * slow) % 1, mirror: Math.sin(a) > 0 };
  }
  if (t < T.charge) {
    const slow = 0.7, a = kiteAngle(T.kite) - 1.6 + (kiteAngle(T.stopKite) - kiteAngle(T.kite)) * slow;
    return { ...k, x: COL_X + 2.6 * Math.cos(a), z: COL_Z + 2.6 * Math.sin(a), pose: "tired", heave: 0.5 + 0.5 * Math.sin(t * 8) };
  }
  if (t < T.impact) { const [x, z] = chargePos(t); return { ...k, x, z, pose: id === 16 || id === 17 ? "back" : "run", phase: (chargeClock(t) * 1.9) % 1 }; }
  return { ...k, x: 0, z: WALL_Z - 0.3, pose: "splat", eyes: 0, dent: 1, sy: 1, on: t < T.poof + 0.15 };
};
const putKnight = (cam: CamInfo, out: Stage, s: KnS) => {
  if (!s.on) return;
  const d = cam.pos.distanceTo(tmp.set(s.x, 2.2, s.z)) / KS, [w0, , k0] = tier(d), k = Math.min(k0, 2.4), w = Math.round((1000 * k * Math.min(w0, 1800)) / (600 * k0));
  const light = light2D(cam, s.mirror);
  const key = `kn|${s.pose}|${q(s.phase, 12)}|${q(s.heave, 6)}|${q(s.eyes, 8)}|${s.dent}|${light}`;
  out.places.push({ key, x: s.x, y: D0, z: s.z, scale: KS, mirror: s.mirror, geo: "wide", size: [w, w, w / 1000],
    draw: (p) => knight(p, { pose: s.pose, phase: q(s.phase, 12), heave: q(s.heave, 6), eyes: q(s.eyes, 8), dent: s.dent, light }) });
  if (s.pose !== "splat") blob(out, s.x, D0, s.z, 2.4);
};

// ---- the bedroom ----
const room = (id: number, cam: CamInfo, t: number, out: Stage) => {
  if (id === 2) {
    const expr = at(t, [[5.0, "grin"], [6.3, "laugh"], [7.6, "smile"]], "smile");
    put(cam, t, out, { i: 1, o: LEO_HOME, okey: "leoH", x: RX + 0.55, z: 0.8, fo: { mode: "stand", expr, prop: "helmet", look: 0, headTilt: -3 } });
  } else {
    const expr = at(t, [[T.helmetOn, "smile"], [T.lightsOut, "grin"]], "neutral");
    const on = t >= T.helmetOn;
    put(cam, t, out, { i: 1, o: on ? LEO_VR : LEO_HOME, okey: on ? "leoVR" : "leoH", x: RX - 1.15, z: 0.9, fo: { mode: "sit", expr, prop: on ? null : "helmet", look: 1 } });
  }
};

// ---- the hall ----
const hall = (id: number, cam: CamInfo, t: number, out: Stage) => {
  // Léo
  const L = leoAt(t);
  put(cam, t, out, { i: 1, o: LEO_GAME, okey: "leoG", x: L.x, y: L.y, z: L.z, roll: L.roll || undefined,
    fo: { mode: L.mode, phase: L.phase, expr: leoExpr(t), prop: L.prop, facing: L.facing, wave: L.wave, look: L.look } });
  if (t >= T.land && t < T.land + 0.5) { const u = q((t - T.land) / 0.5, 15); fx(out, `puff${u}`, (p) => fxPuff(p, u), 0, 0.3, 2.3, 1.6, 1.6, true); }
  if (t >= T.jump + 0.45 && t < T.jump + 0.9) { const u = q((t - T.jump - 0.45) / 0.45, 15); fx(out, `puff${u}`, (p) => fxPuff(p, u), 0, 0.25, 1.1, 1.0, 1.0, true); }
  if (t >= T.side + 0.35 && t < T.side + 0.8) { const u = q((t - T.side - 0.35) / 0.45, 15); fx(out, `puff${u}`, (p) => fxPuff(p, u), 1.9, 0.25, 14.9, 1.0, 1.0, true); }
  if (L.mode === "march") { const u = q(((t * 2.4) % 1), 10); fx(out, `puff${u}`, (p) => fxPuff(p, u), L.x, 0.2, L.z + 0.1, 0.6, 0.6, true); }

  // the knight
  const K = knightAt(t, id);
  putKnight(cam, out, K);
  // floor cracks left by the blows (persist)
  if (t >= T.hit1) flatFx(out, "crack1", (p) => fxCrack(p, 1), 0, 3.25, 1.6, 0.4);
  if (t >= T.hit2) flatFx(out, "crack2", (p) => fxCrack(p, 2), -1.3, 4.3, 1.5, 1.2);
  for (const [h, x, z] of [[T.hit1, 0, 3.25], [T.hit2, -1.3, 4.3]] as const) {
    if (t >= h && t < h + 0.5) {
      const u = q((t - h) / 0.5, 15);
      fx(out, `burst${u}`, (p) => fxBurst(p, u), x, 0.5, z - 0.1, 2.4);
      fx(out, `chunk${u}`, (p) => fxChunks(p, u), x, 0.6, z - 0.15, 2.0);
      fx(out, `puff${u}`, (p) => fxPuff(p, u), x, 0.35, z - 0.2, 1.8, 1.8, true);
    }
  }
  if (t >= T.sweep && t < T.sweep + 0.32) { const u = q((t - T.sweep) / 0.32, 12); fx(out, `slash${u}`, (p) => fxSlash(p, u), 0.7, 2.0, 2.4, 3.2, 3.2, true); }
  // steam from the visor while he pants
  if (K.pose === "tired") for (let i = 0; i < 2; i++) {
    const u = q(((t * 0.9 + i * 0.5) % 1), 12);
    fx(out, `puff${u}`, (p) => fxPuff(p, u), K.x + (i ? 0.35 : -0.3), 2.75 + 0.6 * u, K.z - 0.3, 0.9 + 0.5 * u, 0.9 + 0.5 * u, true);
  }
  if (K.pose === "run" || K.pose === "back") { const u = q(((t * 1.9) % 1), 10); fx(out, `puff${u}`, (p) => fxPuff(p, u), K.x, 0.3, K.z - 0.2, 1.4, 1.4, true); }
  // the crash
  if (t >= T.impact && t < T.impact + 0.6) {
    const u = q((t - T.impact) / 0.6, 18);
    fx(out, `burst${u}`, (p) => fxBurst(p, u), 0, 2.2, WALL_Z - 0.5, 5.0);
    fx(out, `chunk${u}`, (p) => fxChunks(p, u), 0, 2.4, WALL_Z - 0.6, 4.0);
  }
  if (t >= T.impact && t < T.impact + 1.6) { const u = q((t - T.impact) / 1.6, 20); fx(out, `puff${u}`, (p) => fxPuff(p, u), 0.2, 1.0 + u, WALL_Z - 0.7, 3.5 + 1.5 * u, 3.5 + 1.5 * u, true); }
  if (K.pose === "splat" && K.sy >= 1) { const u = q(((t - T.impact) * 0.7) % 1, 16); fx(out, `stars${u}`, (p) => fxStars(p, u), 0, 3.4, WALL_Z - 0.55, 1.8); }
  if (t >= T.poof && t < T.poof + 0.8) {
    const u = q((t - T.poof) / 0.8, 16);
    fx(out, `burst${u}w`, (p) => fxBurst(p, u, "#bff3ff", 14), 0, 2.0, WALL_Z - 0.5, 5.5);
    fx(out, `stars${u}`, (p) => fxStars(p, u), 0, 2.4, WALL_Z - 0.6, 4.5);
  }
  if (t >= T.lvl && t < T.lvl + 0.7) { const u = q((t - T.lvl) / 0.7, 14); fx(out, `burst${u}y`, (p) => fxBurst(p, u, "#ffe28a", 12), 1.9, 1.3, 14.8, 3.0); }
  void fxEyesGlow; void S;
};

/** everything with a face in shot `id` at time t */
export const stage = (id: number, t0: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1], t = poseTime(id, t0);
  LNAME = s.light;
  findSun(cam, SUN);
  if (s.env === "room") room(id, cam, t, out);
  if (s.env === "hall") hall(id, cam, t, out);
  return out;
};
export { FPS, smooth, clamp01 };

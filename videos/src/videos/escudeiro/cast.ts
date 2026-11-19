// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, fxBurst, fxStars, fxPuff, fxShadow, fxContact, boar,
  Outfit, Expr, FrontOpts, SideOpts, Prop,
} from "./toon";
import { FPS, D0, SHOTS, V3, smooth, clamp01, T, RX, FZ, S, boarX } from "./story";
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
  scale?: number; mirror?: boolean; yaw?: number; geo?: "body" | "swing"; roll?: number; pitch?: number; size?: [number, number, number];
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
let LNAME: "day" | "golden" | "night" = "day";
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
const CONTACT: Record<"day" | "golden" | "night", [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33], night: [0.3, 0.3, 0.45] };
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


// ---------------- Escudeiro cast ----------------
const SK = "#e8bf98";
const ANDRE_HOME: Outfit = { jacket: "#8d9099", pants: "#3b4560", boots: "#e9e6df", hat: "hair", hair: "#2a201a", skin: SK };
const ANDRE_VR: Outfit = { ...ANDRE_HOME, hat: "vr" };
const ANDRE_TUNIC: Outfit = { jacket: "#d9c7a0", pants: "#6b5a46", boots: "#5a3b2a", hat: "hair", hair: "#2a201a", skin: SK };
const ANDRE_GAME: Outfit = { jacket: "#9a6440", pants: "#5b4a3a", boots: "#4a3426", hat: "hair", hair: "#2a201a", belt: "#4a3020", pads: "#7a4f33", skin: SK };
const KAEL: Outfit = { jacket: "#2f5f9a", pants: "#2f3a52", boots: "#3a2a22", dress: "#2f5f9a", hat: "hood", hood: "#264f86", moustache: "#dcdcdc", staff: true, skin: "#f0c8a0" };
const SKINS_ = ["#ffe2c2", "#f5c9a0", "#ecd0b6", "#c99067"];
const PLAYER = (v: number): Outfit => {
  const sk = SKINS_[v % 4];
  switch (v % 4) {
    case 0: return { jacket: "#9aa3ad", pants: "#4a4f5a", boots: "#3a2a22", hat: "cap", cap: "#7d848c", pads: "#c9ced6", sword: true, skin: sk };            // warrior
    case 1: return { jacket: ["#8c3b8a", "#b8343a", "#3a6fb5"][v % 3], pants: "#3b3f52", boots: "#3a2a22", dress: ["#7b2f7a", "#9c2e33", "#2f5f9a"][v % 3], hat: "hood", hood: ["#6a2868", "#86282d", "#284f86"][v % 3], staff: v % 2 === 1, skin: sk }; // mage
    case 2: return { jacket: "#4f7a3a", pants: "#5b4a3a", boots: "#4a3426", hat: "hood", hood: "#3f6a2e", belt: "#6b4a2a", skin: sk };                   // archer
    default: return { jacket: "#3a2f4a", pants: "#2a2433", boots: "#1e1a24", hat: "hood", hood: "#2e2540", belt: "#5a4a6a", skin: sk };                 // assassin
  }
};

type PersonArgs = { i: number; o: Outfit; okey: string; x: number; y?: number; z: number; fo: FrontOpts; scale?: number; roll?: number; pitch?: number; yaw?: number; noBlob?: boolean };
const put = (cam: CamInfo, t: number, out: Stage, a: PersonArgs) => {
  const who: Who = { i: a.i, o: a.o, okey: a.okey };
  const fo: FrontOpts = { blink: lidAt(t, a.i), ...a.fo };
  const pl = person(cam, who, a.x, a.y ?? D0, a.z, { side: false, mirror: false }, fo, {}, a.scale ?? 1);
  if (a.roll) pl.roll = a.roll;
  if (a.pitch !== undefined) { pl.pitch = a.pitch; pl.yaw = a.yaw ?? 0; }
  out.places.push(pl);
  if (!a.noBlob) blob(out, a.x, D0, a.z, a.scale ?? 1);
};
const at = (t: number, rows: [number, Expr][], def: Expr): Expr => { let e = def; for (const [s0, x] of rows) if (t >= s0 - LEAD) e = x; return e; };

/** the boar: a side-view card scaled to ~1.3 m, mirrored when it faces screen-left */
const BOAR_SC = 1.2;
const putBoar = (cam: CamInfo, out: Stage, x: number, y: number, z: number, faceLeft: boolean, mode: "stand" | "run" | "stunned", run: number, scrape = 0) => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 0.6, z)) / BOAR_SC, [w, h, k] = tier(d);
  const r = q(run, 8), sc = q(scrape, 12), light = light2D(cam, faceLeft);
  out.places.push({ key: `boar|${mode}|${r}|${sc}|${light}`, x, y, z, scale: BOAR_SC, mirror: faceLeft, size: [w, h, k], draw: (p) => boar(p, r, mode, sc, light) });
  if (y < 0.05) blob(out, x, D0, z, 1.6);
};
const fx = (out: Stage, key: string, draw: (p: Pen) => void, x: number, y: number, z: number, w: number, h = w) =>
  out.fx.push({ key, cw: 500, ch: 500, draw, x, y, z, w, h });

// ---- room ----
const room = (id: number, cam: CamInfo, t: number, out: Stage) => {
  if (id === 1) {
    const expr = at(t, [[1.6, "grin"], [4.0, "laugh"]], "smile");
    put(cam, t, out, { i: 1, o: ANDRE_HOME, okey: "andreH", x: RX + 0.55, z: 0.8, fo: { mode: "stand", expr, prop: "helmet", look: 0, headTilt: -3 } });
  } else if (id === 2) {
    const expr = at(t, [[9.3, "shock"], [10.3, "stern"], [11.6, "pained"]], "smile_closed");
    put(cam, t, out, { i: 1, o: ANDRE_HOME, okey: "andreH", x: RX - 1.15, z: 0.9, fo: { mode: "sit", expr, prop: "phone", look: 0.6, headTilt: t > 10.3 ? -6 : -2 } });
  } else if (t < T.deitou) {
    const expr = at(t, [[13.8, "stern"], [T.helmetOn, "smile"]], "neutral");
    put(cam, t, out, { i: 1, o: t >= T.helmetOn ? ANDRE_VR : ANDRE_HOME, okey: t >= T.helmetOn ? "andreVR" : "andreH", x: RX - 1.15, z: 0.9,
      fo: { mode: "sit", expr, prop: t >= T.helmetOn ? null : "helmet", look: 1 } });
  } else {
    put(cam, t, out, { i: 1, o: ANDRE_VR, okey: "andreVR", x: RX - 0.3, y: 0.69, z: 1.8, pitch: -Math.PI / 2, yaw: Math.PI / 2, noBlob: true, fo: { mode: "stand", expr: "smile" } });
  }
};

// ---- plaza ----
const SPOTS: [number, number, number][] = [ // x, z, stroll speed (0 = stands)
  [-5.5, 6.5, 0], [-3.2, 9.5, 0], [-1.2, 12.5, 0], [2.4, 10.5, 0], [4.6, 7.2, 0], [6.8, 11.5, 0], [-7.6, 12.8, 0], [8.8, 5.2, 0],
  [-2.6, 4.2, 0.6], [3.4, 15.5, -0.5], [-9.5, 4.0, 0], [10.4, 14.0, 0], [0.6, 18.5, 0.4], [-5.0, 17.0, 0], [5.6, 19.0, 0],
  [-3.6, -6.5, 0], [3.2, -8.0, 0], [-6.5, -9.0, 0.5],
];
const plaza = (id: number, cam: CamInfo, t: number, out: Stage) => {
  SPOTS.forEach(([x0, z, v], i) => {
    const x = x0 + v * (t - 32);
    const expr = (["smile", "grin", "neutral", "smile_closed", "laugh", "whistle"] as Expr[])[i % 6];
    const o = PLAYER(i);
    put(cam, t, out, { i: 100 + i, o, okey: `pl${i}`, x, z, fo: { mode: v ? "stroll" : "stand", phase: ((t * 1.8 + i * 0.3) % 1), expr, facing: v > 0 ? 1 : v < 0 ? -1 : 0,
      wave: i % 7 === 3 ? q(Math.sin(t * 6 + i), 20) : undefined } });
  });
  const armor = t >= T.pick + 0.4;
  let expr: Expr = at(t, [[33.5, "shock"], [35.0, "smile"], [T.pick, "grin"]], "dazed");
  if (id === 6) expr = at(t, [[44.6, "nervous"]], "smile");
  if (id === 7) expr = at(t, [[T.shieldIn + 0.25, "shock"], [T.shieldIn + 1.3, "pained"], [49.6, "relief"]], "neutral");
  const prop: Prop = id === 7 && t >= T.shieldIn ? ["shield", 0] : null;
  const wave = id === 5 && t >= 37 && t < T.pick + 0.6 ? q(smooth((t - 37.8) / 1.2), 20) : undefined;
  put(cam, t, out, { i: 1, o: armor ? ANDRE_GAME : ANDRE_TUNIC, okey: armor ? "andreG" : "andreT", x: 0, z: 0,
    fo: { mode: "stand", expr, prop, wave, look: id === 5 && t > 35 ? 0.6 : 0, tilt: id === 7 && t > T.shieldIn + 0.2 ? -4 * smooth((t - T.shieldIn - 0.2) / 0.4) : 0 } });
  if (t >= T.pick + 0.2 && t < T.pick + 0.9) { const u = q((t - T.pick - 0.2) / 0.7, 20); fx(out, `stars${u}`, (p) => fxStars(p, u), 0, 1.2, -0.2, 2.2); }
  if (id === 7 && t >= T.shieldIn - 0.3 && t < T.shieldIn + 0.7) { const u = q((t - T.shieldIn + 0.3) / 1.0, 20); fx(out, `stars${u}`, (p) => fxStars(p, u), -0.45, 0.95, -0.25, 1.3); }
};

// ---- forest ----
const AX = -2.2, KX = -0.5;               // André's spot in the clearing (x, relative to FZ on z)
const V_CHARGE = 4.0, X0 = 4.6, X_HIT = -1.0, X_BACK = 0.6;
/** boar x along the charge (time excluding the freeze) and its leap height */
const boarRun = (t: number) => {
  const tt = t < T.freeze ? t - T.charge : T.freeze - T.charge + Math.max(0, t - T.resume), x = boarX(t);
  const u = clamp01((tt - 0.85) / 0.55), y = 0.5 * Math.sin(Math.PI * u);
  return { x, y };
};
const forest = (id: number, cam: CamInfo, t: number, out: Stage) => {
  // André
  let k = 0, expr: Expr = "neutral", facing: -1 | 0 | 1 = -1;
  if (id === 9) expr = at(t, [[64.0, "stern"], [T.scrape, "nervous"], [T.charge, "shock"]], "neutral");
  if (id === 10) { expr = "shock"; k = 0; }
  if (id === 11) { k = smooth((t - T.raise) / 0.25); expr = at(t, [[T.impact, "pained"], [76.4, "shock"], [77.4, "relief_open"], [79.2, "grin"]], "stern"); }
  if (id === 12) {
    k = t < 82.5 ? 1 - smooth((t - 81.5) / 1) : 0;
    expr = at(t, [[84.0, "smile"], [86.2, "grin"], [89.1, "neutral"], [91.0, "stern"], [93.1, "smile"], [97.4, "nervous"], [99.2, "shock"], [101.0, "nervous"]], "relief");
  }
  if (id === 13) { k = 0.55; expr = "nervous"; facing = 0; }
  const ax = id === 13 ? 0 : AX;
  put(cam, t, out, { i: 1, o: ANDRE_GAME, okey: "andreG", x: ax, z: FZ, fo: { mode: "stand", expr, prop: ["shield", q(k, 20)], facing, look: id === 13 ? 0 : -0.7 } });

  // the boar
  if (id === 9 || id === 10 || id === 11) {
    if (t < T.charge) {
      const sc = t >= T.scrape ? ((t - T.scrape) / 0.9) % 1 : 0;
      putBoar(cam, out, X0, D0, FZ + 0.5, false, "stand", 0, t >= T.scrape ? sc : 0);
      if (t >= T.scrape) { const u = q(((t - T.scrape) % 0.9) / 0.9, 15); fx(out, `puff${u}`, (p) => fxPuff(p, u), X0 + 0.9, 0.25, FZ + 0.4, 0.9); }
    } else if (t < T.impact) {
      const { x, y } = boarRun(t), ph = t < T.freeze ? ((t - T.charge) * 3.2) % 1 : ((T.freeze - T.charge) * 3.2) % 1;
      putBoar(cam, out, x, y, FZ + 0.5, false, "run", ph);
      if (t < T.freeze) { const u = q(((t - T.charge) * 2) % 1, 12); fx(out, `puff${u}`, (p) => fxPuff(p, u), x + 1.2, 0.2, FZ + 0.4, 0.8); }
    } else {
      const u = clamp01((t - T.impact) / 0.55), x = X_HIT + (X_BACK - X_HIT) * easeOutQ(u), y = 0.45 * Math.sin(Math.PI * u);
      putBoar(cam, out, x, y, FZ + 0.5, false, u < 1 ? "run" : "stunned", 0.25);
      if (t < T.impact + 0.35) { const v = q((t - T.impact) / 0.35, 12); fx(out, `burst${v}`, (p) => fxBurst(p, v), AX + 0.6, 0.9, FZ - 0.1, 2.4); }
      if (u >= 1) { const v = q(((t - T.impact - 0.55) * 0.8) % 1, 16); fx(out, `stars${v}`, (p) => fxStars(p, v), x - 0.6, 1.35, FZ + 0.4, 1.1); }
    }
  }
  if (id === 12) {
    // the stunned boar staggers off into the trees
    const u = clamp01((t - 81.3) / 2.6);
    if (u < 1) putBoar(cam, out, X_BACK + 6 * u, D0, FZ + 0.5 + 7 * u, true, u > 0 ? "run" : "stunned", (t * 1.6) % 1);
    // Kael walks in from the left, claps, then talks
    const w = clamp01((t - T.kaelIn) / (T.kaelStop - T.kaelIn)), kx = 5.0 + (KX - 5.0) * w;
    const walking = w > 0 && w < 1;
    const clap = t >= T.kaelStop && t < T.clapEnd ? ["clap", q(Math.abs(Math.sin((t - T.kaelStop) * Math.PI * 3.2)), 10)] as Prop : null;
    const kexpr = at(t, [[85.4, "grin"], [86.1, "laugh"], [88.9, "smile"], [91.0, "neutral"], [93.1, "smile"], [97.1, "stern"], [99.0, "smile"]], "smile_closed");
    if (t >= T.kaelIn) put(cam, t, out, { i: 2, o: KAEL, okey: "kael", x: kx, z: FZ + 0.25, fo: { mode: walking ? "stroll" : "stand", phase: (t * 1.7) % 1, expr: kexpr, facing: 1, prop: clap, look: 0.8 } });
  }
  if (id === 13) {
    putBoar(cam, out, 1.6, D0, FZ + 1.3, false, "stand", 0, ((t - 104) / 0.9) % 1);
    putBoar(cam, out, -1.6, D0, FZ + 1.3, true, "stand", 0, ((t - 104.4) / 0.9) % 1);
  }
};
const easeOutQ = (u: number) => 1 - (1 - clamp01(u)) ** 3;

/** everything with a face in shot `id` at time t */
export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  if (s.env === "room") room(id, cam, t, out);
  if (s.env === "plaza") plaza(id, cam, t, out);
  if (s.env === "forest") forest(id, cam, t, out);
  return out;
};
export { FPS, smooth, clamp01 };

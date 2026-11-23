// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, KID, townsfolk, fxBurst, fxSplash, fxStars, fxCreak, fxRing, fxShadow, fxContact, INK,
  Outfit, Expr, FrontOpts, SideOpts,
} from "./toon";
import { FPS, D0, QY, SHOTS, V3, smooth, clamp01, camAt, ShipState, BIKE, bikeState, T_RUN, T_THIRD, T_STOP, T_HEEL, T_WATER, T_BREEZE, T_DOWN, T_TOP, T_LOW, T_WIND, T_FALL, T_SALT, T_LIFT } from "./story";
import { DECK, hullW, PORT_X, PORT_Y } from "./ship";
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
  scale?: number; mirror?: boolean; yaw?: number; geo?: "body" | "swing"; roll?: number; size?: [number, number, number];
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
let LNAME: "day" | "golden" = "day";
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
const SWAPS: Record<number, number[]> = { 4: [T_STOP], 6: [T_HEEL], 7: [T_FALL] };
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
const CONTACT: Record<"day" | "golden", [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33] };
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME === "day") {
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
export type BikePose = { pos: V3; yaw: number; lean: number; fridge: V3; fridgeRot: V3 };
export type Stage = { places: Place[]; fx: FxPlace[]; bike?: BikePose };


// ---------------- Vasa cast ----------------
const SKINS_ = ["#ffe2c2", "#f5c9a0", "#ecd0b6", "#c99067"];
const SAILOR = (v: number): Outfit => ({ jacket: ["#3f6fb5", "#d9c7a0", "#8c3b4a", "#5d7a3a"][v % 4], pants: ["#5b4a3a", "#3b3f52"][v % 2], boots: INK, hat: "cap", cap: ["#c0353a", "#2f5f6a", "#e8dcc0"][v % 3], skin: SKINS_[v % 4], moustache: v % 3 === 1 ? "#4a3020" : undefined });
const CAPTAIN: Outfit = { jacket: "#2c3e6e", pants: "#3b3f52", boots: INK, hat: "tophat", sash: "#e8c45a", sword: true, moustache: "#4a3020", build: "stout", skin: SKINS_[0] };
const MODERN = (v: number): Outfit => {
  const tees = ["#e2453c", "#3f6fb5", "#f3d35a", "#2f8a4f", "#f08a2c", "#7b5ac9"], hairs = ["#5a3b2a", "#2a201a", "#c9893a", "#4a3020"];
  return { jacket: tees[v % 6], pants: ["#3b5b9a", "#3b3f52", "#d9c7a0"][v % 3], boots: "#f4f1ea", hat: "hair", hair: hairs[v % 4], skin: SKINS_[v % 4] };
};
const SIXTIES = (v: number): Outfit => ({ jacket: ["#8a6a4a", "#3f5f8a", "#a8724a", "#5d6e58"][v % 4], pants: "#3b3f52", boots: "#3a2a22", hat: v % 3 ? "hair" : "cap", hair: ["#5a3b2a", "#2a201a", "#c9893a"][v % 3], cap: "#5a5a60", skin: SKINS_[v % 4] });

let SHIP_M = new THREE.Matrix4(), SHIP: ShipState | null = null;
export const setShip = (m: THREE.Matrix4, st: ShipState) => { SHIP_M = m; SHIP = st; };
const onShip = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyMatrix4(SHIP_M);

/** a ground spot in front of the shot's FIRST camera (stable through glides): d metres ahead, lat to the right */
const spot = (id: number, d: number, lat: number, y = QY): V3 => {
  const c = camAt(id, SHOTS[id - 1].a);
  let fx = c.look[0] - c.pos[0], fz = c.look[2] - c.pos[2];
  const n = Math.hypot(fx, fz); fx /= n; fz /= n;
  const rx = -fz, rz = fx; // right = forward x up
  return [c.pos[0] + fx * d + rx * lat, y, c.pos[2] + fz * d + rz * lat];
};

// ---------------- effect drawings ----------------
/** three wind swooshes on a 600 x 300 canvas; t 0..1 slides them along */
const fxWind = (p: Pen, t: number) => {
  for (let k = 0; k < 3; k++) {
    const y = 70 + k * 80, x0 = 40 + ((t * 260 + k * 70) % 200), pts: [number, number][] = [];
    for (let i = 0; i <= 16; i++) { const u = i / 16; pts.push([x0 + u * 320, y + 16 * Math.sin(u * 6 + k)]); }
    const c = 1 - Math.abs(t - 0.5) * 1.6;
    if (c <= 0) continue;
    p.line(pts, "#ffffff", 14 * c + 2);
    const e = pts[16]; p.arc(e[0] + 20, e[1] - 22, 22, 22, 90, 360, 12 * c + 2, "#ffffff");
  }
};
/** a fat down arrow (heavy) on a 300 x 400 canvas */
const fxArrow = (p: Pen, col: string) => {
  p.poly([[110, 20], [190, 20], [190, 220], [270, 220], [150, 380], [30, 220], [110, 220]], col, 14);
};
/** the shipworm: a pale grub with a big face; sick = green, x eyes, tongue out. 500 x 250, facing right */
const fxWorm = (p: Pen, sick: number, wig: number) => {
  const body = sick > 0.5 ? "#b9d77a" : "#f3c6b0", dark = sick > 0.5 ? "#8aa850" : "#d89a86";
  for (let i = 6; i >= 0; i--) {
    const x = 70 + i * 52, y = 130 + 18 * Math.sin(wig + i * 0.9), r = 46 - Math.abs(i - 4) * 4;
    p.ell(x, y, r, r * 0.9, i % 2 ? body : dark, 9);
  }
  const hx = 400, hy = 128 + 18 * Math.sin(wig + 6.3);
  p.ell(hx, hy, 62, 56, body, 10);
  if (sick > 0.5) {
    for (const ex of [378, 428]) { p.stroke([[ex - 12, hy - 28], [ex + 12, hy - 6]], 8); p.stroke([[ex + 12, hy - 28], [ex - 12, hy - 6]], 8); }
    p.ell(404, hy + 26, 22, 12, "#3a1a22", 7); p.ell(412, hy + 40, 12, 14, "#e86a7a", 6);
  } else {
    for (const ex of [378, 428]) { p.ell(ex, hy - 16, 17, 20, "#ffffff", 7); p.dot(ex + 5, hy - 14, 8); }
    p.arc(404, hy + 18, 22, 14, 10, 170, 8);
  }
};
const fxBubble = (p: Pen) => { p.ell(60, 60, 44, 44, "rgba(220,250,255,0.35)", 6); p.ell(46, 44, 10, 8, "#ffffff", 0); };

// ---------------- crowds ----------------
/** spectators standing on the quay at the edge of frame, side views facing the subject */
const watchers = (cam: CamInfo, id: number, t: number, out: Stage, shockAt: number) => {
  const list: [number, number, boolean][] = id === 1 ? [[7.5, -2.2, false], [8.6, -1.4, false], [9.5, -2.6, false], [8.2, 2.3, true]]
    : [[8, 2.1, true], [9.2, 1.4, true], [10.4, 2.6, true], [9, -2.4, false]];
  list.forEach(([d, lat, mir], i) => {
    const [x, y, z] = spot(id, d, lat);
    const who: Who = { i: i + 100, o: townsfolk(i + 1), okey: `town${i + 1}` };
    const shocked = t >= shockAt - LEAD;
    const expr: Expr = shocked ? (["shock", "nervous", "shock", "dazed"] as Expr[])[i % 4] : (["grin", "smile", "neutral", "grin"] as Expr[])[i % 4];
    const so: SideOpts = { mode: "stand", expr, blink: lidAt(t, i + 100, SWAPS[id]) };
    out.places.push(person(cam, who, x, y, z, { side: true, mirror: mir }, {}, so));
    blob(out, x, y, z);
  });
};
/** the town on the quay cheering (front views waving, a kid hopping) */
const cheer = (cam: CamInfo, id: number, t: number, out: Stage, modern = false) => {
  const spots: [number, number][] = [[6.5, -1.8], [7.2, -0.4], [6.8, 1.2], [8.6, 2.4], [9.4, -2.9], [10.2, 0.4], [11.5, -1.2], [12.4, 2.0], [8.0, -3.6], [13.5, 3.4]];
  spots.forEach(([d, lat], i) => {
    const [x, y, z] = spot(id, d, lat);
    if (z > -35.6 && !modern) return;
    const kid = i % 5 === 2, o = kid ? KID : modern ? SIXTIES(i) : townsfolk(i), who: Who = { i: i + 200, o, okey: kid ? "kid" : `${modern ? "s" : "t"}${i}` };
    const hop = kid ? Math.max(0, Math.sin(t * 8 + i)) * 0.18 : 0;
    const expr: Expr = (["laugh", "grin", "laugh", "smile", "grin"] as Expr[])[i % 5];
    const fo: FrontOpts = { mode: "stand", expr, wave: q(Math.sin(t * 9 + i * 1.3), 30), blink: lidAt(t, i + 200) };
    out.places.push(person(cam, who, x, y + hop, z, { side: false, mirror: false }, fo, {}, kid ? 0.72 : 1));
    blob(out, x, y, z, kid ? 0.72 : 1, hop > 0 ? 0.6 : 1);
  });
};
/** S4: the stability test. 12 sailors run across the waist together, the captain watches; on "parar" all stop. */
const tri = (u: number) => { const f = ((u % 1) + 1) % 1; return f < 0.5 ? f * 4 - 1 : 3 - f * 4; };
const sailors = (cam: CamInfo, t: number, out: Stage) => {
  const heel = THREE.MathUtils.degToRad(SHIP?.heel ?? 0);
  const ph = (t - T_RUN + 0.35) / 1.9 - 0.25; // their mass leads the roll by a quarter period
  const tStop = Math.min(t, T_STOP + 0.05);
  const zNow = (tt: number) => (tt < T_RUN ? 0 : -3.3 * Math.max(-1, Math.min(1, 1.25 * tri((tt - T_RUN + 0.35) / 1.9 - 0.25 + 0.25))));
  for (let i = 0; i < 12; i++) {
    const row = i % 4, col = Math.floor(i / 4);
    const x = -6 + row * 3.2 + (hh(i) - 0.5) * 0.8, z0 = (col - 1) * 1.4;
    const z = t < T_RUN ? z0 : zNow(tStop) + (col - 1) * 1.1 + (hh(i, 3) - 0.5) * 0.4;
    const vz = zNow(tStop + 0.03) - zNow(tStop);
    const p = onShip(x, DECK, z);
    const who: Who = { i: i + 600, o: SAILOR(i), okey: `sail${i % 4}` };
    const stopped = t >= T_STOP - LEAD;
    let pl: Place & { tierKey: string };
    if (t < T_RUN || stopped || Math.abs(vz) < 0.002) {
      const expr: Expr = stopped ? (["dazed", "nervous", "shock", "dazed"] as Expr[])[i % 4] : (["grin", "laugh", "whistle", "grin"] as Expr[])[i % 4];
      pl = person(cam, who, p.x, p.y, p.z, { side: false, mirror: false }, { mode: stopped && i % 3 === 0 ? "fall" : "stand", expr, blink: lidAt(t, i + 600, SWAPS[4]) }, {});
    } else {
      const expr: Expr = t > T_THIRD ? (["nervous", "laugh", "shock"] as Expr[])[i % 3] : (["laugh", "grin", "laugh"] as Expr[])[i % 3];
      pl = person(cam, who, p.x, p.y, p.z, { side: true, mirror: vz < 0 }, {}, { mode: "march", phase: ((t * 2.6 + hh(i)) % 1), expr, stomp: 1, stride: 1.3, blink: lidAt(t, i + 600) });
    }
    pl.roll = heel;
    out.places.push(pl);
  }
  // the captain on the main deck by the castle
  const cp = onShip(-8.4, DECK, -3.9);
  const alarmed = t >= T_THIRD + 0.5;
  const cfo: FrontOpts = { mode: "stand", expr: t >= T_STOP - LEAD ? "shock" : alarmed ? "nervous" : "stern", wave: t >= T_STOP - LEAD ? 1 : undefined, blink: lidAt(t, 690, SWAPS[4]) };
  const cpl = person(cam, { i: 690, o: CAPTAIN, okey: "captain" }, cp.x, cp.y, cp.z, { side: false, mirror: false }, cfo, {});
  cpl.roll = heel; out.places.push(cpl);
  // the hull groans on the big roll
  if (t > T_THIRD + 0.6 && t < T_STOP + 0.5) {
    const m = onShip(-0.5, DECK + 3, 1.2), u = q(((t - T_THIRD) * 3) % 1, 20);
    out.fx.push({ key: `creak${u}`, cw: 300, ch: 300, draw: (pp) => fxCreak(pp, u), x: m.x, y: m.y, z: m.z, w: 2.4, h: 2.4 });
  }
  if (t >= T_STOP && t < T_STOP + 0.4) {
    const u = q((t - T_STOP) / 0.4, 30), m = onShip(-8.4, DECK + 2.6, -3.9);
    out.fx.push({ key: `burst${u}`, cw: 500, ch: 500, draw: (pp) => fxBurst(pp, u), x: m.x, y: m.y, z: m.z, w: 2.6, h: 2.6 });
  }
};
/** water pouring into the low gun ports: splash crowns along the port side waterline */
const splashes = (t: number, t0: number, out: Stage, n = 7) => {
  for (let k = 0; k < n; k++) {
    const ts = t0 + k * 0.22, u = (t - ts) / 1.1;
    if (u < 0 || u >= 1) continue;
    const i = 2 + k * 2, x0 = PORT_X(i), p = onShip(x0, PORT_Y(i), -hullW(x0, PORT_Y(i))), rail = onShip(x0, 7, -hullW(x0, 7)), uq = q(u, 24);
    out.fx.push({ key: `splash${uq}`, cw: 800, ch: 800, draw: (pp) => fxSplash(pp, uq), x: p.x, y: 2.6, z: Math.min(p.z, rail.z) - 1.2, w: 6.5, h: 6.5 });
  }
};
const wind = (t: number, t0: number, pos: V3, w: number, out: Stage) => {
  const u = (t - t0) / 1.2;
  if (u < 0 || u >= 1) return;
  const uq = q(u, 30);
  out.fx.push({ key: `wind${uq}`, cw: 600, ch: 300, draw: (p) => fxWind(p, uq), x: pos[0] + u * w * 0.3, y: pos[1], z: pos[2], w, h: w / 2 });
};

/** S7: the bike with the fridge on the rider's head */
const biker = (cam: CamInfo, t: number, out: Stage) => {
  const bs = bikeState(t), yaw = 0.38, lean = THREE.MathUtils.degToRad(bs.lean);
  const bx = BIKE[0], by = BIKE[1], bz = BIKE[2];
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)); // the bike's right (local +x)
  const lift = (h: number) => new THREE.Vector3(bx, by, bz).addScaledVector(right, h * Math.sin(lean)).setY(by + h * Math.cos(lean));
  const sgn = right.dot(cam.right) >= 0 ? -1 : 1;
  const down = bs.down, k = bs.fall;
  const expr: Expr = down ? "dazed" : t >= T_WIND ? "shock" : t >= T_TOP ? "nervous" : "grin";
  const base = lift(0.15);
  const pl = person(cam, { i: 800, o: { jacket: "#3f6fb5", pants: "#3b3f52", boots: "#f4f1ea", hat: "hair", hair: "#5a3b2a", skin: SKINS_[1] }, okey: "rider" },
    base.x, base.y, base.z, { side: false, mirror: false }, { mode: "march", phase: down ? 0.25 : (t * 1.6) % 1, expr, lift: 40, blink: lidAt(t, 800, SWAPS[7]) }, {});
  pl.roll = sgn * lean;
  out.places.push(pl);
  blob(out, bx, by, bz, 1.1);
  // fridge: sits on the head (bike-local y 2.12), tumbles off on the fall
  out.bike = { pos: [bx, by, bz], yaw, lean: bs.lean, fridge: [0.6 * k, 1.9 - 0.25 * k, -0.05 - 0.4 * k], fridgeRot: [0.3 * k, 0, -0.9 * k] };
  // heavy-up-here arrow, little-down-there arrow
  if (t >= T_TOP - 0.05 && t < T_LOW - 0.1) {
    const u = clamp01((t - T_TOP + 0.05) / 0.25), top = lift(4.3 + 0.35 * (1 - u));
    out.fx.push({ key: "arrowBig", cw: 300, ch: 400, draw: (p) => fxArrow(p, "#e2453c"), x: top.x, y: top.y, z: top.z, w: 0.9, h: 1.2 });
  }
  if (t >= T_LOW - 0.05 && t < T_LOW + 1.1) {
    const p0 = lift(1.25);
    out.fx.push({ key: "arrowSmall", cw: 300, ch: 400, draw: (p) => fxArrow(p, "#f3d35a"), x: p0.x + 0.5, y: p0.y, z: p0.z, w: 0.3, h: 0.4 });
  }
  wind(t, T_WIND - 0.1, [bx - 2.6, by + 2.2, bz + 0.5], 2.6, out);
  if (t >= T_FALL + 0.3 && t < T_FALL + 0.7) {
    const u = q((t - T_FALL - 0.3) / 0.4, 30);
    out.fx.push({ key: `burst${u}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, u), x: bx + 0.9, y: by + 0.4, z: bz + 0.2, w: 2.0, h: 2.0 });
  }
  if (down) {
    const u = q((t * 0.8) % 1, 30), h = lift(1.95);
    out.fx.push({ key: `stars${u}`, cw: 420, ch: 210, draw: (p) => fxStars(p, u), x: h.x, y: h.y + 0.25, z: h.z, w: 0.9, h: 0.45 });
  }
};
/** S8: the crowd at the quay edge, facing the water, staring at the mast tops */
const stare = (cam: CamInfo, t: number, out: Stage) => {
  for (let i = 0; i < 11; i++) {
    const x = 18 + i * 1.55 + (hh(i) - 0.5) * 0.6, z = -36.4 - (i % 3) * 1.1, kid = i % 6 === 4;
    const who: Who = { i: i + 900, o: kid ? KID : townsfolk(i + 2), okey: kid ? "kid" : `town${i + 2}` };
    const expr: Expr = (["shock", "pained", "dazed", "shock", "nervous"] as Expr[])[i % 5];
    out.places.push(person(cam, who, x, QY, z, { side: false, mirror: false }, { mode: "stand", expr, blink: lidAt(t, i + 900), look: (i % 3) - 1 }, {}, kid ? 0.72 : 1));
    blob(out, x, QY, z, kid ? 0.72 : 1);
  }
};
/** S9: the shipworm swims up to the hull, tastes the water, turns green and flees */
const worm = (t: number, out: Stage) => {
  const t0 = 1046 / FPS, ta = T_SALT - 0.15;
  const k1 = smooth((t - t0) / (ta - t0)), k2 = smooth((t - ta - 0.35) / 1.2), flee = t > ta + 0.25;
  const A: V3 = [17, -26.2, -10.5], Bp: V3 = [9.2, -26.7, -7.6], C: V3 = [20, -24.8, -12];
  const p = flee ? A.map((_, i) => Bp[i] + (C[i] - Bp[i]) * k2) : A.map((_, i) => A[i] + (Bp[i] - A[i]) * k1);
  const sick = t > ta ? 1 : 0, wig = q(t * 9, 6);
  out.fx.push({ key: `worm${sick}${wig}`, cw: 500, ch: 250, draw: (pp) => fxWorm(pp, sick, wig), x: p[0], y: p[1], z: p[2], w: flee ? -2.8 : 2.8, h: 1.4, rot: flee ? 0.15 : -0.05 });
  for (let k = 0; k < 6; k++) {
    const u = ((t * 0.35 + k / 6) % 1);
    out.fx.push({ key: "bubble", cw: 120, ch: 120, draw: fxBubble, x: 6 + k * 2.3, y: -30 + u * 9, z: -7 - (k % 3), w: 0.35 + (k % 2) * 0.2, h: 0.35 + (k % 2) * 0.2, soft: true });
  }
};
/** S11: tourists in front of the ship, posing */
const tourists = (cam: CamInfo, id: number, t: number, out: Stage) => {
  const spots: [number, number][] = [[6.2, -1.6], [6.8, -0.2], [6.4, 1.3], [8.2, 2.4], [8.8, -2.6], [9.6, 0.6], [10.8, -1.0]];
  spots.forEach(([d, lat], i) => {
    const [x, , z] = spot(id, d, lat, 0);
    const kid = i % 4 === 2, o = kid ? KID : MODERN(i), who: Who = { i: i + 300, o, okey: kid ? "kid" : `m${i}` };
    const expr: Expr = (["grin", "laugh", "smile_closed", "grin"] as Expr[])[i % 4];
    const fo: FrontOpts = { mode: "stand", expr, wave: i % 2 ? q(Math.sin(t * 7 + i), 30) : 1, blink: lidAt(t, i + 300), look: i % 2 ? 0 : 1 };
    out.places.push(person(cam, who, x, 0, z, { side: false, mirror: false }, fo, {}, kid ? 0.72 : 1));
    blob(out, x, 0, z, kid ? 0.72 : 1);
  });
};

/** everything with a face (and the effects) in shot `id` at time t */
export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  switch (id) {
    case 1: watchers(cam, id, t, out, 0); splashes(t, 0.8, out, 12); break;
    case 2: cheer(cam, id, t, out); break;
    case 4: sailors(cam, t, out); break;
    case 5: cheer(cam, id, t, out); break;
    case 6: {
      watchers(cam, id, t, out, T_HEEL);
      splashes(t, T_WATER - 0.1, out, 9);
      wind(t, T_BREEZE - 0.15, [40, 22, -8], 16, out);
      if (t > T_DOWN) for (let k = 0; k < 3; k++) {
        const u = (t - T_DOWN - k * 0.25) / 1.4;
        if (u > 0 && u < 1) { const uq = q(u, 24); out.fx.push({ key: `splash${uq}`, cw: 800, ch: 800, draw: (pp) => fxSplash(pp, uq), x: 22 + k * 8, y: 2.5, z: -6, w: 9, h: 9 }); }
      }
      break;
    }
    case 7: biker(cam, t, out); break;
    case 8: stare(cam, t, out); break;
    case 9: worm(t, out); break;
    case 10: {
      cheer(cam, id, t, out, true);
      for (let k = 0; k < 6; k++) {
        const u = ((t - T_LIFT + 1.2) * 0.8 + k / 6) % 1;
        if (t < T_LIFT - 1.2) continue;
        const uq = q(u, 24);
        out.fx.push({ key: `splash${uq}`, cw: 800, ch: 800, draw: (pp) => fxSplash(pp, uq), x: -16 + k * 6.5, y: 0.9, z: -6.5, w: 3.6, h: 3.6 });
      }
      break;
    }
    case 11: tourists(cam, id, t, out); break;
  }
  return out;
};
export { FPS, smooth, clamp01, D0 };

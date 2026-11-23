// The Vasa as a posable three.js group. Local frame: origin on the waterline amidships, bow toward +x, port side
// toward -z, y up. Hull from parametric sections (tumblehome, a high stern castle), a painted transom, 2 x 16 gun
// ports per side (the port side's lids and cannons animate), three masts with braced yards, bellying square sails,
// pennants and the big blue-and-yellow ensign at the stern. pose() places it per frame from story.ts ShipState.
import * as THREE from "three";
import { Batch, V, lam, boxGeo } from "./build";
import { ctex } from "./paint";
import { ShipState, portOpen } from "./story";

export const KEEL = -4.6;
export const DECK = 6.2;   // main deck height (local)
export const QDECK = 11.6; // quarterdeck height (stern castle)
const smoothstep = (a: number, b: number, x: number) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
/** rail (top of the bulwark) along the hull: a gentle sheer, then the stern castle rises */
export const railY = (x: number) => 6.9 + 0.0022 * x * x + (13.2 - 6.9) * smoothstep(-8.5, -12.5, x) + 1.0 * smoothstep(16, 22, x);
const keelY = (x: number) => KEEL + Math.max(0, x - 13) * 0.48 + Math.max(0, -x - 20) * 0.5;
const halfB = (x: number) => x >= 0 ? 5.9 * Math.pow(Math.max(0, 1 - (x / 22.6) ** 2), 0.55) : 5.9 * (0.72 + 0.28 * Math.sqrt(Math.max(0, 1 - (x / 24) ** 2)));
const prof = (v: number) => (v < 0.6 ? Math.pow(Math.sin((v / 0.6) * Math.PI / 2), 0.55) : 1 - 0.17 * ((v - 0.6) / 0.4) ** 1.5);
/** half width of the hull at station x, height y (local) */
export const hullW = (x: number, y: number) => {
  const k = keelY(x), r = railY(x), v = Math.max(0, Math.min(1, (y - k) / (r - k)));
  return halfB(x) * prof(v);
};
export const X0 = -24, X1 = 22.6;

// ---------------- paint ----------------
const Y0 = -5, Y1 = 14.5;
/** hull sides: dark oiled planks, a black wale, the red-and-gold upper works */
const hullTex = () => ctex("vasaHull", 2048, 1024, (g, r) => {
  const H = 1024, yOf = (y: number) => H - ((y - Y0) / (Y1 - Y0)) * H;
  g.fillStyle = "#6d4429"; g.fillRect(0, 0, 2048, H);
  for (let y = Y0; y < Y1; y += 0.32) {
    const py = yOf(y);
    g.fillStyle = `rgba(${90 + r() * 30},${55 + r() * 18},${32 + r() * 12},0.55)`; g.fillRect(0, py - 9, 2048, 9);
    g.fillStyle = "rgba(35,20,12,0.55)"; g.fillRect(0, py, 2048, 1.6);
    for (let x = r() * 300; x < 2048; x += 260 + r() * 200) g.fillRect(x, py - 9, 2, 9);
  }
  // black wales between and above the gun rows
  for (const y of [0.9, 3.25, 5.55]) { g.fillStyle = "#2a1c16"; g.fillRect(0, yOf(y + 0.16), 2048, yOf(y - 0.16) - yOf(y + 0.16)); }
  // upper works: red field with gold mouldings
  g.fillStyle = "#a3342c"; g.fillRect(0, 0, 2048, yOf(6.0));
  g.fillStyle = "#e0b04a";
  g.fillRect(0, yOf(6.15), 2048, 7); g.fillRect(0, yOf(8.0), 2048, 5); g.fillRect(0, yOf(10.5), 2048, 5);
  for (let x = 20; x < 2048; x += 64) { g.beginPath(); g.ellipse(x, yOf(6.9), 9, 12, 0, 0, 7); g.fill(); }
});
/** the stern: carved gold figures on red and blue, windows, the royal arms */
const transomTex = () => ctex("vasaTransom", 512, 1024, (g) => {
  g.fillStyle = "#6d4429"; g.fillRect(0, 0, 512, 1024);
  g.fillStyle = "#a3342c"; g.fillRect(30, 40, 452, 560);
  g.fillStyle = "#2f4f9a"; g.fillRect(150, 90, 212, 200);
  g.fillStyle = "#e0b04a";
  g.lineWidth = 14; g.strokeStyle = "#e0b04a"; g.strokeRect(30, 40, 452, 560); g.strokeRect(150, 90, 212, 200);
  // crown + lions holding the arms
  g.beginPath(); g.moveTo(196, 150); g.lineTo(216, 110); g.lineTo(236, 150); g.lineTo(256, 100); g.lineTo(276, 150); g.lineTo(296, 110); g.lineTo(316, 150); g.closePath(); g.fill();
  g.fillRect(196, 150, 120, 24);
  g.beginPath(); g.ellipse(256, 228, 52, 46, 0, 0, 7); g.fill();
  g.fillStyle = "#2f4f9a"; g.beginPath(); g.ellipse(256, 228, 30, 26, 0, 0, 7); g.fill();
  g.fillStyle = "#e0b04a";
  for (const x of [88, 424]) { g.beginPath(); g.ellipse(x, 200, 40, 90, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(x, 100, 34, 30, 0, 0, 7); g.fill(); }
  // two rows of stern windows
  for (const y of [360, 470]) for (let i = 0; i < 5; i++) {
    g.fillStyle = "#e0b04a"; g.fillRect(64 + i * 80, y - 8, 64, 86);
    g.fillStyle = "#1d1a24"; g.fillRect(72 + i * 80, y, 48, 70);
  }
  for (let x = 40; x < 480; x += 36) { g.fillStyle = "#e0b04a"; g.beginPath(); g.arc(x, 600, 14, 0, 7); g.fill(); }
});
const sailTex = () => ctex("vasaSail", 512, 512, (g, r) => {
  g.fillStyle = "#f3ead6"; g.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 42) { g.fillStyle = "rgba(150,130,100,0.35)"; g.fillRect(x, 0, 3, 512); }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(190,170,140,${0.08 + r() * 0.08})`; g.fillRect(r() * 512, r() * 512, 60 + r() * 120, 30 + r() * 60); }
  g.fillStyle = "rgba(120,100,80,0.5)"; g.fillRect(0, 0, 512, 10); g.fillRect(0, 502, 512, 10);
});
export const ensignTex = () => ctex("swedenFlag", 320, 200, (g) => {
  g.fillStyle = "#2c5fb0"; g.fillRect(0, 0, 320, 200);
  g.fillStyle = "#f2c230"; g.fillRect(100, 0, 40, 200); g.fillRect(0, 80, 320, 40);
});
const pennantTex = () => ctex("pennant", 64, 512, (g) => {
  g.fillStyle = "#2c5fb0"; g.fillRect(0, 0, 64, 512);
  g.fillStyle = "#f2c230"; g.fillRect(0, 0, 64, 90); g.fillRect(24, 0, 16, 512);
});

const seg = (b: Batch, mat: THREE.Material, a: THREE.Vector3, c: THREE.Vector3, r: number, n = 6) => {
  const d = c.clone().sub(a), L = d.length();
  const g = new THREE.CylinderGeometry(r, r, L, n, 1, true);
  g.translate(0, L / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize());
  b.add(g, mat, new THREE.Matrix4().compose(a, q, V(1, 1, 1)));
};
const cylAt = (r0: number, r1: number, y0: number, y1: number, n = 12) => new THREE.CylinderGeometry(r1, r0, y1 - y0, n).translate(0, (y0 + y1) / 2, 0);

type Port = { lid: THREE.Group; gun: THREE.Mesh; zs: number; i: number };
type Sail = { mesh: THREE.Mesh; base: Float32Array; w: number; h: number };
type Flag = { mesh: THREE.Mesh; base: Float32Array; len: number; amp: number };
export const MASTS = [{ x: 13, top: 42, low: 23 }, { x: -0.5, top: 50, low: 26 }, { x: -15.5, top: 33, low: 21 }];
export const PORT_X = (i: number) => -9 + (i % 16) * 1.62;
export const PORT_Y = (i: number) => (i < 16 ? 2.05 : 4.4);
const BRACE = THREE.MathUtils.degToRad(40);

export class Ship {
  root = new THREE.Group();
  private ports: Port[] = [];
  private sails: Sail[] = [];
  private flags: Flag[] = [];
  private full = new THREE.Group();   // topmasts, yards, sails, pennants
  private lower = new THREE.Group();  // lower masts + tops (always)
  private furled = new THREE.Group(); // furled sails on the yards (sails 0)
  private sailG = new THREE.Group();
  constructor() {
    const R = this.root;
    R.matrixAutoUpdate = false;
    const hull = lam("vasaHull", () => ({ map: hullTex(), side: THREE.DoubleSide }));
    const dark = lam("vasaDark", () => ({ color: "#3a261a" }));
    const deckM = lam("vasaDeck", () => ({ color: "#b98c5c" }));
    const gold = lam("vasaGold", () => ({ color: "#e8b54a" }));
    const red = lam("vasaRed", () => ({ color: "#b8382e" }));
    const hole = lam("vasaHole", () => ({ color: "#120e12" }));
    const spar = lam("vasaSpar", () => ({ color: "#7a5236" }));
    const rope = lam("vasaRope", () => ({ color: "#4a3426" }));
    const iron = lam("vasaIron", () => ({ color: "#2e2e34" }));
    const canvasM = lam("vasaSail", () => ({ map: sailTex(), side: THREE.DoubleSide }));
    const furlM = lam("vasaFurl", () => ({ color: "#e4d8bd" }));
    const b = new Batch();

    // ---- hull shell: NX stations x NV rings per side ----
    const NX = 64, NV = 26, pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (const s of [-1, 1]) {
      const o = pos.length / 3;
      for (let i = 0; i <= NX; i++) {
        const x = X0 + ((X1 - X0) * i) / NX, k = keelY(x), r = railY(x);
        for (let j = 0; j <= NV; j++) {
          const y = k + ((r - k) * j) / NV;
          pos.push(x, y, s * hullW(x, y));
          uv.push((x - X0) / 12, (y - Y0) / (Y1 - Y0));
        }
      }
      for (let i = 0; i < NX; i++) for (let j = 0; j < NV; j++) {
        const a = o + i * (NV + 1) + j, c = a + NV + 1;
        if (s < 0) idx.push(a, c, a + 1, a + 1, c, c + 1); else idx.push(a, a + 1, c, a + 1, c + 1, c);
      }
    }
    const hg = new THREE.BufferGeometry();
    hg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    hg.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    hg.setIndex(idx); hg.computeVertexNormals();
    const hm = new THREE.Mesh(hg, hull);
    hm.castShadow = true; hm.receiveShadow = true; R.add(hm);

    // ---- transom (flat stern) from the last section's outline ----
    const sh = new THREE.Shape(), kx = keelY(X0), rx = railY(X0);
    const outline: [number, number][] = [];
    for (let j = 0; j <= NV; j++) { const y = kx + ((rx - kx) * j) / NV; outline.push([-hullW(X0, y), y]); }
    for (let j = NV; j >= 0; j--) { const y = kx + ((rx - kx) * j) / NV; outline.push([hullW(X0, y), y]); }
    sh.moveTo(outline[0][0], outline[0][1]); for (const [z, y] of outline.slice(1)) sh.lineTo(z, y);
    const tg = new THREE.ShapeGeometry(sh);
    const tp = tg.attributes.position, tuv: number[] = [];
    const wT = hullW(X0, 6) + 0.2;
    for (let i = 0; i < tp.count; i++) tuv.push((tp.getX(i) + wT) / (2 * wT), (tp.getY(i) - 0.5) / (rx + 0.4 - 0.5));
    tg.setAttribute("uv", new THREE.Float32BufferAttribute(tuv, 2));
    tg.rotateY(-Math.PI / 2).translate(X0 - 0.02, 0, 0);
    b.add(tg, lam("vasaTransom", () => ({ map: transomTex(), side: THREE.DoubleSide })));

    // ---- decks, castle front bulkhead, hatches, capstan ----
    const deckShape = (xa: number, xb: number, y: number) => {
      const s2 = new THREE.Shape(), n = 24;
      for (let i = 0; i <= n; i++) { const x = xa + ((xb - xa) * i) / n; const w = hullW(x, y) - 0.15; if (i) s2.lineTo(x, -w); else s2.moveTo(x, -w); }
      for (let i = n; i >= 0; i--) { const x = xa + ((xb - xa) * i) / n; s2.lineTo(x, hullW(x, y) - 0.15); }
      return new THREE.ShapeGeometry(s2).rotateX(-Math.PI / 2).translate(0, y, 0);
    };
    b.add(deckShape(-11.2, 21.8, DECK), deckM);
    b.add(deckShape(X0 + 0.05, -10.6, QDECK), deckM);
    // bulkhead: the front of the castle, with two doors
    const bw = hullW(-10.8, 9) - 0.1;
    b.add(boxGeo(V(-11.0, DECK, -bw), V(-10.6, QDECK + 0.05, bw)), lam("vasaBulk", () => ({ color: "#8a5a38" })));
    for (const z of [-2.2, 2.2]) b.add(boxGeo(V(-10.62, DECK, z - 0.6), V(-10.5, DECK + 2.1, z + 0.6)), dark);
    b.add(boxGeo(V(-10.5, QDECK - 0.3, -bw), V(-10.3, QDECK + 0.9, bw)), gold); // castle front rail
    for (const x of [3.5, 8, -6]) b.add(boxGeo(V(x - 1.2, DECK, -1.4), V(x + 1.2, DECK + 0.35, 1.4)), dark);
    b.add(cylAt(0.55, 0.45, DECK, DECK + 1.3), spar, new THREE.Matrix4().makeTranslation(-4.5, 0, 0));
    // gold ornaments: castle crown rail, lanterns, figurehead lion, bow rail
    for (let x = X0 + 0.4; x < -11; x += 1.1) for (const s of [-1, 1]) b.add(new THREE.SphereGeometry(0.22, 10, 8), gold, new THREE.Matrix4().makeTranslation(x, railY(x) + 0.2, s * (hullW(x, railY(x)) - 0.1)));
    for (const z of [-2.4, 0, 2.4]) {
      b.add(cylAt(0.35, 0.45, 0, 1.4, 10), gold, new THREE.Matrix4().makeTranslation(X0 + 0.5, railY(X0) + 0.6, z));
      b.add(new THREE.ConeGeometry(0.5, 0.8, 10).translate(0, 2.4, 0), gold, new THREE.Matrix4().makeTranslation(X0 + 0.5, railY(X0) + 0.6, z));
    }
    b.add(new THREE.SphereGeometry(1.0, 14, 10).scale(1.5, 1, 0.8), gold, new THREE.Matrix4().makeTranslation(X1 + 0.9, 4.6, 0)); // lion
    b.add(new THREE.SphereGeometry(0.6, 12, 8), gold, new THREE.Matrix4().makeTranslation(X1 + 2.0, 5.6, 0));
    // bowsprit
    seg(b, spar, V(18, DECK + 1, 0), V(34, 15, 0), 0.38, 10);
    // ---- gun ports: both rows, both sides; port side lids + cannons animate ----
    const lidOut = lam("vasaLid", () => ({ color: "#5a3520" }));
    for (let i = 0; i < 32; i++) {
      const x = PORT_X(i), y = PORT_Y(i);
      for (const s of [-1, 1]) {
        const w = hullW(x, y);
        b.add(boxGeo(V(x - 0.36, y - 0.36, s * w - 0.06), V(x + 0.36, y + 0.36, s * w + 0.06)), hole);
        if (s > 0) b.add(boxGeo(V(x - 0.42, y - 0.42, w + 0.04), V(x + 0.42, y + 0.42, w + 0.12)), lidOut);
      }
      const w = hullW(x, y), lid = new THREE.Group();
      const outer = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.84, 0.06).translate(0, -0.42, -0.04), lidOut);
      const inner = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.78, 0.03).translate(0, -0.42, 0.005), red);
      const mask = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8).scale(1, 1, 0.4).translate(0, -0.42, -0.09), gold);
      for (const m of [outer, inner, mask]) { m.castShadow = true; m.receiveShadow = true; lid.add(m); }
      lid.position.set(x, y + 0.42, -w - 0.1);
      R.add(lid);
      const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 2.4, 12).rotateX(Math.PI / 2), iron);
      gun.castShadow = true; gun.receiveShadow = true;
      R.add(gun);
      this.ports.push({ lid, gun, zs: -w, i });
    }

    // ---- masts: lower masts + tops always; topmasts, yards, sails, rigging in `full` ----
    const lb = new Batch(), fb = new Batch(), ub = new Batch();
    for (const m of MASTS) {
      const y0 = m.x < -11 ? QDECK : DECK;
      lb.add(cylAt(0.62, 0.48, y0 - 0.5, m.low + 1.5, 14), spar, new THREE.Matrix4().makeTranslation(m.x, 0, 0));
      lb.add(cylAt(1.8, 1.8, m.low, m.low + 0.35, 20), spar, new THREE.Matrix4().makeTranslation(m.x, 0, 0)); // top
      lb.add(cylAt(1.85, 1.85, m.low + 0.35, m.low + 1.0, 20).scale(1, 1, 1), lam("vasaTopRim", () => ({ color: "#a3342c" })), new THREE.Matrix4().makeTranslation(m.x, 0, 0));
      fb.add(cylAt(0.4, 0.22, m.low, m.top, 12), spar, new THREE.Matrix4().makeTranslation(m.x, 0, 0));
      // shrouds: rail to the top, 5 a side
      for (const s of [-1, 1]) for (let k = 0; k < 5; k++) {
        const xr = m.x - 1.6 + k * 0.8, yr = railY(xr);
        seg(lb, rope, V(xr, yr, s * (hullW(xr, yr) + 0.1)), V(m.x + (k - 2) * 0.12, m.low, s * 1.5), 0.05, 4);
        seg(fb, rope, V(m.x + (k - 2) * 0.3, m.low + 0.8, s * 1.7), V(m.x, m.top - 4, s * 0.25), 0.04, 4);
      }
    }
    // stays (fore-and-aft lines)
    seg(lb, rope, V(MASTS[1].x, MASTS[1].low, 0), V(MASTS[0].x, DECK + 1, 0), 0.07, 5);
    seg(lb, rope, V(MASTS[0].x, MASTS[0].low, 0), V(30, 13.5, 0), 0.07, 5);
    seg(lb, rope, V(MASTS[2].x, MASTS[2].low, 0), V(MASTS[1].x, DECK + 1, 0), 0.06, 5);
    seg(fb, rope, V(MASTS[1].x, MASTS[1].top - 3, 0), V(MASTS[0].x, MASTS[0].low + 1, 0), 0.05, 4);
    seg(fb, rope, V(MASTS[0].x, MASTS[0].top - 3, 0), V(33, 14.6, 0), 0.05, 4);
    lb.build(this.lower); fb.build(this.full);
    // yards + sails, braced: each yard group turns about its mast
    const yards: [number, number, number, number][] = [ // mast, yard height, yard length, sail drop
      [1, 26.2, 21, 9.6], [1, 40, 15, 10.4], [0, 23.2, 18.5, 8.6], [0, 35, 13, 9.4], [2, 29, 9, 6.6],
    ];
    for (const [mi, y, len, drop] of yards) {
      const m = MASTS[mi], g = new THREE.Group();
      g.position.set(m.x, y, 0); g.rotation.y = BRACE;
      const yb = new Batch();
      seg(yb, spar, V(0, 0, -len / 2), V(0, 0, len / 2), 0.22, 10);
      yb.build(g);
      // sail: PlaneGeometry in the y-z plane facing +x, top on the yard
      const w = len - 1.2, sg = new THREE.PlaneGeometry(w, drop, 12, 8).rotateY(Math.PI / 2).translate(0.15, -drop / 2 - 0.2, 0);
      const sm = new THREE.Mesh(sg, canvasM); sm.castShadow = true; sm.receiveShadow = true;
      g.add(sm);
      this.sails.push({ mesh: sm, base: Float32Array.from(sg.attributes.position.array as Float32Array), w, h: drop });
      const fz = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, w, 10).rotateX(Math.PI / 2).translate(0.1, -0.45, 0), furlM);
      fz.castShadow = true;
      const fg = new THREE.Group(); fg.position.copy(g.position); fg.rotation.y = BRACE; fg.add(fz);
      this.furled.add(fg);
      this.sailG.add(g);
    }
    this.full.add(this.sailG, this.furled);
    // pennants at the mast heads, the ensign on its staff at the stern
    const pm = new THREE.MeshLambertMaterial({ map: pennantTex(), side: THREE.DoubleSide });
    for (const m of MASTS) {
      const pg = new THREE.PlaneGeometry(0.9, 9, 1, 12).rotateZ(Math.PI / 2).translate(-4.5, 0, 0);
      const pmsh = new THREE.Mesh(pg, pm); pmsh.position.set(m.x, m.top + 0.2, 0);
      this.full.add(pmsh);
      this.flags.push({ mesh: pmsh, base: Float32Array.from(pg.attributes.position.array as Float32Array), len: 9, amp: 0.8 });
    }
    seg(ub, spar, V(X0 - 0.3, railY(X0) - 1, 0), V(X0 - 1.6, railY(X0) + 8, 0), 0.12, 8);
    ub.build(this.root);
    const eg = new THREE.PlaneGeometry(5.5, 3.4, 10, 4).translate(-2.75, 0, 0);
    const em = new THREE.Mesh(eg, new THREE.MeshLambertMaterial({ map: ensignTex(), side: THREE.DoubleSide }));
    em.position.set(X0 - 1.5, railY(X0) + 6.2, 0);
    R.add(em);
    this.flags.push({ mesh: em, base: Float32Array.from(eg.attributes.position.array as Float32Array), len: 5.5, amp: 0.45 });
    b.build(R);
    R.add(this.lower, this.full);
    for (const g of [this.lower, this.full]) g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }

  /** place and animate the ship */
  pose(st: ShipState, t: number) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-THREE.MathUtils.degToRad(st.heel), st.yaw, -THREE.MathUtils.degToRad(st.pitch), "YZX"));
    this.root.matrix.compose(V(st.x, st.y, st.z), q, V(1, 1, 1));
    this.root.matrixWorldNeedsUpdate = true;
    this.full.visible = st.rig === "full";
    this.sailG.visible = st.sails > 0.5;
    this.furled.visible = st.sails <= 0.5;
    // the ensign only flies with the flag on; pennants belong to the full rig
    this.flags[this.flags.length - 1].mesh.visible = st.flag > 0;
    for (const p of this.ports) {
      const k = st.ports < 0 ? portOpen(p.i, t, 9.9) : st.ports;
      const g = st.guns < 0 ? portOpen(p.i, t, 10.15) : st.guns;
      p.lid.rotation.x = THREE.MathUtils.degToRad(84) * k;
      p.gun.position.set(PORT_X(p.i), PORT_Y(p.i), p.zs + 0.9 - 1.25 * g);
      p.gun.visible = g > 0.02;
    }
    // sails belly: max at mid width and a bit below the yard
    for (const s of this.sails) {
      const a = s.mesh.geometry.attributes.position as THREE.BufferAttribute, B = s.base;
      for (let i = 0; i < a.count; i++) {
        const z = B[i * 3 + 2], y = B[i * 3 + 1];
        const u = 1 - (2 * z / s.w) ** 2, v = Math.sin(Math.min(1, -y / (s.h + 0.2)) * Math.PI * 0.85);
        a.setX(i, B[i * 3] + st.bulge * 1.9 * u * v + 0.08 * Math.sin(t * 5 + z));
      }
      a.needsUpdate = true; s.mesh.geometry.computeVertexNormals();
    }
    for (const f of this.flags) {
      const a = f.mesh.geometry.attributes.position as THREE.BufferAttribute, B = f.base;
      for (let i = 0; i < a.count; i++) {
        const x = B[i * 3], d = Math.min(1, -x / f.len);
        a.setZ(i, B[i * 3 + 2] + f.amp * d * Math.sin(t * 7 + x * 1.1));
        a.setY(i, B[i * 3 + 1] - 0.25 * d * f.len * 0.15);
      }
      a.needsUpdate = true; f.mesh.geometry.computeVertexNormals();
    }
  }
}

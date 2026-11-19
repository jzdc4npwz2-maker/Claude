// The Piazza: lawn, marble paving, cathedral, baptistery, city wall, houses and hills, plus the tower built floor by
// floor as a kinematic chain (each floor sits on the top of the one below, leaning, the upper ones bent back).
// Sky, light rig, clouds and the character cards work exactly like the bridge short.
import * as THREE from "three";
import { Batch, boxGeo, V, lam, house, Kit, quad, tri } from "./build";
import { rep, ctex, stoneHD, cobbleHD, grassHD, cloudHD, roofHD, brick } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, untone, twoTone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import { FPS, D0, SHOTS, camAt, ShotDef, V3, RX, FZ } from "./story";

export const loadKit = async (): Promise<Kit> => ({});

const discTex = () => ctex("sunDisc", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const SUN_SHOT: Record<number, { az?: number; el?: number }> = { 1: { az: 150, el: 55 }, 2: { az: 140, el: 55 }, 3: { az: 140, el: 60 }, 5: { az: 120 }, 6: { az: 120 }, 7: { az: 115 }, 12: { az: 40, el: 12 }, 13: { az: 150, el: 14 } };

/** horizontal quad facing up at height y covering x0..x1, z0..z1 */
const quadUp = (x0: number, x1: number, z0: number, z1: number, u: number, v: number, y = D0) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z1, x1, y, z0, x0, y, z0], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, u, 0, u, v, 0, 0, u, v, 0, v], 2));
  return g;
};
const cyl = (r0: number, r1: number, h: number, n = 48, open = false) => new THREE.CylinderGeometry(r1, r0, h, n, 1, open).translate(0, h / 2, 0);
const at = (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z);

const wood = () => ctex("roomFloor", 1024, 1024, (g, r) => {
  g.fillStyle = "#8a6242"; g.fillRect(0, 0, 1024, 1024);
  for (let y = 0; y < 1024; y += 128) {
    g.fillStyle = ["#8f6646", "#835c3d", "#946a49", "#7d583b"][(y / 128) % 4]; g.fillRect(0, y, 1024, 124);
    g.fillStyle = "rgba(40,24,16,.7)"; g.fillRect(0, y + 124, 1024, 4);
    const o = (y / 128) % 2 ? 300 : 700; g.fillRect(o, y, 4, 128);
  }
});
const wallTex = (key: string, base: string, stripe: string) => ctex(key, 512, 512, (g) => {
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  g.fillStyle = stripe; for (let x = 0; x < 512; x += 64) g.fillRect(x, 0, 22, 512);
});
const nightWindow = () => ctex("nightWin", 512, 512, (g, r) => {
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, "#0d1638"); gr.addColorStop(1, "#33467e");
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  g.fillStyle = "#fff6d8"; g.beginPath(); g.arc(380, 110, 42, 0, 7); g.fill();
  g.fillStyle = "#33467e"; g.beginPath(); g.arc(398, 98, 38, 0, 7); g.fill();
  for (let i = 0; i < 40; i++) { g.fillStyle = "rgba(255,255,255,.8)"; g.fillRect(r() * 512, r() * 260, 3, 3); }
  // skyline with lit windows
  for (let x = 0; x < 512; x += 46 + Math.floor(r() * 20)) {
    const h = 120 + r() * 160; g.fillStyle = "#161c36"; g.fillRect(x, 512 - h, 44, h);
    for (let y = 512 - h + 12; y < 500; y += 22) for (let wx = x + 6; wx < x + 40; wx += 12) if (r() < 0.45) { g.fillStyle = r() < 0.5 ? "#ffd27a" : "#9fd0ff"; g.fillRect(wx, y, 6, 9); }
  }
  g.strokeStyle = "#e9e4da"; g.lineWidth = 18; g.strokeRect(0, 0, 512, 512); g.beginPath(); g.moveTo(256, 0); g.lineTo(256, 512); g.stroke();
});
const posterTex = () => ctex("poster", 256, 384, (g) => {
  g.fillStyle = "#2a3b6e"; g.fillRect(0, 0, 256, 384);
  g.fillStyle = "#ffc93c"; g.beginPath(); g.moveTo(128, 60); g.lineTo(200, 300); g.lineTo(56, 300); g.closePath(); g.fill();
  g.fillStyle = "#e9e4da"; g.fillRect(118, 140, 20, 150); g.fillRect(88, 280, 80, 14);
  g.strokeStyle = "#111"; g.lineWidth = 10; g.strokeRect(0, 0, 256, 384);
});
const screenTex = () => ctex("monitor", 512, 320, (g) => {
  const gr = g.createLinearGradient(0, 0, 512, 320); gr.addColorStop(0, "#1b5fa8"); gr.addColorStop(1, "#4fd6ff");
  g.fillStyle = gr; g.fillRect(0, 0, 512, 320);
  g.fillStyle = "rgba(255,255,255,.85)"; g.font = "bold 64px sans-serif"; g.textAlign = "center"; g.fillText("VRMMO", 256, 150);
  g.fillStyle = "#ffc93c"; g.fillRect(176, 190, 160, 36);
});
const dirt = () => ctex("dirt", 512, 512, (g) => {
  const gr = g.createRadialGradient(256, 256, 60, 256, 256, 256);
  gr.addColorStop(0, "rgba(176,140,98,1)"); gr.addColorStop(0.75, "rgba(170,136,96,.85)"); gr.addColorStop(1, "rgba(170,136,96,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  g.fillStyle = "rgba(120,92,62,.5)";
  for (let i = 0; i < 70; i++) { const a = i * 2.4, r = 30 + (i * 37) % 200; g.beginPath(); g.ellipse(256 + Math.cos(a) * r, 256 + Math.sin(a) * r, 10, 5, a, 0, 7); g.fill(); }
});
const banner = (col: string) => ctex("banner" + col, 128, 256, (g) => {
  g.fillStyle = col; g.beginPath(); g.moveTo(0, 0); g.lineTo(128, 0); g.lineTo(128, 256); g.lineTo(64, 210); g.lineTo(0, 256); g.closePath(); g.fill();
  g.fillStyle = "#ffc93c"; g.beginPath(); g.arc(64, 90, 30, 0, 7); g.fill();
});
/** inward-facing quad (a b c d counter-clockwise seen from inside) */
const inq = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, u = 1, v = 1) => quad(a, b, c, d, u, v);

const tree = (b: Batch, x: number, z: number, s: number, M: Record<string, THREE.Material>, seed: number) => {
  b.add(cyl(0.35 * s, 0.25 * s, 3.2 * s, 8), M.bark, at(x, D0, z));
  b.add(new THREE.IcosahedronGeometry(2.2 * s, 1), seed % 2 ? M.leafA : M.leafB, at(x, D0 + 4.6 * s, z));
  b.add(new THREE.IcosahedronGeometry(1.6 * s, 1), seed % 3 ? M.leafB : M.leafA, at(x + 0.9 * s, D0 + 5.8 * s, z - 0.4 * s));
  if (seed % 2) b.add(new THREE.IcosahedronGeometry(1.4 * s, 1), M.leafC, at(x - 1.0 * s, D0 + 5.2 * s, z + 0.3 * s));
};
const pine = (b: Batch, x: number, z: number, s: number, M: Record<string, THREE.Material>) => {
  b.add(cyl(0.3 * s, 0.22 * s, 2 * s, 8), M.bark, at(x, D0, z));
  for (let i = 0; i < 3; i++) b.add(new THREE.ConeGeometry((2.4 - i * 0.6) * s, 3 * s, 10).translate(0, 1.5 * s, 0), M.pine, at(x, D0 + (1.6 + i * 1.7) * s, z));
};
const rock = (b: Batch, x: number, z: number, s: number, M: Record<string, THREE.Material>) =>
  b.add(new THREE.DodecahedronGeometry(s, 0), M.rock, new THREE.Matrix4().compose(V(x, D0 + s * 0.35, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, x, 0.2)), V(1.3, 0.75, 1)));

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private sunDisc: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private cloudMaps: Record<"day" | "golden" | "night", THREE.Texture[]>;
  private clouds: THREE.Mesh[] = [];
  private sets: Record<"room" | "plaza" | "forest", THREE.Group> = { room: new THREE.Group(), plaza: new THREE.Group(), forest: new THREE.Group() };
  private glow: THREE.Mesh;
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(_kit: Kit) {
    const R = this.root, M: Record<string, THREE.Material> = {};
    // ---- sky + light (same as the bridge short) ----
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex(), color: new THREE.Color(6.0, 4.4, 2.4), fog: false, depthWrite: false }));
    this.sunDisc.frustumCulled = false; this.sunDisc.layers.set(NOINK); R.add(this.sunDisc);
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    R.add(this.hemi, this.sun, this.sun.target);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)), night: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.night.cloud)) };
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.3, d = 620 + (i % 3) * 60;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 140 + (i % 4) * 30;
      m.position.set(Math.cos(a) * d, 110 + (i % 4) * 40, Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK);
      this.clouds.push(m); R.add(m);
    }

    // ---- materials ----
    M.grass = lam("grassHD", () => ({ map: grassHD() }));
    M.cobble = lam("cobbleHD", () => ({ map: cobbleHD() }));
    M.pave = lam("paveHD", () => ({ map: stoneHD("paveHD", ["#e6dccd", "#ddd3c3", "#ece4d6", "#d6cbba"], "#aea293") }));
    M.stone = lam("fountainStone", () => ({ map: stoneHD("fstoneHD", ["#cfc6b8", "#c4baab", "#d8d0c3", "#bcb2a3"], "#968b7c") }));
    M.water = lam("fountainWater", () => ({ color: "#4fb8d8" }));
    M.bark = lam("bark", () => ({ color: "#8a5a3c" }));
    M.leafA = lam("leafA", () => ({ color: "#62ae4c" }));
    M.leafB = lam("leafB", () => ({ color: "#4f9a43" }));
    M.leafC = lam("leafC", () => ({ color: "#78b857" }));
    M.pine = lam("pine", () => ({ color: "#3f8a4a" }));
    M.rock = lam("rock", () => ({ color: "#a9a49c" }));
    M.post = lam("post", () => ({ color: "#4a3a32" }));
    M.floor = lam("roomFloor", () => ({ map: rep(wood(), 2, 2) }));
    M.wallA = lam("roomWallA", () => ({ map: rep(wallTex("wallA", "#6f7fb0", "#6879a9"), 3, 1) }));
    M.wallB = lam("roomWallB", () => ({ map: rep(wallTex("wallB", "#7887b6", "#7180ae"), 3, 1) }));
    M.bed = lam("bedFrame", () => ({ color: "#6b4a34" }));
    M.blanket = lam("blanket", () => ({ color: "#c0464a" }));
    M.sheet = lam("sheet", () => ({ color: "#e9e6f0" }));
    M.desk = lam("desk", () => ({ color: "#a37752" }));
    M.dark = lam("darkPlastic", () => ({ color: "#2a2d3a" }));
    M.box = lam("cardboard", () => ({ color: "#c69a62" }));
    M.rug = lam("rug", () => ({ color: "#3f5f8a" }));
    const hm = [lam("hillA", () => ({ color: "#78b257" })), lam("hillB", () => ({ color: "#6aa24e" })), lam("hillC", () => ({ color: "#8bbf63" }))];

    // ---- the bedroom (night), 5 x 4.6 m, open ceiling; cameras look toward +z ----
    {
      const b = new Batch(), x0 = RX - 2.5, x1 = RX + 2.5, z0 = -2.6, z1 = 2.5, h = 2.7;
      b.add(quadUp(x0, x1, z0, z1, 1, 1), M.floor);
      b.add(inq(V(x1, 0, z1), V(x0, 0, z1), V(x0, h, z1), V(x1, h, z1), 3, 1), M.wallA);           // back wall (faces -z)
      b.add(inq(V(x0, 0, z1), V(x0, 0, z0), V(x0, h, z0), V(x0, h, z1), 3, 1), M.wallB);           // left wall (faces +x)
      b.add(inq(V(x1, 0, z0), V(x1, 0, z1), V(x1, h, z1), V(x1, h, z0), 3, 1), M.wallB);           // right wall (faces -x)
      b.add(boxGeo(V(x0, 0, z1 - 0.06), V(x1, 0.12, z1)), M.desk);                                     // skirting
      // bed along the back wall, left
      b.add(boxGeo(V(RX - 2.4, 0, 1.2), V(RX - 0.2, 0.32, 2.45)), M.bed);
      b.add(boxGeo(V(RX - 2.35, 0.32, 1.25), V(RX - 0.25, 0.5, 2.4)), M.sheet);
      b.add(boxGeo(V(RX - 1.6, 0.5, 1.22), V(RX - 0.22, 0.56, 2.42)), M.blanket);
      b.add(boxGeo(V(RX - 2.3, 0.5, 1.5), V(RX - 1.75, 0.66, 2.3)), M.sheet);                          // pillow
      b.add(boxGeo(V(RX - 2.45, 0, 1.15), V(RX - 2.35, 0.95, 2.5)), M.bed);                            // headboard
      // desk + monitor on the right, window above the bed's foot
      b.add(boxGeo(V(RX + 1.2, 0.72, 1.6), V(RX + 2.45, 0.78, 2.45)), M.desk);
      for (const [x, z] of [[1.25, 1.65], [2.4, 1.65], [1.25, 2.4], [2.4, 2.4]]) b.add(boxGeo(V(RX + x - 0.03, 0, z - 0.03), V(RX + x + 0.03, 0.72, z + 0.03)), M.desk);
      b.add(boxGeo(V(RX + 1.5, 0.78, 2.2), V(RX + 2.15, 1.2, 2.26)), M.dark);
      b.add(boxGeo(V(RX - 1.1, 0.002, -0.4), V(RX + 0.9, 0.012, 1.1)), M.rug);
      // the open box on the floor
      b.add(boxGeo(V(RX + 0.75, 0, 0.9), V(RX + 1.3, 0.32, 1.4)), M.box);
      b.add(quad(V(RX + 0.75, 0.32, 0.9), V(RX + 1.3, 0.32, 0.9), V(RX + 1.36, 0.6, 0.72), V(RX + 0.7, 0.6, 0.72)), M.box);
      b.build(this.sets.room);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.2), new THREE.MeshBasicMaterial({ map: nightWindow(), fog: false }));
      win.position.set(RX + 0.6, 1.65, z1 - 0.01); win.rotation.y = Math.PI; this.sets.room.add(win);
      const post = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.82), new THREE.MeshBasicMaterial({ map: posterTex(), color: new THREE.Color(0.55, 0.6, 0.85), fog: false }));
      post.position.set(x0 + 0.01, 1.55, 0.2); post.rotation.y = Math.PI / 2; this.sets.room.add(post);
      const mon = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.38), new THREE.MeshBasicMaterial({ map: screenTex(), fog: false }));
      mon.position.set(RX + 1.825, 0.99, 2.19); mon.rotation.y = Math.PI; mon.layers.set(NOINK); this.sets.room.add(mon);
      // the helmet's glow pooled on the floor and walls around André (soft additive disc)
      this.glow = new THREE.Mesh(new THREE.CircleGeometry(1.6, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#2fb8ff", transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.glow.position.set(RX + 0.55, 0.02, 0.8); this.glow.layers.set(NOINK); this.sets.room.add(this.glow);
    }

    // ---- the plaza (day), origin; André stands at (0, 0, 0) facing -z ----
    {
      const b = new Batch();
      b.add(quadUp(-400, 400, -400, 380, 200, 200), M.grass);
      b.add(new THREE.CircleGeometry(22, 72).rotateX(-Math.PI / 2), M.cobble, at(0, D0 + 0.02, 6));
      // fountain behind André
      b.add(cyl(3.2, 3.2, 0.7, 48), M.stone, at(0, D0, 9));
      b.add(new THREE.CircleGeometry(2.9, 48).rotateX(-Math.PI / 2), M.water, at(0, D0 + 0.6, 9));
      b.add(cyl(0.5, 0.4, 2.2, 16), M.stone, at(0, D0, 9));
      b.add(cyl(1.3, 1.3, 0.25, 32), M.stone, at(0, D0 + 2.2, 9));
      b.add(cyl(0.25, 0.2, 1.0, 12), M.stone, at(0, D0 + 2.45, 9));
      // ring of houses facing the square
      let hs = 2;
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2, r = 25 + (i % 3);
        const x = Math.sin(a) * r, z = 6 + Math.cos(a) * r;
        if (z < -6 && Math.abs(x) < 14) continue; // keep the camera side open
        house(b, x, z, a + Math.PI, 9 + (i % 2) * 2, 7, [7, 8.4, 9.8][i % 3], hs++);
      }
      // lamp posts with banners
      for (const [x, z] of [[-6, 2], [6, 2], [-8, 12], [8, 12]]) {
        b.add(cyl(0.09, 0.07, 4.2, 8), M.post, at(x, D0, z));
        b.add(new THREE.SphereGeometry(0.28, 12, 8), lam("lampGlass", () => ({ color: "#ffe9a8" })), at(x, D0 + 4.35, z));
      }
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + 0.2; tree(b, Math.sin(a) * 34, 6 + Math.cos(a) * 34, 1.1 + (i % 3) * 0.15, M, i); }
      ([[-160, 220, 160, 60, 110], [140, 260, 200, 70, 130], [-260, 40, 120, 50, 120], [260, 60, 140, 46, 120]] as const)
        .forEach(([x, z, sx, sy, sz], i) => b.add(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), hm[i % 3], new THREE.Matrix4().compose(V(x, D0 - 2, z), new THREE.Quaternion(), V(sx, sy, sz))));
      b.build(this.sets.plaza);
      for (const [x, z, c] of [[-6, 2, "#c0353a"], [6, 2, "#2f5f9a"], [-8, 12, "#2f8a4f"], [8, 12, "#c0353a"]] as const) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.4), twoTone(new THREE.MeshLambertMaterial({ map: banner(c), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide })));
        m.position.set(x + 0.36, D0 + 3.3, z); this.sets.plaza.add(m);
      }
    }

    // ---- the forest clearing (day / sunset), centred at (0, 0, FZ) ----
    {
      const b = new Batch();
      b.add(quadUp(-400, 400, FZ - 300, FZ + 400, 200, 175), M.grass);
      const d = new THREE.Mesh(new THREE.CircleGeometry(7, 48).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: dirt(), transparent: true, depthWrite: false }));
      twoTone(d.material as THREE.MeshLambertMaterial); d.position.set(0, D0 + 0.03, FZ + 0.5); d.receiveShadow = true; this.sets.forest.add(d);
      let ts = 0;
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2 + 0.13, r = 13 + (i % 4) * 2.5, x = Math.sin(a) * r, z = FZ + 3 + Math.cos(a) * r;
        if (z < FZ - 4 && Math.abs(x) < 9) continue; // the camera side stays open
        if (i % 3 === 0) pine(b, x, z, 1.1 + (i % 2) * 0.2, M); else tree(b, x, z, 1.2 + (i % 3) * 0.2, M, ts++);
      }
      for (let i = 0; i < 40; i++) { const a = i * 2.39996, r = 24 + (i % 7) * 4, x = Math.sin(a) * r, z = FZ + 8 + Math.cos(a) * r; if (z > FZ + 4 || Math.abs(x) > 14) pine(b, x, z, 1.3 + (i % 3) * 0.2, M); }
      for (const [x, z, s2] of [[-6.5, 4.5, 0.6], [6.8, 5.5, 0.8], [-9, -1, 0.5], [9.5, 1.5, 0.45], [3.5, 7.5, 0.4]]) rock(b, x, FZ + z, s2, M);
      ([[-180, FZ + 260, 180, 70, 120], [160, FZ + 300, 220, 90, 140], [0, FZ + 380, 260, 110, 150]] as const)
        .forEach(([x, z, sx, sy, sz], i) => b.add(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), hm[i % 3], new THREE.Matrix4().compose(V(x, D0 - 2, z), new THREE.Quaternion(), V(sx, sy, sz))));
      b.build(this.sets.forest);
    }
    for (const g of Object.values(this.sets)) R.add(g);
  }

  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const az = THREE.MathUtils.degToRad(SUN_SHOT[id]?.az ?? L.az), el = THREE.MathUtils.degToRad(SUN_SHOT[id]?.el ?? L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }
  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene, pf = f) {
    const t = pf / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light];
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.2; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    let Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 14, 110);
    if (s.light === "golden") Rr = Math.max(Rr, 40);
    this.sun.position.copy(focus).addScaledVector(sunDir, 260); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 560; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...LOOK[s.light].bounce); TONE.uSat.value = LOOK[s.light].sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar * 1.4;
    scene.fog = this.fog; scene.background = null;
    this.sunDisc.visible = s.light === "golden" && id !== 13;
    if (this.sunDisc.visible) {
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 900);
      this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(1.7)));
    }
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i];
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      (m.material as THREE.MeshBasicMaterial).map = this.cloudMaps[s.light][i % 4];
    }
    for (const [k, g] of Object.entries(this.sets)) g.visible = k === s.env;
    (this.glow.material as THREE.MeshBasicMaterial).opacity = id === 1 ? 0.22 : id === 2 ? 0.08 : id === 3 ? 0.16 : 0;
    // ---- cast + effects ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stage(id, t, { pos: cam.position, right });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const tint = s.light === "golden" ? "#ffcf9e" : "#ffffff";
    let ai = 0;
    const used: Actor[] = [];
    for (const p of st.places) {
      const sc2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 3.5))) continue;
      const a = this.actor(ai++);
      const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(p.pitch ?? 0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      if (a.mat.emissiveMap) a.mat.emissive.set(tint);
      a.mesh.castShadow = L.actorShadow;
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of st.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h)))) continue;
      const e2 = this.fx(fi++);
      e2.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      e2.use(!!p.soft);
      e2.mesh.visible = true;
      e2.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) e2.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else { e2.mesh.quaternion.copy(cam.quaternion); e2.mesh.rotateZ(p.rot ?? 0); }
      e2.mesh.scale.set(p.w, p.h, 1);
      fused.push(e2);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const e3 of fused) e3.bind();
    return focus;
  }
}
export type { V3 };

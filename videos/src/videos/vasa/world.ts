// Stockholm harbour, 1628: the water (bridge-short shader), the stone quay with the crowd's houses behind it, the town
// across the water (spires, the royal castle, hills), an island, the sea bed for the underwater shot, two salvage
// pontoons (1961) and the museum hall (today). The ship (ship.ts) is posed per frame from story.ts.
// Sky, light rig, clouds and the character cards work exactly like the Pisa / bridge shorts.
import * as THREE from "three";
import { Batch, boxGeo, V, lam, house, Kit } from "./build";
import { rep, ctex, stoneHD, cobbleHD, grassHD, cloudHD, roofHD, waterNear, waterFar } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, untone, LFB } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage, setShip } from "./cast";
import { Ship } from "./ship";
import { FPS, D0, QY, SHOTS, camAt, ShotDef, shipState, V3 } from "./story";

export const loadKit = async (): Promise<Kit> => ({});

const discTex = () => ctex("sunDisc", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const SUN_SHOT: Record<number, { az?: number; el?: number }> = {
  1: { az: 110 }, 2: { az: 115 }, 3: { az: 120, el: 40 }, 4: { az: 70 }, 5: { az: 115 }, 6: { az: 120 }, 7: { az: 125 },
  8: { az: 70 }, 9: { az: 150, el: 70 }, 10: { az: 25, el: 9 }, 11: { az: 140, el: 20 },
};

const quadUp = (x0: number, x1: number, z0: number, z1: number, u: number, v: number, y = D0) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z1, x1, y, z0, x0, y, z0], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, u, 0, u, v, 0, 0, u, v, 0, v], 2));
  return g;
};
const cyl = (r0: number, r1: number, h: number, n = 24) => new THREE.CylinderGeometry(r1, r0, h, n).translate(0, h / 2, 0);
const at = (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z);

const seabedTex = () => ctex("seabed", 1024, 1024, (g, r) => {
  g.fillStyle = "#8a8360"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${90 + r() * 40},${84 + r() * 30},${56 + r() * 20},0.5)`; g.beginPath(); g.ellipse(r() * 1024, r() * 1024, 20 + r() * 70, 10 + r() * 30, r() * 3, 0, 7); g.fill(); }
});
const hallTex = () => ctex("hallWall", 1024, 1024, (g, r) => {
  g.fillStyle = "#4a4048"; g.fillRect(0, 0, 1024, 1024);
  for (let x = 0; x < 1024; x += 128) { g.fillStyle = "#3a3038"; g.fillRect(x, 0, 14, 1024); }
  for (let i = 0; i < 80; i++) { g.fillStyle = `rgba(80,70,78,${0.2 + r() * 0.2})`; g.fillRect(r() * 1024, r() * 1024, 80, 40); }
});

const tree = (b: Batch, x: number, y: number, z: number, s: number, M: Record<string, THREE.Material>, seed: number) => {
  b.add(cyl(0.35 * s, 0.25 * s, 3.2 * s, 8), M.bark, at(x, y, z));
  b.add(new THREE.IcosahedronGeometry(2.2 * s, 1), seed % 2 ? M.leafA : M.leafB, at(x, y + 4.6 * s, z));
  b.add(new THREE.IcosahedronGeometry(1.6 * s, 1), seed % 3 ? M.leafB : M.leafA, at(x + 0.9 * s, y + 5.8 * s, z - 0.4 * s));
};
/** church: nave box + tower + copper spire */
const church = (b: Batch, x: number, z: number, y: number, s: number, M: Record<string, THREE.Material>) => {
  b.add(boxGeo(V(x - 9 * s, y, z - 5 * s), V(x + 9 * s, y + 11 * s, z + 5 * s), 4), M.plaster);
  b.add(new THREE.CylinderGeometry(0.01, 8 * s, 7 * s, 4, 1).rotateY(Math.PI / 4).scale(1.3, 1, 0.75).translate(0, 3.5 * s, 0), M.roofD, at(x, y + 11 * s, z));
  b.add(boxGeo(V(x - 3 * s, y, z - 3 * s), V(x + 3 * s, y + 26 * s, z + 3 * s), 4), M.plaster, at(-12 * s, 0, 0));
  b.add(new THREE.ConeGeometry(3.6 * s, 22 * s, 8).translate(0, 11 * s, 0), M.copper, at(x - 12 * s, y + 26 * s, z));
};

const WATER_DECL = `#include <common>
varying vec3 vWP;
uniform vec3 wNearC, wMidC, wFarC, wCrest, wTrough, wGlint, wShade;
uniform sampler2D wNearTex, wFarTex;
uniform float wTime;`;
const WATER_COL = `
  vec3 wV = vWP - cameraPosition;
  float wd = length(wV);
  float wDep = asin(clamp(-wV.y / wd, 0.0, 1.0));
  float wf = 1.0 - smoothstep(0.0, 0.42, wDep);
  vec3 wc = mix(mix(wNearC, wMidC, smoothstep(0.0, 0.55, wf)), wFarC, smoothstep(0.55, 1.0, wf));
  vec2 wp = vWP.xz + vec2(0.25 * wTime, 0.12 * wTime);
  vec4 mk = mix(texture2D(wNearTex, wp / 8.0), texture2D(wFarTex, wp / 40.0 + 0.37), smoothstep(25.0, 90.0, wd));
  wc = mix(wc, wTrough, mk.g * 0.6);
  wc = mix(wc, wCrest, mk.r * 0.7);
  wc = mix(wc, wGlint, mk.b * (0.3 + 0.5 * wf));
  diffuseColor.rgb = wc;`;

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
  private cloudMaps: Record<"day" | "golden", THREE.Texture[]>;
  private clouds: THREE.Mesh[] = [];
  private WU: Record<string, THREE.IUniform>;
  private water: THREE.Mesh; private under: THREE.Mesh;
  private quay = new THREE.Group(); private town = new THREE.Group(); private bed = new THREE.Group();
  private hall = new THREE.Group(); private pontoons = new THREE.Group(); private bike = new THREE.Group();
  ship = new Ship();
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(_kit: Kit) {
    const R = this.root, M: Record<string, THREE.Material> = {};
    // ---- sky + light ----
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
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)) };
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
    M.quay = lam("quayStone", () => ({ map: stoneHD("quayHD", ["#b9b0a2", "#aea495", "#c3baab", "#a69b8b"], "#7c7266") }));
    M.plaster = lam("plasterW", () => ({ color: "#ecdcc0" }));
    M.roofD = lam("roofDark", () => ({ map: roofHD("#8f5a48") }));
    M.copper = lam("copper", () => ({ color: "#5fa58c" }));
    M.castle = lam("castleW", () => ({ color: "#e6cf9a" }));
    M.bark = lam("bark", () => ({ color: "#8a5a3c" }));
    M.leafA = lam("leafA", () => ({ color: "#62ae4c" }));
    M.leafB = lam("leafB", () => ({ color: "#4f9a43" }));
    M.wood = lam("crateWood", () => ({ color: "#a8724a" }));
    M.barrel = lam("barrel", () => ({ color: "#8f5d3b" }));
    M.iron = lam("bollard", () => ({ color: "#3a3a40" }));
    const hm = [lam("hillA", () => ({ color: "#78b257" })), lam("hillB", () => ({ color: "#6aa24e" })), lam("hillC", () => ({ color: "#8bbf63" }))];

    // ---- water ----
    const wNear = waterNear(), wFar = waterFar();
    for (const t of [wNear, wFar]) { t.colorSpace = THREE.NoColorSpace; t.anisotropy = 16; t.needsUpdate = true; }
    this.WU = {
      wNearC: { value: new THREE.Color() }, wMidC: { value: new THREE.Color() }, wFarC: { value: new THREE.Color() },
      wCrest: { value: new THREE.Color() }, wTrough: { value: new THREE.Color() }, wGlint: { value: new THREE.Color() },
      wShade: { value: new THREE.Vector3(0.5, 0.56, 0.72) }, wNearTex: { value: wNear }, wFarTex: { value: wFar }, wTime: { value: 0 },
    };
    const waterM = new THREE.MeshLambertMaterial({ color: 0xffffff });
    waterM.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.WU);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWP;")
        .replace("#include <project_vertex>", "#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", WATER_DECL)
        .replace("#include <map_fragment>", WATER_COL)
        .replace("#include <lights_fragment_begin>", "float sunVis = 1.0;\n" + LFB)
        .replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\n  reflectedLight.directDiffuse = diffuseColor.rgb * mix(wShade, vec3(1.0), sunVis);\n  reflectedLight.indirectDiffuse = vec3(0.0);");
    };
    waterM.customProgramCacheKey = () => "harbour1";
    this.water = new THREE.Mesh(quadUp(-1000, 1000, -34, 1000, 1, 1), waterM);
    this.water.receiveShadow = true; R.add(this.water);
    // the surface seen from below (underwater shot only)
    this.under = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000).rotateX(Math.PI / 2).translate(0, -0.05, 0),
      new THREE.MeshBasicMaterial({ color: "#7fd0d4", fog: true, side: THREE.DoubleSide }));
    this.under.layers.set(NOINK); R.add(this.under);

    // ---- the quay: stone wall + cobbled top, bollards, barrels, crates; houses facing the water ----
    const qb = new Batch();
    qb.add(boxGeo(V(-400, -6, -400), V(400, QY, -34), 6), M.quay);
    qb.add(quadUp(-400, 400, -400, -34.3, 160, 146, QY + 0.01), M.cobble);
    for (let x = -200; x <= 200; x += 9) qb.add(cyl(0.32, 0.26, 0.8, 12), M.iron, at(x, QY, -35.2));
    const props: [number, number][] = [[-12, -40], [6, -42], [44, -39], [52, -44], [84, -41], [-30, -43], [96, -47], [58, -66]];
    props.forEach(([x, z], i) => {
      if (i % 2) qb.add(cyl(0.45, 0.5, 1.1, 14), M.barrel, at(x, QY, z)), qb.add(cyl(0.45, 0.5, 1.1, 14), M.barrel, at(x + 1.1, QY, z + 0.3));
      else qb.add(boxGeo(V(x - 0.6, QY, z - 0.6), V(x + 0.6, QY + 1.2, z + 0.6), 1), M.wood), qb.add(boxGeo(V(x + 0.7, QY, z - 0.4), V(x + 1.6, QY + 0.9, z + 0.5), 1), M.wood);
    });
    let hs = 1;
    for (let x = -180; x < 220; x += 11) { house(qb, x, -96, 0, 10, 8, [9, 11, 12.5][hs % 3], hs, QY); hs++; }
    for (let x = -176; x < 220; x += 13) { house(qb, x, -112, 0, 12, 8, 13 + (hs % 2) * 3, hs, QY); hs++; }
    qb.build(this.quay); R.add(this.quay);

    // ---- the town across the water: shore wall, three rows of houses, churches, the castle, hills; an island ----
    const tb = new Batch();
    tb.add(boxGeo(V(-500, -6, 150), V(500, 2.4, 700), 6), M.quay);
    tb.add(quadUp(-500, 500, 150.3, 700, 200, 220, 2.41), M.cobble);
    for (let x = -240; x < 260; x += 11) { house(tb, x, 162, Math.PI, 10, 8, [10, 12, 14][hs % 3], hs, 2.4); hs++; }
    for (let x = -236; x < 260; x += 12.5) { house(tb, x, 178, Math.PI, 11, 8, 13 + (hs % 3) * 1.5, hs, 2.4); hs++; }
    for (let x = -230; x < 260; x += 14) { house(tb, x, 196, Math.PI, 12, 9, 15 + (hs % 2) * 2, hs, 2.4); hs++; }
    church(tb, -70, 215, 2.4, 1.3, M); church(tb, 90, 225, 2.4, 1.1, M); church(tb, 210, 212, 2.4, 1.0, M);
    // the royal castle (Tre Kronor): long block + a tall tower with three crowns
    tb.add(boxGeo(V(-10, 2.4, 205), V(50, 24, 235), 6), M.castle);
    tb.add(boxGeo(V(10, 2.4, 212), V(24, 48, 226), 6), M.castle);
    tb.add(new THREE.ConeGeometry(10, 20, 4).rotateY(Math.PI / 4).translate(17, 58, 219), M.copper);
    for (const dx of [-3, 0, 3]) tb.add(new THREE.SphereGeometry(1.1, 10, 8), lam("vasaGold", () => ({ color: "#e8b54a" })), at(17 + dx, 69, 219));
    ([[-360, 380, 220, 60, 130], [120, 460, 280, 80, 150], [420, 340, 180, 55, 140], [-520, 200, 200, 46, 150], [540, 150, 170, 44, 130]] as const)
      .forEach(([x, z, sx, sy, sz], i) => tb.add(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), hm[i % 3], new THREE.Matrix4().compose(V(x, D0 - 2, z), new THREE.Quaternion(), V(sx, sy, sz))));
    let ts = 0;
    for (let x = -240; x <= 250; x += 13) { tree(tb, x + (ts % 3) * 2, 2.4, 232 + (ts % 2) * 4, 1.3 + (ts % 3) * 0.2, M, ts); ts++; }
    // island to the left (Skeppsholmen): a green mound with trees and a few houses
    tb.add(new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), hm[0], new THREE.Matrix4().compose(V(-230, -3, 80), new THREE.Quaternion(), V(110, 14, 45)));
    for (let i = 0; i < 18; i++) tree(tb, -300 + i * 8, 6 + 3 * Math.sin(i), 70 + (i % 3) * 8, 1.4, M, i);
    for (let i = 0; i < 5; i++) house(tb, -280 + i * 22, 52, Math.PI * 0.95, 9, 7, 9, i + 3, 4);
    tb.build(this.town); R.add(this.town);

    // ---- sea bed (only ever seen in the underwater shot) ----
    const bb = new Batch();
    bb.add(quadUp(-400, 400, -400, 400, 40, 40, -35), lam("seabed", () => ({ map: rep(seabedTex(), 1, 1) })));
    const rock = lam("rock", () => ({ color: "#7a7468" })), weed = lam("weed", () => ({ color: "#5a8a4a" }));
    for (let i = 0; i < 40; i++) {
      const a = i * 2.39, d = 14 + (i * 7) % 40, x = Math.cos(a) * d, z = Math.sin(a) * d * 0.7;
      bb.add(new THREE.IcosahedronGeometry(0.6 + (i % 4) * 0.4, 1).scale(1.3, 0.6, 1), rock, at(x, -35, z));
      bb.add(new THREE.ConeGeometry(0.25, 2 + (i % 3), 6).translate(0, 1 + (i % 3) / 2, 0), weed, at(x + 1.2, -35, z + 0.5));
    }
    bb.build(this.bed); R.add(this.bed);

    // ---- salvage pontoons (1961) ----
    const pb = new Batch(), steel = lam("pontoon", () => ({ color: "#5d6672" })), stripe = lam("pontoonStripe", () => ({ color: "#d8a440" }));
    for (const s of [-1, 1]) {
      pb.add(boxGeo(V(-20, -1.5, s * 9.5 - 2.2), V(20, 2.2, s * 9.5 + 2.2), 4), steel);
      pb.add(boxGeo(V(-20.05, 1.4, s * 9.5 - 2.25), V(20.05, 1.9, s * 9.5 + 2.25)), stripe);
      for (let x = -16; x <= 16; x += 8) pb.add(boxGeo(V(x - 0.4, 2.2, s * 9.5 - 0.4), V(x + 0.4, 6, s * 9.5 + 0.4)), steel);
    }
    pb.build(this.pontoons); R.add(this.pontoons);

    // ---- the museum hall (today): dark walls around the ship, floor, cradle under the keel ----
    const lb = new Batch(), wall = lam("hallWall", () => ({ map: rep(hallTex(), 4, 3), side: THREE.DoubleSide }));
    const floor = lam("hallFloor", () => ({ color: "#6a5446" }));
    lb.add(quadUp(-70, 70, -70, 50, 1, 1, 0.0), floor);
    lb.add(boxGeo(V(-70, 0, 46), V(70, 70, 50), 0), wall);
    lb.add(boxGeo(V(-70, 0, -70), V(-66, 70, 50), 0), wall);
    lb.add(boxGeo(V(66, 0, -70), V(70, 70, 50), 0), wall);
    for (const x of [-16, -8, 0, 8, 16]) lb.add(boxGeo(V(x - 0.8, 0, -1.2), V(x + 0.8, 1.2, 1.2)), lam("cradle", () => ({ color: "#4d5560" })));
    for (const x of [-12, 4, 14]) for (const s of [-1, 1]) lb.add(new THREE.CylinderGeometry(0.18, 0.18, 7.5, 8).rotateX(s * 0.75).translate(0, 3.2, s * 3.2), lam("cradle", () => ({ color: "#4d5560" })), at(x, 0, s * 3.6));
    lb.build(this.hall, false); R.add(this.hall);

    // ---- the bike + fridge (S7): built at the origin, posed by world.update ----
    const kb = new Batch(), frame = lam("bikeFrame", () => ({ color: "#d23c32" })), tyre = lam("tyre", () => ({ color: "#26232a" }));
    for (const z of [-0.55, 0.55]) kb.add(new THREE.TorusGeometry(0.34, 0.045, 8, 32), tyre, at(0, 0.37, z));
    // frame drawn along z (the bike points at +z), seat at the back, bars at the front
    const bar = (a: THREE.Vector3, c: THREE.Vector3, r = 0.03) => {
      const d = c.clone().sub(a), g = new THREE.CylinderGeometry(r, r, d.length(), 8).translate(0, d.length() / 2, 0);
      kb.add(g, frame, new THREE.Matrix4().compose(a, new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()), V(1, 1, 1)));
    };
    bar(V(0, 0.37, -0.55), V(0, 0.4, 0)); bar(V(0, 0.4, 0), V(0, 0.82, -0.2)); bar(V(0, 0.82, -0.2), V(0, 0.85, 0.45));
    bar(V(0, 0.4, 0), V(0, 0.85, 0.45)); bar(V(0, 0.37, 0.55), V(0, 0.95, 0.45)); bar(V(-0.28, 0.98, 0.45), V(0.28, 0.98, 0.45), 0.025);
    kb.add(boxGeo(V(-0.1, 0.84, -0.32), V(0.1, 0.9, -0.08)), tyre);
    kb.build(this.bike);
    const fridge = new THREE.Group(), fb = new Batch(), white = lam("fridge", () => ({ color: "#f2f2ee" }));
    fb.add(boxGeo(V(-0.38, 0, -0.34), V(0.38, 1.55, 0.34)), white);
    fb.add(boxGeo(V(-0.39, 1.0, 0.33), V(0.39, 1.03, 0.36)), lam("fridgeLine", () => ({ color: "#9aa0a8" })));
    fb.add(boxGeo(V(0.24, 0.5, 0.34), V(0.3, 0.9, 0.42)), lam("fridgeLine", () => ({ color: "#9aa0a8" })));
    fb.add(boxGeo(V(0.24, 1.12, 0.34), V(0.3, 1.4, 0.42)), lam("fridgeLine", () => ({ color: "#9aa0a8" })));
    fb.build(fridge); fridge.name = "fridge";
    this.bike.add(fridge); R.add(this.bike);

    R.add(this.ship.root);
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

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light];
    // ---- ship first: the deck camera (S4) rides it ----
    const st = shipState(id, t);
    this.ship.pose(st, t);
    this.ship.root.updateMatrixWorld(true);
    const shipM = this.ship.root.matrix;
    setShip(shipM, st);
    const c = camAt(id, f);
    if (c.ship) {
      const p = V(...c.pos).applyMatrix4(shipM), l = V(...c.look).applyMatrix4(shipM), up = V(0, 1, 0).transformDirection(shipM);
      cam.position.copy(p); cam.up.copy(up); cam.lookAt(l); cam.rotateZ(c.roll);
    } else {
      cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    }
    cam.fov = c.fov; cam.near = 0.2; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = c.ship ? V(...c.look).applyMatrix4(shipM) : V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    // ---- set visibility per shot ----
    const under = id === 9, museum = id === 11;
    this.water.visible = !under && !museum;
    this.under.visible = under;
    this.bed.visible = under;
    this.quay.visible = !under && !museum;
    this.town.visible = !under && !museum;
    this.hall.visible = museum;
    this.pontoons.visible = id === 10;
    this.bike.visible = id === 7;
    this.ship.root.visible = id !== 7;
    // ---- light ----
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    let Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 14, 110);
    if (s.light === "golden") Rr = Math.max(Rr, 40);
    if (id === 1 || id === 6 || id === 2 || id === 5 || id === 10 || id === 11) Rr = Math.max(Rr, 70);
    this.sun.position.copy(focus).addScaledVector(sunDir, 260); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 560; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    const lit = under ? [L.lit[0] * 0.62, L.lit[1] * 0.95, L.lit[2] * 1.05] as const : L.lit;
    TONE.uLitCol.value.set(...lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...LOOK[s.light].bounce); TONE.uSat.value = LOOK[s.light].sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    const su = this.skyMat.uniforms;
    const skyC = under ? ["#1f6a78", "#2b7f8c", "#3a95a0", "#56aeb4", "#7fcacb"] : museum ? ["#3a3038", "#3a3038", "#3a3038", "#3a3038", "#3a3038"] : K.sky.c;
    skyC.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    if (under) { untone("#246f7c", this.fog.color); this.fog.near = 3; this.fog.far = 62; }
    else if (museum) { untone("#4a3c40", this.fog.color); this.fog.near = 60; this.fog.far = 220; }
    else { untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar * 1.4; }
    scene.fog = this.fog; scene.background = null;
    this.sunDisc.visible = s.light === "golden" && !museum;
    if (this.sunDisc.visible) {
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 900);
      this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(1.7)));
    }
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i];
      m.visible = !under && !museum;
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      (m.material as THREE.MeshBasicMaterial).map = this.cloudMaps[s.light][i % 4];
    }
    const W = this.WU, wc = K.water;
    untone(wc.near, W.wNearC.value); untone(wc.mid, W.wMidC.value); untone(wc.far, W.wFarC.value);
    untone(wc.crest, W.wCrest.value); untone(wc.trough, W.wTrough.value); untone(wc.glint, W.wGlint.value);
    W.wShade.value.set(...wc.shade); W.wTime.value = t;
    // ---- cast + effects ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const stg = stage(id, t, { pos: cam.position, right });
    // the bike rig follows the cast's pose for it
    if (stg.bike) {
      const k = stg.bike;
      this.bike.position.set(...k.pos);
      this.bike.rotation.set(0, k.yaw, 0, "YXZ");
      this.bike.rotation.z = -THREE.MathUtils.degToRad(k.lean);
      const fr = this.bike.getObjectByName("fridge")!;
      fr.position.set(...k.fridge); fr.rotation.set(k.fridgeRot[0], 0, k.fridgeRot[2]);
    }
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const tint = s.light === "golden" ? "#ffcf9e" : "#ffffff";
    let ai = 0;
    const used: Actor[] = [];
    for (const p of stg.places) {
      const sc2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 3.5))) continue;
      const a = this.actor(ai++);
      const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      if (a.mat.emissiveMap) a.mat.emissive.set(tint);
      a.mesh.castShadow = L.actorShadow;
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of stg.fx) {
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

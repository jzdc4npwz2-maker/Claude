// "Coroa de Ferro — Parte 1". One three.js world (world.ts) posed per frame from story.ts, plus the 2D layers:
// narration captions (Bebas Neue, yellow keywords), game HUD (boss bar, stamina, tags, CRÍTICO, level up), the two
// science scenes and the eyes-in-the-dark end card. The 3D is rendered live (stills) or from a pre-rendered
// background video (final: CoroaBG renders the slow software-GL pass once, the 2D pass on top is fast).
import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, continueRender, delayRender, getInputProps, useCurrentFrame, OffthreadVideo, staticFile } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import { BlendFunction, BloomEffect, EffectComposer, EffectPass, RenderPass, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import "@fontsource/bebas-neue";
import "@fontsource/oswald/500.css";
import "@fontsource/oswald/700.css";
import { World, loadKit } from "./world";
import { InkPass, noInkFallback } from "./ink";
import { LensBlur } from "./lensblur";
import { GradeEffect, GRADES, GRADE_STRENGTH, gradeFor } from "./grade";
import { Kit } from "./build";
import { TOTAL, SHOTS, FPS, S, T, shotAt, is3D, dofAt, camAt, CAPTIONS, clamp01, smooth, V3, WALL_Z } from "./story";
import { ArmourSci, MomentumSci } from "./sci";

export const COROA_FRAMES = TOTAL;
const W = 1080, H = 1920;
const YEL = "#FFC93C";

const makeBloom = () => {
  const b = new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.5, luminanceThreshold: 1.0, luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.6 });
  const mip = b.mipmapBlurPass;
  const setSize = mip.setSize.bind(mip);
  mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
  return b;
};
const fwd = new THREE.Vector3(), fpt = new THREE.Vector3();

const useKit = () => {
  const [kit, setKit] = useState<Kit | null>(null);
  const [handle] = useState(() => delayRender("kit"));
  useEffect(() => { loadKit().then((k) => { setKit(k); continueRender(handle); }); }, [handle]);
  return kit;
};
const useFonts = () => {
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    Promise.all(["400 80px 'Bebas Neue'", "700 40px Oswald", "500 40px Oswald"].map((f) => document.fonts.load(f))).then(() => continueRender(handle));
  }, [handle]);
};

// ---------------- the 3D world ----------------
const Inner: React.FC<{ id: number; kit: Kit }> = ({ id, kit }) => {
  const f = useCurrentFrame();
  const { camera, scene } = useThree();
  const world = useMemo(() => new World(kit), [kit]);
  const target = useMemo(() => new THREE.Vector3(), []);
  const fx = useMemo(() => ({
    ink: new InkPass(scene, camera as THREE.PerspectiveCamera),
    lens: new LensBlur({ maxCoC: 24, nearScale: 1.2 }),
    bloom: makeBloom(),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    grade: new GradeEffect(GRADES.day, GRADE_STRENGTH.day),
  }), [camera, scene]);
  useEffect(() => () => fx.ink.dispose(), [fx]);
  const gl = useThree((st) => st.gl);
  const size = useThree((st) => st.size);
  const composer = useMemo(() => {
    const c = new EffectComposer(gl, { multisampling: 4, frameBufferType: THREE.HalfFloatType });
    c.addPass(new RenderPass(scene, camera));
    c.addPass(fx.ink);
    c.addPass(new EffectPass(camera, fx.lens.pre));
    c.addPass(new EffectPass(camera, fx.lens.main));
    c.addPass(new EffectPass(camera, fx.bloom, fx.tone, fx.grade));
    return c;
  }, [gl, scene, camera, fx]);
  useEffect(() => { composer.setSize(size.width, size.height); }, [composer, size]);
  useEffect(() => () => { composer.removeAllPasses(); }, [composer]);
  useFrame((_, dt) => { composer.render(dt); }, 1);
  const cam = camera as THREE.PerspectiveCamera;
  target.copy(world.update(id, f, cam, scene, f));
  noInkFallback(world.root);
  const d = dofAt(f);
  cam.getWorldDirection(fwd);
  if (d.focus) fpt.set(...d.focus(f)); else fpt.copy(target);
  fx.lens.focus = Math.max(0.3, fpt.sub(cam.position).dot(fwd));
  fx.lens.cInf = d.cInf;
  gradeFor(fx.grade, SHOTS[id - 1].light);
  return <primitive object={world.root} dispose={null} />;
};
const ShotView: React.FC<{ id: number; kit: Kit }> = ({ id, kit }) => (
  <AbsoluteFill>
    <ThreeCanvas width={W} height={H} shadows gl={{ alpha: false, antialias: false, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
      camera={{ fov: 40, near: 0.2, far: 1500 }}>
      <Inner id={id} kit={kit} />
    </ThreeCanvas>
  </AbsoluteFill>
);
/** 3D only (black where the shot is 2D): rendered once to public/coroa_bg.mp4 for the final pass */
export const CoroaBG: React.FC = () => {
  const f = useCurrentFrame(), kit = useKit(), s = shotAt(f);
  if (!kit) return null;
  return <AbsoluteFill style={{ background: "#000" }}>{is3D(s.id) && <ShotView key={s.id} id={s.id} kit={kit} />}</AbsoluteFill>;
};

// ---------------- screen projection (labels follow the 3D cast) ----------------
const pcam = new THREE.PerspectiveCamera(40, W / H, 0.2, 1500);
const project = (id: number, f: number, p: V3): [number, number] => {
  const c = camAt(id, f);
  pcam.position.set(...c.pos); pcam.up.set(0, 1, 0); pcam.lookAt(...c.look); pcam.rotateZ(c.roll);
  pcam.fov = c.fov; pcam.updateProjectionMatrix(); pcam.updateMatrixWorld();
  const v = new THREE.Vector3(...p).project(pcam);
  return [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H];
};

// ---------------- captions ----------------
const Words: React.FC<{ text: string }> = ({ text }) => (
  <>{text.split(/(\*[^*]+\*)/).filter(Boolean).map((p, i) => p.startsWith("*") ? <span key={i} style={{ color: YEL }}>{p.slice(1, -1)}</span> : <span key={i} style={{ color: "#fff" }}>{p}</span>)}</>
);
const capStyle: React.CSSProperties = {
  fontFamily: "'Bebas Neue'", fontSize: 116, lineHeight: 1.0, letterSpacing: 2, textAlign: "center",
  WebkitTextStroke: "14px #000", paintOrder: "stroke fill", textShadow: "0 8px 0 rgba(0,0,0,.55)",
};
const Captions: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS, c = CAPTIONS.find((l) => t >= l.a && t < l.b);
  if (!c || t >= T.end) return null;
  const k = clamp01((t - c.a) * FPS / 4), sc = 0.82 + 0.18 * (1 - (1 - k) ** 3) + 0.04 * Math.sin(k * Math.PI);
  return (
    <div style={{ position: "absolute", left: 50, right: 50, top: 1290, display: "flex", justifyContent: "center" }}>
      <div style={{ ...capStyle, transform: `scale(${sc})` }}><Words text={c.text} /></div>
    </div>
  );
};

// ---------------- HUD ----------------
const glass: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(20,16,30,.88), rgba(12,10,20,.92))", border: "5px solid #c9a24a", borderRadius: 22,
  boxShadow: "0 0 26px rgba(201,162,74,.45), inset 0 0 18px rgba(201,162,74,.15)", color: "#f4ead2", fontFamily: "Oswald", fontWeight: 500,
};
const pop = (f: number, a: number, b: number) => {
  const i = clamp01((f - a) / 7), o = clamp01((b - f) / 6);
  return { opacity: Math.min(i, o), transform: `scale(${0.85 + 0.15 * smooth(i)})` };
};
const lerpT = (t: number, rows: [number, number][]) => {
  if (t <= rows[0][0]) return rows[0][1];
  for (let i = 1; i < rows.length; i++) if (t < rows[i][0]) { const [a, va] = rows[i - 1], [b, vb] = rows[i]; return va + (vb - va) * smooth((t - a) / (b - a)); }
  return rows[rows.length - 1][1];
};
const hpAt = (t: number) => (t < T.impact ? 1 : t < T.crit ? 0.3 : lerpT(t, [[T.crit, 0.3], [T.crit + 0.5, 0]]));
const stamAt = (t: number) => lerpT(t, [[22, 1], [31.8, 0.62], [33.6, 0.5], [56, 0.58], [58, 0.58], [60.6, 0.5], [62.6, 0.06], [65.2, 0.12], [81.2, 0.02]]);
const BOSS_SHOTS = new Set([5, 7, 8, 9, 10, 12, 13, 14, 16, 17, 18]);
const BossBar: React.FC<{ f: number; id: number }> = ({ f, id }) => {
  const t = f / FPS;
  if (!BOSS_SHOTS.has(id) || t < T.bossCard + 2.9) return null;
  const hp = hpAt(t), st = stamAt(t), low = st < 0.25, blink = low && Math.floor(f / 6) % 2 === 0;
  return (
    <div style={{ position: "absolute", left: 60, right: 60, top: 150, padding: "16px 26px 20px", ...glass, border: "5px solid #b8333a", boxShadow: "0 0 24px rgba(184,51,58,.5)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 40, fontWeight: 700 }}><span>CAVALEIRO DE FERRO</span><span style={{ color: "#ff8a80" }}>NV.40</span></div>
      <div style={{ height: 30, marginTop: 10, background: "rgba(255,255,255,.12)", borderRadius: 15, overflow: "hidden" }}>
        <div style={{ width: `${hp * 100}%`, height: "100%", background: "linear-gradient(90deg,#c0262c,#ff5a4f)" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 10 }}>
        <span style={{ fontSize: 28, width: 120, color: low ? "#ff8a80" : "#f4ead2" }}>FÔLEGO</span>
        <div style={{ flex: 1, height: 18, background: "rgba(255,255,255,.12)", borderRadius: 9, overflow: "hidden" }}>
          <div style={{ width: `${st * 100}%`, height: "100%", background: blink ? "#ff5a4f" : "linear-gradient(90deg,#e8b23a,#ffd86a)" }} />
        </div>
      </div>
    </div>
  );
};
const BossCard: React.FC<{ f: number }> = ({ f }) => {
  const a = S(T.bossCard), b = S(18.35);
  if (f < a || f >= b) return null;
  return (
    <div style={{ position: "absolute", left: 90, right: 90, top: 260, padding: "26px 30px", textAlign: "center", ...glass, border: "6px solid #b8333a", boxShadow: "0 0 34px rgba(184,51,58,.6)", ...pop(f, a, b) }}>
      <div style={{ fontSize: 34, color: "#ffb4ad", letterSpacing: 4 }}>CHEFE DO SALÃO</div>
      <div style={{ fontFamily: "'Bebas Neue'", fontSize: 120, lineHeight: 1, color: "#f4ead2" }}>CAVALEIRO DE FERRO</div>
      <div style={{ fontSize: 56, fontWeight: 700, color: "#ff5a4f" }}>NÍVEL 40</div>
    </div>
  );
};
const Tag: React.FC<{ x: number; y: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ x, y, style, children }) => (
  <div style={{ position: "absolute", left: Math.max(200, Math.min(W - 200, x)), top: y, transform: "translate(-50%, -100%)", whiteSpace: "nowrap", fontFamily: "Oswald", fontWeight: 700,
    fontSize: 42, color: "#fff", padding: "8px 22px", borderRadius: 14, background: "rgba(14,12,22,.85)", border: "4px solid #c9a24a", ...style }}>{children}</div>
);
const Toast: React.FC<{ f: number; a: number; b: number; top?: number; children: React.ReactNode }> = ({ f, a, b, top = 300, children }) => {
  if (f < a || f >= b) return null;
  return <div style={{ position: "absolute", left: 0, right: 0, top, display: "flex", justifyContent: "center" }}>
    <div style={{ ...glass, padding: "18px 36px", fontSize: 46, fontWeight: 700, ...pop(f, a, b) }}>{children}</div></div>;
};
const Big: React.FC<{ f: number; a: number; b: number; top: number; size?: number; color?: string; children: React.ReactNode }> = ({ f, a, b, top, size = 190, color = YEL, children }) => {
  if (f < a || f >= b) return null;
  const k = clamp01((f - a) / 6), o = clamp01((b - f) / 6), sc = 1.5 - 0.5 * (1 - (1 - k) ** 3);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top, textAlign: "center", opacity: Math.min(k * 2, o), transform: `scale(${sc})` }}>
      <div style={{ fontFamily: "'Bebas Neue'", fontSize: size, lineHeight: 1, color, WebkitTextStroke: "14px #2a1600", paintOrder: "stroke fill", textShadow: "0 0 40px rgba(255,201,60,.8), 0 10px 0 rgba(0,0,0,.5)" }}>{children}</div>
    </div>
  );
};
const Labels: React.FC<{ f: number; id: number }> = ({ f, id }) => {
  const t = f / FPS, out: React.ReactNode[] = [];
  if (id === 6 && t >= 19.25) out.push(<Tag key="leo" x={W / 2} y={330} style={{ ...pop(f, S(19.25), S(21.9)), fontSize: 56 }}>Léo · <span style={{ color: "#ff8a80" }}>NV.2</span></Tag>);
  // dodges: "ERROU!" pops near Léo at each blow
  const miss: [number, number, V3][] = [[7, T.hit1, [0, 2.0, 1.2]], [8, T.hit2, [1.2, 2.0, 1.4]], [9, T.sweep + 0.15, [1.2, 1.7, 1.4]]];
  for (const [sid, h, p] of miss) if (id === sid && t >= h && t < h + 1.0) {
    const [x, y] = project(sid, f, p), u = (t - h) / 1.0;
    out.push(<div key={"m" + sid} style={{ position: "absolute", left: Math.max(20, Math.min(W - 420, x - 200)), width: 400, top: y - 40 - 90 * u, textAlign: "center", opacity: 1 - u * u,
      fontFamily: "'Bebas Neue'", fontSize: 100, color: "#7dffb2", WebkitTextStroke: "10px #062a16", paintOrder: "stroke fill" }}>ERROU!</div>);
  }
  if (id === 19 && t >= T.lvl) { const [x, y] = project(19, f, [1.9, 2.25, 15.0]); out.push(<Tag key="lv" x={x} y={Math.max(520, y)} style={{ ...pop(f, S(T.lvl), S(89)), border: `4px solid ${YEL}` }}>Léo · <span style={{ color: YEL }}>NV.15</span></Tag>); }
  return <>{out}</>;
};
const Laps: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS;
  if (t < T.kite || t >= 63.1) return null;
  const n = t >= T.lap3 ? 3 : t >= T.lap2 ? 2 : 1, a = n === 3 ? T.lap3 : n === 2 ? T.lap2 : T.kite, k = clamp01((t - a) * FPS / 5);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 470, textAlign: "center", transform: `scale(${1.3 - 0.3 * k})`, opacity: clamp01((63.1 - t) * 4) }}>
      <span style={{ fontFamily: "'Bebas Neue'", fontSize: 150, color: "#fff", WebkitTextStroke: "12px #000", paintOrder: "stroke fill" }}>VOLTA <span style={{ color: YEL }}>{n}</span></span>
    </div>
  );
};
const Victory: React.FC<{ f: number }> = ({ f }) => {
  const a = S(T.poof + 0.1), b = S(89.0);
  if (f < a || f >= b) return null;
  const lv = f >= S(T.lvl), k = smooth((f - S(T.lvl)) / 8);
  return (
    <div style={{ position: "absolute", left: 70, right: 70, top: 230, padding: "26px 30px", textAlign: "center", ...glass, border: `6px solid ${YEL}`, boxShadow: "0 0 40px rgba(255,201,60,.6)", ...pop(f, a, b) }}>
      <div style={{ fontFamily: "'Bebas Neue'", fontSize: 120, lineHeight: 1, color: YEL }}>CHEFE DERROTADO</div>
      <div style={{ fontSize: 40, color: "#f4ead2", marginTop: 6 }}>DANO CAUSADO PELO LÉO: <span style={{ color: "#7dffb2", fontWeight: 700 }}>0</span></div>
      {lv && <div style={{ fontSize: 64, fontWeight: 700, marginTop: 10, transform: `scale(${0.7 + 0.3 * k})`, opacity: k }}>NÍVEL 2 <span style={{ color: YEL }}>→ 15</span></div>}
    </div>
  );
};
const Logo: React.FC<{ f: number }> = ({ f }) => {
  const a = S(5.7), b = S(9.1);
  if (f < a || f >= b) return null;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 230, display: "flex", justifyContent: "center", ...pop(f, a, b) }}>
      <div style={{ textAlign: "center", padding: "20px 50px", ...glass, border: `6px solid ${YEL}` }}>
        <svg width="140" height="100" viewBox="0 0 512 380"><path d="M70 320 L50 70 L160 200 L256 10 L352 200 L462 70 L442 320 Z" fill="#d0a646" stroke="#1a1418" strokeWidth="18" strokeLinejoin="round" /><rect x="70" y="310" width="372" height="50" fill="#d0a646" stroke="#1a1418" strokeWidth="18" /></svg>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 130, lineHeight: 0.95, color: "#f4ead2", letterSpacing: 4 }}>COROA DE FERRO</div>
        <div style={{ fontSize: 34, color: "#cdbf9c", letterSpacing: 6 }}>REALIDADE VIRTUAL</div>
      </div>
    </div>
  );
};

// ---------------- the end: eyes in the dark + PARTE 2 ----------------
const Eyes: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS, open = smooth((t - T.eyes) / 0.25), blink = Math.abs(t - 97.2) < 0.08 ? 0.1 : 1, glow = open * blink;
  const zoom = 1 + (t - 92.85) * 0.02;
  return (
    <AbsoluteFill style={{ background: "#020205" }}>
      <svg width={W} height={H} viewBox="0 0 1080 1920" style={{ transform: `scale(${zoom})` }}>
        <defs><radialGradient id="eg"><stop offset="0" stopColor="#ff4a2a" stopOpacity="0.85" /><stop offset="1" stopColor="#ff2a10" stopOpacity="0" /></radialGradient></defs>
        {/* ragged rim of the hole, faint torchlight behind the camera */}
        <path d="M0 0 H1080 V1920 H0 Z M180 380 L260 250 L420 210 L560 160 L700 230 L860 260 L930 420 L960 700 L1000 980 L950 1300 L900 1560 L760 1700 L540 1760 L330 1720 L170 1580 L110 1300 L80 980 L120 680 Z"
          fill="#1a1c2a" fillRule="evenodd" stroke="#0a0a10" strokeWidth="14" />
        {[0, 1, 2, 3].map((i) => <path key={i} d={`M${200 + i * 210} ${330 - (i % 2) * 60} l${30 - i * 10} 90`} stroke="#0a0a10" strokeWidth="8" />)}
        <g opacity={glow}>
          <ellipse cx="455" cy="930" rx="150" ry="110" fill="url(#eg)" /><ellipse cx="625" cy="930" rx="150" ry="110" fill="url(#eg)" />
          <path d={`M400 930 Q455 ${930 - 34 * open} 510 930 Q455 ${930 + 26 * open} 400 930 Z`} fill="#ff3b2a" />
          <path d={`M570 930 Q625 ${930 - 34 * open} 680 930 Q625 ${930 + 26 * open} 570 930 Z`} fill="#ff3b2a" />
          <circle cx="455" cy="930" r={9 * open} fill="#ffe0d0" /><circle cx="625" cy="930" r={9 * open} fill="#ffe0d0" />
        </g>
      </svg>
    </AbsoluteFill>
  );
};
const EndCard: React.FC<{ f: number }> = ({ f }) => {
  const a = S(T.end);
  if (f < a) return null;
  const k = smooth((f - a) / 9), hb = 1 + 0.08 * Math.max(0, Math.sin((f - a) * 0.25));
  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      <div style={{ position: "absolute", top: 380, transform: `scale(${0.6 + 0.4 * k}) rotate(${-4 + 4 * k}deg)`, opacity: k,
        background: "linear-gradient(180deg,#3a2a12,#1c1408)", border: `10px solid ${YEL}`, borderRadius: 34, padding: "14px 56px", boxShadow: "0 0 50px rgba(255,201,60,.6)" }}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 190, lineHeight: 1, color: YEL, letterSpacing: 6 }}>PARTE 2</div>
      </div>
      <div style={{ position: "absolute", top: 1330, opacity: smooth((f - a - 12) / 9), textAlign: "center" }}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 110, color: "#fff", WebkitTextStroke: "12px #000", paintOrder: "stroke fill" }}>CURTE E SEGUE</div>
        <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: 44, color: "#f4ead2" }}>pra ver o que tem na passagem</div>
        <svg width="120" height="110" viewBox="0 0 100 92" style={{ marginTop: 20, transform: `scale(${hb})` }}><path d="M50 88 C20 66 4 50 4 30 C4 14 16 4 29 4 C39 4 46 10 50 18 C54 10 61 4 71 4 C84 4 96 14 96 30 C96 50 80 66 50 88 Z" fill="#ff3b4f" stroke="#111" strokeWidth="6" /></svg>
      </div>
    </AbsoluteFill>
  );
};

// ---------------- transitions ----------------
const fadeBlack = (f: number) => {
  const t = f / FPS;
  if (t < 0.3) return 1 - t / 0.3;
  if (t >= T.lightsOut && t < 11.65) return smooth((t - T.lightsOut) / 0.35);
  if (t >= 11.65 && t < 12.0) return 1 - (t - 11.65) / 0.35;
  if (t >= 92.4 && t < 92.85) return smooth((t - 92.4) / 0.45);
  if (t >= 92.85 && t < 93.2) return 1 - (t - 92.85) / 0.35;
  return 0;
};
const flashWhite = (f: number) => {
  const t = f / FPS;
  for (const c of [4.05, 35.8, 51.3, 67.0, 77.5]) { const n = f - S(c); if (n >= 0 && n < 5) return [0.8, 0.55, 0.3, 0.15, 0.05][n]; }
  for (const [c, a] of [[T.land, 0.35], [T.hit1, 0.4], [T.hit2, 0.35], [T.impact, 0.85], [T.crit, 0.7], [T.poof, 0.6]] as const) {
    const n = f - S(c); if (n >= 0 && n < 5) return a * [1, 0.6, 0.35, 0.15, 0.05][n];
  }
  return 0;
};
const Streaks: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS;
  if (t < 10.85 || t >= 11.75) return null;
  const u = (t - 10.85) / 0.9;
  return (
    <AbsoluteFill style={{ mixBlendMode: "screen" }}>
      {Array.from({ length: 16 }, (_, i) => {
        const y = ((i * 263) % 1920), sp = 1 + (i % 4) * 0.6, x = ((u * 3200 * sp + i * 371) % 2800) - 1400;
        return <div key={i} style={{ position: "absolute", top: y, left: x, width: 900, height: 10 + (i % 3) * 8, borderRadius: 20, opacity: 0.75,
          background: "linear-gradient(90deg, rgba(111,227,255,0), rgba(111,227,255,1), rgba(255,255,255,0))" }} />;
      })}
    </AbsoluteFill>
  );
};
const Vignette: React.FC = () => <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,.45) 100%)", pointerEvents: "none" }} />;

// ---------------- the short ----------------
type Props = { bg?: "live" | "video" };
export const CoroaShort: React.FC = () => {
  const f = useCurrentFrame();
  useFonts();
  const kit = useKit();
  const mode = (getInputProps() as Props).bg ?? "live";
  if (!kit) return null;
  const s = shotAt(f);
  const bg = mode === "video"
    ? <OffthreadVideo src={staticFile("coroa_bg.mp4")} muted style={{ width: W, height: H }} />
    : is3D(s.id) ? <ShotView key={s.id} id={s.id} kit={kit} /> : null;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill>{is3D(s.id) && bg}</AbsoluteFill>
      {is3D(s.id) && s.env === "hall" && <Vignette />}
      {s.id === 11 && <ArmourSci f={f - s.a} />}
      {s.id === 15 && <MomentumSci f={f - s.a} />}
      {s.id === 21 && <Eyes f={f} />}
      <Logo f={f} />
      <BossCard f={f} />
      <BossBar f={f} id={s.id} />
      <Labels f={f} id={s.id} />
      <Toast f={f} a={S(20.0)} b={S(21.8)} top={1060}>ADAGA <span style={{ color: YEL }}>+</span> COLETE DE COURO</Toast>
      <Laps f={f} />
      <Big f={f} a={S(T.crit)} b={S(85.0)} top={420} size={230}>CRÍTICO!</Big>
      <Victory f={f} />
      <Streaks f={f} />
      <Captions f={f} />
      <EndCard f={f} />
      <AbsoluteFill style={{ background: "#fff", opacity: flashWhite(f), pointerEvents: "none" }} />
      <AbsoluteFill style={{ background: "#000", opacity: fadeBlack(f), pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
void WALL_Z;

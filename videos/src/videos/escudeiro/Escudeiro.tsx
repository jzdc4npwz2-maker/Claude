// "André no VRMMO — Ep. 1: Escudeiro". One three.js world (world.ts) posed per frame from story.ts, plus the 2D layers:
// captions (Bebas Neue, yellow keywords), game HUD panels, the two x-ray science scenes, speech balloons and the A/B
// split. The 3D can be rendered live (stills, preview) or from a pre-rendered background video (final render: the slow
// software-GL pass is done once by EscudeiroBG, the 2D pass on top is fast).
import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, continueRender, delayRender, getInputProps, useCurrentFrame, OffthreadVideo, staticFile, Sequence } from "remotion";
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
import { TOTAL, SHOTS, FPS, S, T, FZ, shotAt, is3D, poseFrame, dofAt, camAt, CAPTIONS, BALLOONS, clamp01, smooth, V3 } from "./story";
import { Brain, Spindles } from "./science";

export const ESC_FRAMES = TOTAL;
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
  target.copy(world.update(id, f, cam, scene, poseFrame(f)));
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
/** 3D only (black where the shot is 2D): rendered once to public/escudeiro_bg.mp4 for the final pass */
export const EscudeiroBG: React.FC = () => {
  const f = useCurrentFrame(), kit = useKit(), s = shotAt(f);
  if (!kit) return null;
  return <AbsoluteFill style={{ background: "#000" }}>{is3D(s.id) && <ShotView key={s.id} id={s.id} kit={kit} />}</AbsoluteFill>;
};

// ---------------- screen projection (labels and balloons follow the 3D cast) ----------------
const pcam = new THREE.PerspectiveCamera(40, W / H, 0.2, 1500);
const project = (id: number, f: number, p: V3): [number, number] => {
  const c = camAt(id, f);
  pcam.position.set(...c.pos); pcam.up.set(0, 1, 0); pcam.lookAt(...c.look); pcam.rotateZ(c.roll);
  pcam.fov = c.fov; pcam.updateProjectionMatrix(); pcam.updateMatrixWorld();
  const v = new THREE.Vector3(...p).project(pcam);
  return [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H];
};

// ---------------- captions ----------------
const Words: React.FC<{ text: string; color?: string }> = ({ text, color = "#fff" }) => (
  <>{text.split(/(\*[^*]+\*)/).filter(Boolean).map((p, i) => p.startsWith("*") ? <span key={i} style={{ color: YEL }}>{p.slice(1, -1)}</span> : <span key={i} style={{ color }}>{p}</span>)}</>
);
const capStyle: React.CSSProperties = {
  fontFamily: "'Bebas Neue'", fontSize: 112, lineHeight: 1.0, letterSpacing: 2, textAlign: "center",
  WebkitTextStroke: "14px #000", paintOrder: "stroke fill", textShadow: "0 8px 0 rgba(0,0,0,.55)",
};
const Captions: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS, c = CAPTIONS.find((l) => t >= l.a && t < l.b);
  if (!c || t >= 104) return null;
  const k = clamp01((t - c.a) * FPS / 4), sc = 0.82 + 0.18 * (1 - (1 - k) ** 3) + 0.04 * Math.sin(k * Math.PI);
  return (
    <div style={{ position: "absolute", left: 60, right: 60, top: 1300, display: "flex", justifyContent: "center" }}>
      <div style={{ ...capStyle, transform: `scale(${sc})` }}><Words text={c.text} /></div>
    </div>
  );
};

// ---------------- HUD pieces ----------------
const glass: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(14,34,64,.86), rgba(10,22,44,.9))", border: "5px solid #6fe3ff", borderRadius: 26,
  boxShadow: "0 0 28px rgba(111,227,255,.55), inset 0 0 22px rgba(111,227,255,.18)", color: "#e8f7ff", fontFamily: "Oswald", fontWeight: 500,
};
const pop = (f: number, a: number, b: number) => {
  const i = clamp01((f - a) / 7), o = clamp01((b - f) / 6);
  return { opacity: Math.min(i, o), transform: `scale(${0.85 + 0.15 * smooth(i)})` };
};
const ClassPanel: React.FC<{ f: number }> = ({ f }) => {
  const a = S(35.0), b = S(41.7);
  if (f < a || f >= b) return null;
  const rows: [string, number, string][] = [["MAGO", 31, "31%"], ["ASSASSINO", 28, "28%"], ["ARQUEIRO", 24, "24%"], ["GUERREIRO", 16.7, "16,7%"], ["ESCUDEIRO", 0.3, "0,3%"]];
  const picked = f >= S(T.pick), blink = Math.floor(f / 6) % 2 === 0;
  return (
    <div style={{ position: "absolute", left: 110, width: 860, top: 230, padding: "34px 44px", ...glass, ...pop(f, a, b), transformOrigin: "50% 30%" }}>
      <div style={{ fontSize: 46, fontWeight: 700, letterSpacing: 4, textAlign: "center", marginBottom: 22, color: "#bff3ff" }}>ESCOLHA SUA CLASSE</div>
      {rows.map(([name, v, lab], i) => {
        const esc = name === "ESCUDEIRO", ri = clamp01((f - a - 6 - i * 4) / 10);
        const hl = esc && picked;
        return (
          <div key={name} style={{ display: "flex", alignItems: "center", gap: 20, margin: "16px 0", opacity: ri, padding: "8px 14px", borderRadius: 14,
            background: hl ? "rgba(255,201,60,.25)" : "transparent", border: hl ? `4px solid ${YEL}` : "4px solid transparent" }}>
            <div style={{ width: 280, fontSize: 44, fontWeight: 700, color: hl ? YEL : "#e8f7ff" }}>{name}</div>
            <div style={{ flex: 1, height: 30, background: "rgba(255,255,255,.12)", borderRadius: 15, overflow: "hidden" }}>
              <div style={{ width: `${Math.max(1.2, (v / 31) * 100) * ri}%`, height: "100%", borderRadius: 15,
                background: esc ? (blink || picked ? "#ff5a4f" : "#7a2a26") : "linear-gradient(90deg,#3fb6ff,#6fe3ff)" }} />
            </div>
            <div style={{ width: 120, textAlign: "right", fontSize: 40, color: esc ? "#ff8a80" : "#bff3ff" }}>{lab}</div>
          </div>
        );
      })}
      {f >= S(T.pick) - 12 && f < S(T.pick) + 14 && (() => { // tap ripple on the Escudeiro row
        const u = (f - S(T.pick) + 12) / 26;
        return <div style={{ position: "absolute", left: 230, top: 600, width: 60 + 140 * u, height: 60 + 140 * u, marginLeft: -(30 + 70 * u), marginTop: -(30 + 70 * u),
          borderRadius: "50%", border: `6px solid ${YEL}`, opacity: 1 - u }} />;
      })()}
    </div>
  );
};
const AttrPanel: React.FC<{ f: number }> = ({ f }) => {
  const a = S(42.1), b = S(46.9);
  if (f < a || f >= b) return null;
  const rows: [string, number][] = [["DEFESA", 94], ["VIGOR", 86], ["FORÇA", 18], ["DESTREZA", 22], ["VELOCIDADE", 16], ["SORTE", 12]];
  const dmg = f >= S(45.0), shake = dmg && f < S(45.0) + 10 ? Math.sin(f * 2.4) * 10 * (1 - (f - S(45.0)) / 10) : 0;
  return (
    <div style={{ position: "absolute", left: 140, width: 800, top: 250, padding: "30px 44px", ...glass, ...pop(f, a, b) }}>
      <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: 3, textAlign: "center", color: YEL }}>ESCUDEIRO · NV.1</div>
      <div style={{ fontSize: 28, textAlign: "center", color: "#9fdcf0", marginBottom: 14 }}>ATRIBUTOS</div>
      {rows.map(([n, v], i) => {
        const k = smooth((f - a - 8 - i * 7) / 16), top = i < 2;
        return (
          <div key={n} style={{ display: "flex", alignItems: "center", gap: 18, margin: "14px 0" }}>
            <div style={{ width: 260, fontSize: 40, fontWeight: 700, color: top ? "#7dffb2" : "#e8f7ff" }}>{n}</div>
            <div style={{ flex: 1, height: 28, background: "rgba(255,255,255,.12)", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ width: `${v * k}%`, height: "100%", borderRadius: 14, background: top ? "linear-gradient(90deg,#2fd27a,#7dffb2)" : "linear-gradient(90deg,#3f6a8a,#6a8fae)" }} />
            </div>
            <div style={{ width: 70, textAlign: "right", fontSize: 38 }}>{Math.round(v * k)}</div>
          </div>
        );
      })}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, paddingTop: 16, borderTop: "3px solid rgba(111,227,255,.4)", opacity: dmg ? 1 : 0.25 }}>
        <div style={{ fontSize: 46, fontWeight: 700 }}>DANO</div>
        <div style={{ fontSize: 96, fontWeight: 700, color: "#ff4a3d", transform: `translateX(${shake}px)`, textShadow: "0 0 18px rgba(255,74,61,.7)" }}>{dmg ? "3" : "–"}</div>
      </div>
    </div>
  );
};
const Toast: React.FC<{ f: number; a: number; b: number; children: React.ReactNode; top?: number }> = ({ f, a, b, children, top = 300 }) => {
  if (f < a || f >= b) return null;
  return <div style={{ position: "absolute", left: 0, right: 0, top, display: "flex", justifyContent: "center" }}>
    <div style={{ ...glass, padding: "18px 36px", fontSize: 44, fontWeight: 700, ...pop(f, a, b) }}>{children}</div></div>;
};
const Tag: React.FC<{ x: number; y: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ x, y, style, children }) => (
  <div style={{ position: "absolute", left: Math.max(200, Math.min(W - 200, x)), top: y, transform: "translate(-50%, -100%)", whiteSpace: "nowrap", fontFamily: "Oswald", fontWeight: 700,
    fontSize: 40, color: "#fff", padding: "8px 22px", borderRadius: 14, background: "rgba(10,22,44,.82)", border: "4px solid #6fe3ff", ...style }}>{children}</div>
);
const EnemyBar: React.FC<{ f: number }> = ({ f }) => {
  const a = S(64.0), b = S(69.0);
  if (f < a || f >= b) return null;
  return (
    <div style={{ position: "absolute", left: 180, width: 720, top: 250, padding: "20px 34px", ...glass, border: "5px solid #ff6a5a", boxShadow: "0 0 26px rgba(255,90,80,.5)", ...pop(f, a, b) }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 44, fontWeight: 700 }}><span>Javali Selvagem</span><span style={{ color: "#ff8a80" }}>Nv.3</span></div>
      <div style={{ height: 34, marginTop: 12, background: "rgba(255,255,255,.12)", borderRadius: 17, overflow: "hidden", position: "relative" }}>
        <div style={{ width: "100%", height: "100%", background: "linear-gradient(90deg,#e0362c,#ff6a5a)" }} />
        <div style={{ position: "absolute", inset: 0, textAlign: "center", fontSize: 28, lineHeight: "34px" }}>120 / 120</div>
      </div>
    </div>
  );
};
const ReactionTimeline: React.FC<{ f: number }> = ({ f }) => {
  const a = S(69.2), b = S(75.0);
  if (f < a || f >= b) return null;
  const ms = Math.min(300, Math.max(0, ((f - S(70.0)) / (S(74.4) - S(70.0))) * 300)), X = (v: number) => 70 + (v / 300) * 800;
  return (
    <div style={{ position: "absolute", left: 50, width: 980, top: 230, padding: "28px 20px 40px", ...glass, ...pop(f, a, b) }}>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "baseline", gap: 14 }}>
        <span style={{ fontSize: 120, fontWeight: 700, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{Math.round(ms)}</span><span style={{ fontSize: 50 }}>ms</span>
      </div>
      <div style={{ position: "relative", height: 150 }}>
        <div style={{ position: "absolute", left: X(0), width: 800, top: 70, height: 14, background: "rgba(255,255,255,.25)", borderRadius: 7 }} />
        <div style={{ position: "absolute", left: X(0), width: X(ms) - X(0), top: 70, height: 14, background: "#6fe3ff", borderRadius: 7 }} />
        {[0, 100, 200, 300].map((v) => <div key={v} style={{ position: "absolute", left: X(v) - 40, width: 80, top: 100, textAlign: "center", fontSize: 30, color: "#9fdcf0" }}>{v}</div>)}
        {f >= S(71.0) && <div style={{ position: "absolute", left: X(250) - 4, top: 34, width: 8, height: 86, background: YEL }}><div style={{ position: "absolute", top: -46, left: -80, width: 160, textAlign: "center", fontSize: 34, fontWeight: 700, color: YEL }}>REAÇÃO</div></div>}
        {f >= S(73.4) && <div style={{ position: "absolute", left: X(300) - 4, top: 34, width: 8, height: 86, background: "#ff4a3d" }}><div style={{ position: "absolute", top: -46, left: -90, width: 180, textAlign: "center", fontSize: 34, fontWeight: 700, color: "#ff4a3d" }}>IMPACTO</div></div>}
      </div>
    </div>
  );
};
const BossCard: React.FC<{ f: number }> = ({ f }) => {
  const a = S(99.0), b = S(100.9);
  if (f < a || f >= b) return null;
  return (
    <div style={{ position: "absolute", left: 120, width: 840, top: 210, padding: "24px 30px", display: "flex", gap: 26, alignItems: "center", ...glass, border: "5px solid #ff4a3d", boxShadow: "0 0 30px rgba(255,74,61,.6)", ...pop(f, a, b) }}>
      <svg width="130" height="130" viewBox="0 0 100 100"><path d="M50 8C28 8 14 24 14 44c0 12 6 20 12 25v15h48V69c6-5 12-13 12-25C86 24 72 8 50 8z" fill="#f1ece0" stroke="#111" strokeWidth="5" />
        <ellipse cx="36" cy="46" rx="10" ry="12" fill="#111" /><ellipse cx="64" cy="46" rx="10" ry="12" fill="#111" /><circle cx="36" cy="47" r="4" fill="#ff3b2e" /><circle cx="64" cy="47" r="4" fill="#ff3b2e" />
        <path d="M44 66l6-8 6 8z" fill="#111" /><path d="M34 78v10M44 78v10M56 78v10M66 78v10" stroke="#111" strokeWidth="4" /></svg>
      <div>
        <div style={{ fontSize: 34, color: "#ffb4ad", letterSpacing: 2 }}>MASMORRA DAS RAÍZES</div>
        <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.05 }}>GUARDIÃO</div>
        <div style={{ fontSize: 50, fontWeight: 700, color: "#ff4a3d" }}>NÍVEL 30</div>
      </div>
    </div>
  );
};

// ---------------- the phone message (shot 2) ----------------
const PhoneMsg: React.FC<{ f: number }> = ({ f }) => {
  const a = S(9.2), b = S(13.0);
  if (f < a || f >= b) return null;
  const k = smooth((f - a) / 8);
  return (
    <div style={{ position: "absolute", left: 90, right: 90, top: 300, opacity: Math.min(1, (b - f) / 6), transform: `translateY(${(1 - k) * -80}px)` }}>
      <div style={{ background: "rgba(245,247,252,.97)", borderRadius: 40, padding: "26px 34px", boxShadow: "0 18px 40px rgba(0,0,0,.4)", display: "flex", gap: 26, alignItems: "center", fontFamily: "Oswald" }}>
        <div style={{ width: 110, height: 110, borderRadius: 55, background: "#3f8a5a", color: "#fff", fontSize: 60, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>L</div>
        <div>
          <div style={{ fontSize: 40, fontWeight: 700, color: "#1b2233" }}>Lucas <span style={{ fontWeight: 500, fontSize: 30, color: "#7a8399" }}>· agora</span></div>
          <div style={{ fontSize: 46, color: "#1b2233", display: "flex", alignItems: "center", gap: 12 }}>foi mal mano, não vou conseguir hj
            <svg width="50" height="50" viewBox="0 0 50 50"><circle cx="25" cy="25" r="22" fill="#ffd34d" stroke="#222" strokeWidth="3" /><circle cx="17" cy="21" r="3" fill="#222" /><circle cx="33" cy="21" r="3" fill="#222" /><path d="M15 36q10-8 20 0" stroke="#222" strokeWidth="3.5" fill="none" strokeLinecap="round" /></svg>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------- speech balloons (shot 12) ----------------
const Balloon: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS, b = BALLOONS.find((x) => t >= x.a && t < x.b);
  if (!b) return null;
  const head: V3 = b.who === "kael" ? [-0.5, 2.05, FZ + 0.25] : [-2.2, 2.0, FZ];
  const [hx, hy] = project(12, f, head);
  const k = smooth((t - b.a) * FPS / 6), o = clamp01((b.b - t) * FPS / 5);
  const bw = 760, left = Math.max(40, Math.min(W - 40 - bw, hx - bw / 2)), top = Math.max(180, hy - 380);
  return (
    <div style={{ position: "absolute", left, top, width: bw, opacity: o, transform: `scale(${0.8 + 0.2 * k})`, transformOrigin: `${hx - left}px 100%` }}>
      <div style={{ background: "#fff", border: "8px solid #111", borderRadius: 60, padding: "26px 36px", fontFamily: "Oswald", fontWeight: 700, fontSize: 54,
        lineHeight: 1.12, color: "#151515", textAlign: "center", boxShadow: "0 10px 0 rgba(0,0,0,.25)" }}>{b.text}</div>
      <svg style={{ position: "absolute", left: Math.max(60, Math.min(bw - 120, hx - left - 40)), top: "100%", marginTop: -8 }} width="90" height="80" viewBox="0 0 90 80">
        <path d="M6 0 L84 0 L30 74 Z" fill="#fff" stroke="#111" strokeWidth="8" strokeLinejoin="round" /><rect x="10" y="0" width="70" height="9" fill="#fff" />
      </svg>
    </div>
  );
};
const FloatLabels: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS, out: React.ReactNode[] = [];
  if (t >= 84.0 && t < 86.0) { const [x, y] = project(12, f, [-0.5, 2.35, FZ + 0.25]); out.push(<Tag key="k" x={x} y={y} style={pop(f, S(84), S(86))}>Kael · <span style={{ color: YEL }}>NV.24</span></Tag>); }
  if (t >= 101.2 && t < 103.9) {
    const [x, y] = project(12, f, [-2.2, 2.3, FZ]), on = Math.floor(f / 7) % 2 === 0;
    out.push(<Tag key="a" x={x} y={y} style={{ border: "4px solid #ff4a3d", color: on ? "#ff4a3d" : "#fff", fontSize: 52, top: Math.max(560, y) }}>André · NV.1</Tag>);
  }
  if (t >= 75.4 && t < 78.2) {
    out.push(<div key="bp" style={{ position: "absolute", left: 0, right: 0, top: 330, textAlign: "center", ...pop(f, S(75.4), S(78.2)) }}>
      <div style={{ fontFamily: "'Bebas Neue'", fontSize: 150, color: YEL, WebkitTextStroke: "12px #3a2200", paintOrder: "stroke fill", textShadow: "0 0 30px rgba(255,201,60,.8)" }}>BLOQUEIO PERFEITO</div>
    </div>);
    const [x, y] = project(11, f, [-2.2, 2.25, FZ]);
    out.push(<Tag key="d0" x={x} y={y + 30} style={{ ...pop(f, S(75.7), S(78.2)), color: "#7dffb2", border: "4px solid #7dffb2" }}>DANO 0</Tag>);
  }
  if (t >= 76.0 && t < 80.8) { const [x, y] = project(11, f, [0.4, 1.4, FZ + 0.5]); out.push(<Tag key="st" x={x} y={y} style={{ ...pop(f, S(76.0), S(80.8)), color: YEL, border: `4px solid ${YEL}` }}>ATORDOADO</Tag>); }
  return <>{out}</>;
};

// ---------------- A/B split (shot 13) ----------------
const Dungeon: React.FC<{ f: number }> = ({ f }) => {
  const fl = (s: number) => 1 + 0.12 * Math.sin(f * 0.9 + s) + 0.08 * Math.sin(f * 2.3 + s * 2);
  const eye = Math.floor(f / 40) % 3 !== 2 ? 1 : 0.2;
  const zoom = 1 + (f - S(104)) * 0.0006;
  return (
    <svg width={W} height={960} viewBox="0 0 1080 960" style={{ transform: `translateY(-110px) scale(${zoom})`, transformOrigin: "50% 60%" }}>
      <defs>
        <linearGradient id="nsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0d1638" /><stop offset="1" stopColor="#3a3f7a" /></linearGradient>
        <radialGradient id="torch"><stop offset="0" stopColor="#ffe9a0" stopOpacity="0.95" /><stop offset="1" stopColor="#ff8a3a" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="1080" height="960" fill="url(#nsky)" />
      {[[120, 90], [300, 160], [520, 70], [760, 130], [960, 60], [880, 220], [60, 260], [650, 210]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3} fill="#fff" opacity={0.8} />)}
      <circle cx="880" cy="150" r="56" fill="#fff4d6" />
      <path d="M-20 960 L120 520 L260 600 L420 300 L540 250 L680 330 L820 480 L960 430 L1100 600 L1100 960 Z" fill="#3b3352" stroke="#030303" strokeWidth="7" strokeLinejoin="round" />
      <path d="M420 300 L540 250 L600 300 L520 330 Z" fill="#5a5070" />
      <path d="M-20 960 L180 700 L360 760 L540 640 L760 720 L1100 680 L1100 960 Z" fill="#2c2840" stroke="#030303" strokeWidth="6" />
      {/* the arch */}
      <path d="M380 900 L380 620 Q540 470 700 620 L700 900 Z" fill="#8a8399" stroke="#030303" strokeWidth="8" />
      <path d="M430 900 L430 640 Q540 535 650 640 L650 900 Z" fill="#0a0812" stroke="#030303" strokeWidth="6" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => { const a = Math.PI * (0.08 + i * 0.14), x = 540 - Math.cos(a) * 140, y = 650 - Math.sin(a) * 130; return <path key={i} d={`M${540 - Math.cos(a) * 112} ${650 - Math.sin(a) * 105} L${x} ${y}`} stroke="#030303" strokeWidth="4" />; })}
      {/* skull keystone */}
      <g transform="translate(540 520)"><path d="M0 -40C-26 -40 -40 -22 -40 -2c0 12 6 20 12 24v14h56V22c6-4 12-12 12-24C40 -22 26 -40 0 -40z" fill="#efe8d8" stroke="#030303" strokeWidth="5" />
        <ellipse cx="-14" cy="-4" rx="9" ry="11" fill="#111" /><ellipse cx="14" cy="-4" rx="9" ry="11" fill="#111" /></g>
      {/* eyes in the dark */}
      <g opacity={eye}><ellipse cx="510" cy="770" rx="14" ry="9" fill="#ff2a1e" /><ellipse cx="572" cy="770" rx="14" ry="9" fill="#ff2a1e" />
        <ellipse cx="510" cy="770" rx="34" ry="24" fill="#ff2a1e" opacity="0.25" /><ellipse cx="572" cy="770" rx="34" ry="24" fill="#ff2a1e" opacity="0.25" /></g>
      {/* torches */}
      {[330, 750].map((x, i) => (
        <g key={x}><rect x={x - 9} y="650" width="18" height="110" fill="#5a3b2a" stroke="#030303" strokeWidth="5" />
          <circle cx={x} cy="630" r={90 * fl(i)} fill="url(#torch)" />
          <path d={`M${x - 22} 650 Q${x - 20} ${600 - 16 * fl(i + 1)} ${x} ${575 - 20 * fl(i)} Q${x + 22} ${605 - 10 * fl(i + 2)} ${x + 22} 650 Z`} fill="#ffb33a" stroke="#030303" strokeWidth="5" />
          <path d={`M${x - 9} 650 Q${x} ${615 - 8 * fl(i)} ${x + 9} 650 Z`} fill="#fff1a8" /></g>
      ))}
    </svg>
  );
};
const ChoiceBtn: React.FC<{ f: number; a: number; letter: string; title: string; sub: string; color: string }> = ({ f, a, letter, title, sub, color }) => {
  if (f < a) return null;
  const k = smooth((f - a) / 8);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 22, background: "rgba(10,14,28,.88)", border: `6px solid ${color}`, borderRadius: 30, padding: "16px 30px 16px 16px",
      transform: `scale(${0.7 + 0.3 * k})`, opacity: k, boxShadow: `0 0 26px ${color}88` }}>
      <div style={{ width: 110, height: 110, borderRadius: 24, background: color, color: "#111", fontFamily: "'Bebas Neue'", fontSize: 100, lineHeight: "118px", textAlign: "center" }}>{letter}</div>
      <div style={{ fontFamily: "Oswald", color: "#fff" }}><div style={{ fontSize: 50, fontWeight: 700, lineHeight: 1.05 }}>{title}</div><div style={{ fontSize: 32, color: "#cfd8ea" }}>{sub}</div></div>
    </div>
  );
};
const Split: React.FC<{ f: number; bg: React.ReactNode }> = ({ f, bg }) => {
  const a = S(104), k = smooth((f - a) / 10), t = f / FPS, c = CAPTIONS.find((l) => t >= l.a && t < l.b && l.a >= 104);
  const end = f >= S(108.2), ek = smooth((f - S(108.2)) / 9);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <div style={{ position: "absolute", left: 0, top: -960 * (1 - k), width: W, height: 960, overflow: "hidden" }}><Dungeon f={f} /></div>
      <div style={{ position: "absolute", left: 0, top: 960 + 960 * (1 - k), width: W, height: 960, overflow: "hidden" }}><div style={{ position: "absolute", top: -480, width: W, height: H }}>{bg}</div></div>
      <div style={{ position: "absolute", left: 40, right: 40, top: 700 }}><ChoiceBtn f={f} a={S(104.3)} letter="A" title="IR ATÉ A MASMORRA" sub="chefe nível 30 · André nível 1" color="#ff5a4f" /></div>
      <div style={{ position: "absolute", left: 40, right: 40, top: 1075 }}><ChoiceBtn f={f} a={S(105.7)} letter="B" title="CAÇAR JAVALIS" sub="subir de nível antes" color="#7dffb2" /></div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 960 - 80, height: 160, background: YEL, transform: `scaleX(${k})`, borderTop: "8px solid #111", borderBottom: "8px solid #111",
        display: "flex", alignItems: "center", justifyContent: "center" }}>
        {c && !end && <div style={{ fontFamily: "'Bebas Neue'", fontSize: 92, color: "#111", textAlign: "center", lineHeight: 1 }}>{c.text.replace(/\*/g, "").replace(" / ", " ")}</div>}
        {!c && !end && <div style={{ fontFamily: "'Bebas Neue'", fontSize: 110, color: "#111" }}>OU</div>}
      </div>
      {end && (
        <AbsoluteFill style={{ background: `rgba(0,0,0,${0.55 * ek})`, alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: YEL, border: "10px solid #111", borderRadius: 40, padding: "40px 50px", textAlign: "center", transform: `scale(${0.6 + 0.4 * ek}) rotate(${-3 + 3 * ek}deg)`, boxShadow: "0 20px 0 rgba(0,0,0,.4)" }}>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 170, lineHeight: 0.95, color: "#111" }}>COMENTA<br />A OU B</div>
            <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: 46, color: "#111", marginTop: 16 }}>a mais votada vira o EP. 2</div>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

// ---------------- transitions ----------------
const fadeBlack = (f: number) => {
  const t = f / FPS;
  if (t < 0.4) return 1 - t / 0.4;
  if (t >= T.blackout && t < 18) return smooth((t - T.blackout) / 0.6);
  if (t >= 18 && t < 18.5) return 1 - (t - 18) / 0.5;
  return 0;
};
const flashWhite = (f: number) => {
  const t = f / FPS;
  if (t >= 31.6 && t < 32) return smooth((t - 31.6) / 0.4);
  if (t >= 32 && t < 33) return 1 - smooth((t - 32) / 1.0);   // eyes open into the plaza
  for (const c of [51, 63, 75, 81]) { const n = f - S(c); if (n >= 0 && n < 5) return [0.8, 0.55, 0.3, 0.15, 0.05][n]; }
  if (Math.abs(t - T.impact) < 0.1) return 0.6;
  return 0;
};
const Streaks: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS;
  if (t < 16.4 || t >= 18) return null;
  const u = (t - 16.4) / 1.6;
  return (
    <AbsoluteFill style={{ mixBlendMode: "screen" }}>
      {Array.from({ length: 14 }, (_, i) => {
        const y = ((i * 263) % 1920), sp = 1 + (i % 4) * 0.6, x = ((u * 2600 * sp + i * 371) % 2800) - 1400;
        return <div key={i} style={{ position: "absolute", top: y, left: x, width: 900, height: 10 + (i % 3) * 8, borderRadius: 20, opacity: 0.7 * Math.min(1, u * 3),
          background: "linear-gradient(90deg, rgba(111,227,255,0), rgba(111,227,255,1), rgba(255,255,255,0))" }} />;
      })}
    </AbsoluteFill>
  );
};

// ---------------- the short ----------------
type Props = { bg?: "live" | "video" };
export const EscudeiroShort: React.FC = () => {
  const f = useCurrentFrame();
  useFonts();
  const kit = useKit();
  const mode = (getInputProps() as Props).bg ?? "live";
  if (!kit) return null;
  const s = shotAt(f), t = f / FPS;
  const bg = mode === "video"
    ? <OffthreadVideo src={staticFile("escudeiro_bg.mp4")} muted style={{ width: W, height: H }} />
    : is3D(s.id) ? <ShotView key={s.id} id={s.id} kit={kit} /> : null;
  const gray = s.id === 10 ? Math.min(1, (f - s.a) / 6) : 0;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {s.id === 13 ? <Split f={f} bg={bg} /> : (
        <AbsoluteFill style={{ filter: gray ? `grayscale(${gray * 0.85}) contrast(${1 + 0.1 * gray}) brightness(${1 - 0.15 * gray})` : undefined }}>{is3D(s.id) && bg}</AbsoluteFill>
      )}
      {s.id === 4 && <Brain f={f - s.a} dur={s.b - s.a} />}
      {s.id === 8 && <Spindles f={f - s.a} dur={s.b - s.a} />}
      <PhoneMsg f={f} />
      <ClassPanel f={f} />
      <AttrPanel f={f} />
      <Toast f={f} a={S(47.7)} b={S(50.6)} top={260}>+ ESCUDO REDONDO <span style={{ color: YEL }}>· 4,5 kg</span></Toast>
      <EnemyBar f={f} />
      <ReactionTimeline f={f} />
      <BossCard f={f} />
      {s.id === 12 && <Balloon f={f} />}
      <FloatLabels f={f} />
      <Streaks f={f} />
      <Captions f={f} />
      <AbsoluteFill style={{ background: "#fff", opacity: flashWhite(f), pointerEvents: "none" }} />
      <AbsoluteFill style={{ background: "#000", opacity: fadeBlack(f), pointerEvents: "none" }} />
      {t < 0 && <Sequence>{null}</Sequence>}
    </AbsoluteFill>
  );
};

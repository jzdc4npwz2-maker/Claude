// The two x-ray "science" scenes, drawn as animated SVG: always the same teal grid, glowing blue lines and pink organs,
// so the audience learns "blue screen = science moment". f is the frame inside the scene (30 fps).
import React from "react";
import { AbsoluteFill } from "remotion";

const BLUE = "#6fe3ff", PINK = "#ff8fb3", YEL = "#FFC93C", BG = "#0b2a35";
const cl = (x: number) => Math.max(0, Math.min(1, x));
const sm = (x: number) => { const u = cl(x); return u * u * (3 - 2 * u); };
type P = [number, number];
/** point at fraction u along a polyline */
const along = (pts: P[], u: number): P => {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1])), tot = seg.reduce((a, b) => a + b, 0);
  let d = cl(u) * tot;
  for (let i = 0; i < seg.length; i++) { if (d <= seg[i]) { const k = d / seg[i]; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k]; } d -= seg[i]; }
  return pts[pts.length - 1];
};
const qpts = (a: P, c: P, b: P, n = 24): P[] => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, s = 1 - t; return [s * s * a[0] + 2 * s * t * c[0] + t * t * b[0], s * s * a[1] + 2 * s * t * c[1] + t * t * b[1]] as P; });
const poly = (pts: P[]) => "M" + pts.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join(" L");

const Grid: React.FC<{ f: number }> = ({ f }) => (
  <>
    <defs>
      <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M60 0H0V60" fill="none" stroke="#14566a" strokeWidth="2" /></pattern>
      <radialGradient id="vig" cx="50%" cy="48%" r="70%"><stop offset="0.55" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.7" /></radialGradient>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>
    <rect width="1080" height="1920" fill={BG} />
    <rect width="1080" height="1920" fill="url(#grid)" transform={`translate(0 ${(f * 0.6) % 60})`} />
    <rect x="0" y={(f * 9) % 2200 - 140} width="1080" height="120" fill={BLUE} opacity="0.05" />
  </>
);
const Pulse: React.FC<{ p: P; r?: number; c?: string }> = ({ p, r = 13, c = YEL }) => (
  <g filter="url(#glow)"><circle cx={p[0]} cy={p[1]} r={r * 1.9} fill={c} opacity="0.3" /><circle cx={p[0]} cy={p[1]} r={r} fill={c} /><circle cx={p[0]} cy={p[1]} r={r * 0.45} fill="#fff" /></g>
);
const Label: React.FC<{ x: number; y: number; o: number; children: React.ReactNode; c?: string }> = ({ x, y, o, children, c = BLUE }) => (
  <g opacity={o}><rect x={x - 10} y={y - 52} width={String(children).length * 25 + 40} height="68" rx="14" fill="rgba(5,20,28,.85)" stroke={c} strokeWidth="4" />
    <text x={x + 10} y={y} fontFamily="Oswald" fontWeight="700" fontSize="42" fill={c} letterSpacing="2">{children}</text></g>
);

// ---------------- scene 4: the brain never saw anything ----------------
const HEAD = "M380 1330 C380 1250 300 1150 290 1010 C270 760 400 560 560 545 C720 532 820 640 835 790 C838 830 850 850 885 905 C902 930 896 948 860 952 C855 975 870 990 856 1004 C868 1020 860 1050 838 1060 C834 1100 820 1130 770 1135 C735 1138 715 1150 712 1200 L720 1330";
export const Brain: React.FC<{ f: number; dur: number }> = ({ f }) => {
  const t = f / 30;
  const draw = sm(t / 2.4), dark = sm((t - 7.4) / 1.2), helmet = sm((t - 10.9) / 0.8), eyeOff = sm((t - 11.3) / 0.8), ask = sm((t - 12.8) / 0.4);
  const eye: P = [790, 855], cortex: P = [380, 930];
  const nerve = qpts([eye[0] - 20, eye[1] + 5], [560, 990], cortex);
  const fromHelmet = qpts([905, 852], [740, 930], [560, 960]).concat(qpts([560, 960], [480, 980], cortex).slice(1));
  const sig = t >= 8.9;
  const pulses: P[] = [];
  if (sig) for (let i = 0; i < 4; i++) { const u = ((t - 8.9) * 0.9 + i * 0.25) % 1; pulses.push(along(helmet > 0.5 ? fromHelmet : nerve, u)); }
  const gyri = Array.from({ length: 9 }, (_, i) => { const x = 380 + i * 42; return `M${x} 760 q 20 40 0 80 q -20 40 0 80`; });
  return (
    <AbsoluteFill>
      <svg width="1080" height="1920" viewBox="0 0 1080 1920">
        <Grid f={f} />
        <g opacity={0.95}>
          <path d={HEAD} fill="rgba(111,227,255,.08)" stroke={BLUE} strokeWidth="10" strokeLinecap="round" strokeDasharray="3200" strokeDashoffset={3200 * (1 - draw)} filter="url(#glow)" />
          {/* skull */}
          <path d="M330 1000 C320 790 430 610 560 600 C700 590 790 690 795 820 L760 900 C700 990 520 1060 420 1080 Z" fill="none" stroke={BLUE} strokeWidth="5" opacity={0.5 * draw} />
          {/* darkness inside the skull */}
          <path d="M340 990 C330 800 440 630 560 620 C690 610 775 700 780 820 L748 892 C690 975 520 1045 425 1065 Z" fill="#000" opacity={0.75 * dark} />
          {/* brain */}
          <g opacity={sm((t - 1.6) / 0.8) * (1 - 0.35 * dark)} filter="url(#glow)">
            <path d="M360 900 C340 780 430 690 560 690 C690 690 760 760 750 850 C745 930 690 975 600 985 C520 1000 430 990 380 960 Z" fill={PINK} fillOpacity="0.85" stroke="#ffd0df" strokeWidth="6" />
            {gyri.map((d, i) => <path key={i} d={d} stroke="#c94f78" strokeWidth="6" fill="none" opacity="0.8" />)}
            <ellipse cx={cortex[0] + 18} cy={cortex[1]} rx="34" ry="28" fill={sig ? YEL : PINK} opacity={sig ? 0.9 : 0.4} />
          </g>
          {/* eye + optic nerve */}
          <g opacity={draw * (1 - 0.8 * eyeOff)}>
            <circle cx={eye[0]} cy={eye[1]} r="38" fill="#e9fbff" stroke={BLUE} strokeWidth="6" />
            <circle cx={eye[0] + 12} cy={eye[1]} r="15" fill="#123" />
          </g>
          <path d={poly(nerve)} stroke={BLUE} strokeWidth="9" fill="none" opacity={0.85 * draw} filter="url(#glow)" />
          {pulses.map((p, i) => <Pulse key={i} p={p} />)}
          {/* the VR helmet slides over the eyes */}
          <g transform={`translate(${(1 - helmet) * 500} 0)`} opacity={helmet}>
            <rect x="745" y="790" width="230" height="135" rx="40" fill="#2a3042" stroke="#030303" strokeWidth="8" />
            <rect x="770" y="822" width="150" height="58" rx="20" fill={BLUE} filter="url(#glow)" />
            <rect x="960" y="820" width="140" height="40" fill="#2a3042" stroke="#030303" strokeWidth="6" />
          </g>
          <g opacity={ask} transform={`translate(560 760) scale(${0.6 + 0.4 * ask})`}>
            <circle r="78" fill={YEL} stroke="#030303" strokeWidth="8" /><text y="34" textAnchor="middle" fontFamily="'Bebas Neue'" fontSize="130" fill="#111">?</text>
          </g>
        </g>
        <Label x={680} y={700} o={sm((t - 4.2) / 0.5) * (1 - sm((t - 7.2) / 0.4))} c={YEL}>OLHO</Label>
        <Label x={140} y={640} o={sm((t - 8.9) / 0.4) * (1 - sm((t - 10.8) / 0.4))}>SINAL ELÉTRICO</Label>
        <Label x={700} y={1060} o={sm((t - 11.2) / 0.4)} c={YEL}>MESMO SINAL</Label>
      </svg>
    </AbsoluteFill>
  );
};

// ---------------- scene 8: muscle spindles ----------------
export const Spindles: React.FC<{ f: number; dur: number }> = ({ f }) => {
  const t = f / 30;
  const draw = sm(t / 1.8), spin = sm((t - 1.6) / 0.6), stretch = t > 4.4 && t < 7.8 ? 0.5 + 0.5 * Math.sin((t - 4.4) * 5) : 0;
  const game = sm((t - 7.8) / 0.6), droop = sm((t - 10.0) / 0.7);
  const Sh: P = [210, 720], El: P = [470, 1040 + 20 * droop], Hd: P = [830, 980 + 140 * droop], sc: P = [Hd[0] + 40, Hd[1] - 40];
  const brain: P = [210, 330], helm: P = [560, 330];
  const mid: P = [(Sh[0] + El[0]) / 2, (Sh[1] + El[1]) / 2], ang = (Math.atan2(El[1] - Sh[1], El[0] - Sh[0]) * 180) / Math.PI, len = Math.hypot(El[0] - Sh[0], El[1] - Sh[1]);
  const nerve = qpts([mid[0] + 10, mid[1] - 40], [140, 560], [brain[0], brain[1] + 70]);
  const pulses: P[] = [];
  if (t > 4.4 && t < 8.0) for (let i = 0; i < 3; i++) pulses.push(along(nerve, ((t - 4.4) * 0.8 + i / 3) % 1));
  if (t >= 8.0) for (let i = 0; i < 3; i++) pulses.push(along([[helm[0] - 60, helm[1]], [brain[0] + 90, brain[1]]], ((t - 8.0) * 1.0 + i / 3) % 1));
  const spiral = (cx: number, cy: number, k: number, key: number, on: boolean) => {
    const pts: P[] = []; for (let i = 0; i < 40; i++) { const a = i * 0.9; pts.push([cx - 50 * k + (i / 40) * 100 * k, cy + Math.sin(a) * 16]); }
    return <path key={key} d={poly(pts)} stroke={on ? YEL : "#d07a98"} strokeWidth="6" fill="none" filter={on ? "url(#glow)" : undefined} />;
  };
  return (
    <AbsoluteFill>
      <svg width="1080" height="1920" viewBox="0 0 1080 1920">
        <Grid f={f} />
        {/* arm outline (skin) */}
        <g opacity={draw}>
          <path d={poly([Sh, El, Hd])} stroke="rgba(111,227,255,.18)" strokeWidth="200" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d={poly([Sh, El, Hd])} stroke={BLUE} strokeWidth="200" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.12" />
          {/* bones */}
          <path d={poly([Sh, El])} stroke="#e9fbff" strokeWidth="26" strokeLinecap="round" filter="url(#glow)" />
          <path d={poly([[El[0] + 8, El[1] - 10], [Hd[0] - 10, Hd[1] - 14]])} stroke="#e9fbff" strokeWidth="16" strokeLinecap="round" />
          <path d={poly([[El[0] + 8, El[1] + 14], [Hd[0] - 10, Hd[1] + 10]])} stroke="#e9fbff" strokeWidth="16" strokeLinecap="round" />
          {/* biceps */}
          <g transform={`translate(${mid[0]} ${mid[1]}) rotate(${ang}) translate(0 -46)`}>
            <ellipse rx={len * 0.42 * (1 + 0.12 * stretch + 0.1 * droop)} ry={48 * (1 - 0.15 * stretch)} fill={PINK} fillOpacity="0.8" stroke="#ffd0df" strokeWidth="6" />
            <g opacity={spin}>{[-60, 0, 60].map((x, i) => spiral(x, i % 2 ? 10 : -8, 0.45 * (1 + 0.5 * stretch + 0.4 * droop), i, stretch > 0.3 || droop > 0.5))}</g>
          </g>
        </g>
        {/* the shield in the hand */}
        <g opacity={draw}>
          <circle cx={sc[0]} cy={sc[1]} r="150" fill="rgba(111,227,255,.08)" stroke={BLUE} strokeWidth="9" filter="url(#glow)" />
          <circle cx={sc[0]} cy={sc[1]} r="34" fill="none" stroke={BLUE} strokeWidth="7" />
        </g>
        {/* weight tag + arrow */}
        <g opacity={droop} transform={`translate(${sc[0] - 150} ${sc[1] + 190})`}>
          <rect width="300" height="84" rx="16" fill={YEL} stroke="#030303" strokeWidth="6" />
          <text x="150" y="60" textAnchor="middle" fontFamily="Oswald" fontWeight="700" fontSize="46" fill="#111">PESO: 4,5 kg</text>
          <path d={`M150 110 v ${60 + 20 * Math.sin(t * 8)} m -30 -30 l 30 30 l 30 -30`} stroke={YEL} strokeWidth="12" fill="none" strokeLinecap="round" />
        </g>
        {/* nerve to the brain */}
        <path d={poly(nerve)} stroke={BLUE} strokeWidth="7" fill="none" opacity={0.7 * spin} strokeDasharray="14 12" />
        <g opacity={spin} transform={`translate(${brain[0]} ${brain[1]})`} filter="url(#glow)">
          <ellipse rx="95" ry="70" fill={PINK} fillOpacity="0.85" stroke="#ffd0df" strokeWidth="6" />
          {[-50, -20, 10, 40].map((x) => <path key={x} d={`M${x} -50 q 14 25 0 50 q -14 25 0 45`} stroke="#c94f78" strokeWidth="5" fill="none" />)}
        </g>
        <g opacity={game} transform={`translate(${helm[0] + (1 - game) * 400} ${helm[1]})`}>
          <rect x="-80" y="-55" width="190" height="110" rx="34" fill="#2a3042" stroke="#030303" strokeWidth="7" />
          <rect x="-58" y="-26" width="130" height="48" rx="16" fill={BLUE} filter="url(#glow)" />
        </g>
        {pulses.map((p, i) => <Pulse key={i} p={p} />)}
        <Label x={500} y={640} o={spin * (1 - sm((t - 7.6) / 0.4))} c={YEL}>FUSOS MUSCULARES</Label>
        <Label x={300} y={180} o={sm((t - 4.6) / 0.4) * (1 - sm((t - 7.6) / 0.4))}>"ESTICADO!"</Label>
        <Label x={370} y={180} o={game} c={YEL}>O JOGO MANDA O SINAL</Label>
      </svg>
    </AbsoluteFill>
  );
};

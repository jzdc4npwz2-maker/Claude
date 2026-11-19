// The two "science" scenes of Coroa de Ferro, as animated SVG on the same teal grid as the Ep. 1 x-rays
// (blue screen = science moment). f is the frame inside the scene (30 fps); times are seconds from the scene start.
import React from "react";
import { AbsoluteFill } from "remotion";

const BLUE = "#6fe3ff", PINK = "#ff8fb3", YEL = "#FFC93C", RED = "#ff5a4f", BG = "#0b2a35";
const cl = (x: number) => Math.max(0, Math.min(1, x));
const sm = (x: number) => { const u = cl(x); return u * u * (3 - 2 * u); };
const pop = (t: number, a: number) => { const u = cl((t - a) / 0.25); return 0.6 + 0.4 * (1 - (1 - u) ** 3) + 0.08 * Math.sin(u * Math.PI); };

const Grid: React.FC<{ f: number }> = ({ f }) => (
  <>
    <defs>
      <pattern id="grid2" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M60 0H0V60" fill="none" stroke="#14566a" strokeWidth="2" /></pattern>
      <filter id="glow2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>
    <rect width="1080" height="1920" fill={BG} />
    <rect width="1080" height="1920" fill="url(#grid2)" transform={`translate(0 ${(f * 0.6) % 60})`} />
    <rect x="0" y={(f * 9) % 2200 - 140} width="1080" height="120" fill={BLUE} opacity="0.05" />
  </>
);
const Tag: React.FC<{ x: number; y: number; o: number; s?: number; c?: string; size?: number; children: string }> = ({ x, y, o, s = 1, c = BLUE, size = 46, children }) => {
  const w = children.length * size * 0.56 + 44;
  return (
    <g opacity={o} transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-w / 2} y={-size * 0.95} width={w} height={size * 1.45} rx="16" fill="rgba(5,20,28,.88)" stroke={c} strokeWidth="5" />
      <text x="0" y={size * 0.25} textAnchor="middle" fontFamily="Oswald" fontWeight="700" fontSize={size} fill={c} letterSpacing="2">{children}</text>
    </g>
  );
};

// a suit of plate armour in glowing outline (front), centred at x = 540
const Armour: React.FC<{ y: number; s: number; draw: number; hi: number }> = ({ y, s, draw, hi }) => {
  const d = 2600, off = d * (1 - draw);
  const st = { fill: "rgba(111,227,255,.08)", stroke: BLUE, strokeWidth: 9, strokeLinejoin: "round" as const, strokeDasharray: d, strokeDashoffset: off };
  const pl = { ...st, fill: `rgba(255,201,60,${0.18 * hi})`, stroke: hi > 0.05 ? YEL : BLUE };
  return (
    <g transform={`translate(540 ${y}) scale(${s})`} filter="url(#glow2)">
      <path d="M-70 -420 Q-75 -500 0 -505 Q75 -500 70 -420 L70 -330 Q0 -310 -70 -330 Z" {...pl} />
      <path d="M-55 -385 H55" stroke={BLUE} strokeWidth="10" opacity={draw} />
      <path d="M-150 -300 Q-160 -330 -110 -330 H110 Q160 -330 150 -300 L130 -90 Q0 -60 -130 -90 Z" {...pl} />
      <path d="M-130 -90 L-140 0 H140 L130 -90" {...pl} />
      <ellipse cx="-175" cy="-300" rx="75" ry="48" {...pl} /><ellipse cx="175" cy="-300" rx="75" ry="48" {...pl} />
      <path d="M-200 -260 L-225 -60 L-185 -50 L-160 -250" {...st} /><path d="M200 -260 L225 -60 L185 -50 L160 -250" {...st} />
      <path d="M-110 0 L-120 300 L-60 300 L-40 0" {...pl} /><path d="M110 0 L120 300 L60 300 L40 0" {...pl} />
      <path d="M-130 300 H-50 L-45 340 H-140 Z" {...st} /><path d="M130 300 H50 L45 340 H140 Z" {...st} />
    </g>
  );
};

/** scene 11 (35.8-51.3): armour weight -> treadmill energy x2 -> squeezed breathing */
export const ArmourSci: React.FC<{ f: number }> = ({ f }) => {
  const t = f / 30;
  const A = sm((5.0 - t) / 0.35), B = sm((t - 5.0) / 0.35) * sm((11.6 - t) / 0.35), C = sm((t - 11.6) / 0.35);
  // phase A: armour + weight
  const kg = t >= 3.25, ku = cl((t - 3.25) / 0.6);
  // phase B: treadmill
  const walk = (t * 1.6) % 1, leg = Math.sin(walk * Math.PI * 2) * 26;
  const e = sm((t - 8.9) / 1.0), mult = 1 + 1.2 * e;
  // phase C: lungs
  const br = Math.sin(t * 9) * 0.5 + 0.5, squeeze = sm((t - 12.2) / 0.6);
  return (
    <AbsoluteFill>
      <svg width="1080" height="1920" viewBox="0 0 1080 1920">
        <Grid f={f} />
        <g opacity={A}>
          <Armour y={1080} s={1.15} draw={sm(t / 1.6)} hi={sm((t - 1.4) / 0.6)} />
          {kg && <g transform={`translate(540 520) scale(${pop(t, 3.25)})`}>
            <rect x="-300" y="-95" width="600" height="170" rx="30" fill={YEL} stroke="#111" strokeWidth="9" />
            <text x="0" y="40" textAnchor="middle" fontFamily="'Bebas Neue'" fontSize="150" fill="#111">{`${Math.round(30 * ku)}–${Math.round(50 * ku)} KG`}</text>
          </g>}
        </g>
        <g opacity={B}>
          {/* treadmill */}
          <g transform="translate(540 1180)">
            <rect x="-330" y="40" width="660" height="56" rx="28" fill="rgba(111,227,255,.12)" stroke={BLUE} strokeWidth="8" />
            {Array.from({ length: 9 }, (_, i) => <line key={i} x1={-300 + ((i * 75 + t * 160) % 660)} y1="52" x2={-320 + ((i * 75 + t * 160) % 660)} y2="84" stroke={BLUE} strokeWidth="5" opacity=".7" />)}
            <path d="M250 40 L300 -260 L210 -280" fill="none" stroke={BLUE} strokeWidth="10" strokeLinecap="round" />
            {/* walker in armour (simple glowing figure) */}
            <g filter="url(#glow2)" stroke={YEL} strokeWidth="14" strokeLinecap="round" fill="none">
              <circle cx="0" cy="-380" r="46" fill="rgba(255,201,60,.15)" />
              <path d="M0 -330 L0 -150" strokeWidth="60" stroke="rgba(255,201,60,.35)" />
              <path d="M0 -330 L0 -150" />
              <path d={`M0 -150 L${leg} -50 L${leg * 1.2} 36`} /><path d={`M0 -150 L${-leg} -50 L${-leg * 1.2} 36`} />
              <path d={`M0 -300 L${-leg} -220 L${-leg * 0.6} -160`} /><path d={`M0 -300 L${leg} -220 L${leg * 0.6} -160`} />
            </g>
          </g>
          {/* energy bars */}
          <g transform="translate(130 420)">
            <text x="0" y="0" fontFamily="Oswald" fontWeight="700" fontSize="44" fill="#bff3ff">ENERGIA PRA ANDAR</text>
            <text x="0" y="90" fontFamily="Oswald" fontWeight="500" fontSize="36" fill="#9fdcf0">SEM ARMADURA</text>
            <rect x="0" y="110" width="360" height="48" rx="24" fill={BLUE} />
            <text x="0" y="230" fontFamily="Oswald" fontWeight="500" fontSize="36" fill="#9fdcf0">COM ARMADURA</text>
            <rect x="0" y="250" width={360 * mult} height="48" rx="24" fill={e > 0.5 ? RED : BLUE} />
            {e > 0.05 && <text x={360 * mult + 24} y="295" fontFamily="'Bebas Neue'" fontSize="96" fill={RED} opacity={e}>×2</text>}
          </g>
        </g>
        <g opacity={C}>
          {/* torso with lungs squeezed by the breastplate */}
          <g transform="translate(540 1000)" filter="url(#glow2)">
            <path d="M-260 -380 Q-300 -400 -240 -430 H240 Q300 -400 260 -380 L230 220 Q0 280 -230 220 Z" fill="rgba(111,227,255,.06)" stroke={BLUE} strokeWidth="9" />
            {[-1, 1].map((sd) => {
              const rx = 105 * (1 - 0.25 * squeeze) * (0.9 + 0.1 * br), ry = 210 * (1 - 0.12 * squeeze) * (0.94 + 0.06 * br);
              return <ellipse key={sd} cx={sd * 115} cy="-90" rx={rx} ry={ry} fill="rgba(255,143,179,.35)" stroke={PINK} strokeWidth="9" />;
            })}
            <path d="M0 -380 V-240 M0 -240 L-90 -170 M0 -240 L90 -170" stroke={PINK} strokeWidth="10" fill="none" />
            {/* the plate closing in */}
            {[-1, 1].map((sd) => <path key={sd} d={`M${sd * (300 - 70 * squeeze)} -400 Q${sd * (250 - 60 * squeeze)} -90 ${sd * (290 - 60 * squeeze)} 230`} stroke={YEL} strokeWidth="22" fill="none" strokeLinecap="round" />)}
            {[-1, 1].map((sd) => <path key={"a" + sd} d={`M${sd * 420} -90 l${-sd * 70} 0 m${sd * 26} -26 l${-sd * 26} 26 l${sd * 26} 26`} stroke={YEL} strokeWidth="12" fill="none" strokeLinecap="round" opacity={squeeze} />)}
          </g>
          {/* quick, shallow breaths */}
          <g transform="translate(540 1460)">
            <path d={"M-380 0 " + Array.from({ length: 49 }, (_, i) => `L${-380 + i * 16} ${-Math.sin((i * 16 + t * 600) / (60 - 30 * squeeze)) * (70 - 45 * squeeze)}`).join(" ")} stroke={PINK} strokeWidth="9" fill="none" />
          </g>
          <Tag x={540} y={470} o={sm((t - 13.4) / 0.3)} s={pop(t, 13.4)} c={RED} size={60}>RESPIRAÇÃO CURTA</Tag>
        </g>
      </svg>
    </AbsoluteFill>
  );
};

/** scene 15 (67.0-77.5): heavy + fast is hard to stop -> mass x velocity -> truck vs bicycle braking */
export const MomentumSci: React.FC<{ f: number }> = ({ f }) => {
  const t = f / 30;
  const A = sm((6.0 - t) / 0.35), B = sm((t - 6.0) / 0.35);
  // phase A: a block slides with a big arrow; mass x velocity
  const mv = sm((t - 3.3) / 0.5);
  // phase B: braking race from the same line
  const bt = Math.max(0, t - 6.6), bike = Math.min(1, bt / 0.9), truck = Math.min(1, bt / 3.2);
  const ease = (u: number) => 1 - (1 - u) ** 2;
  const L0 = 140, bikeStop = 330, truckStop = 860;
  return (
    <AbsoluteFill>
      <svg width="1080" height="1920" viewBox="0 0 1080 1920">
        <Grid f={f} />
        <g opacity={A}>
          <g transform={`translate(${200 + 140 * Math.min(1, t / 3)} 1050)`} filter="url(#glow2)">
            <rect x="-120" y="-200" width="300" height="200" rx="18" fill="rgba(255,201,60,.18)" stroke={YEL} strokeWidth="10" />
            <text x="30" y="-75" textAnchor="middle" fontFamily="'Bebas Neue'" fontSize="110" fill={YEL}>AÇO</text>
            <path d="M220 -100 h240 m-60 -50 l60 50 l-60 50" stroke={RED} strokeWidth="18" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </g>
          <line x1="60" y1="1052" x2="1020" y2="1052" stroke={BLUE} strokeWidth="8" />
          <g opacity={mv} transform={`translate(540 640) scale(${0.8 + 0.2 * mv})`}>
            <rect x="-420" y="-110" width="840" height="190" rx="30" fill="rgba(5,20,28,.9)" stroke={YEL} strokeWidth="8" />
            <text x="0" y="22" textAnchor="middle" fontFamily="'Bebas Neue'" fontSize="104" fill="#fff"><tspan fill={YEL}>MASSA</tspan> × <tspan fill={YEL}>VELOCIDADE</tspan></text>
          </g>
          <Tag x={540} y={1330} o={sm((t - 4.6) / 0.3)} s={pop(t, 4.6)} c={RED} size={56}>MAIS FORÇA PRA FREAR</Tag>
        </g>
        <g opacity={B}>
          {[["BICICLETA", 820, bikeStop, bike], ["CAMINHÃO", 1230, truckStop, truck]].map(([name, y, stop, u]) => {
            const x = L0 + ((stop as number) - L0) * ease(u as number), Y = y as number;
            return (
              <g key={name as string}>
                <text x="70" y={Y - 200} fontFamily="Oswald" fontWeight="700" fontSize="52" fill="#bff3ff">{name as string}</text>
                <line x1="60" y1={Y} x2="1020" y2={Y} stroke={BLUE} strokeWidth="8" />
                <line x1={L0} y1={Y - 170} x2={L0} y2={Y + 30} stroke={YEL} strokeWidth="6" strokeDasharray="16 12" />
                <line x1={L0} y1={Y + 60} x2={x} y2={Y + 60} stroke={RED} strokeWidth="10" strokeLinecap="round" />
                <g transform={`translate(${x} ${Y})`} filter="url(#glow2)" fill="none" stroke={name === "BICICLETA" ? BLUE : YEL} strokeWidth="9" strokeLinejoin="round">
                  {name === "BICICLETA" ? (<>
                    <circle cx="-60" cy="-45" r="42" /><circle cx="60" cy="-45" r="42" /><path d="M-60 -45 L-15 -110 L45 -110 L60 -45 M-15 -110 L-30 -135 M45 -110 L50 -140 h20" />
                  </>) : (<>
                    <rect x="-210" y="-190" width="250" height="140" rx="10" fill="rgba(255,201,60,.12)" /><path d="M40 -150 h70 l40 50 v50 h-110 Z" fill="rgba(255,201,60,.12)" />
                    <circle cx="-150" cy="-40" r="34" /><circle cx="-60" cy="-40" r="34" /><circle cx="100" cy="-40" r="34" />
                  </>)}
                </g>
              </g>
            );
          })}
          <Tag x={540} y={420} o={sm((t - 6.3) / 0.3)} s={pop(t, 6.3)} c={YEL} size={54}>FREIAM NA MESMA LINHA</Tag>
        </g>
      </svg>
    </AbsoluteFill>
  );
};

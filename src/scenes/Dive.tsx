import React from 'react';
import {AbsoluteFill, random, useCurrentFrame} from 'remotion';
import {COLORS, FONTS, H, W} from '../theme';
import {E, clamp01, lerp, prog} from '../lib/ease';
import {T, local, pulse} from '../lib/timing';

const FROM = T.scenes.dive.from;
const LEN = T.scenes.dive.to - FROM;
const PASSES = T.cues.divePassBeats.map((b) => local(b, FROM));
const FOCAL = 1000;
const CX = W / 2;
const CY = H / 2;
const BUILD = PASSES[PASSES.length - 1];
export const TITLE_SIZE = 220;

// camera Z: a slow drift plus a 1000-unit surge centred on each pass beat
// (it opens with a decelerating rush that carries the swarm's dive momentum)
const ENTRY = 2600;
const cruise = (f: number) =>
  ENTRY * E.quintOut(clamp01(f / 22)) +
  f * 6 +
  PASSES.reduce((z, p) => z + 1000 * E.quartInOut(clamp01((f - (p - 9)) / 18)), 0);
const C_BUILD = cruise(BUILD);
const Z_TITLE = C_BUILD + 4200;
// after the last pass the camera accelerates into the title plane, arriving on the drop
const camZ = (f: number) => {
  if (f <= BUILD) return cruise(f);
  const t = clamp01((f - BUILD) / (LEN - BUILD));
  return C_BUILD + (Z_TITLE - FOCAL - C_BUILD) * E.expoIn(t);
};

const WORDS = [
  {text: 'FORM', ox: -520, oy: -230, style: 'fill', color: COLORS.paper},
  {text: 'RHYTHM', ox: 480, oy: 250, style: 'stroke', color: COLORS.signal},
  {text: 'DEPTH', ox: 520, oy: -250, style: 'fill', color: COLORS.signal},
  {text: 'FLOW', ox: -540, oy: 250, style: 'stroke', color: COLORS.paper},
].map((w, i) => ({...w, z: cruise(PASSES[i] + 1) + 70}));

const STARS = Array.from({length: 240}, (_, i) => ({
  x: (random(`sx${i}`) - 0.5) * 3600,
  y: (random(`sy${i}`) - 0.5) * 2200,
  z: random(`sz${i}`) * 6000,
  c: i % 11 === 0 ? COLORS.signal : i % 17 === 0 ? COLORS.ultra : COLORS.paper,
}));

const Plane: React.FC<{dist: number; ox: number; oy: number; children: React.ReactNode; focus?: number}> = ({dist, ox, oy, children, focus = 900}) => {
  if (dist < 40) return null;
  const s = FOCAL / dist;
  if (s > 9) return null;
  const blur = Math.min(14, Math.abs(dist - focus) * 0.005);
  const fadeIn = clamp01((5200 - dist) / 1600);
  const fadeOut = clamp01((dist - 60) / 260);
  return (
    <div style={{position: 'absolute', inset: 0, filter: blur > 0.3 ? `blur(${blur}px)` : undefined, opacity: fadeIn * fadeOut}}>
      <div
        style={{
          position: 'absolute',
          left: CX + ox * s,
          top: CY + oy * s,
          transform: `translate(-50%, -50%) scale(${s})`,
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export const TitleWord: React.FC<{size?: number}> = ({size = TITLE_SIZE}) => (
  <div style={{fontFamily: FONTS.display, fontSize: size, letterSpacing: '-0.045em', color: COLORS.paper, lineHeight: 1}}>
    SIGNAL<span style={{color: COLORS.signal}}>/</span>NOISE
  </div>
);

/**
 * 05 DEPTH — a pseudo-3D camera surges through floating type planes on the
 * beat, with depth-of-field blur and velocity streaks, then crash-zooms into the title.
 */
export const Dive: React.FC = () => {
  const f = useCurrentFrame();
  const z = camZ(f);
  const vel = z - camZ(f - 1);
  const kick = pulse(f, PASSES, 0.2);

  const roll = Math.sin(f * 0.045) * 3 + PASSES.reduce((r, p, i) => r + (i % 2 ? 1 : -1) * 5 * pulse(f, [p], 0.12), 0);
  const build = prog(f, BUILD, LEN - BUILD, E.expoIn);
  const shake = build * 7;
  const sx = Math.sin(f * 2.3) * shake;
  const sy = Math.cos(f * 1.7) * shake;

  // residual grid from the swarm, passing the lens in the first frames
  const gridDist = 182 - z;
  const grid: React.ReactNode[] = [];
  if (gridDist > 30) {
    const s = FOCAL / gridDist;
    for (let c = -17.5; c <= 17.5; c++) {
      for (let r = -9.5; r <= 9.5; r++) {
        const x = CX + c * 48 * s;
        const y = CY + r * 48 * s;
        if (x < -50 || x > W + 50 || y < -50 || y > H + 50) continue;
        grid.push(<circle key={`${c}${r}`} cx={x} cy={y} r={2.4 * s} fill={COLORS.paper} opacity={0.55 * clamp01((gridDist - 30) / 60)} />);
      }
    }
  }

  const streaks = STARS.map((st, i) => {
    const d = ((st.z - z) % 6000 + 6000) % 6000 + 40;
    const s1 = FOCAL / d;
    const s2 = FOCAL / (d + Math.max(4, vel * 2.2));
    const op = clamp01((6000 - d) / 1500) * clamp01(d / 200);
    return (
      <line
        key={i}
        x1={CX + st.x * s1}
        y1={CY + st.y * s1}
        x2={CX + st.x * s2}
        y2={CY + st.y * s2}
        stroke={st.c}
        strokeWidth={Math.min(6, 1 + s1 * 2)}
        strokeLinecap="round"
        opacity={op * 0.8}
      />
    );
  });

  const words = WORDS.map((w) => (
    <Plane key={w.text} dist={w.z - z} ox={w.ox} oy={w.oy}>
      <div
        style={{
          fontFamily: FONTS.display,
          fontSize: 300,
          letterSpacing: '-0.04em',
          lineHeight: 1,
          color: w.style === 'fill' ? w.color : 'transparent',
          WebkitTextStroke: w.style === 'stroke' ? `4px ${w.color}` : undefined,
        }}
      >
        {w.text}
      </div>
    </Plane>
  ));

  // depth ruler
  const rulerTicks = Array.from({length: 24}, (_, i) => {
    const y = ((i * 40 + z * 0.12) % 960) + 60;
    return <div key={i} style={{position: 'absolute', left: 0, top: y, width: i % 5 === 0 ? 26 : 12, height: 1.5, background: COLORS.paper, opacity: 0.4}} />;
  });

  return (
    <AbsoluteFill style={{background: COLORS.ink, overflow: 'hidden'}}>
      <AbsoluteFill style={{transform: `translate(${sx}px, ${sy}px) rotate(${roll}deg) scale(${1 + kick * 0.03})`}}>
        <svg width={W} height={H} style={{position: 'absolute'}}>
          {streaks}
          {grid}
        </svg>
        {words.slice().reverse()}
        <Plane dist={Z_TITLE - z} ox={0} oy={0} focus={lerp(900, Z_TITLE - z, prog(f, BUILD - 6, 14, E.quartInOut))}>
          <TitleWord />
        </Plane>
      </AbsoluteFill>
      <div style={{position: 'absolute', left: 64, top: 0, bottom: 0, width: 40}}>{rulerTicks}</div>
      <div style={{position: 'absolute', left: 104, top: H / 2 - 10, fontFamily: FONTS.mono, fontSize: 14, letterSpacing: '0.15em', color: COLORS.paper}}>
        Z {z.toFixed(0).padStart(5, '0')}
        <span style={{color: COLORS.signal, marginLeft: 14}}>V {vel.toFixed(0).padStart(3, '0')}</span>
      </div>
    </AbsoluteFill>
  );
};

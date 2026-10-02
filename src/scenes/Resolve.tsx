import React from 'react';
import {AbsoluteFill, random, useCurrentFrame} from 'remotion';
import {COLORS, FONTS, H, W} from '../theme';
import {E, prog, springAt} from '../lib/ease';

const CX = W / 2;
const CY = H / 2;
const WORD = 150;
const GROUP_W = 1120;

const DEBRIS = Array.from({length: 150}, (_, i) => ({
  a: random(`da${i}`) * Math.PI * 2,
  d: 300 + random(`dd${i}`) * 1100,
  size: 3 + random(`ds${i}`) * 9,
  spin: (random(`dr${i}`) - 0.5) * 40,
  c: i % 4 === 0 ? COLORS.signal : i % 9 === 0 ? COLORS.ultra : COLORS.paper,
}));

/**
 * 07 RESOLVE — the system collapses back into the original point, which pops,
 * rings out and slides aside to reveal the wordmark.
 */
export const Resolve: React.FC = () => {
  const f = useCurrentFrame();

  const pop = springAt(f, 0, 0.6, 0.32);
  const dotR = 16 * pop;
  const slide = prog(f, 5, 13, E.expoInOut);
  const dotX = CX + slide * (-GROUP_W / 2 + 16 - 0);
  const reveal = prog(f, 7, 13, E.expoOut);
  const ring = prog(f, 0, 24, E.expoOut);

  // detonation: stacked shockwaves, a ray burst and debris thrown outward
  const shock = [
    {delay: 0, color: COLORS.paper, w: 70, max: 1500},
    {delay: 1, color: COLORS.signal, w: 46, max: 1250},
    {delay: 2.5, color: COLORS.ultra, w: 26, max: 1000},
  ].map((r, i) => {
    const p = prog(f, r.delay, 16, E.expoOut);
    if (f < r.delay || p >= 1) return null;
    return <circle key={i} cx={CX} cy={CY} r={10 + p * r.max} fill="none" stroke={r.color} strokeWidth={r.w * (1 - p)} opacity={1 - p * 0.6} />;
  });
  const burst = prog(f, 0, 12, E.expoOut);
  const rays =
    burst < 1
      ? Array.from({length: 64}, (_, i) => {
          const a = (i / 64) * Math.PI * 2 + random(`ba${i}`) * 0.08;
          const reach = (0.6 + random(`bl${i}`) * 0.6) * 1300;
          const r1 = burst * reach * 0.55;
          const r2 = burst * reach;
          return <line key={i} x1={CX + Math.cos(a) * r1} y1={CY + Math.sin(a) * r1} x2={CX + Math.cos(a) * r2} y2={CY + Math.sin(a) * r2} stroke={i % 5 === 0 ? COLORS.signal : COLORS.paper} strokeWidth={3 * (1 - burst) + 0.5} opacity={1 - burst} />;
        })
      : null;
  const debris = DEBRIS.map((d, i) => {
    const p = prog(f, 0, 26, E.expoOut);
    if (p >= 1) return null;
    const x = CX + Math.cos(d.a) * d.d * p;
    const y = CY + Math.sin(d.a) * d.d * p;
    const sz = d.size * (1 - p);
    return <rect key={i} x={x - sz / 2} y={y - sz / 2} width={sz} height={sz} fill={d.c} opacity={1 - p} transform={`rotate(${f * d.spin} ${x} ${y})`} />;
  });
  const punch = 1 + (1 - prog(f, 0, 22, E.expoOut)) * 0.16;
  const line = prog(f, 10, 16, E.expoInOut);
  const sub = 'MOTION DESIGN REEL  ·  2026';
  const typed = sub.slice(0, Math.max(0, Math.floor((f - 11) * 2.2)));
  
  return (
    <AbsoluteFill style={{background: COLORS.ink}}>
      <AbsoluteFill style={{transform: `scale(${punch})`}}>
        <svg width={W} height={H} style={{position: 'absolute'}}>
          <circle cx={CX} cy={CY} r={20 + ring * 700} fill="none" stroke={COLORS.signal} strokeWidth={3 * (1 - ring)} opacity={1 - ring} />
          <circle cx={CX} cy={CY} r={20 + ring * 420} fill="none" stroke={COLORS.paper} strokeWidth={1.5 * (1 - ring)} opacity={(1 - ring) * 0.7} />
          {rays}
          {shock}
          {debris}
        </svg>
        <div
          style={{
            position: 'absolute',
            left: CX - GROUP_W / 2 + 64,
            top: CY - WORD * 0.57,
            fontFamily: FONTS.display,
            fontSize: WORD,
            letterSpacing: '-0.045em',
            lineHeight: 1,
            color: COLORS.paper,
            clipPath: `inset(-10% ${(1 - reveal) * 100}% -10% 0)`,
            transform: `translateX(${(1 - reveal) * -60}px)`,
            whiteSpace: 'nowrap',
          }}
        >
          SIGNAL<span style={{color: COLORS.signal}}>/</span>NOISE
        </div>
        <div
          style={{
            position: 'absolute',
            left: CX - GROUP_W / 2 + 60,
            top: CY + WORD * 0.55,
            width: (GROUP_W - 60) * line,
            height: 1.5,
            background: COLORS.paper,
            opacity: 0.5,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: CX - GROUP_W / 2 + 60,
            top: CY + WORD * 0.55 + 22,
            fontFamily: FONTS.mono,
            fontSize: 18,
            letterSpacing: '0.35em',
            color: COLORS.paper,
            whiteSpace: 'nowrap',
          }}
        >
          {typed}
          <span style={{opacity: f % 8 < 4 && f > 10 ? 1 : 0, color: COLORS.signal}}>▌</span>
        </div>
        <svg width={W} height={H} style={{position: 'absolute'}}>
          <circle cx={dotX} cy={CY - 8} r={dotR} fill={COLORS.signal} />
        </svg>
      </AbsoluteFill>
      {/* white-out, then a signal-orange afterflash */}
      <AbsoluteFill style={{background: COLORS.paper, opacity: f < 1 ? 1 : 0}} />
      <AbsoluteFill style={{background: COLORS.signal, mixBlendMode: 'screen', opacity: f >= 1 ? Math.max(0, 0.85 - (f - 1) * 0.22) : 0}} />
    </AbsoluteFill>
  );
};

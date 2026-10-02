import React from 'react';
import {AbsoluteFill, random, useCurrentFrame} from 'remotion';
import {COLORS, FONTS, H, W} from '../theme';
import {E, keys, prog} from '../lib/ease';
import {SHAPES, toPath} from '../lib/shapes';
import {T, local, pulse} from '../lib/timing';
import {TitleWord} from './Dive';

const FROM = T.scenes.drop.from;
const LEN = T.scenes.drop.to - FROM;
const COLLAPSE = local(T.cues.collapseBeat, FROM);
// collapse choreography: strain → implode → 2-frame blackout before the final hit
const ANTIC = COLLAPSE - 9;
const BLACKOUT = LEN - 2;
const IMPLODE_LEN = BLACKOUT - COLLAPSE;

const VORTEX = Array.from({length: 200}, (_, i) => ({
  r0: 650 + random(`vr${i}`) * 900,
  a0: random(`va${i}`) * Math.PI * 2,
  delay: random(`vd${i}`) * 5,
  spin: 1.2 + random(`vs${i}`) * 1.4,
  size: 1.5 + random(`vz${i}`) * 3,
  c: i % 5 === 0 ? COLORS.signal : i % 7 === 0 ? COLORS.ultra : COLORS.paper,
}));
const BEATS = [0, 15, 30];
const TILE = 240;
const CX = W / 2;
const CY = H / 2;
const TICKER = 'MOTION DESIGN ✦ KINETIC TYPE ✦ FORM ✦ PARTICLES ✦ CAMERA ✦ RHYTHM ✦ ';

const Ticker: React.FC<{f: number; y: number; bg: string; fg: string; dir: 1 | -1; delay: number; rot: number}> = ({f, y, bg, fg, dir, delay, rot}) => {
  const open = prog(f, delay, 12, E.expoOut);
  return (
    <div
      style={{
        position: 'absolute',
        left: -100,
        width: W + 200,
        top: y,
        height: 56,
        background: bg,
        transform: `rotate(${rot}deg) scaleX(${open})`,
        transformOrigin: dir === 1 ? '0% 50%' : '100% 50%',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          whiteSpace: 'nowrap',
          fontFamily: FONTS.mono,
          fontSize: 22,
          letterSpacing: '0.25em',
          color: fg,
          transform: `translateX(${-800 + dir * -f * 16}px)`,
        }}
      >
        {TICKER.repeat(6)}
      </div>
    </div>
  );
};

/**
 * 06 DROP — impact. Full-frame title with chromatic split pulsing on the beat,
 * a wave-driven field of the morph shapes, ticker bands; then it all collapses to a point.
 */
export const Drop: React.FC = () => {
  const f = useCurrentFrame();

  const hit = pulse(f, [0], 0.14);
  const beatHit = pulse(f, BEATS, 0.22);
  // anticipation: the frame strains (push-in, growing split, jitter) before it gives way
  const strain = prog(f, ANTIC, COLLAPSE - ANTIC, E.quartInOut);
  const implode = prog(f, COLLAPSE, IMPLODE_LEN, E.expoIn);
  const jitter = strain * (1 - implode) * 6;
  const split = 30 * hit + 9 * beatHit + strain * 22 + implode * 90;

  const titleScale = keys(f, [0, 14], [1.14, 1], E.expoOut) + beatHit * 0.012;
  const sceneScale = (1 + strain * 0.07) * (1 - implode);
  const sceneRot = -implode * 220 + Math.sin(f * 3.1) * jitter * 0.15;

  const tiles: React.ReactNode[] = [];
  for (let c = 0; c < 8; c++) {
    for (let r = 0; r < 5; r++) {
      const x = c * TILE + TILE / 2;
      const y = r * TILE + TILE / 2 - 60;
      const d = Math.hypot(x - CX, y - CY);
      let wave = 0;
      for (const b of BEATS) {
        if (f >= b) wave = Math.max(wave, Math.max(0, 1 - Math.abs(d - (f - b) * 85) / 160));
      }
      const shape = SHAPES[(c * 2 + r) % SHAPES.length].pts;
      const rot = f * 2.5 * ((c + r) % 2 ? 1 : -1) + wave * 45;
      const s = 62 * (1 + wave * 0.45) * prog(f, d / 120, 14, E.backOut);
      tiles.push(
        <path
          key={`${c}-${r}`}
          d={toPath(shape, s, x, y)}
          transform={`rotate(${rot} ${x} ${y})`}
          fill={wave > 0.4 ? COLORS.signal : 'none'}
          stroke={wave > 0.4 ? COLORS.signal : COLORS.paper}
          strokeWidth={2}
          opacity={0.14 + wave * 0.55}
        />,
      );
    }
  }

  const subIn = prog(f, 6, 16, E.expoOut);

  // vortex: debris spirals into the singularity, trailing streaks
  const vortexOn = f >= COLLAPSE - 2 && f < BLACKOUT;
  const vortexAt = (v: (typeof VORTEX)[number], t: number) => {
    const p = prog(t, COLLAPSE - 2 + v.delay, IMPLODE_LEN + 2 - v.delay, E.expoIn);
    const r = v.r0 * (1 - p);
    const a = v.a0 + p * Math.PI * v.spin;
    return {x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r, p};
  };
  const vortex = vortexOn
    ? VORTEX.map((v, i) => {
        const a = vortexAt(v, f);
        const b = vortexAt(v, f - 1.5);
        return (
          <line key={i} x1={b.x} y1={b.y} x2={a.x} y2={a.y + 0.01} stroke={v.c} strokeWidth={v.size * (1 - a.p * 0.6)} strokeLinecap="round" opacity={Math.min(1, a.p * 6) * (1 - a.p * 0.5)} />
        );
      })
    : null;
  // converging light rays
  const rays = vortexOn
    ? Array.from({length: 48}, (_, i) => {
        const ang = (i / 48) * Math.PI * 2 + random(`ra${i}`) * 0.1;
        const inner = 1400 * (1 - implode) + 30;
        const len = 60 + 900 * implode * (0.5 + random(`rl${i}`) * 0.5);
        return (
          <line key={i} x1={CX + Math.cos(ang) * inner} y1={CY + Math.sin(ang) * inner} x2={CX + Math.cos(ang) * (inner + len)} y2={CY + Math.sin(ang) * (inner + len)} stroke={i % 6 === 0 ? COLORS.signal : COLORS.paper} strokeWidth={1.5} opacity={0.15 + implode * 0.6} />
        );
      })
    : null;
  const core = strain * 6 + implode * 34;

  return (
    <AbsoluteFill style={{background: COLORS.ink, overflow: 'hidden'}}>
      <AbsoluteFill style={{transform: `translate(${Math.sin(f * 2.3) * jitter}px, ${Math.cos(f * 1.9) * jitter}px) scale(${sceneScale}) rotate(${sceneRot}deg)`}}>
        <svg width={W} height={H} style={{position: 'absolute'}}>
          {tiles}
        </svg>
        <Ticker f={f} y={150} bg={COLORS.signal} fg={COLORS.ink} dir={1} delay={2} rot={-3} />
        <Ticker f={f} y={H - 210} bg={COLORS.ultra} fg={COLORS.paper} dir={-1} delay={5} rot={-3} />

        <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', transform: `scale(${titleScale})`}}>
          <div style={{position: 'relative'}}>
            <div style={{position: 'absolute', inset: 0, transform: `translate(${-split}px, ${split * 0.25}px)`, mixBlendMode: 'screen', filter: 'url(#tint-ultra)'}}>
              <TitleWord />
            </div>
            <div style={{position: 'absolute', inset: 0, transform: `translate(${split}px, ${-split * 0.25}px)`, mixBlendMode: 'screen', filter: 'url(#tint-signal)'}}>
              <TitleWord />
            </div>
            <div style={{position: 'relative', mixBlendMode: 'normal'}}>
              <TitleWord />
            </div>
          </div>
          <div
            style={{
              marginTop: 18,
              fontFamily: FONTS.mono,
              fontSize: 20,
              letterSpacing: '0.42em',
              color: COLORS.paper,
              clipPath: `inset(0 ${(1 - subIn) * 100}% 0 0)`,
            }}
          >
            MOTION — DESIGN — DIRECTION
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
      <svg width={0} height={0} style={{position: 'absolute'}}>
        <filter id="tint-ultra">
          <feColorMatrix type="matrix" values="0 0 0 0 0.24  0 0 0 0 0.35  0 0 0 0 1  0 0 0 1 0" />
        </filter>
        <filter id="tint-signal">
          <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 0.3  0 0 0 0 0.12  0 0 0 1 0" />
        </filter>
      </svg>
      <AbsoluteFill style={{background: '#000', opacity: implode * 0.55}} />
      {vortexOn && (
        <svg width={W} height={H} style={{position: 'absolute'}}>
          <defs>
            <filter id="glow" x="-200%" y="-200%" width="500%" height="500%">
              <feGaussianBlur stdDeviation={8 + implode * 18} />
            </filter>
          </defs>
          {rays}
          {vortex}
          <circle cx={CX} cy={CY} r={core * 2.2} fill={COLORS.signal} opacity={0.6} filter="url(#glow)" />
          <circle cx={CX} cy={CY} r={core} fill={COLORS.paper} filter="url(#glow)" />
          <circle cx={CX} cy={CY} r={core * 0.45} fill={COLORS.paper} />
        </svg>
      )}
      <AbsoluteFill style={{background: COLORS.paper, opacity: Math.max(0, 1 - f / 4)}} />
      {f >= BLACKOUT && (
        <AbsoluteFill style={{background: '#000', justifyContent: 'center', alignItems: 'center'}}>
          <div style={{width: 5, height: 5, borderRadius: 5, background: COLORS.paper, boxShadow: `0 0 18px 6px ${COLORS.signal}`}} />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

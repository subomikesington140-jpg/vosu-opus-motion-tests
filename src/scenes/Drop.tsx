import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {COLORS, FONTS, H, W} from '../theme';
import {E, keys, prog} from '../lib/ease';
import {SHAPES, toPath} from '../lib/shapes';
import {T, local, pulse} from '../lib/timing';
import {TitleWord} from './Dive';

const FROM = T.scenes.drop.from;
const LEN = T.scenes.drop.to - FROM;
const COLLAPSE = local(T.cues.collapseBeat, FROM);
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
  const split = 30 * hit + 9 * beatHit;

  const titleScale = keys(f, [0, 14], [1.14, 1], E.expoOut) + beatHit * 0.012;
  const collapse = prog(f, COLLAPSE, LEN - COLLAPSE, E.expoIn);
  const sceneScale = 1 - collapse;
  const sceneRot = -collapse * 120;

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

  return (
    <AbsoluteFill style={{background: COLORS.ink, overflow: 'hidden'}}>
      <AbsoluteFill style={{transform: `scale(${sceneScale}) rotate(${sceneRot}deg)`}}>
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
      <AbsoluteFill style={{background: COLORS.paper, opacity: Math.max(0, 1 - f / 4)}} />
    </AbsoluteFill>
  );
};

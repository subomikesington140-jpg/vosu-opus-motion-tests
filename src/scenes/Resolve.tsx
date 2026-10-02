import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {COLORS, FONTS, H, W} from '../theme';
import {E, prog, springAt} from '../lib/ease';

const CX = W / 2;
const CY = H / 2;
const WORD = 150;
const GROUP_W = 1120;

/**
 * 07 RESOLVE — the system collapses back into the original point, which pops,
 * rings out and slides aside to reveal the wordmark.
 */
export const Resolve: React.FC = () => {
  const f = useCurrentFrame();

  const pop = springAt(f, 0, 0.6, 0.32);
  const dotR = 16 * pop;
  const slide = prog(f, 3, 14, E.expoInOut);
  const dotX = CX + slide * (-GROUP_W / 2 + 16 - 0);
  const reveal = prog(f, 6, 14, E.expoOut);
  const ring = prog(f, 0, 24, E.expoOut);
  const line = prog(f, 10, 16, E.expoInOut);
  const sub = 'MOTION DESIGN REEL  ·  2026';
  const typed = sub.slice(0, Math.max(0, Math.floor((f - 11) * 2.2)));
  const settle = 1 + (1 - prog(f, 0, 30, E.expoOut)) * 0.04;

  return (
    <AbsoluteFill style={{background: COLORS.ink}}>
      <AbsoluteFill style={{transform: `scale(${settle})`}}>
        <svg width={W} height={H} style={{position: 'absolute'}}>
          <circle cx={CX} cy={CY} r={20 + ring * 700} fill="none" stroke={COLORS.signal} strokeWidth={3 * (1 - ring)} opacity={1 - ring} />
          <circle cx={CX} cy={CY} r={20 + ring * 420} fill="none" stroke={COLORS.paper} strokeWidth={1.5 * (1 - ring)} opacity={(1 - ring) * 0.7} />
          <circle cx={dotX} cy={CY - 8} r={dotR} fill={COLORS.signal} />
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
      </AbsoluteFill>
      <AbsoluteFill style={{background: COLORS.paper, opacity: Math.max(0, 0.6 - f * 0.2)}} />
    </AbsoluteFill>
  );
};

import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {COLORS, FONTS, H, W} from '../theme';
import {E, keys, prog, springAt} from '../lib/ease';
import {FPB} from '../lib/timing';

const CX = W / 2;
const CY = H / 2;
const BEATS = [0, 1, 2, 3].map((b) => b * FPB);
const GRID = 60;

/**
 * 01 IGNITION — a single point pulses on the heartbeat, emits rings, draws its
 * coordinate system, then irises open to fill the frame with signal orange.
 */
export const Ignition: React.FC = () => {
  const f = useCurrentFrame();

  // dot grows a step on every beat, with spring overshoot
  const dotR = BEATS.reduce((r, b, i) => r + springAt(f, b, 0.5, 0.35) * (i === 0 ? 7 : 3 + i), 0);
  // iris: dot swallows the frame at the scene's end
  const iris = prog(f, 45, 13, E.expoIn);
  const irisR = dotR + iris * 1400;

  // camera: slow push with a settle of rotation
  const camScale = interpolate(f, [0, 60], [1, 1.14]);
  const camRot = keys(f, [0, 40], [-3, 0], E.quintOut);

  // crosshair draws out, then rotates 45° on beat 2 and back to square on beat 3
  const lineLen = prog(f, 6, 26, E.expoOut) * W * 0.7;
  const crossRot = keys(f, [30, 40, 45, 55], [0, 45, 45, 90], E.anticipate);

  // dot grid revealed by an expanding radius
  const reveal = prog(f, 4, 40, E.quintOut) * 1200;
  const dots: React.ReactNode[] = [];
  for (let x = GRID / 2; x < W; x += GRID) {
    for (let y = GRID / 2; y < H; y += GRID) {
      const d = Math.hypot(x - CX, y - CY);
      const edge = Math.max(0, Math.min(1, (reveal - d) / 120));
      if (edge <= 0) continue;
      // ripple brightening on each beat
      const ripple = BEATS.reduce((acc, b) => {
        const front = (f - b) * 38;
        return acc + Math.max(0, 1 - Math.abs(d - front) / 60) * (f >= b ? 1 : 0);
      }, 0);
      dots.push(
        <circle key={`${x}-${y}`} cx={x} cy={y} r={1.2 + ripple * 1.6} fill={ripple > 0.3 ? COLORS.signal : COLORS.paper} opacity={(0.16 + ripple * 0.7) * edge} />,
      );
    }
  }

  const rings = BEATS.map((b, i) => {
    const p = prog(f, b, 34, E.expoOut);
    if (f < b) return null;
    return (
      <circle
        key={i}
        cx={CX}
        cy={CY}
        r={dotR + p * (220 + i * 130)}
        fill="none"
        stroke={i % 2 ? COLORS.signal : COLORS.paper}
        strokeWidth={2.5 * (1 - p) + 0.5}
        opacity={1 - p}
      />
    );
  });

  // satellites orbit after beat 1
  const orbitIn = prog(f, FPB, 20, E.backOut);
  const sats = [0, 1, 2].map((i) => {
    const a = f * (0.05 + i * 0.025) + (i * Math.PI * 2) / 3;
    const r = (120 + i * 70) * orbitIn;
    return <rect key={i} x={CX + Math.cos(a) * r - 4} y={CY + Math.sin(a) * r - 4} width={8} height={8} fill={i === 1 ? COLORS.signal : COLORS.paper} transform={`rotate(${f * 4} ${CX + Math.cos(a) * r} ${CY + Math.sin(a) * r})`} />;
  });

  const coords = `X ${Math.round(CX + Math.sin(f * 0.3) * 40)}  Y ${Math.round(CY + Math.cos(f * 0.21) * 40)}`;
  const labelIn = prog(f, 10, 14);

  return (
    <AbsoluteFill style={{background: COLORS.ink}}>
      <AbsoluteFill style={{transform: `scale(${camScale}) rotate(${camRot}deg)`}}>
        <svg width={W} height={H}>
          {dots}
          <g transform={`rotate(${crossRot} ${CX} ${CY})`} opacity={0.6}>
            <line x1={CX - lineLen} y1={CY} x2={CX + lineLen} y2={CY} stroke={COLORS.paper} strokeWidth={1} />
            <line x1={CX} y1={CY - lineLen * 0.6} x2={CX} y2={CY + lineLen * 0.6} stroke={COLORS.paper} strokeWidth={1} />
            {[-3, -2, -1, 1, 2, 3].map((k) => (
              <line key={k} x1={CX + k * 80} y1={CY - 8} x2={CX + k * 80} y2={CY + 8} stroke={COLORS.paper} strokeWidth={1} opacity={Math.abs(k * 80) < lineLen ? 1 : 0} />
            ))}
          </g>
          {rings}
          {sats}
          <circle cx={CX} cy={CY} r={irisR} fill={COLORS.signal} />
        </svg>
        <div
          style={{
            position: 'absolute',
            left: CX + 28,
            top: CY + 22,
            fontFamily: FONTS.mono,
            fontSize: 14,
            letterSpacing: '0.1em',
            color: COLORS.paper,
            opacity: labelIn * (1 - iris),
            transform: `translateX(${(1 - labelIn) * -20}px)`,
            lineHeight: 1.6,
          }}
        >
          <div style={{color: COLORS.signal}}>● SIGNAL ACQUIRED</div>
          <div>{coords}</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

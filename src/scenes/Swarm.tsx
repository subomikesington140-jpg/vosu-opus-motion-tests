import React from 'react';
import {AbsoluteFill, random, useCurrentFrame} from 'remotion';
import {COLORS, FONTS, H, W} from '../theme';
import {E, keys, lerp, prog} from '../lib/ease';
import {curl} from '../lib/noise';
import {SHAPES} from '../lib/shapes';
import {T, local, pulse} from '../lib/timing';
import {MORPH_END_SCALE, MORPH_R} from './Morph';

const FROM = T.scenes.swarm.from;
const LEN = T.scenes.swarm.to - FROM;
const REGROUP = local(T.cues.regroupBeat, FROM);
const COLS = 36;
const ROWS = 20;
const COUNT = COLS * ROWS;
const GAP = 48;
const CX = W / 2;
const CY = H / 2;

type P = {x: number; y: number};

/**
 * Deterministic particle simulation, integrated once and cached per frame so any
 * frame renders identically regardless of render order.
 */
const sim = (() => {
  const frames: P[][] = [];
  const star = SHAPES[4].pts;
  const R = MORPH_R * MORPH_END_SCALE;
  const a0 = (4 * 72 * Math.PI) / 180;
  const ps = Array.from({length: COUNT}, (_, i) => {
    const [sx, sy] = star[i % star.length];
    const u = Math.sqrt(random(`u${i}`)) * 0.95 + 0.05;
    const x = CX + (sx * Math.cos(a0) - sy * Math.sin(a0)) * R * u;
    const y = CY + (sx * Math.sin(a0) + sy * Math.cos(a0)) * R * u;
    const dx = x - CX;
    const dy = y - CY;
    const d = Math.hypot(dx, dy) || 1;
    const sp = (10 + random(`s${i}`) * 26) * (0.5 + u);
    const jitter = (random(`j${i}`) - 0.5) * 0.9;
    const ang = Math.atan2(dy, dx) + jitter;
    return {x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp};
  });
  for (let f = 0; f <= LEN; f++) {
    frames.push(ps.map((p) => ({x: p.x, y: p.y})));
    for (const p of ps) {
      const [cx, cy] = curl(p.x / 380, p.y / 380, f * 0.025);
      p.vx = p.vx * 0.9 + cx * 2.6;
      p.vy = p.vy * 0.9 + cy * 2.6;
      p.x += p.vx;
      p.y += p.vy;
    }
  }
  // assign grid slots spatially (by x, then y within a column) for clean regrouping
  const ref = frames[30];
  const order = Array.from({length: COUNT}, (_, i) => i).sort((a, b) => ref[a].x - ref[b].x);
  const targets: P[] = new Array(COUNT);
  for (let c = 0; c < COLS; c++) {
    const col = order.slice(c * ROWS, (c + 1) * ROWS).sort((a, b) => ref[a].y - ref[b].y);
    col.forEach((idx, r) => {
      targets[idx] = {x: CX + (c - (COLS - 1) / 2) * GAP, y: CY + (r - (ROWS - 1) / 2) * GAP};
    });
  }
  return {frames, targets};
})();

const posAt = (i: number, f: number): P => {
  const fi = Math.max(0, Math.min(LEN, f));
  const lo = Math.floor(fi);
  const hi = Math.min(LEN, lo + 1);
  const t = fi - lo;
  const a = sim.frames[lo][i];
  const b = sim.frames[hi][i];
  const s = {x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t)};
  const g = sim.targets[i];
  const dn = Math.min(1, Math.hypot(g.x - CX, g.y - CY) / 900);
  const k = prog(fi, 24 + dn * 7, 14, E.quartInOut);
  return {x: lerp(s.x, g.x, k), y: lerp(s.y, g.y, k)};
};

/**
 * 04 SWARM — the star shatters into particles that ride a curl-noise flow
 * field, then snap into a grid on the beat. The camera then dives into the grid.
 */
export const Swarm: React.FC = () => {
  const f = useCurrentFrame();

  const kick = pulse(f, [REGROUP, REGROUP + 15], 0.2);
  const burst = keys(f, [0, 20], [1.18, 1], E.expoOut);
  const dive = prog(f, LEN - 15, 15, E.expoIn);
  const camScale = burst * (1 + dive * 4.5) * (1 + kick * 0.02);
  const camRot = keys(f, [0, REGROUP], [8, 0], E.quintOut) + dive * 12;

  const flash = 1 - prog(f, 0, 6, E.expoOut);

  const parts = [];
  for (let i = 0; i < COUNT; i++) {
    const p = posAt(i, f);
    const q = posAt(i, f - 1.6);
    const g = sim.targets[i];
    const dist = Math.hypot(g.x - CX, g.y - CY);
    // ripple waves from centre after the regroup, one per kick
    let ripple = 0;
    for (const h of [REGROUP, REGROUP + 15]) {
      if (f >= h) {
        const front = (f - h) * 70;
        ripple = Math.max(ripple, Math.max(0, 1 - Math.abs(dist - front) / 90) * Math.exp(-(f - h) * 0.05));
      }
    }
    const base = 1.6 + random(`r${i}`) * 2.2;
    const r = base + ripple * 4;
    const accent = i % 9 === 0 ? COLORS.signal : i % 13 === 0 ? COLORS.ultra : COLORS.paper;
    const color = ripple > 0.35 ? COLORS.signal : accent;
    parts.push(
      <line key={i} x1={q.x} y1={q.y} x2={p.x} y2={p.y + 0.01} stroke={color} strokeWidth={r} strokeLinecap="round" opacity={0.55 + 0.45 * Math.max(ripple, i % 9 === 0 ? 1 : 0)} />,
    );
  }

  const labelIn = prog(f, REGROUP, 12);

  return (
    <AbsoluteFill style={{background: COLORS.ink, overflow: 'hidden'}}>
      <AbsoluteFill style={{transform: `scale(${camScale}) rotate(${camRot}deg)`}}>
        <svg width={W} height={H}>
          <circle cx={CX} cy={CY} r={200 + (1 - flash) * 900} fill="none" stroke={COLORS.paper} strokeWidth={30 * flash} opacity={flash} />
          {parts}
        </svg>
      </AbsoluteFill>
      <AbsoluteFill style={{background: COLORS.paper, opacity: flash * 0.85}} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 96,
          textAlign: 'center',
          fontFamily: FONTS.mono,
          fontSize: 16,
          letterSpacing: '0.3em',
          color: COLORS.paper,
          opacity: labelIn * (1 - dive),
        }}
      >
        {COUNT} PARTICLES — ORDER FROM NOISE
      </div>
    </AbsoluteFill>
  );
};

import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {COLORS, FONTS, H, W} from '../theme';
import {E, keys, prog, springAt} from '../lib/ease';
import {SHAPES, mix, toPath, type Pt} from '../lib/shapes';
import {T, local, pulse} from '../lib/timing';

const FROM = T.scenes.morph.from;
const HITS = T.cues.morphBeats.map((b) => local(b, FROM));
const END = T.scenes.morph.to - FROM;
export const MORPH_R = 250;
export const MORPH_END_SCALE = 0.86;
const STEP_ROT = 72;

/** Shape geometry, rotation and scale at any local frame (used for echo trails too). */
export const morphState = (f: number) => {
  let pts: Pt[] = SHAPES[0].pts;
  let rot = 0;
  let idx = 0;
  HITS.forEach((h, i) => {
    if (f < h) return;
    idx = i;
    const s = springAt(f, h, 0.38, 0.38);
    if (i > 0) {
      pts = mix(SHAPES[i - 1].pts, SHAPES[i].pts, s);
      rot += STEP_ROT * s;
    }
  });
  const grow = springAt(f, 0, 0.3, 0.45);
  const squash = prog(f, END - 10, 10, E.expoIn);
  const scale = grow * (1 - squash * (1 - MORPH_END_SCALE));
  return {pts, rot, scale, idx};
};

const CX = W / 2;
const CY = H / 2;

/**
 * 03 MORPH — circle → triangle → square → hexagon → star, one per kick, with
 * spring overshoot, rotational follow-through, layered echoes and an orbiting 3D camera.
 */
export const Morph: React.FC = () => {
  const f = useCurrentFrame();
  const {pts, rot, scale, idx} = morphState(f);
  const kick = pulse(f, HITS, 0.22);

  // orbiting camera returns to neutral by the end so the shatter lines up
  const orbitY = keys(f, [0, 25, 50, END], [-28, 22, -18, 0], E.quartInOut);
  const orbitX = keys(f, [0, 35, END], [18, -10, 0], E.quartInOut);
  const camRoll = keys(f, [0, END], [-6, 0], E.quintOut);
  const camScale = 1 + kick * 0.035;

  const R = MORPH_R * scale * (1 + kick * 0.06);

  const echoes = [8, 5, 2].map((lag, i) => {
    const s = morphState(f - lag);
    return (
      <svg key={lag} width={W} height={H} style={{position: 'absolute', transform: `translateZ(${-260 + i * 80}px)`}}>
        <path
          d={toPath(s.pts, MORPH_R * s.scale, CX, CY)}
          transform={`rotate(${s.rot} ${CX} ${CY})`}
          fill="none"
          stroke={COLORS.ultra}
          strokeWidth={3}
          opacity={0.25 + i * 0.25}
        />
      </svg>
    );
  });

  // vertex markers ride every 36th point of the ring
  const markers = [0, 36, 72, 108, 144].map((k) => {
    const [x, y] = pts[k];
    const a = (rot * Math.PI) / 180;
    const rx = CX + (x * Math.cos(a) - y * Math.sin(a)) * R * 1.18;
    const ry = CY + (x * Math.sin(a) + y * Math.cos(a)) * R * 1.18;
    return (
      <g key={k}>
        <rect x={rx - 5} y={ry - 5} width={10} height={10} fill="none" stroke={COLORS.paper} strokeWidth={1.5} transform={`rotate(45 ${rx} ${ry})`} />
        <line x1={CX + (rx - CX) * 0.88} y1={CY + (ry - CY) * 0.88} x2={rx} y2={ry} stroke={COLORS.paper} strokeWidth={1} opacity={0.5} />
      </g>
    );
  });

  // measurement dial ticks step-rotate on each beat
  const dialRot = HITS.reduce((acc, h) => acc + prog(f, h, 12, E.expoOut) * 15, 0);
  const ticks = Array.from({length: 72}, (_, i) => {
    const a = (i / 72) * Math.PI * 2;
    const long = i % 6 === 0;
    const r1 = 420;
    const r2 = long ? 440 : 430;
    return <line key={i} x1={CX + Math.cos(a) * r1} y1={CY + Math.sin(a) * r1} x2={CX + Math.cos(a) * r2} y2={CY + Math.sin(a) * r2} stroke={COLORS.paper} strokeWidth={long ? 2 : 1} opacity={long ? 0.5 : 0.25} />;
  });

  const shatterFlash = prog(f, END - 3, 3, E.expoIn);

  return (
    <AbsoluteFill style={{background: COLORS.ink, overflow: 'hidden'}}>
      {/* big index numeral, slides per beat */}
      <div style={{position: 'absolute', left: 120, top: 120, height: 420, overflow: 'hidden', fontFamily: FONTS.light, fontSize: 420, lineHeight: 1, color: COLORS.paper, opacity: 0.07}}>
        <div style={{transform: `translateY(${-HITS.reduce((acc, h) => acc + prog(f, h, 14, E.expoOut), 0) * 420}px)`}}>
          {['', '01', '02', '03', '04', '05'].map((n) => (
            <div key={n} style={{height: 420}}>{n}</div>
          ))}
        </div>
      </div>

      <AbsoluteFill style={{perspective: 1400, transform: `rotate(${camRoll}deg) scale(${camScale})`}}>
        <AbsoluteFill style={{transformStyle: 'preserve-3d', transform: `rotateX(${orbitX}deg) rotateY(${orbitY}deg)`}}>
          <svg width={W} height={H} style={{position: 'absolute', transform: 'translateZ(-420px)'}}>
            <g transform={`rotate(${dialRot} ${CX} ${CY})`}>{ticks}</g>
          </svg>
          {echoes}
          <svg width={W} height={H} style={{position: 'absolute'}}>
            <path d={toPath(pts, R, CX, CY)} transform={`rotate(${rot} ${CX} ${CY})`} fill={shatterFlash > 0 ? `rgb(255,${77 + 178 * shatterFlash},${31 + 210 * shatterFlash})` : COLORS.signal} />
          </svg>
          <svg width={W} height={H} style={{position: 'absolute', transform: 'translateZ(120px)'}}>
            <path d={toPath(pts, R * 0.55, CX, CY)} transform={`rotate(${-rot * 1.5} ${CX} ${CY})`} fill="none" stroke={COLORS.ink} strokeWidth={2.5} />
          </svg>
          <svg width={W} height={H} style={{position: 'absolute', transform: 'translateZ(220px)'}}>
            {markers}
          </svg>
        </AbsoluteFill>
      </AbsoluteFill>

      {/* shape label */}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 150, display: 'flex', justifyContent: 'center'}}>
        <div style={{height: 26, overflow: 'hidden', fontFamily: FONTS.mono, fontSize: 20, letterSpacing: '0.3em', color: COLORS.paper}}>
          <div style={{transform: `translateY(${-HITS.reduce((acc, h, i) => acc + (i > 0 ? prog(f, h, 10, E.expoOut) : 0), 0) * 26}px)`}}>
            {SHAPES.map((s, i) => (
              <div key={s.name} style={{height: 26, textAlign: 'center'}}>
                <span style={{color: COLORS.signal}}>{String(i + 1).padStart(2, '0')}</span> / {s.name}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{position: 'absolute', right: 140, top: H / 2 - 12, fontFamily: FONTS.mono, fontSize: 14, letterSpacing: '0.15em', color: COLORS.dim, textAlign: 'right', lineHeight: 1.8}}>
        <div>ROT {rot.toFixed(1).padStart(6, '0')}°</div>
        <div>SCL {scale.toFixed(3)}</div>
        <div>IDX {idx + 1}/5</div>
      </div>
    </AbsoluteFill>
  );
};

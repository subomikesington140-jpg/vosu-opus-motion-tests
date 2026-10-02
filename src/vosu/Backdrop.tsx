import React from 'react';
import {AbsoluteFill, random, useCurrentFrame} from 'remotion';
import {noise3} from '../lib/noise';
import {BRAND} from './lib';

const BLOBS = [
  {c: '255,122,51', x: 0.22, y: 0.3, r: 0.55},
  {c: '228,61,240', x: 0.72, y: 0.25, r: 0.5},
  {c: '123,92,255', x: 0.62, y: 0.78, r: 0.6},
  {c: '47,107,255', x: 0.25, y: 0.82, r: 0.5},
];

const DUST = Array.from({length: 70}, (_, i) => ({
  x: random(`dx${i}`),
  y: random(`dy${i}`),
  z: 0.3 + random(`dz${i}`) * 0.7,
  s: random(`ds${i}`),
}));

/**
 * Brand atmosphere: drifting soft glows in the VOSU gradient colours plus
 * depth-scaled dust that parallaxes with the camera.
 */
export const Backdrop: React.FC<{
  base?: string;
  intensity?: number;
  light?: boolean;
  parallaxX?: number;
  parallaxY?: number;
  dust?: number;
}> = ({base = BRAND.bg, intensity = 0.55, light = false, parallaxX = 0, parallaxY = 0, dust = 1}) => {
  const f = useCurrentFrame();
  const t = f * 0.008;
  const bg = BLOBS.map((b, i) => {
    const x = (b.x + noise3(i * 3.1, t, 0) * 0.08) * 100;
    const y = (b.y + noise3(0, i * 2.7, t) * 0.08) * 100;
    const a = intensity * (light ? 0.35 : 0.42);
    return `radial-gradient(circle at ${x}% ${y}%, rgba(${b.c},${a}) 0%, rgba(${b.c},0) ${b.r * 100}%)`;
  });
  return (
    <AbsoluteFill style={{background: base}}>
      <AbsoluteFill style={{background: bg.join(',')}} />
      {dust > 0 && (
        <svg width="100%" height="100%" style={{position: 'absolute'}}>
          {DUST.map((d, i) => {
            const x = (((d.x * 1920 + f * (0.4 + d.z) + parallaxX * d.z) % 2000) + 2000) % 2000 - 40;
            const y = (((d.y * 1080 - f * 0.25 * d.z + parallaxY * d.z) % 1120) + 1120) % 1120 - 20;
            const tw = 0.5 + 0.5 * Math.sin(f * 0.1 + i);
            return <circle key={i} cx={x} cy={y} r={0.6 + d.z * 1.8} fill={light ? 'rgba(80,60,140,1)' : '#fff'} opacity={(0.08 + d.s * 0.22) * tw * dust} />;
          })}
        </svg>
      )}
    </AbsoluteFill>
  );
};

const BOKEH = Array.from({length: 12}, (_, i) => ({
  x: random(`bx${i}`),
  y: random(`by${i}`),
  r: 40 + random(`br${i}`) * 110,
  c: ['255,122,51', '228,61,240', '123,92,255', '47,107,255'][i % 4],
}));

/** Out-of-focus foreground orbs that sweep past faster than the subject: depth without touching the UI. */
export const Bokeh: React.FC<{parallaxX?: number; parallaxY?: number; opacity?: number}> = ({parallaxX = 0, parallaxY = 0, opacity = 0.14}) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {BOKEH.map((b, i) => {
        const x = ((((b.x * 2400 + parallaxX * 1.8 + f * 1.2) % 2400) + 2400) % 2400) - 240;
        const y = ((((b.y * 1400 + parallaxY * 1.8) % 1400) + 1400) % 1400) - 160;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x - b.r,
              top: y - b.r,
              width: b.r * 2,
              height: b.r * 2,
              borderRadius: '50%',
              background: `radial-gradient(circle, rgba(${b.c},${opacity}) 0%, rgba(${b.c},${opacity * 0.4}) 40%, rgba(${b.c},0) 70%)`,
              filter: 'blur(10px)',
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

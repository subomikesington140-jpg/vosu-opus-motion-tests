import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {E, lerp, prog, springAt} from '../../lib/ease';
import {Backdrop} from '../Backdrop';
import {A, BRAND, Sparkle, VT} from '../lib';

const FROM = VT.scenes.logo.from;
const C = VT.cues;
const LW = 1180;
const K = LW / A.logo_full.w;
const LH = A.logo_full.h * K;
const LEFT = 960 - LW / 2;
const TOP = 540 - LH / 2;
const HOLE = A.logo_hole.bbox as number[];
// centre of the star cut out of the "O", in screen px at zoom 1
const PX = LEFT + ((HOLE[0] + HOLE[2]) / 2) * K;
const PY = TOP + ((HOLE[1] + HOLE[3]) / 2) * K;
const LETTERS = ['logo_v', 'logo_o', 'logo_s', 'logo_u'];

/**
 * 01 — The mark assembles letter by letter on the beat, catches a glint, then
 * the camera flies through the star in the "O" into the product.
 */
export const LogoOpen: React.FC = () => {
  const g = useCurrentFrame() + FROM;

  // fly-through: exponential zoom about the star, drifting it to frame centre
  const zt = prog(g, C.zoomThrough, 17, E.expoIn);
  const zoom = Math.pow(70, zt) * lerp(1, 1.06, prog(g, 0, C.zoomThrough, E.quintOut));
  const shiftX = (960 - PX) * zt;
  const shiftY = (540 - PY) * zt;
  const L = PX + (LEFT - PX) * zoom + shiftX;
  const Tt = PY + (TOP - PY) * zoom + shiftY;
  const W = LW * zoom;
  const Hh = LH * zoom;

  const bloom = prog(g, C.letters[0], 30, E.quintOut);
  const sweep = prog(g, C.glint - 4, 16, E.quartInOut);

  const matte: React.CSSProperties =
    g >= C.zoomThrough - 2
      ? {
          WebkitMaskImage: `url(${staticFile(A.logo_hole.file)}), linear-gradient(#000, #000)`,
          WebkitMaskSize: `${W}px ${Hh}px, 100% 100%`,
          WebkitMaskPosition: `${L}px ${Tt}px, 0 0`,
          WebkitMaskRepeat: 'no-repeat, no-repeat',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }
      : {};

  return (
    <AbsoluteFill>
      {/* everything outside the star; the next scene shows through the hole */}
      <AbsoluteFill style={matte}>
        <Backdrop intensity={0.25 + bloom * 0.45} />
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse 38% 30% at ${(PX / 1920) * 100}% 50%, rgba(155,92,255,${0.35 * bloom}) 0%, rgba(255,79,163,${0.15 * bloom}) 45%, rgba(0,0,0,0) 100%)`,
          }}
        />
      </AbsoluteFill>

      <div style={{position: 'absolute', left: L, top: Tt, width: W, height: Hh}}>
        {LETTERS.map((id, i) => {
          const land = C.letters[i];
          const p = springAt(g, land - 5, 0.42, 0.5);
          const vis = prog(g, land - 5, 4, E.quintOut);
          const blur = (1 - prog(g, land - 5, 8, E.expoOut)) * 22;
          const a = A[id];
          return (
            <Img
              key={id}
              src={staticFile(a.file)}
              style={{
                position: 'absolute',
                left: (a.x ?? 0) * K * zoom,
                top: 0,
                width: a.w * K * zoom,
                height: a.h * K * zoom,
                opacity: vis,
                transform: `translateY(${(1 - p) * 70 * zoom}px) scale(${lerp(1.35, 1, p)}) rotate(${(1 - p) * (i % 2 ? 10 : -10)}deg)`,
                filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
              }}
            />
          );
        })}
        {/* specular sweep, masked to the mark */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            WebkitMaskImage: `url(${staticFile(A.logo_full.file)})`,
            WebkitMaskSize: '100% 100%',
            background: `linear-gradient(105deg, rgba(255,255,255,0) ${sweep * 140 - 30}%, rgba(255,255,255,0.75) ${sweep * 140 - 15}%, rgba(255,255,255,0) ${sweep * 140}%)`,
            mixBlendMode: 'screen',
            opacity: sweep > 0 && sweep < 1 ? 1 : 0,
          }}
        />
      </div>

      {/* glint on the small sparkle of the "O" */}
      {g >= C.glint - 2 && g < C.glint + 14 && (
        <Sparkle
          x={L + 450 * K * zoom}
          y={Tt + 73 * K * zoom}
          size={140 * Math.sin(Math.PI * prog(g, C.glint - 2, 16, E.quartInOut))}
          rot={g * 4}
        />
      )}
      <AbsoluteFill style={{background: BRAND.bg, opacity: 1 - prog(g, 0, 6)}} />
    </AbsoluteFill>
  );
};

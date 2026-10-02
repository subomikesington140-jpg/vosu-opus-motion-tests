import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {E, keys, lerp, prog, springAt} from '../../lib/ease';
import {Backdrop} from '../Backdrop';
import {A, BRAND, Card, UI, VT, wordFrame} from '../lib';

const FROM = VT.scenes.market.from;
const C = VT.cues;
// hero panel in source px (marketplace.webp)
const P = {x: 108, y: 80, w: 1204, h: 502};
const K = 1.45;

const BUILD: {id: string; at: number; kind: 'drop' | 'rise' | 'fade' | 'pop'}[] = [
  {id: 'mk_pill', at: 318, kind: 'drop'},
  {id: 'mk_h1', at: 322, kind: 'rise'},
  {id: 'mk_h2', at: 327, kind: 'rise'},
  {id: 'mk_copy', at: 332, kind: 'fade'},
  {id: 'mk_btn', at: 336, kind: 'pop'},
  {id: 'mk_trust1', at: 341, kind: 'fade'},
  {id: 'mk_trust2', at: 344, kind: 'fade'},
  {id: 'mk_trust3', at: 347, kind: 'fade'},
];
const CARDS = [
  {id: 'mk_video', at: 326, dir: [-1, -1], depth: 1.2},
  {id: 'mk_audio', at: 330, dir: [1, -1], depth: 0.8},
  {id: 'mk_image', at: 334, dir: [-1, 1], depth: 1.0},
  {id: 'mk_3d', at: 338, dir: [1, 1], depth: 1.3},
];
// a white area of the centre card, above its VOSU mark: the camera dives into it
const DIVE = {x: 950, y: 238};

/**
 * 05 — "And get paid on the Creator Marketplace." The real hero assembles piece
 * by piece, the media cards orbit into place, the CTA is pressed on the beat,
 * then the camera dives into the white card to reach the end card.
 */
export const Market: React.FC = () => {
  const g = useCurrentFrame() + FROM;

  const enter = prog(g, FROM, 18, E.expoOut);
  const dive = prog(g, C.endBloom - 14, 14, E.expoIn);
  const zoom = keys(g, [FROM, C.endBloom - 14], [1, 1.05], E.quartInOut) * Math.pow(14, dive);
  const rotY = keys(g, [FROM, C.endBloom - 14], [9, -2], E.quartInOut) * (1 - dive);
  // pivot drifts from panel centre to the dive target
  const pvx = lerp(P.x + P.w / 2, DIVE.x, prog(g, C.endBloom - 20, 20, E.quartInOut));
  const pvy = lerp(P.y + P.h / 2, DIVE.y, prog(g, C.endBloom - 20, 20, E.quartInOut));
  const sx = (x: number) => 960 + (x - pvx) * K;
  const sy = (y: number) => 545 + (y - pvy) * K;

  const creator = wordFrame('creator');
  const pillGlow = prog(g, creator - 2, 6) * (1 - prog(g, creator + 6, 18));
  const press = g >= C.buttonPress ? Math.sin(Math.min(1, (g - C.buttonPress) / 7) * Math.PI) : 0;
  const ripple = prog(g, C.buttonPress, 18, E.expoOut);
  const shine = prog(g, 329, 18, E.quartInOut);

  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <Backdrop intensity={0.5} />
      <AbsoluteFill style={{perspective: 2000}}>
        <AbsoluteFill
          style={{
            transformOrigin: `${sx(pvx)}px ${sy(pvy)}px`,
            transform: `translateY(${(1 - enter) * 380}px) scale(${zoom * lerp(0.9, 1, enter)}) rotateX(${(1 - enter) * 28}deg) rotateY(${rotY}deg)`,
            opacity: enter,
          }}
        >
          {/* the hero panel: the real background, blurred, inside the panel frame */}
          <div
            style={{
              position: 'absolute',
              left: sx(P.x),
              top: sy(P.y),
              width: P.w * K,
              height: P.h * K,
              borderRadius: 30 * K,
              overflow: 'hidden',
              border: '1.5px solid rgba(255,255,255,0.09)',
              boxShadow: '0 60px 140px rgba(0,0,0,0.55)',
            }}
          >
            <Img src={staticFile(A.mk_bg.file)} style={{width: '100%', height: '100%'}} />
          </div>

          {/* white centre card */}
          {(() => {
            const p = prog(g, 320, 16, E.expoOut);
            const a = A.mk_center;
            return (
              <div
                style={{
                  position: 'absolute',
                  left: sx(a.x ?? 0) - 7 * K,
                  top: sy(a.y ?? 0) - 7 * K,
                  width: (a.w + 14) * K,
                  height: (a.h + 14) * K,
                  borderRadius: 12 * K,
                  background: 'rgba(255,255,255,0.22)',
                  opacity: p,
                  transform: `scale(${lerp(0.86, 1, p)})`,
                  filter: p < 0.97 ? `blur(${(1 - p) * 14}px)` : undefined,
                }}
              >
                <Img src={staticFile(a.file)} style={{position: 'absolute', left: 7 * K, top: 7 * K, width: a.w * K, height: a.h * K, borderRadius: 6 * K}} />
              </div>
            );
          })()}

          {/* copy column */}
          <div style={{position: 'absolute', left: sx(0), top: sy(0)}}>
            {/* pill highlight on "Creator Marketplace" */}
            <div
              style={{
                position: 'absolute',
                left: (A.mk_pill.x ?? 0) * K + 6,
                top: (A.mk_pill.y ?? 0) * K + 6,
                width: A.mk_pill.w * K - 12,
                height: A.mk_pill.h * K - 12,
                borderRadius: 40,
                background: BRAND.gradient,
                filter: 'blur(16px)',
                opacity: pillGlow * 0.9,
              }}
            />
            {BUILD.map(({id, at, kind}) => {
              const a = A[id];
              const p = prog(g, at, 14, E.expoOut);
              const s = springAt(g, at, 0.45, 0.5);
              let style: React.CSSProperties = {opacity: p};
              if (kind === 'drop') style = {opacity: p, transform: `translateY(${(1 - p) * -20}px)`};
              if (kind === 'fade') style = {opacity: p, transform: `translateY(${(1 - p) * 18}px)`};
              if (kind === 'pop') style = {opacity: p, transform: `scale(${lerp(0.75, 1, s) * (1 - press * 0.06)})`};
              if (kind === 'rise')
                return (
                  <div key={id} style={{position: 'absolute', left: (a.x ?? 0) * K, top: (a.y ?? 0) * K, width: a.w * K, height: a.h * K, overflow: 'hidden'}}>
                    <Img src={staticFile(a.file)} style={{width: '100%', height: '100%', transform: `translateY(${(1 - p) * 105}%)`}} />
                    {id === 'mk_h2' && shine > 0 && shine < 1 && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          WebkitMaskImage: `url(${staticFile(a.file)})`,
                          WebkitMaskSize: '100% 100%',
                          background: `linear-gradient(100deg, rgba(255,255,255,0) ${shine * 160 - 40}%, rgba(255,255,255,0.8) ${shine * 160 - 20}%, rgba(255,255,255,0) ${shine * 160}%)`,
                        }}
                      />
                    )}
                  </div>
                );
              return <UI key={id} id={id} k={K} style={style} />;
            })}
            {g >= C.buttonPress && ripple < 1 && (
              <div
                style={{
                  position: 'absolute',
                  left: (A.mk_btn.x ?? 0) * K - 14 * ripple,
                  top: (A.mk_btn.y ?? 0) * K - 14 * ripple,
                  width: A.mk_btn.w * K + 28 * ripple,
                  height: A.mk_btn.h * K + 28 * ripple,
                  borderRadius: 60,
                  border: `${3 * (1 - ripple)}px solid rgba(255,163,108,${1 - ripple})`,
                }}
              />
            )}
          </div>

          {/* floating media cards orbit in to their exact spots and angles */}
          {CARDS.map((c, i) => {
            const a = A[c.id];
            const s = springAt(g, c.at, 0.28, 0.65);
            const vis = prog(g, c.at, 6);
            const bob = Math.sin((g - c.at) * 0.08 + i * 1.7) * 5;
            const par = rotY * c.depth * 6;
            return (
              <Card
                key={c.id}
                id={c.id}
                k={K}
                x={sx(a.cx ?? 0) + c.dir[0] * (1 - s) * 420 + par}
                y={sy(a.cy ?? 0) + c.dir[1] * (1 - s) * 300 + bob}
                style={{opacity: vis, transform: `rotate(${(a.angle ?? 0) + (1 - s) * c.dir[0] * 40}deg) scale(${lerp(1.4, 1, s)})`}}
              />
            );
          })}
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {E, keys, lerp, prog, springAt} from '../../lib/ease';
import {Backdrop} from '../Backdrop';
import {A, BRAND, FONT, UI, VT, wordFrame} from '../lib';

const FROM = VT.scenes.tools.from;
const C = VT.cues;
const BG = (A as unknown as Record<string, Record<string, string>>)._colors.toolsBg;
const GRID = [
  ['tool_upscale', 'tool_bgremove', 'tool_angle', 'tool_skin'],
  ['tool_videogen', 'tool_vfx', 'tool_extend'],
];
const HERO = 'tool_bgremove';
// the "Remove Background" button inside the hero card (source px)
const BTN = {x: 553, y: 246};

/**
 * 04 — "Pro tools, one click away." The real Popular Tools grid cascades in
 * with a 3D flip, then the camera pushes onto Background Remover; its button
 * gets clicked on the word "click" while the line sets as kinetic type.
 */
export const Tools: React.FC = () => {
  const g = useCurrentFrame() + FROM;
  const clickF = wordFrame('click');
  const oneF = clickF - 9;
  const awayF = clickF + 7;

  const enter = 1 - prog(g, C.swipe, 14, E.expoInOut); // shared with the node scene's swipe out
  // camera (source px focus -> screen anchor)
  const KF = [FROM, C.toolsPush, C.toolsPush + 16, 318];
  const fx = keys(g, KF, [705, 705, 553, 553], E.quartInOut);
  const fy = keys(g, KF, [350, 350, 262, 262], E.quartInOut);
  const zoom = keys(g, KF, [1.32, 1.36, 2.35, 2.45], E.quartInOut);
  const ax = keys(g, KF, [960, 960, 640, 630], E.quartInOut);
  const tiltX = keys(g, [FROM, C.toolsPush, C.toolsPush + 16], [24, 6, 0], E.quartInOut);
  const focus = prog(g, C.toolsPush, 14, E.quartInOut);

  const out = prog(g, 306, 12, E.expoIn);
  const press = g >= clickF ? Math.sin(Math.min(1, (g - clickF) / 6) * Math.PI) : 0;
  const ripple = prog(g, clickF, 16, E.expoOut);

  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <AbsoluteFill style={{background: BG, transform: `translateY(${enter * 1080}px) scale(${1 - out * 0.12})`, opacity: 1 - out, filter: out > 0.02 ? `blur(${out * 12}px)` : undefined}}>
        <Backdrop base={BG} intensity={0.14} />
        <AbsoluteFill style={{perspective: 1800}}>
          <div
            style={{
              position: 'absolute',
              left: ax - fx * zoom,
              top: 560 - fy * zoom,
              width: 1400,
              height: 700,
              transform: `scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            <div style={{position: 'absolute', inset: 0, transform: `rotateX(${tiltX}deg)`, transformOrigin: `${fx}px ${fy}px`}}>
              {['tools_title', 'tools_all'].map((id, i) => {
                const p = prog(g, C.toolsCascade - 2 + i * 3, 12, E.expoOut);
                return <UI key={id} id={id} style={{opacity: p * (1 - focus * 0.8), transform: `translateY(${(1 - p) * 20}px)`}} />;
              })}
              {GRID.map((row, r) =>
                row.map((id, c) => {
                  const at = C.toolsCascade + (r + c) * 2.5;
                  const s = springAt(g, at, 0.38, 0.55);
                  const vis = prog(g, at, 6);
                  const hero = id === HERO;
                  const dim = hero ? 0 : focus;
                  return (
                    <UI
                      key={id}
                      id={id}
                      origin="50% 100%"
                      style={{
                        opacity: vis * (1 - dim * 0.85),
                        transform: `translateY(${(1 - s) * 90}px) rotateX(${(1 - s) * -70}deg) scale(${hero ? 1 - press * 0.02 : 1})`,
                        filter: dim > 0.05 ? `blur(${dim * 5}px)` : undefined,
                        borderRadius: 14,
                        boxShadow: hero ? `0 30px 80px rgba(0,0,0,${0.6 * focus})` : undefined,
                      }}
                    />
                  );
                }),
              )}
              {/* click ripple on the real button */}
              {g >= clickF && ripple < 1 && (
                <div
                  style={{
                    position: 'absolute',
                    left: BTN.x - 60 * ripple,
                    top: BTN.y - 60 * ripple,
                    width: 120 * ripple,
                    height: 120 * ripple,
                    borderRadius: '50%',
                    border: `${3 * (1 - ripple) + 0.5}px solid rgba(255,255,255,${0.9 * (1 - ripple)})`,
                  }}
                />
              )}
            </div>
          </div>
        </AbsoluteFill>

        {/* kinetic line, word-synced to the VO */}
        <div style={{position: 'absolute', left: 1180, top: 400, color: '#fff'}}>
          {[
            {t: 'One', at: oneF, font: FONT.sans, size: 104},
            {t: 'click', at: clickF, font: FONT.sans, size: 104},
          ].map((w, i) => {
            const p = prog(g, w.at - 2, 12, E.expoOut);
            return (
              <span key={i} style={{display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom', marginRight: 26, paddingBottom: 6}}>
                <span style={{display: 'inline-block', fontFamily: w.font, fontSize: w.size, letterSpacing: '-0.03em', lineHeight: 1.05, transform: `translateY(${(1 - p) * 110}%)`}}>{w.t}</span>
              </span>
            );
          })}
          <div style={{overflow: 'hidden', paddingBottom: 10}}>
            {(() => {
              const p = prog(g, awayF - 2, 14, E.expoOut);
              return (
                <span
                  style={{
                    display: 'inline-block',
                    fontFamily: FONT.serif,
                    fontSize: 150,
                    lineHeight: 1,
                    backgroundImage: `linear-gradient(100deg, ${BRAND.peach}, ${BRAND.orange})`,
                    WebkitBackgroundClip: 'text',
                    color: 'transparent',
                    transform: `translateY(${(1 - p) * 110}%) skewX(${(1 - p) * -12}deg)`,
                    paddingRight: 20,
                  }}
                >
                  away.
                </span>
              );
            })()}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

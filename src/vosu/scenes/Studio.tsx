import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {E, keys, lerp, prog, springAt} from '../../lib/ease';
import {A, BRAND, Card, MotionBlur, UI, VT, wordFrame} from '../lib';

const FROM = VT.scenes.studio.from;
const C = VT.cues;
// layout: source px (home.png) -> screen, centred on the headline/prompt column
const K = 1.65;
const OX = 708 - 960 / K;
const OY = 262 - 540 / K;

const PILLS: {id: string; at: number}[] = [
  {id: 'home_pill_studios', at: wordFrame('studio')},
  {id: 'home_pill_video', at: wordFrame('video')},
  {id: 'home_pill_images', at: wordFrame('image')},
  {id: 'home_pill_audio', at: wordFrame('audio')},
  {id: 'home_pill_3d', at: wordFrame('threeD')},
];

const CARDS = [
  {id: 'mk_video', at: wordFrame('video'), x: 225, y: 235, from: [-500, -160]},
  {id: 'mk_image', at: wordFrame('image'), x: 245, y: 905, from: [-500, 220]},
  {id: 'mk_audio', at: wordFrame('audio'), x: 1700, y: 235, from: [500, -160]},
  {id: 'mk_3d', at: wordFrame('threeD'), x: 1712, y: 895, from: [500, 220]},
];

/** Reveal-from-below inside a clipping box, for the real headline crops. */
const Rise: React.FC<{id: string; at: number; g: number}> = ({id, at, g}) => {
  const a = A[id];
  const p = prog(g, at, 14, E.expoOut);
  return (
    <div style={{position: 'absolute', left: ((a.x ?? 0) - OX) * K, top: ((a.y ?? 0) - OY) * K, width: a.w * K, height: a.h * K, overflow: 'hidden'}}>
      <Img
        src={staticFile(a.file)}
        style={{width: '100%', height: '100%', transform: `translateY(${(1 - p) * 105}%)`, filter: p < 0.98 ? `blur(${(1 - p) * 8}px)` : undefined}}
      />
    </div>
  );
};

/**
 * 02 — "Your AI studio for video, image, audio and 3D." The real home screen
 * builds itself: headline, prompt box (placeholder types on), and each category
 * pill lights up as its word is spoken while the matching media card floats in.
 */
export const Studio: React.FC = () => {
  const g = useCurrentFrame() + FROM;

  // camera: continues the fly-through, settles, drifts, then whips out left
  const arrive = prog(g, C.zoomThrough, 26, E.expoOut);
  const camScale = lerp(1.35, 1, arrive) * keys(g, [70, 142], [1, 1.04], E.quartInOut);
  const tilt = lerp(14, 0, arrive);
  // whip pan: shares its curve with the node scene, which rides in alongside
  const whip = prog(g, C.whip, 12, E.expoInOut);
  const whipX = -1920 * whip;
  const whipBlur = Math.abs(1920 * (whip - prog(g - 1, C.whip, 12, E.expoInOut))) * 0.3;

  const box = prog(g, 47, 18, E.expoOut);
  const typed = prog(g, C.typeOn, 16, (t) => t);
  const textA = A.home_prompt_text;
  const caretX = ((textA.x ?? 0) - OX) * K + textA.w * K * typed;

  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <MotionBlur id="studio-whip" x={whipBlur} />
      <AbsoluteFill style={{background: BRAND.bg, filter: whipBlur > 0.5 ? 'url(#studio-whip)' : undefined, transform: `translateX(${whipX}px)`}}>
        {/* blurred real screen as atmosphere */}
        <Img
          src={staticFile(A.home_bg.file)}
          style={{position: 'absolute', left: -120, top: -90, width: 2160, height: 1260, opacity: 0.9, transform: `scale(${1 + (camScale - 1) * 0.5})`}}
        />
        <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, rgba(14,14,18,0) 30%, rgba(14,14,18,0.75) 100%)'}} />

        <AbsoluteFill style={{perspective: 1600}}>
          <AbsoluteFill style={{transform: `scale(${camScale}) rotateX(${tilt}deg)`, transformOrigin: '50% 45%'}}>
            <Rise id="home_headline_a" at={42} g={g} />
            <Rise id="home_headline_b" at={46} g={g} />

            {/* prompt box: empty shell first, then the real placeholder types on */}
            <div style={{position: 'absolute', inset: 0, opacity: box, transform: `translateY(${(1 - box) * 40}px) scale(${lerp(0.94, 1, box)})`, transformOrigin: '50% 40%'}}>
              <UI id="home_prompt_empty" ox={OX} oy={OY} k={K} />
              <UI id="home_prompt_text" ox={OX} oy={OY} k={K} style={{clipPath: `inset(0 ${(1 - typed) * 100}% 0 0)`}} />
              {g >= C.typeOn - 4 && g < C.typeOn + 30 && (
                <div
                  style={{
                    position: 'absolute',
                    left: caretX + 2,
                    top: ((textA.y ?? 0) - OY) * K + 4,
                    width: 2.5,
                    height: textA.h * K - 8,
                    background: '#fff',
                    opacity: Math.floor(g / 4) % 2 || typed < 1 ? 0.9 : 0,
                  }}
                />
              )}
              {['home_prompt_actions_l', 'home_prompt_actions_r'].map((id, i) => {
                const p = prog(g, 82 + i * 3, 12, E.expoOut);
                return <UI key={id} id={id} ox={OX} oy={OY} k={K} style={{opacity: p, transform: `translateY(${(1 - p) * 14}px)`}} />;
              })}
            </div>

            {/* category pills, each on its spoken word */}
            {PILLS.map(({id, at}) => {
              const s = springAt(g, at - 2, 0.5, 0.5);
              const vis = prog(g, at - 2, 5);
              const glow = Math.max(0, 1 - Math.max(0, g - at) / 16) * (g >= at - 2 ? 1 : 0);
              const a = A[id];
              return (
                <React.Fragment key={id}>
                  <div
                    style={{
                      position: 'absolute',
                      left: ((a.x ?? 0) - OX) * K + 4,
                      top: ((a.y ?? 0) - OY) * K + 4,
                      width: a.w * K - 8,
                      height: a.h * K - 8,
                      borderRadius: 12 * K,
                      background: BRAND.gradient,
                      filter: 'blur(14px)',
                      opacity: glow * 0.85,
                      transform: `scale(${1 + glow * 0.08})`,
                    }}
                  />
                  <UI id={id} ox={OX} oy={OY} k={K} style={{opacity: vis, transform: `translateY(${(1 - s) * 26 - glow * 5}px) scale(${lerp(0.9, 1, s)})`}} />
                </React.Fragment>
              );
            })}

            {(() => {
              const p = prog(g, 116, 14, E.expoOut);
              return <UI id="home_row" ox={OX} oy={OY} k={K} style={{opacity: p * 0.9, transform: `translateY(${(1 - p) * 20}px)`}} />;
            })()}
          </AbsoluteFill>
        </AbsoluteFill>

        {/* the real media cards float in on their words, at depth */}
        {CARDS.map((c, i) => {
          const p = springAt(g, c.at - 4, 0.3, 0.62);
          const vis = prog(g, c.at - 4, 6);
          const bob = Math.sin((g - c.at) * 0.07 + i) * 8;
          const a = A[c.id];
          const drift = (camScale - 1) * (c.x - 960) * 0.6;
          return (
            <Card
              key={c.id}
              id={c.id}
              k={1.45}
              x={c.x + c.from[0] * (1 - p) + drift}
              y={c.y + c.from[1] * (1 - p) + bob}
              style={{opacity: vis, transform: `rotate(${(a.angle ?? 0) + (1 - p) * (i % 2 ? 25 : -25)}deg) scale(${lerp(1.3, 1, p)})`}}
            />
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

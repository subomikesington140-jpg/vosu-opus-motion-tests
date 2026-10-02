import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {E, keys, lerp, prog, springAt} from '../../lib/ease';
import {Backdrop} from '../Backdrop';
import {A, BRAND, FONT, Sparkle, VT, wordFrame} from '../lib';

const FROM = VT.scenes.end.from;
const C = VT.cues;
const LW = 880;
const K = LW / A.logo_full.w;
const LEFT = 960 - LW / 2;
const TOP = 300;
const LETTERS = ['logo_v', 'logo_o', 'logo_s', 'logo_u'];

const WORDS: {t: string; key: 'what' | 'are' | 'you' | 'creating' | 'today'; serif?: boolean}[] = [
  {t: 'What', key: 'what'},
  {t: 'are', key: 'are'},
  {t: 'you', key: 'you'},
  {t: 'creating', key: 'creating', serif: true},
  {t: 'today?', key: 'today', serif: true},
];

/**
 * 06 — The mark on light, as it was designed to sit. The product's own line,
 * "What are you creating today?", sets word by word with the voice.
 */
export const EndCard: React.FC = () => {
  const g = useCurrentFrame() + FROM;
  const push = keys(g, [FROM, 450], [1.0, 1.045], E.quartInOut);
  const chord = Math.exp(-Math.max(0, g - C.finalChord) * 0.15) * (g >= C.finalChord ? 1 : 0);
  const urlIn = prog(g, 428, 14, E.expoOut);

  return (
    <AbsoluteFill style={{background: BRAND.light, overflow: 'hidden'}}>
      <Backdrop base={BRAND.light} light intensity={0.8} dust={0.5} />
      <AbsoluteFill style={{transform: `scale(${push})`}}>
        {/* soft brand halo behind the mark */}
        <div
          style={{
            position: 'absolute',
            left: 960 - 700,
            top: TOP - 200,
            width: 1400,
            height: 620,
            background: 'radial-gradient(ellipse at 50% 50%, rgba(155,92,255,0.18) 0%, rgba(255,120,80,0.10) 40%, rgba(255,255,255,0) 70%)',
            opacity: prog(g, C.endBloom + 2, 20),
          }}
        />
        <div style={{position: 'absolute', left: LEFT, top: TOP, width: LW, height: A.logo_full.h * K, transform: `scale(${1 + chord * 0.025})`}}>
          {LETTERS.map((id, i) => {
            const at = C.endBloom + 2 + i * 2;
            const s = springAt(g, at, 0.4, 0.55);
            const vis = prog(g, at, 5);
            const a = A[id];
            return (
              <Img
                key={id}
                src={staticFile(a.file)}
                style={{
                  position: 'absolute',
                  left: (a.x ?? 0) * K,
                  top: 0,
                  width: a.w * K,
                  height: a.h * K,
                  opacity: vis,
                  transform: `translateY(${(1 - s) * 50}px) scale(${lerp(0.7, 1, s)})`,
                  filter: s < 0.95 ? `blur(${(1 - Math.min(1, s)) * 16}px)` : undefined,
                }}
              />
            );
          })}
          {g >= C.finalGlint - 2 && g < C.finalGlint + 16 && (
            <Sparkle x={450 * K} y={73 * K} size={120 * Math.sin(Math.PI * prog(g, C.finalGlint - 2, 18, E.quartInOut))} rot={g * 3} color="#ffffff" />
          )}
        </div>

        {/* tagline, word-synced */}
        <div style={{position: 'absolute', left: 0, right: 0, top: 640, display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 22}}>
          {WORDS.map((w) => {
            const at = wordFrame(w.key) - 2;
            const p = prog(g, at, 13, E.expoOut);
            return (
              <span key={w.key} style={{display: 'inline-block', overflow: 'hidden', paddingBottom: 12, paddingRight: w.serif ? 8 : 0}}>
                <span
                  style={{
                    display: 'inline-block',
                    transform: `translateY(${(1 - p) * 105}%)`,
                    fontFamily: w.serif ? FONT.serif : FONT.sans,
                    fontSize: w.serif ? 104 : 86,
                    letterSpacing: w.serif ? '0' : '-0.035em',
                    lineHeight: 1.1,
                    color: w.serif ? 'transparent' : BRAND.ink,
                    backgroundImage: w.serif ? `linear-gradient(100deg, #FF9A5C, ${BRAND.orange} 60%, #FF4FA3)` : undefined,
                    WebkitBackgroundClip: w.serif ? 'text' : undefined,
                  }}
                >
                  {w.t}
                </span>
              </span>
            );
          })}
        </div>

        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 830,
            display: 'flex',
            justifyContent: 'center',
            opacity: urlIn,
            transform: `translateY(${(1 - urlIn) * 16}px)`,
          }}
        >
          <div style={{fontFamily: FONT.sansSemi, fontSize: 30, letterSpacing: '0.08em', color: BRAND.ink, padding: '12px 30px', borderRadius: 60, border: '1.5px solid rgba(20,19,22,0.14)', background: 'rgba(255,255,255,0.6)'}}>
            vosu.ai
          </div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{background: '#fff', opacity: 1 - prog(g, C.endBloom, 10, E.quintOut)}} />
    </AbsoluteFill>
  );
};

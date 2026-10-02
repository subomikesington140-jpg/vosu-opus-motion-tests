import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {COLORS, FONTS, H, W} from '../theme';
import {E, keys, prog, springAt} from '../lib/ease';
import {T, local, pulse} from '../lib/timing';

const FROM = T.scenes.type.from;
const WORD = 'MOTION';
const HITS = T.cues.typeLetterBeats.map((b) => Math.round(local(b, FROM)));
const SPLIT = local(T.cues.typeSplitBeat, FROM);
const WIPE = local(T.cues.typeWipeBeat, FROM);
const SIZE = 330;

const Outline: React.FC<{children: React.ReactNode; color: string; width?: number; style?: React.CSSProperties}> = ({children, color, width = 2, style}) => (
  <span style={{color: 'transparent', WebkitTextStroke: `${width}px ${color}`, ...style}}>{children}</span>
);

/**
 * 02 KINETIC TYPE — the word slams in letter by letter on 8th notes with
 * squash/stretch and skew, echoes into a stack, then a layered diagonal wipe.
 */
export const KineticType: React.FC = () => {
  const f = useCurrentFrame();

  const kick = pulse(f, HITS, 0.25);
  const camScale = interpolate(f, [0, 60], [1.1, 1]) + kick * 0.015;
  const camRot = interpolate(f, [0, 60], [-1.5, 1]);

  // split: letters spread and the row echoes vertically
  const split = prog(f, SPLIT, 12, E.expoOut);
  const spread = split * 0.06;

  const letters = WORD.split('').map((ch, i) => {
    const hit = HITS[i];
    const s = springAt(f, hit, 0.55, 0.45);
    const y = (1 - s) * 115;
    const skew = (1 - prog(f, hit, 10, E.expoOut)) * -18;
    const stretchY = 1 + (1 - prog(f, hit, 9, E.expoOut)) * 0.55;
    const flash = f >= hit && f < hit + 2;
    return (
      <span key={i} style={{display: 'inline-block', overflow: 'hidden', lineHeight: 0.86, padding: '0 0.005em'}}>
        <span
          style={{
            display: 'inline-block',
            transform: `translateY(${y}%) skewX(${skew}deg) scaleY(${stretchY})`,
            transformOrigin: '50% 100%',
            color: flash ? COLORS.paper : COLORS.ink,
          }}
        >
          {ch}
        </span>
      </span>
    );
  });

  // marquee texture rows behind the word (parallax)
  const rows = [-1, 0, 1, 2].map((r) => {
    const dir = r % 2 ? 1 : -1;
    const x = dir * f * 6 - 400;
    return (
      <div
        key={r}
        style={{
          position: 'absolute',
          top: H / 2 + r * 250 - 330,
          left: x,
          whiteSpace: 'nowrap',
          fontFamily: FONTS.display,
          fontSize: 260,
          letterSpacing: '-0.04em',
          opacity: 0.16,
        }}
      >
        <Outline color={COLORS.ink} width={1.5}>
          MOTION MOTION MOTION MOTION
        </Outline>
      </div>
    );
  });

  // echo stack revealed at the split
  const echoes = [-2, -1, 1, 2].map((r) => {
    const p = prog(f, SPLIT + Math.abs(r) * 2, 14, E.expoOut);
    const dx = (r % 2 ? 1 : -1) * (1 - p) * 500 + (r % 2 ? 1 : -1) * p * 40;
    return (
      <div
        key={r}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '50%',
          transform: `translate(${dx}px, ${-50 + r * 92}%)`,
          textAlign: 'center',
          opacity: p * (1 - Math.abs(r) * 0.3),
        }}
      >
        <Outline color={COLORS.ink} width={2.5} style={{letterSpacing: `${-0.045 + spread}em`}}>
          {WORD}
        </Outline>
      </div>
    );
  });

  // layered wipe: ultramarine leads, ink follows
  const wipeA = prog(f, WIPE - 2, 9, E.expoInOut);
  const wipeB = prog(f, WIPE + 0.5, 7.5, E.expoInOut);
  const poly = (p: number) => {
    const x = -700 + p * (W + 1400);
    return `polygon(${x - W - 600}px 0, ${x}px 0, ${x - 600}px ${H}px, ${x - W - 1200}px ${H}px)`;
  };

  const subIn = prog(f, 4, 14);

  return (
    <AbsoluteFill style={{background: COLORS.signal, overflow: 'hidden'}}>
      <AbsoluteFill style={{transform: `scale(${camScale}) rotate(${camRot}deg)`}}>
        {rows}
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            fontFamily: FONTS.display,
            fontSize: SIZE,
            letterSpacing: '-0.045em',
          }}
        >
          {echoes}
          <div style={{letterSpacing: `${-0.045 + spread}em`, transform: `scaleX(${1 + split * 0.04})`}}>{letters}</div>
        </AbsoluteFill>
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: H / 2 - 230,
            display: 'flex',
            justifyContent: 'space-between',
            padding: '0 330px',
            fontFamily: FONTS.mono,
            fontSize: 18,
            letterSpacing: '0.2em',
            color: COLORS.ink,
            opacity: subIn,
          }}
        >
          <span>[ KINETIC ]</span>
          <span>TYPE — WEIGHT — RHYTHM</span>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{background: COLORS.ultra, clipPath: poly(wipeA)}} />
      <AbsoluteFill style={{background: COLORS.ink, clipPath: poly(wipeB)}} />
    </AbsoluteFill>
  );
};

import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {COLORS, FONTS} from '../theme';
import {T} from '../lib/timing';

const SECTIONS: [number, string][] = [
  [T.scenes.ignition.from, '01  IGNITION'],
  [T.scenes.type.from, '02  KINETIC TYPE'],
  [T.scenes.morph.from, '03  MORPH'],
  [T.scenes.swarm.from, '04  SWARM'],
  [T.scenes.dive.from, '05  DEPTH'],
  [T.scenes.drop.from, '06  DROP'],
];

const tc = (f: number) => {
  const s = Math.floor(f / 30);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `00:00:${pad(s)}:${pad(f % 30)}`;
};

/** Persistent broadcast-style overlay: timecode, section, beat counter, crop marks. */
export const Hud: React.FC = () => {
  const frame = useCurrentFrame();
  const onOrange = frame >= T.scenes.type.from && frame < T.scenes.type.to - 6;
  const color = onOrange ? COLORS.ink : COLORS.paper;
  const intro = interpolate(frame, [4, 20], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const outro = interpolate(frame, [T.scenes.resolve.from - 14, T.scenes.resolve.from - 8], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const vis = intro * outro;

  const sectionIdx = SECTIONS.reduce((acc, [f], i) => (frame >= f ? i : acc), 0);
  const sinceSection = frame - SECTIONS[sectionIdx][0];
  const label = SECTIONS[sectionIdx][1];
  // type-on effect for the section label on each change
  const shown = label.slice(0, Math.max(0, Math.floor(sinceSection * 1.6)));

  const beatInBar = Math.floor(frame / T.framesPerBeat) % 4;
  const bar = Math.floor(frame / (T.framesPerBeat * 4)) + 1;

  const text: React.CSSProperties = {
    fontFamily: FONTS.mono,
    fontSize: 15,
    letterSpacing: '0.12em',
    color,
    position: 'absolute',
  };
  const mark = (style: React.CSSProperties) => (
    <div style={{position: 'absolute', width: 22, height: 22, borderColor: color, borderStyle: 'solid', borderWidth: 0, ...style}} />
  );

  return (
    <AbsoluteFill style={{opacity: vis, pointerEvents: 'none'}}>
      {mark({left: 40, top: 40, borderLeftWidth: 1.5, borderTopWidth: 1.5})}
      {mark({right: 40, top: 40, borderRightWidth: 1.5, borderTopWidth: 1.5})}
      {mark({left: 40, bottom: 40, borderLeftWidth: 1.5, borderBottomWidth: 1.5})}
      {mark({right: 40, bottom: 40, borderRightWidth: 1.5, borderBottomWidth: 1.5})}

      <div style={{...text, left: 78, top: 44}}>SIGNAL/NOISE — REEL ’26</div>
      <div style={{...text, right: 78, top: 44}}>{tc(frame)}</div>
      <div style={{...text, left: 78, bottom: 44}}>{shown}</div>
      <div style={{...text, right: 78, bottom: 44, display: 'flex', gap: 14, alignItems: 'center'}}>
        <span>{T.bpm} BPM</span>
        <span style={{opacity: 0.6}}>BAR {String(bar).padStart(2, '0')}</span>
        <span style={{display: 'flex', gap: 6}}>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              style={{
                width: 9,
                height: 9,
                background: i === beatInBar ? (onOrange ? COLORS.ink : COLORS.signal) : 'transparent',
                border: `1.5px solid ${color}`,
              }}
            />
          ))}
        </span>
      </div>
    </AbsoluteFill>
  );
};

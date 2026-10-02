import React from 'react';
import {Img, staticFile} from 'remotion';
import assets from './assets.json';
import timeline from './timeline.json';
import vo from './vo.json';

export const VT = timeline;
export const FPS = timeline.fps;

export const BRAND = {
  bg: '#0E0E12',
  light: '#F6F5F8',
  ink: '#141316',
  orange: '#FF5A1F',
  peach: '#FFA36C',
  magenta: '#E43DF0',
  violet: '#7B5CFF',
  blue: '#2F6BFF',
  /** The gradient family of the VOSU mark, used for glows and highlights. */
  gradient: 'linear-gradient(110deg, #FF8A3D 0%, #FF4FA3 35%, #9B5CFF 65%, #3A7BFF 100%)',
};

export const FONT = {
  sans: '"Plus Jakarta Sans ExtraBold", sans-serif',
  sansSemi: '"Plus Jakarta Sans SemiBold", sans-serif',
  serif: '"Instrument Serif Italic", serif',
};

type Asset = {file: string; w: number; h: number; x?: number; y?: number; cx?: number; cy?: number; angle?: number; bbox?: number[]};
export const A = assets as unknown as Record<string, Asset>;

type VoLine = {duration: number; words: {start: number; end: number}[]};
const VO = vo as unknown as Record<string, VoLine>;

/** Global frame at which a voiceover word starts (see timeline.words). */
export const wordFrame = (key: keyof typeof timeline.words) => {
  const [line, i] = timeline.words[key] as [keyof typeof timeline.vo, number];
  return (timeline.vo[line] + VO[line].words[i].start) * FPS;
};

/**
 * A real UI component cut from the screenshots, placed by its original
 * coordinates relative to a layout origin, at scale k.
 */
export const UI: React.FC<{
  id: string;
  ox?: number;
  oy?: number;
  k?: number;
  style?: React.CSSProperties;
  origin?: string;
}> = ({id, ox = 0, oy = 0, k = 1, style, origin = '50% 50%'}) => {
  const a = A[id];
  return (
    <Img
      src={staticFile(a.file)}
      style={{
        position: 'absolute',
        left: ((a.x ?? 0) - ox) * k,
        top: ((a.y ?? 0) - oy) * k,
        width: a.w * k,
        height: a.h * k,
        transformOrigin: origin,
        ...style,
      }}
    />
  );
};

/** A straightened floating card, centred on (x, y) in layout px. */
export const Card: React.FC<{id: string; x: number; y: number; k: number; style?: React.CSSProperties}> = ({id, x, y, k, style}) => {
  const a = A[id];
  return (
    <Img
      src={staticFile(a.file)}
      style={{
        position: 'absolute',
        left: x - (a.w * k) / 2,
        top: y - (a.h * k) / 2,
        width: a.w * k,
        height: a.h * k,
        borderRadius: 13 * k,
        boxShadow: `0 ${18 * k}px ${50 * k}px rgba(0,0,0,0.45)`,
        ...style,
      }}
    />
  );
};

/** Directional (horizontal or vertical) motion blur filter for whip moves. */
export const MotionBlur: React.FC<{id: string; x?: number; y?: number}> = ({id, x = 0, y = 0}) => (
  <svg width={0} height={0} style={{position: 'absolute'}}>
    <filter id={id} x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation={`${x.toFixed(2)} ${y.toFixed(2)}`} />
    </filter>
  </svg>
);

/** The four-point sparkle from the VOSU mark, as a glint. */
export const Sparkle: React.FC<{x: number; y: number; size: number; rot?: number; opacity?: number; color?: string}> = ({x, y, size, rot = 0, opacity = 1, color = '#fff'}) => {
  const s = size / 2;
  const w = s * 0.18;
  const d = `M0,${-s} C${w},${-w} ${w},${-w} ${s},0 C${w},${w} ${w},${w} 0,${s} C${-w},${w} ${-w},${w} ${-s},0 C${-w},${-w} ${-w},${-w} 0,${-s}Z`;
  return (
    <svg width={size * 2} height={size * 2} style={{position: 'absolute', left: x - size, top: y - size, opacity, overflow: 'visible', pointerEvents: 'none'}}>
      <g transform={`translate(${size} ${size}) rotate(${rot})`}>
        <circle r={s * 0.5} fill={color} opacity={0.35} style={{filter: `blur(${s * 0.25}px)`}} />
        <path d={d} fill={color} />
      </g>
    </svg>
  );
};

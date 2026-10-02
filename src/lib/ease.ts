import {Easing, interpolate} from 'remotion';

// A small, opinionated easing kit. Most motion here is "fast in, long settle".
export const E = {
  expoOut: Easing.bezier(0.16, 1, 0.3, 1),
  expoIn: Easing.bezier(0.7, 0, 0.84, 0),
  expoInOut: Easing.bezier(0.87, 0, 0.13, 1),
  quintOut: Easing.bezier(0.22, 1, 0.36, 1),
  quartInOut: Easing.bezier(0.76, 0, 0.24, 1),
  snap: Easing.bezier(0.9, 0, 0.1, 1),
  backOut: Easing.bezier(0.34, 1.56, 0.64, 1),
  anticipate: Easing.bezier(0.68, -0.6, 0.32, 1.6),
};

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Eased 0→1 progress over [start, start+dur]. */
export const prog = (frame: number, start: number, dur: number, ease = E.expoOut) =>
  interpolate(frame, [start, start + dur], [0, 1], {
    easing: ease,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

/**
 * Closed-form damped spring (0→1) so frame-accurate motion needs no state.
 * zeta < 1 overshoots. omega is angular frequency in rad/frame.
 */
export const springAt = (frame: number, start: number, omega = 0.42, zeta = 0.42) => {
  const t = frame - start;
  if (t <= 0) return 0;
  const wd = omega * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + ((zeta * omega) / wd) * Math.sin(wd * t));
};

/** Piecewise keyframes with per-segment easing. */
export const keys = (frame: number, input: number[], output: number[], ease = E.quartInOut) =>
  interpolate(frame, input, output, {
    easing: ease,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

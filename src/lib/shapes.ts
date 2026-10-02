// Shapes as fixed-length point rings so any two can be interpolated vertex-to-vertex.
export type Pt = [number, number];
export const RES = 180;

/** Resample a closed polygon to `n` points evenly spaced by arc length. */
export function resample(poly: Pt[], n = RES): Pt[] {
  const segs: number[] = [];
  let total = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segs.push(d);
    total += d;
  }
  const out: Pt[] = [];
  let seg = 0;
  let acc = 0;
  for (let k = 0; k < n; k++) {
    const target = (k / n) * total;
    while (acc + segs[seg] < target) {
      acc += segs[seg];
      seg++;
    }
    const a = poly[seg];
    const b = poly[(seg + 1) % poly.length];
    const t = (target - acc) / segs[seg];
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

/** Regular polygon starting at the top (angle -90°). */
export const ngon = (sides: number, r = 1, rot = 0): Pt[] =>
  Array.from({length: sides}, (_, i) => {
    const a = -Math.PI / 2 + rot + (i / sides) * Math.PI * 2;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });

export const star = (points: number, outer = 1, inner = 0.45): Pt[] =>
  Array.from({length: points * 2}, (_, i) => {
    const a = -Math.PI / 2 + (i / (points * 2)) * Math.PI * 2;
    const r = i % 2 ? inner : outer;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });

export const circle = (): Pt[] => ngon(RES, 1);

// The morph sequence. Radii are tuned so each shape has similar visual mass.
export const SHAPES: {name: string; pts: Pt[]}[] = [
  {name: 'CIRCLE', pts: resample(circle())},
  {name: 'TRIANGLE', pts: resample(ngon(3, 1.25))},
  {name: 'SQUARE', pts: resample(ngon(4, 1.12, Math.PI / 4))},
  {name: 'HEXAGON', pts: resample(ngon(6, 1.05))},
  {name: 'STAR', pts: resample(star(5, 1.25, 0.52))},
];

export const mix = (a: Pt[], b: Pt[], t: number): Pt[] =>
  a.map((p, i) => [p[0] + (b[i][0] - p[0]) * t, p[1] + (b[i][1] - p[1]) * t]);

export const toPath = (pts: Pt[], scale = 1, cx = 0, cy = 0) =>
  'M' + pts.map((p) => `${(cx + p[0] * scale).toFixed(2)},${(cy + p[1] * scale).toFixed(2)}`).join('L') + 'Z';

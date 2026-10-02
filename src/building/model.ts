import timeline from './timeline.json';

/**
 * Procedural model of the tower. Everything is a box (unit cube, scaled), so each
 * element type renders as one InstancedMesh and every instance carries its own
 * build cue and build motion.
 */
export const C = timeline.cues;

export const SPEC = {
  W: 24, // tower width (x)
  D: 16, // tower depth (z)
  floors: 12,
  floorH: 3.4,
  slabT: 0.36,
  plinthH: 0.8,
  podiumH: 6.0,
  inset: 0.75, // glass line set back from slab edge
  bay: 1.5,
};
export const FLOOR0 = SPEC.plinthH + SPEC.podiumH; // top of lobby slab
export const levelY = (i: number) => FLOOR0 + i * SPEC.floorH;
export const ROOF = levelY(SPEC.floors);

export type Motion = 'drop' | 'growY' | 'slideX' | 'slideZ' | 'riseIn' | 'pane';
export type Item = {
  p: [number, number, number]; // centre
  s: [number, number, number]; // size
  t: number; // build start (s)
  d: number; // build duration (s)
  m: Motion;
  k?: number; // motion amount (distance)
  tag?: number; // free per-instance value (floor index, light seed...)
};

let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

const {W, D, floors, floorH, slabT, plinthH, podiumH, inset, bay} = SPEC;
const floorT = (i: number) => C.floorStart + i * C.floorStep;

// ---------------------------------------------------------------- structure
export const plinth: Item[] = [
  {p: [0, plinthH / 2 - 0.4, 0], s: [W + 12, plinthH + 0.8, D + 12], t: C.plinth, d: 0.7, m: 'riseIn', k: plinthH + 0.8},
  {p: [0, plinthH + 0.05, D / 2 + 10], s: [W - 4, 0.1, 6], t: C.plinth + 0.25, d: 0.6, m: 'riseIn', k: 0.6}, // forecourt step
];

export const slabs: Item[] = [];
// lobby roof slab + 12 tower slabs + roof slab
for (let i = 0; i <= floors; i++) {
  const y = levelY(i) - slabT / 2;
  const t = i === 0 ? C.podium + 0.6 : floorT(i - 1) + 0.12;
  slabs.push({p: [0, y, 0], s: [W, slabT, D], t, d: 0.45, m: 'drop', k: 5, tag: i});
}

export const columns: Item[] = [];
const colXs = [-W / 2 + 1.1, -W / 6, W / 6, W / 2 - 1.1];
const colZs = [-D / 2 + 1.1, D / 2 - 1.1];
for (const x of colXs)
  for (const z of colZs) {
    columns.push({p: [x, plinthH + podiumH / 2, z], s: [0.55, podiumH, 0.55], t: C.podium + 0.05 * (columns.length % 4), d: 0.5, m: 'growY'});
    for (let i = 0; i < floors; i++) {
      const h = floorH - slabT;
      columns.push({p: [x, levelY(i) + h / 2, z], s: [0.45, h, 0.45], t: floorT(i), d: 0.35, m: 'growY', tag: i});
    }
  }

// concrete side wall (west facade), one board-formed panel per level, plus the
// spine that rises past the roof
export const walls: Item[] = [];
walls.push({p: [-W / 2 - 0.3, plinthH + podiumH / 2, 0], s: [0.6, podiumH, D], t: C.wallStart - 0.1, d: 0.45, m: 'slideX', k: -8});
for (let i = 0; i < floors; i++) {
  walls.push({p: [-W / 2 - 0.3, levelY(i) + floorH / 2 - slabT / 2, 0], s: [0.6, floorH, D], t: C.wallStart + i * 0.045, d: 0.45, m: 'slideX', k: -8, tag: i});
}
walls.push({p: [-W / 2 - 0.3, ROOF + 1.6, 0], s: [0.6, 3.2, D], t: C.wallStart + floors * 0.045, d: 0.45, m: 'slideX', k: -8});

// rooftop crown: pavilion + floating frame
export const crown: Item[] = [
  {p: [2, ROOF + 1.5, -1], s: [14, 3, 9], t: floorT(floors - 1) + 0.35, d: 0.5, m: 'growY'},
  {p: [0, ROOF + 3.6, 0], s: [W + 0.6, 0.45, D + 0.6], t: floorT(floors - 1) + 0.55, d: 0.5, m: 'drop', k: 6},
];

// ---------------------------------------------------------------- envelope
// faces that receive glazing: south (front, +z), north (back, -z), east (+x)
type Face = {axis: 'x' | 'z'; sign: 1 | -1; len: number};
const FACES: Face[] = [
  {axis: 'z', sign: 1, len: W - 2 * inset},
  {axis: 'z', sign: -1, len: W - 2 * inset},
  {axis: 'x', sign: 1, len: D - 2 * inset},
];

export const panes: Item[] = [];
export const mullions: Item[] = [];
export const rooms: Item[] = [];
const paneH = floorH - slabT;
for (let i = -1; i < floors; i++) {
  // i = -1 is the double-height lobby
  const y0 = i < 0 ? plinthH : levelY(i);
  const h = i < 0 ? podiumH - slabT : paneH;
  const ins = i < 0 ? inset + 1.2 : inset; // lobby glass sits further back
  const tFloor = i < 0 ? C.podium + 0.35 : C.glassStart + i * C.glassFloorStep;
  for (const f of FACES) {
    const half = (f.axis === 'z' ? W : D) / 2 - ins;
    const n = Math.round((2 * half) / bay);
    const bw = (2 * half) / n;
    const plane = (f.axis === 'z' ? D : W) / 2 - ins;
    for (let b = 0; b < n; b++) {
      const u = -half + bw * (b + 0.5);
      const fromCentre = Math.abs(u) / half;
      const t = tFloor + fromCentre * 0.18;
      const at = (along: number, depth: number): [number, number, number] =>
        f.axis === 'z' ? [along, y0 + h / 2, f.sign * depth] : [f.sign * depth, y0 + h / 2, along];
      const size = (a: number, thick: number, hh: number): [number, number, number] => (f.axis === 'z' ? [a, hh, thick] : [thick, hh, a]);
      panes.push({p: at(u, plane), s: size(bw - 0.05, 0.04, h - 0.02), t, d: 0.4, m: 'pane', tag: i});
      if (i >= 0) {
        rooms.push({p: at(u, plane - 0.9), s: size(bw, 0.02, h - 0.25), t: C.lightsStart + i * C.lightsFloorStep + rnd() * 0.35, d: 0.25, m: 'pane', tag: rnd()});
      }
      mullions.push({p: at(-half + bw * b, plane + 0.03), s: size(0.07, 0.12, h), t: t - 0.05, d: 0.35, m: 'growY'});
    }
    mullions.push({p: f.axis === 'z' ? [half, y0 + h / 2, f.sign * (plane + 0.03)] : [f.sign * (plane + 0.03), y0 + h / 2, half], s: f.axis === 'z' ? [0.07, h, 0.12] : [0.12, h, 0.07], t: tFloor, d: 0.35, m: 'growY'});
  }
}

// ---------------------------------------------------------------- balconies (south face, staggered)
export const balconies: Item[] = [];
export const rails: Item[] = [];
export const leds: Item[] = [];
const BD = 2.4; // balcony depth
for (let i = 0; i < floors; i++) {
  const xs = i % 2 ? [-3.8, 7.6] : [-7.4, 4.2];
  const t0 = C.balconyStart + i * C.balconyFloorStep;
  const y = levelY(i) - slabT / 2;
  xs.forEach((x, j) => {
    const w = j ? 6.2 : 7.0;
    const t = t0 + j * 0.05;
    balconies.push({p: [x, y, D / 2 + BD / 2], s: [w, 0.3, BD], t, d: 0.5, m: 'slideZ', k: -BD - 0.5, tag: i});
    const ry = y + 0.15 + 0.55;
    rails.push({p: [x, ry, D / 2 + BD - 0.03], s: [w - 0.1, 1.1, 0.04], t: t + 0.18, d: 0.35, m: 'growY'});
    rails.push({p: [x - w / 2 + 0.03, ry, D / 2 + BD / 2], s: [0.04, 1.1, BD - 0.06], t: t + 0.2, d: 0.35, m: 'growY'});
    rails.push({p: [x + w / 2 - 0.03, ry, D / 2 + BD / 2], s: [0.04, 1.1, BD - 0.06], t: t + 0.2, d: 0.35, m: 'growY'});
    // warm LED line along the soffit edge
    leds.push({p: [x, y - 0.17, D / 2 + BD - 0.12], s: [w - 0.4, 0.04, 0.06], t: C.ledStart + i * 0.04, d: 0.3, m: 'pane'});
  });
}
// slab-edge LED reveal on the podium canopy
leds.push({p: [0, FLOOR0 - slabT - 0.04, D / 2 + 0.02], s: [W - 0.6, 0.05, 0.05], t: C.ledStart - 0.2, d: 0.4, m: 'pane'});

// ---------------------------------------------------------------- site
export const planters: Item[] = [];
for (let k = 0; k < 6; k++) {
  const x = -15 + k * 6;
  planters.push({p: [x, plinthH + 0.3, D / 2 + 14.5], s: [3.2, 0.6, 1.4], t: C.podium + 0.1 + k * 0.05, d: 0.4, m: 'growY'});
}
export const bollards: Item[] = [];
for (let k = 0; k < 10; k++) {
  bollards.push({p: [-18 + k * 4, plinthH + 0.45, D / 2 + 17.5], s: [0.18, 0.9, 0.18], t: C.ledStart + 0.1 + k * 0.03, d: 0.2, m: 'pane'});
}

import timeline from './timeline.json';

/**
 * Procedural model of a 5-level mixed-use building. Every element is a box
 * (unit cube, scaled), so each component type renders as one InstancedMesh and
 * every instance carries its own build cue and build motion.
 *
 * Axes: +x east, +z south (the main facade), y up. Units are metres.
 */
export const C = timeline.cues;

export const W = 32; // footprint x
export const D = 18; // footprint z
export const HW = W / 2;
export const HD = D / 2;
export const BASE = 0.6; // top of the foundation
export const H = [5.2, 3.8, 3.8, 3.8, 4.2]; // storey heights, L01 (lobby) .. L05 (penthouse)
export const SLAB = 0.4;
export const LEVELS = H.length;
export const levelY = (i: number) => BASE + H.slice(0, i).reduce((a, b) => a + b, 0);
export const ROOF = levelY(LEVELS); // 21.4
export const PH_X1 = 7; // penthouse east edge (terrace beyond)
export const CORE = {x: 0, z: -7.6, w: 6, d: 3.6};
export const COL_X = [-14.8, -7.4, 0, 7.4, 14.8];
export const COL_Z = [-7.8, 7.8];

export type Motion = 'drop' | 'growY' | 'slideX' | 'slideZ' | 'riseIn' | 'pane' | 'none';
export type Item = {
  p: [number, number, number]; // centre
  s: [number, number, number]; // size
  t: number; // build start (s)
  d: number; // build duration (s)
  m: Motion;
  k?: number; // motion amount
  tag?: number; // free per-instance value (level, light seed...)
};

let seed = 1234;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

/** x-extent of level i (the penthouse is set back to make a terrace). */
const levelX1 = (i: number) => (i === LEVELS - 1 ? PH_X1 : HW);

// ---------------------------------------------------------------- foundation
export const foundation: Item[] = [
  {p: [0, 0, 0.5], s: [W + 6, BASE * 2, D + 7], t: C.foundation, d: 0.6, m: 'riseIn', k: 1.6},
  {p: [0, BASE - 0.2, HD + 4.3], s: [W - 6, 0.4, 1.0], t: C.foundation + 0.18, d: 0.5, m: 'riseIn', k: 0.8},
  {p: [0, BASE - 0.4, HD + 5.1], s: [W - 6, 0.4, 0.8], t: C.foundation + 0.24, d: 0.5, m: 'riseIn', k: 0.8},
];

// ---------------------------------------------------------------- slabs + columns
export const slabs: Item[] = [];
export const columns: Item[] = [];
for (let i = 0; i < LEVELS; i++) {
  const t0 = C.levels[i];
  const x1 = levelX1(i);
  for (const x of COL_X) {
    if (x > x1 - 0.5) continue;
    for (const z of COL_Z) {
      const h = H[i] - SLAB;
      columns.push({p: [x, levelY(i) + h / 2, z], s: [0.5, h, 0.5], t: t0 + rnd() * 0.08, d: 0.35, m: 'growY', tag: i});
    }
  }
  if (i < LEVELS - 1) {
    // floor slab of the next level, full footprint, crisp white edge
    slabs.push({p: [0, levelY(i + 1) - SLAB / 2, 0], s: [W, SLAB, D], t: t0 + 0.18, d: 0.4, m: 'drop', k: 4, tag: i + 1});
  }
}
// penthouse roof with a deep overhang, plus metal fascia
export const roof: Item[] = [
  {p: [(-HW + PH_X1) / 2, ROOF + 0.22, 0], s: [PH_X1 + HW + 2.4, 0.45, D + 2.4], t: C.roof, d: 0.45, m: 'drop', k: 5, tag: 5},
];

// ---------------------------------------------------------------- structural walls + core
export const walls: Item[] = [];
for (let i = 0; i < LEVELS - 1; i++) {
  walls.push({p: [HW + 0.3, levelY(i) + H[i] / 2, 0], s: [0.6, H[i], D], t: C.walls + i * 0.06, d: 0.4, m: 'growY', tag: i});
}
// parapet on the terrace edge of the east wall
walls.push({p: [HW + 0.3, levelY(LEVELS - 1) + 0.55, 0], s: [0.6, 1.1, D], t: C.walls + 0.3, d: 0.4, m: 'growY'});
// north service core, rising above the roof
walls.push({p: [CORE.x, (BASE + ROOF + 1.8) / 2, CORE.z], s: [CORE.w, ROOF + 1.8 - BASE, CORE.d], t: C.walls - 0.05, d: 0.6, m: 'growY'});

// ---------------------------------------------------------------- envelope
type Face = {axis: 'x' | 'z'; sign: 1 | -1; a0: number; a1: number; plane: number};
function faces(i: number): Face[] {
  const ins = i === 0 ? 1.6 : 0.6;
  const x1 = levelX1(i);
  const f: Face[] = [
    {axis: 'z', sign: 1, a0: -HW + ins, a1: x1 - (i === LEVELS - 1 ? ins : 0.02), plane: HD - ins},
    {axis: 'z', sign: -1, a0: -HW + ins, a1: x1 - (i === LEVELS - 1 ? ins : 0.02), plane: HD - ins},
    {axis: 'x', sign: -1, a0: -HD + ins, a1: HD - ins, plane: HW - ins},
  ];
  if (i === LEVELS - 1) f.push({axis: 'x', sign: 1, a0: -HD + ins, a1: HD - ins, plane: PH_X1 - ins});
  return f;
}

export const panes: Item[] = [];
export const mullions: Item[] = [];
export const rooms: Item[] = [];
for (let i = 0; i < LEVELS; i++) {
  const h = H[i] - SLAB;
  const y = levelY(i) + h / 2;
  const tL = C.windows + i * C.windowLevelStep;
  for (const f of faces(i)) {
    const n = Math.max(1, Math.round((f.a1 - f.a0) / 2.0));
    const bw = (f.a1 - f.a0) / n;
    const at = (along: number, depth: number): [number, number, number] => (f.axis === 'z' ? [along, y, f.sign * depth] : [f.sign * depth, y, along]);
    const size = (a: number, thick: number, hh: number): [number, number, number] => (f.axis === 'z' ? [a, hh, thick] : [thick, hh, a]);
    for (let b = 0; b < n; b++) {
      const u = f.a0 + bw * (b + 0.5);
      // the north core interrupts the glazing
      if (f.axis === 'z' && f.sign === -1 && Math.abs(u - CORE.x) < CORE.w / 2 + 0.2) continue;
      const t = tL + ((u - f.a0) / (f.a1 - f.a0)) * 0.22;
      panes.push({p: at(u, f.plane), s: size(bw - 0.06, 0.05, h - 0.02), t, d: 0.35, m: 'pane', tag: i});
      mullions.push({p: at(f.a0 + bw * b, f.plane + 0.04), s: size(0.08, 0.14, h), t: t - 0.04, d: 0.3, m: 'growY'});
      // lit interior surface behind the glass
      const lit = i === 0 ? 0.95 : rnd();
      rooms.push({p: at(u, f.plane - (i === 0 ? 2.2 : 1.4)), s: size(bw, 0.02, h - 0.5), t, d: 0.35, m: 'pane', tag: lit});
    }
    mullions.push({p: at(f.a1, f.plane + 0.04), s: size(0.08, 0.14, h), t: tL, d: 0.3, m: 'growY'});
  }
}

// ---------------------------------------------------------------- balconies (south + wrapping the south-west corner)
export const balconies: Item[] = [];
export const rails: Item[] = []; // glass balustrades
export const railMetal: Item[] = []; // top rails + slab fascias
export const leds: Item[] = []; // warm soffit strips
const BD = 2.4;
const SPANS: Record<number, [number, number][]> = {
  1: [[-HW - BD, -6], [2, 12]],
  2: [[-HW - BD, -9], [-3, 7]],
  3: [[-HW - BD, -6], [2, 12]],
};
const WEST: Record<number, number> = {1: -3, 2: 1, 3: -3}; // west balcony start (z)
for (let i = 1; i <= 3; i++) {
  const y = levelY(i) - 0.15;
  const t0 = C.balconies + (i - 1) * C.balconyLevelStep;
  const ry = levelY(i) + 0.55;
  SPANS[i].forEach(([x0, x1], j) => {
    const w = x1 - x0;
    const cx = (x0 + x1) / 2;
    const t = t0 + j * 0.06;
    balconies.push({p: [cx, y, HD + BD / 2], s: [w, 0.3, BD], t, d: 0.45, m: 'slideZ', k: -BD - 0.4, tag: i});
    rails.push({p: [cx, ry, HD + BD - 0.05], s: [w - 0.1, 1.05, 0.03], t: t + 0.15, d: 0.3, m: 'growY'});
    railMetal.push({p: [cx, ry + 0.55, HD + BD - 0.05], s: [w - 0.06, 0.06, 0.07], t: t + 0.2, d: 0.3, m: 'slideZ', k: -1});
    railMetal.push({p: [cx, y, HD + BD + 0.02], s: [w + 0.04, 0.34, 0.06], t: t + 0.05, d: 0.45, m: 'slideZ', k: -BD - 0.4});
    leds.push({p: [cx, y - 0.17, HD + BD - 0.15], s: [w - 0.4, 0.03, 0.06], t: t + 0.1, d: 0.4, m: 'slideZ', k: -BD});
    if (j > 0 || x0 > -HW - 1) rails.push({p: [x0 + 0.05, ry, HD + BD / 2], s: [0.03, 1.05, BD - 0.1], t: t + 0.18, d: 0.3, m: 'growY'});
    rails.push({p: [x1 - 0.05, ry, HD + BD / 2], s: [0.03, 1.05, BD - 0.1], t: t + 0.18, d: 0.3, m: 'growY'});
  });
  // west wing of the corner balcony
  const z0 = WEST[i];
  const wl = HD - z0;
  const t = t0 + 0.1;
  balconies.push({p: [-HW - BD / 2, y, z0 + wl / 2], s: [BD, 0.3, wl], t, d: 0.45, m: 'slideX', k: BD + 0.4, tag: i});
  rails.push({p: [-HW - BD + 0.05, ry, z0 + (wl + BD) / 2], s: [0.03, 1.05, wl + BD - 0.1], t: t + 0.15, d: 0.3, m: 'growY'});
  rails.push({p: [-HW - BD / 2, ry, z0 + 0.05], s: [BD - 0.1, 1.05, 0.03], t: t + 0.18, d: 0.3, m: 'growY'});
  railMetal.push({p: [-HW - BD + 0.05, ry + 0.55, z0 + (wl + BD) / 2], s: [0.07, 0.06, wl + BD - 0.06], t: t + 0.2, d: 0.3, m: 'slideX', k: 1});
  railMetal.push({p: [-HW - BD - 0.02, y, z0 + (wl + BD) / 2], s: [0.06, 0.34, wl + BD + 0.04], t: t + 0.05, d: 0.45, m: 'slideX', k: BD + 0.4});
  leds.push({p: [-HW - BD + 0.15, y - 0.17, z0 + wl / 2], s: [0.06, 0.03, wl - 0.4], t: t + 0.1, d: 0.4, m: 'slideX', k: BD});
}
// penthouse terrace balustrade
{
  const y = levelY(LEVELS - 1) + 0.55;
  const t = C.balconies + 0.42;
  const tw = HW - PH_X1;
  rails.push({p: [(PH_X1 + HW) / 2, y, HD - 0.1], s: [tw, 1.05, 0.03], t, d: 0.3, m: 'growY'});
  rails.push({p: [(PH_X1 + HW) / 2, y, -HD + 0.1], s: [tw, 1.05, 0.03], t, d: 0.3, m: 'growY'});
  railMetal.push({p: [(PH_X1 + HW) / 2, y + 0.55, HD - 0.1], s: [tw, 0.06, 0.07], t: t + 0.05, d: 0.3, m: 'growY'});
}
// roof fascia + lobby canopy
railMetal.push({p: [(-HW + PH_X1) / 2, ROOF + 0.22, HD + 1.22], s: [PH_X1 + HW + 2.5, 0.5, 0.06], t: C.roof + 0.1, d: 0.4, m: 'drop', k: 5});
railMetal.push({p: [-HW - 1.22, ROOF + 0.22, 0], s: [0.06, 0.5, D + 2.5], t: C.roof + 0.1, d: 0.4, m: 'drop', k: 5});
railMetal.push({p: [0, levelY(1) - 1.0, HD + 2.2], s: [9, 0.25, 4.4], t: C.balconies + 0.3, d: 0.45, m: 'slideZ', k: -4});
leds.push({p: [0, levelY(1) - 1.14, HD + 2.2], s: [8, 0.02, 3.6], t: C.balconies + 0.35, d: 0.45, m: 'slideZ', k: -4});

// ---------------------------------------------------------------- site + context
export const planters: Item[] = [];
for (let k = 0; k < 6; k++) {
  const x = -20 + k * 8;
  if (Math.abs(x) < 5) continue;
  planters.push({p: [x, 0.35, HD + 9], s: [4.2, 0.7, 1.6], t: C.contextStart + 0.2 + k * 0.05, d: 0.45, m: 'growY'});
}
export const trees: {p: [number, number, number]; s: number; t: number}[] = [];
for (const x of [-30, -22, 22, 30]) trees.push({p: [x, 0, HD + 11 + rnd() * 2], s: 0.75 + rnd() * 0.3, t: C.contextStart + 0.3 + rnd() * 0.5});
for (const z of [-12, -4, 4]) trees.push({p: [-HW - 10 - rnd() * 2, 0, z], s: 0.75 + rnd() * 0.3, t: C.contextStart + 0.3 + rnd() * 0.5});
for (const z of [-8, 2]) trees.push({p: [HW + 9 + rnd() * 2, 0, z], s: 0.75 + rnd() * 0.3, t: C.contextStart + 0.3 + rnd() * 0.5});

export const lamps: Item[] = [];
for (let k = 0; k < 9; k++) lamps.push({p: [-32 + k * 8, 2.2, HD + 18], s: [0.12, 4.4, 0.12], t: C.contextStart + 0.5 + k * 0.03, d: 0.3, m: 'growY'});

export const context: Item[] = [];
{
  let n = 0;
  while (context.length < 90 && n++ < 4000) {
    const a = rnd() * Math.PI * 2;
    const r = 165 + rnd() * 190;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (z > 40 && Math.abs(x) < 90) continue; // keep the front view open
    const w = 14 + rnd() * 24;
    const d = 14 + rnd() * 24;
    const h = 8 + rnd() ** 2 * 34;
    context.push({p: [x, h / 2, z], s: [w, h, d], t: C.contextStart + ((r - 165) / 190) * 0.9 + rnd() * 0.3, d: 0.9, m: 'growY'});
  }
}

// ---------------------------------------------------------------- annotation anchors
/** Mid-height of level i. */
export const levelMid = (i: number) => levelY(i) + (H[i] - SLAB) / 2;
export const PROGRAM = ['LOBBY + RECEPTION', 'PRIVATE OFFICES', 'EXECUTIVE SUITES', 'RESIDENTIAL', 'PENTHOUSE'];

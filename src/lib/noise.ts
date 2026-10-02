// Compact 3D simplex noise (Stefan Gustavson's reference), seeded.
const grad3 = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];

const perm = new Uint8Array(512);
{
  const p = Array.from({length: 256}, (_, i) => i);
  let s = 42;
  for (let i = 255; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
}

const F3 = 1 / 3;
const G3 = 1 / 6;

export function noise3(x: number, y: number, z: number): number {
  const s = (x + y + z) * F3;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  const k = Math.floor(z + s);
  const t = (i + j + k) * G3;
  const x0 = x - (i - t);
  const y0 = y - (j - t);
  const z0 = z - (k - t);
  let i1, j1, k1, i2, j2, k2;
  if (x0 >= y0) {
    if (y0 >= z0) [i1, j1, k1, i2, j2, k2] = [1, 0, 0, 1, 1, 0];
    else if (x0 >= z0) [i1, j1, k1, i2, j2, k2] = [1, 0, 0, 1, 0, 1];
    else [i1, j1, k1, i2, j2, k2] = [0, 0, 1, 1, 0, 1];
  } else if (y0 < z0) [i1, j1, k1, i2, j2, k2] = [0, 0, 1, 0, 1, 1];
  else if (x0 < z0) [i1, j1, k1, i2, j2, k2] = [0, 1, 0, 0, 1, 1];
  else [i1, j1, k1, i2, j2, k2] = [0, 1, 0, 1, 1, 0];

  const offs = [
    [x0, y0, z0, 0, 0, 0],
    [x0 - i1 + G3, y0 - j1 + G3, z0 - k1 + G3, i1, j1, k1],
    [x0 - i2 + 2 * G3, y0 - j2 + 2 * G3, z0 - k2 + 2 * G3, i2, j2, k2],
    [x0 - 1 + 3 * G3, y0 - 1 + 3 * G3, z0 - 1 + 3 * G3, 1, 1, 1],
  ];
  const ii = i & 255;
  const jj = j & 255;
  const kk = k & 255;
  let n = 0;
  for (const [dx, dy, dz, a, b, c] of offs) {
    let tt = 0.6 - dx * dx - dy * dy - dz * dz;
    if (tt > 0) {
      const g = grad3[perm[ii + a + perm[jj + b + perm[kk + c]]] % 12];
      tt *= tt;
      n += tt * tt * (g[0] * dx + g[1] * dy + g[2] * dz);
    }
  }
  return 32 * n;
}

/** Divergence-free 2D curl of a noise potential: smooth, swirling flow. */
export function curl(x: number, y: number, z: number): [number, number] {
  const e = 0.01;
  const dndy = (noise3(x, y + e, z) - noise3(x, y - e, z)) / (2 * e);
  const dndx = (noise3(x + e, y, z) - noise3(x - e, y, z)) / (2 * e);
  return [dndy, -dndx];
}

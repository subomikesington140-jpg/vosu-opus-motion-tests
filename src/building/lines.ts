import * as THREE from 'three';
import {REVEAL} from './materials';
import {Item} from './model';

/**
 * Line segments that draw themselves: each segment grows from its first vertex
 * to its second, starting at its own delay (seconds). Built from plain arrays
 * of [a, b, delay] so the same shader serves the building wireframe, the ground
 * grid, structural axes and dimension lines.
 */
export type Seg = [number[], number[], number];

export function segGeometry(segs: Seg[]) {
  const pos = new Float32Array(segs.length * 6);
  const start = new Float32Array(segs.length * 6);
  const delay = new Float32Array(segs.length * 2);
  segs.forEach(([a, b, d], i) => {
    pos.set(a, i * 6);
    pos.set(b, i * 6 + 3);
    start.set(a, i * 6);
    start.set(a, i * 6 + 3);
    delay[i * 2] = delay[i * 2 + 1] = d;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aStart', new THREE.BufferAttribute(start, 3));
  g.setAttribute('aDelay', new THREE.BufferAttribute(delay, 1));
  return g;
}

export function lineMaterial(color: string, o: {grow?: number; fadeR?: number; useReveal?: boolean} = {}) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: {value: 0},
      uOpacity: {value: 1},
      uColor: {value: new THREE.Color(color)},
      uGrow: {value: o.grow ?? 0.35},
      uFadeR: {value: o.fadeR ?? 0},
      uUseReveal: {value: o.useReveal ? 1 : 0},
      uReveal: REVEAL.uReveal,
    },
    vertexShader: /* glsl */ `
      attribute vec3 aStart; attribute float aDelay;
      uniform float uTime; uniform float uGrow;
      varying float vOn; varying vec3 vW;
      void main() {
        float g = clamp((uTime - aDelay) / uGrow, 0.0, 1.0);
        g = 1.0 - pow(1.0 - g, 3.0);
        vec3 p = mix(aStart, position, g);
        vOn = step(0.0, uTime - aDelay);
        vec4 w = modelMatrix * vec4(p, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity; uniform float uFadeR; uniform float uUseReveal; uniform float uReveal;
      varying float vOn; varying vec3 vW;
      void main() {
        float a = uOpacity * vOn;
        if (uFadeR > 0.0) a *= smoothstep(uFadeR, uFadeR * 0.25, length(vW.xz));
        if (uUseReveal > 0.5) a *= 1.0 - smoothstep(uReveal + 0.9, uReveal - 0.9, vW.y);
        if (a < 0.003) discard;
        gl_FragColor = vec4(uColor, a);
      }`,
  });
}

/** The 12 edges of each item's box, each drawn from a delay picked by `delayOf`. */
export function boxSegs(items: Item[], delayOf: (it: Item, edge: number) => number): Seg[] {
  const out: Seg[] = [];
  for (const it of items) {
    const [x, y, z] = it.p;
    const [hx, hy, hz] = it.s.map((v) => v / 2);
    const c = (sx: number, sy: number, sz: number) => [x + sx * hx, y + sy * hy, z + sz * hz];
    const E: [number[], number[]][] = [];
    // verticals grow upward; horizontals trace around
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) E.push([c(sx, -1, sz), c(sx, 1, sz)]);
    for (const sy of [-1, 1]) {
      E.push([c(-1, sy, -1), c(1, sy, -1)]);
      E.push([c(1, sy, -1), c(1, sy, 1)]);
      E.push([c(1, sy, 1), c(-1, sy, 1)]);
      E.push([c(-1, sy, 1), c(-1, sy, -1)]);
    }
    E.forEach(([a, b], k) => out.push([a, b, delayOf(it, k)]));
  }
  return out;
}

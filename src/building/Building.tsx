import React, {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {E, clamp01, lerp, prog} from '../lib/ease';
import {applyCam} from './camera';
import {Seg, boxSegs, lineMaterial, segGeometry} from './lines';
import {Materials, REVEAL, createMaterials} from './materials';
import {
  BASE,
  C,
  COL_X,
  CORE,
  D,
  H,
  HD,
  HW,
  Item,
  LEVELS,
  PH_X1,
  ROOF,
  SLAB,
  balconies,
  columns,
  context,
  foundation,
  lamps,
  leds,
  levelY,
  mullions,
  panes,
  planters,
  railMetal,
  rails,
  roof,
  rooms,
  slabs,
  trees,
  walls,
} from './model';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const vP = new THREE.Vector3();
const vS = new THREE.Vector3();
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

/** Instance transform for an item at time t (s), applying its build motion. */
function compose(it: Item, t: number) {
  let [x, y, z] = it.p;
  let [sx, sy, sz] = it.s;
  if (it.m !== 'none') {
    const raw = clamp01((t - it.t) / it.d);
    if (raw <= 0) return null;
    switch (it.m) {
      case 'drop': {
        const e = E.expoOut(raw);
        y += (1 - e) * (it.k ?? 4);
        sx *= lerp(0.94, 1, e);
        sz *= lerp(0.94, 1, e);
        break;
      }
      case 'growY':
      case 'pane': {
        const e = (it.m === 'pane' ? E.quintOut : E.expoOut)(raw);
        y -= (sy * (1 - e)) / 2;
        sy *= Math.max(0.001, e);
        break;
      }
      case 'riseIn':
        y -= (1 - E.quintOut(raw)) * (it.k ?? 1);
        break;
      case 'slideX':
        x += (1 - E.expoOut(raw)) * (it.k ?? 4);
        break;
      case 'slideZ': {
        const e = E.expoOut(raw);
        z += (1 - e) * (it.k ?? 2);
        sx *= lerp(0.97, 1, e);
        break;
      }
    }
  }
  vP.set(x, y, z);
  vS.set(sx, sy, sz);
  return m4.compose(vP, q, vS);
}

const Instanced: React.FC<{
  items: Item[];
  t: number;
  material: THREE.Material;
  shadows?: boolean;
  receive?: boolean;
  colorFn?: (it: Item, t: number, c: THREE.Color) => void;
  order?: number;
}> = ({items, t, material, shadows = true, receive = true, colorFn, order}) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const col = useMemo(() => new THREE.Color(), []);
  useLayoutEffect(() => {
    const mesh = ref.current!;
    items.forEach((it, i) => {
      mesh.setMatrixAt(i, compose(it, t) ?? HIDDEN);
      if (colorFn) {
        colorFn(it, t, col);
        mesh.setColorAt(i, col);
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[BOX, material, items.length]} castShadow={shadows} receiveShadow={receive} frustumCulled={false} renderOrder={order} />;
};

// ---------------------------------------------------------------- timing helpers
/** Height of the material reveal sweep at time t. */
export const revealY = (t: number) => lerp(-1.5, ROOF + 4, prog(t, C.revealStart, C.revealEnd - C.revealStart, E.quartInOut));
/** 0 = dark technical stage, 1 = blue-hour visualisation. */
export const skyMix = (t: number) => prog(t, C.skyStart, C.skyEnd - C.skyStart, E.quartInOut);
/** Program-stage highlight envelope for level i. */
export function highlight(t: number, i: number) {
  const on = prog(t, C.program[i], 0.3, E.expoOut);
  const next = i < LEVELS - 1 ? prog(t, C.program[i + 1], 0.35, E.quartInOut) : 0;
  const out = 1 - prog(t, C.programOut, 0.45, E.quartInOut);
  return on * lerp(1, 0.32, next) * out;
}

// ---------------------------------------------------------------- sky
const skyMat = () =>
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {uMix: {value: 0}, uSun: {value: new THREE.Vector3(-0.85, 0.08, 0.5).normalize()}},
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
    fragmentShader: /* glsl */ `
      uniform float uMix; uniform vec3 uSun; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir); float h = d.y;
        vec3 dark = mix(vec3(0.016,0.024,0.04), vec3(0.003,0.005,0.01), smoothstep(-0.05, 0.6, h));
        vec3 zen = vec3(0.012,0.035,0.11), mid = vec3(0.07,0.13,0.30), hor = vec3(0.95,0.46,0.22), low = vec3(0.03,0.035,0.05);
        vec3 c = mix(hor, mid, smoothstep(0.0, 0.16, h));
        c = mix(c, zen, smoothstep(0.16, 0.75, h));
        c = mix(c, mix(hor * 0.35, low, smoothstep(0.0, -0.08, h)), step(h, 0.0));
        float s = max(dot(d, uSun), 0.0);
        c += vec3(1.0,0.5,0.22) * (pow(s, 6.0) * 0.55 + pow(s, 60.0) * 1.5) * smoothstep(-0.1, 0.05, h);
        gl_FragColor = vec4(mix(dark, c, uMix), 1.0);
      }`,
  });

/** Blue-hour sky as the image-based light for reflections (built once). */
const EnvFromSky: React.FC = () => {
  const {gl, scene} = useThree();
  useMemo(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const s = new THREE.Scene();
    const m = skyMat();
    m.uniforms.uMix.value = 1;
    s.add(new THREE.Mesh(new THREE.SphereGeometry(100, 48, 24), m));
    // a few warm "city" glows on the horizon so glass picks up highlights
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      const b = new THREE.Mesh(new THREE.PlaneGeometry(6 + (k % 3) * 4, 1.6), new THREE.MeshBasicMaterial({color: new THREE.Color(1.6, 0.9, 0.45), side: THREE.DoubleSide}));
      b.position.set(Math.cos(a) * 80, 1 + (k % 4) * 0.8, Math.sin(a) * 80);
      b.lookAt(0, 1, 0);
      s.add(b);
    }
    scene.environment = pm.fromScene(s, 0.02).texture;
    pm.dispose();
  }, [gl, scene]);
  return null;
};

// ---------------------------------------------------------------- linework
function hash(n: number) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}
function useLinework() {
  return useMemo(() => {
    // building wireframe: bottom-up with jitter
    const wd = (it: Item, e: number) => C.wireStart + (Math.max(0, it.p[1] - it.s[1] / 2) / ROOF) * 1.15 + hash(it.p[0] * 3.1 + it.p[2] * 7.7 + e) * 0.22 + (e < 4 ? 0 : 0.08);
    const major = segGeometry(boxSegs([...foundation.slice(0, 1), ...slabs, ...columns, ...walls, ...roof, ...balconies], wd));
    const minor = segGeometry(boxSegs(panes, wd));

    const segs: Seg[] = [];
    // ground grid from the centre outward (4 m)
    for (let v = -96; v <= 96; v += 4) {
      const d0 = C.gridStart + (Math.abs(v) / 96) * 0.5;
      segs.push([[0, 0.02, v], [-110, 0.02, v], d0], [[0, 0.02, v], [110, 0.02, v], d0]);
      segs.push([[v, 0.02, 0], [v, 0.02, -110], d0], [[v, 0.02, 0], [v, 0.02, 110], d0]);
    }
    const grid = segGeometry(segs);

    // structural axes 1-5 and A-B with bubbles, plus dimension strings
    const ax: Seg[] = [];
    const y = BASE + 0.03;
    COL_X.forEach((x, i) => {
      const d0 = C.wireStart + 0.05 * i;
      ax.push([[x, y, -HD - 4], [x, y, HD + 13], d0]);
      ring(ax, x, y, HD + 14.2, 1.2, d0 + 0.3);
    });
    [-7.8, 7.8].forEach((z, i) => {
      const d0 = C.wireStart + 0.1 + 0.05 * i;
      ax.push([[HW + 4, y, z], [-HW - 13, y, z], d0]);
      ring(ax, -HW - 14.2, y, z, 1.2, d0 + 0.3);
    });
    const dims: Seg[] = [];
    const t0 = C.dimStart;
    // south: overall width
    const zs = HD + 9.5;
    dims.push([[-HW, y, HD + 1], [-HW, y, zs + 0.8], t0], [[HW, y, HD + 1], [HW, y, zs + 0.8], t0]);
    dims.push([[-HW, y, zs], [HW, y, zs], t0 + 0.1]);
    tick(dims, -HW, y, zs, 'x', t0 + 0.3);
    tick(dims, HW, y, zs, 'x', t0 + 0.3);
    // west: overall depth
    const xw = -HW - 9.5;
    dims.push([[-HW - 3, y, -HD], [xw - 0.8, y, -HD], t0 + 0.1], [[-HW - 3, y, HD], [xw - 0.8, y, HD], t0 + 0.1]);
    dims.push([[xw, y, -HD], [xw, y, HD], t0 + 0.2]);
    tick(dims, xw, y, -HD, 'z', t0 + 0.4);
    tick(dims, xw, y, HD, 'z', t0 + 0.4);
    // east: storey heights
    const xe = HW + 6;
    dims.push([[xe, BASE, HD], [xe, ROOF, HD], t0 + 0.2]);
    for (let i = 0; i <= LEVELS; i++) {
      const ly = levelY(i);
      dims.push([[xe - 1.2, ly, HD], [xe + 1.2, ly, HD], t0 + 0.3 + i * 0.06]);
      dims.push([[xe - 0.5, ly - 0.5, HD], [xe + 0.5, ly + 0.5, HD], t0 + 0.35 + i * 0.06]);
    }
    return {major, minor, grid, axes: segGeometry(ax), dims: segGeometry(dims)};
  }, []);
}
function ring(out: Seg[], x: number, y: number, z: number, r: number, d0: number) {
  const n = 28;
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI * 2;
    const a1 = ((k + 1) / n) * Math.PI * 2;
    out.push([[x + Math.cos(a0) * r, y, z + Math.sin(a0) * r], [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r], d0 + (k / n) * 0.3]);
  }
}
function tick(out: Seg[], x: number, y: number, z: number, along: 'x' | 'z', d0: number) {
  // architectural 45 degree tick
  out.push([[x - 0.6, y, z + (along === 'x' ? 0.6 : -0.6)], [x + 0.6, y, z + (along === 'x' ? -0.6 : 0.6)], d0]);
}

// ---------------------------------------------------------------- the scene
const ROOM_OFF_CLAY = new THREE.Color('#c9ced2');
const ROOM_DARK = new THREE.Color('#0a0c10');
const ROOM_WARM = new THREE.Color('#ffc890');
const ROOM_CREAM = new THREE.Color('#fff0dc');
const BRASS = new THREE.Color('#e0b874');
const tmpC = new THREE.Color();

export const ArchScene: React.FC<{t: number}> = ({t}) => {
  const M: Materials = useMemo(() => createMaterials(), []);
  const L = useLinework();
  const lm = useMemo(
    () => ({
      major: lineMaterial('#8fdcff', {useReveal: true}),
      minor: lineMaterial('#8fdcff', {useReveal: true}),
      grid: lineMaterial('#2f6d93', {grow: 0.6, fadeR: 95}),
      axes: lineMaterial('#5fb6e6', {grow: 0.5}),
      dims: lineMaterial('#9fe3ff', {grow: 0.4}),
      hl: Array.from({length: LEVELS}, () => lineMaterial('#f1cf8e', {grow: 0.01})),
    }),
    [],
  );
  const sky = useMemo(() => skyMat(), []);
  const {camera, scene} = useThree();
  const sunRef = useRef<THREE.DirectionalLight>(null);

  // ---- global state for this frame
  const sm = skyMix(t);
  const ry = revealY(t);
  REVEAL.uReveal.value = ry;
  REVEAL.uBand.value = prog(t, C.revealStart, 0.3) * (1 - prog(t, C.revealEnd - 0.4, 0.5));
  sky.uniforms.uMix.value = sm;
  M.context.userData.uWinOn.value = 0.9 * prog(t, C.contextStart + 0.6, 1.2, E.quartInOut);
  const built = prog(t, C.foundation, 2.6, E.quartInOut); // solids taking over from the wire

  for (const k of ['major', 'minor', 'grid', 'axes', 'dims'] as const) lm[k].uniforms.uTime.value = t;
  lm.major.uniforms.uOpacity.value = lerp(0.95, 0.3, built) * (1 - prog(t, C.revealEnd - 0.6, 0.8));
  lm.minor.uniforms.uOpacity.value = lerp(0.4, 0.14, built) * (1 - prog(t, C.revealEnd - 0.6, 0.8));
  const tech = 1 - prog(t, C.skyStart, 1.6, E.quartInOut);
  lm.grid.uniforms.uOpacity.value = 0.5 * tech;
  lm.axes.uniforms.uOpacity.value = 0.55 * tech;
  lm.dims.uniforms.uOpacity.value = 0.75 * tech * (1 - 0.4 * prog(t, C.program[0], 0.5));

  useLayoutEffect(() => {
    applyCam(camera as THREE.PerspectiveCamera, t);
    scene.environmentIntensity = lerp(0.12, 1.0, sm);
    scene.fog = new THREE.FogExp2(new THREE.Color().lerpColors(new THREE.Color('#05080d'), new THREE.Color('#33405e'), sm), lerp(0.0065, 0.0042, sm));
    const sun = sunRef.current!;
    sun.position.set(lerp(-45, -85, sm), lerp(70, 26, sm), lerp(55, 42, sm));
    sun.target.position.set(0, 8, 0);
    sun.target.updateMatrixWorld();
  });

  // ---- per-instance colours
  const roomColor = (it: Item, tt: number, c: THREE.Color) => {
    const y = it.p[1];
    const passed = clamp01((ry - y - (it.tag ?? 0) * 2.5) / 1.6);
    const lvl = Math.round(levelOf(y));
    const lit = (it.tag ?? 0) > 0.16;
    const warm = (it.tag ?? 0) > 0.75 ? ROOM_CREAM : ROOM_WARM;
    c.copy(ROOM_OFF_CLAY).multiplyScalar(0.62);
    if (passed > 0) c.lerp(lit ? tmpC.copy(warm).multiplyScalar(0.75 + (it.tag ?? 0) * 0.55) : ROOM_DARK, passed);
    const hl = highlight(tt, lvl);
    if (hl > 0) c.lerp(tmpC.copy(BRASS).multiplyScalar(1.6), hl * 0.55);
  };
  const ledColor = (it: Item, _tt: number, c: THREE.Color) => {
    const passed = clamp01((ry - it.p[1] - 0.5) / 1.2);
    c.set('#c9ced2').multiplyScalar(0.5).lerp(tmpC.set('#ffbf7a').multiplyScalar(1.7), passed);
  };

  return (
    <>
      <mesh material={sky} scale={900} renderOrder={-10}>
        <sphereGeometry args={[1, 48, 24]} />
      </mesh>
      <EnvFromSky />

      <hemisphereLight args={['#9fb4d4', '#0c0f15', lerp(0.5, 0.3, sm)]} />
      <ambientLight intensity={lerp(0.06, 0.04, sm)} />
      <directionalLight
        ref={sunRef}
        color={new THREE.Color().lerpColors(new THREE.Color('#f4f6ff'), new THREE.Color('#ffd2b0'), sm)}
        intensity={lerp(2.3, 1.7, sm) * prog(t, 1.6, 1.0, E.quartInOut)}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-48}
        shadow-camera-right={48}
        shadow-camera-top={48}
        shadow-camera-bottom={-48}
        shadow-camera-near={1}
        shadow-camera-far={260}
      />
      <directionalLight position={[60, 30, -20]} color="#7f9cff" intensity={lerp(0.35, 0.25, sm)} />
      <pointLight position={[0, 4.0, HD + 2.4]} color="#ffb56e" intensity={28 * prog(t, C.revealStart + 0.2, 0.8)} distance={18} decay={2} />

      {/* ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={M.ground}>
        <planeGeometry args={[900, 900]} />
      </mesh>
      <lineSegments geometry={L.grid} material={lm.grid} />
      <lineSegments geometry={L.axes} material={lm.axes} />
      <lineSegments geometry={L.dims} material={lm.dims} />

      {/* building */}
      <Instanced items={foundation} t={t} material={M.concrete} />
      <Instanced items={columns} t={t} material={M.slab} />
      <Instanced items={slabs} t={t} material={M.slab} />
      <Instanced items={roof} t={t} material={M.slab} />
      <Instanced items={walls} t={t} material={M.concrete} />
      {M.rooms.map((mat, k) => (
        <Instanced key={k} items={roomGroups[k]} t={t} material={mat} shadows={false} receive={false} colorFn={roomColor} />
      ))}
      <Instanced items={mullions} t={t} material={M.metal} shadows={false} />
      <Instanced items={balconies} t={t} material={M.slab} />
      <Instanced items={railMetal} t={t} material={M.metal} />
      <Instanced items={leds} t={t} material={M.led} shadows={false} receive={false} colorFn={ledColor} />
      <Instanced items={panes} t={t} material={M.glass} shadows={false} order={2} />
      <Instanced items={rails} t={t} material={M.rail} shadows={false} order={3} />

      {/* site + city */}
      <Instanced items={planters} t={t} material={M.concrete} />
      <Instanced items={lamps} t={t} material={M.metal} shadows={false} />
      <Instanced items={lamps.map((l) => ({...l, p: [l.p[0], 4.45, l.p[2]] as [number, number, number], s: [0.5, 0.12, 0.5] as [number, number, number], t: l.t + 0.25, d: 0.25, m: 'growY' as const}))} t={t} material={M.led} shadows={false} receive={false} colorFn={(it, tt, c) => c.set('#ffcf94').multiplyScalar(2 * prog(tt, C.contextStart + 0.9, 0.5))} />
      <Instanced items={context} t={t} material={M.context} />
      <Trees t={t} M={M} />

      {/* wireframe */}
      <lineSegments geometry={L.major} material={lm.major} />
      <lineSegments geometry={L.minor} material={lm.minor} />

      {/* program highlights */}
      {H.map((h, i) => {
        const a = highlight(t, i);
        if (a <= 0.001) return null;
        const x1 = i === LEVELS - 1 ? PH_X1 : HW + 0.6;
        const w = x1 + HW + 0.4;
        lm.hl[i].uniforms.uTime.value = 99;
        lm.hl[i].uniforms.uOpacity.value = 0.95 * a;
        return (
          <group key={i} position={[(x1 - HW) / 2, levelY(i) + (h - SLAB) / 2, 0]}>
            <mesh scale={[w, h - SLAB + 0.1, D + 0.5]}>
              <boxGeometry />
              <meshBasicMaterial color={BRASS} transparent opacity={0.16 * a} depthWrite={false} blending={THREE.AdditiveBlending} />
            </mesh>
            <lineSegments geometry={hlEdges(w, h - SLAB + 0.1, D + 0.5)} material={lm.hl[i]} />
          </group>
        );
      })}

      <Particles t={t} sm={sm} />
    </>
  );
};

const roomGroups = [0, 1, 2, 3].map((k) => rooms.filter((_, i) => (i * 7 + Math.floor(i / 3)) % 4 === k));

const levelOf = (y: number) => {
  for (let i = LEVELS - 1; i >= 0; i--) if (y >= levelY(i)) return i;
  return 0;
};

const hlCache = new Map<string, THREE.BufferGeometry>();
function hlEdges(w: number, h: number, d: number) {
  const key = `${w}|${h}|${d}`;
  if (!hlCache.has(key)) hlCache.set(key, segGeometry(boxSegs([{p: [0, 0, 0], s: [w, h, d], t: 0, d: 0, m: 'none'}], () => 0)));
  return hlCache.get(key)!;
}

const TRUNK = new THREE.CylinderGeometry(0.1, 0.16, 1, 6);
const CROWN = new THREE.IcosahedronGeometry(1, 2);
const LOBES: [number, number, number, number][] = [
  [0, 4.4, 0, 1.7],
  [0.9, 3.7, 0.4, 1.2],
  [-0.8, 3.8, -0.3, 1.25],
  [0.2, 5.4, -0.2, 1.1],
];
const Trees: React.FC<{t: number; M: Materials}> = ({t, M}) => {
  const trunk = useRef<THREE.InstancedMesh>(null);
  const crown = useRef<THREE.InstancedMesh>(null);
  const col = useMemo(() => new THREE.Color(), []);
  useLayoutEffect(() => {
    trees.forEach((tr, i) => {
      const g = E.backOut(clamp01((t - tr.t) / 0.7));
      const s = tr.s * Math.max(0.0001, g);
      trunk.current!.setMatrixAt(i, m4.compose(vP.set(tr.p[0], 1.6 * s, tr.p[2]), q, vS.set(s, 3.2 * s, s)));
      LOBES.forEach(([x, y, z, r], k) => {
        crown.current!.setMatrixAt(i * LOBES.length + k, m4.compose(vP.set(tr.p[0] + x * s, y * s, tr.p[2] + z * s), q, vS.setScalar(r * s)));
        crown.current!.setColorAt(i * LOBES.length + k, col.set(k % 2 ? '#5d6e45' : '#4b5c3a').multiplyScalar(0.9 + hash(i * 4 + k) * 0.3));
      });
    });
    trunk.current!.instanceMatrix.needsUpdate = true;
    crown.current!.instanceMatrix.needsUpdate = true;
    if (crown.current!.instanceColor) crown.current!.instanceColor.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={trunk} args={[TRUNK, M.bark, trees.length]} castShadow frustumCulled={false} />
      <instancedMesh ref={crown} args={[CROWN, M.foliage, trees.length * LOBES.length]} castShadow receiveShadow frustumCulled={false} />
    </>
  );
};

const NP = 700;
const Particles: React.FC<{t: number; sm: number}> = ({t, sm}) => {
  const base = useMemo(() => {
    const a = new Float32Array(NP * 4);
    for (let i = 0; i < NP; i++) a.set([(hash(i) - 0.5) * 150, hash(i + 0.31) * 45, (hash(i + 0.67) - 0.5) * 130, hash(i + 0.9) * 6.28], i * 4);
    return a;
  }, []);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
    return g;
  }, []);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < NP; i++) {
    const ph = base[i * 4 + 3];
    p.setXYZ(i, base[i * 4] + Math.sin(t * 0.3 + ph) * 1.5 + t * 0.4, base[i * 4 + 1] + Math.sin(t * 0.21 + ph * 2) * 0.8 + t * 0.12, base[i * 4 + 2] + Math.cos(t * 0.25 + ph) * 1.5);
  }
  p.needsUpdate = true;
  return (
    <points geometry={geo} frustumCulled={false}>
      <pointsMaterial
        size={0.16}
        sizeAttenuation
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        color={new THREE.Color().lerpColors(new THREE.Color('#8fd8ff'), new THREE.Color('#ffd2a0'), sm)}
        opacity={0.55 * prog(t, 0.2, 1.5)}
      />
    </points>
  );
};

// re-exported for the overlay
export {BASE, CORE};

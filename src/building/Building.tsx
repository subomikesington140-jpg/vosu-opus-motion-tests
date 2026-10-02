import React, {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import type {} from '@react-three/fiber'; // registers the three.js JSX element types
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {E, clamp01, lerp, prog} from '../lib/ease';
import {
  C,
  Item,
  ROOF,
  SPEC,
  balconies,
  bollards,
  columns,
  crown,
  leds,
  mullions,
  panes,
  planters,
  plinth,
  rails,
  rooms,
  slabs,
  walls,
} from './model';
import {Materials} from './materials';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const vP = new THREE.Vector3();
const vS = new THREE.Vector3();

/** Instance transform for an item at time t (s), applying its build motion. */
function compose(it: Item, t: number) {
  const raw = clamp01((t - it.t) / it.d);
  let [x, y, z] = it.p;
  let [sx, sy, sz] = it.s;
  if (raw <= 0) return null;
  switch (it.m) {
    case 'drop': {
      const e = E.expoOut(raw);
      y += (1 - e) * (it.k ?? 4);
      sx *= lerp(0.92, 1, e);
      sz *= lerp(0.92, 1, e);
      break;
    }
    case 'growY': {
      const e = E.expoOut(raw);
      y -= (sy * (1 - e)) / 2;
      sy *= Math.max(0.001, e);
      break;
    }
    case 'riseIn': {
      const e = E.quintOut(raw);
      y -= (1 - e) * (it.k ?? 1);
      break;
    }
    case 'slideX': {
      const e = E.expoOut(raw);
      x += (1 - e) * (it.k ?? 4);
      break;
    }
    case 'slideZ': {
      const e = E.expoOut(raw);
      z += (1 - e) * (it.k ?? 2);
      sx *= lerp(0.96, 1, e);
      break;
    }
    case 'pane': {
      const e = E.quintOut(raw);
      y -= (sy * (1 - e)) / 2;
      sy *= Math.max(0.001, e);
      break;
    }
  }
  vP.set(x, y, z);
  vS.set(sx, sy, sz);
  return m4.compose(vP, q, vS);
}

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

const Instanced: React.FC<{items: Item[]; t: number; material: THREE.Material; shadows?: boolean; colorFn?: (it: Item, t: number, c: THREE.Color) => void}> = ({
  items,
  t,
  material,
  shadows = true,
  colorFn,
}) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const col = useMemo(() => new THREE.Color(), []);
  useLayoutEffect(() => {
    const mesh = ref.current!;
    items.forEach((it, i) => {
      const mtx = compose(it, t);
      mesh.setMatrixAt(i, mtx ?? HIDDEN);
      if (colorFn) {
        colorFn(it, t, col);
        mesh.setColorAt(i, col);
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  });
  return <instancedMesh ref={ref} args={[BOX, material, items.length]} castShadow={shadows} receiveShadow frustumCulled={false} />;
};

// ---------------------------------------------------------------- blueprint wireframe
function boxEdges(items: Item[]): THREE.BufferGeometry[] {
  return items.map((it) => {
    const g = new THREE.EdgesGeometry(new THREE.BoxGeometry(...it.s));
    g.translate(...it.p);
    return g;
  });
}
function gridGeometry(radius: number, step: number) {
  const pts: number[] = [];
  for (let v = -radius; v <= radius; v += step) {
    pts.push(-radius, 0, v, radius, 0, v, v, 0, -radius, v, 0, radius);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

const ROOM_ON = new THREE.Color('#ffb36b');
const ROOM_COOL = new THREE.Color('#ffd9a8');
const ROOM_OFF = new THREE.Color('#0d0f12');

export const Building: React.FC<{t: number; M: Materials}> = ({t, M}) => {
  const wire = useMemo(() => {
    const major = mergeGeometries([...boxEdges(plinth), ...boxEdges(slabs), ...boxEdges(columns), ...boxEdges(walls), ...boxEdges(crown), ...boxEdges(balconies)]);
    // façade bays as a lighter layer
    const minor = mergeGeometries(boxEdges(panes.filter((_, i) => i % 1 === 0)));
    return {major, minor, grid: gridGeometry(90, 3)};
  }, []);

  // wire draws upward with a clipping plane; a glowing "scan" frame rides the cut
  const wireH = lerp(-1, ROOF + 6, prog(t, C.wireStart, C.wireEnd - C.wireStart, E.quartInOut));
  const clip = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), []);
  clip.constant = wireH;
  const wireFade = 1 - prog(t, C.materialStart, 0.8, E.quartInOut);
  M.wire.clippingPlanes = [clip];
  M.wireDim.clippingPlanes = [clip];
  M.wire.opacity = 0.85 * wireFade;
  M.wireDim.opacity = 0.28 * wireFade;
  const gridIn = prog(t, C.gridIn, 1.2, E.expoOut);
  M.grid.opacity = 0.4 * gridIn * lerp(1, 0.0, prog(t, C.materialStart - 0.4, 1.2));
  const scanOn = t > C.wireStart && t < C.wireEnd + 0.2;

  const roomColor = (it: Item, tt: number, c: THREE.Color) => {
    const on = clamp01((tt - it.t) / 0.18);
    const seedV = it.tag ?? 0.5;
    const off = seedV < 0.14; // a few apartments stay dark
    const intensity = off ? 0 : (0.55 + seedV * 0.9) * on;
    c.copy(ROOM_OFF).lerp(seedV > 0.7 ? ROOM_COOL : ROOM_ON, Math.min(1, intensity)).multiplyScalar(1 + intensity * 1.6);
  };
  const ledColor = (it: Item, tt: number, c: THREE.Color) => {
    const on = clamp01((tt - it.t) / it.d);
    c.set('#ffcf94').multiplyScalar(0.05 + on * 3.2);
  };

  return (
    <group>
      {/* ground: dark site, lighter paved plaza */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow material={M.ground}>
        <planeGeometry args={[600, 600]} />
      </mesh>
      <lineSegments geometry={wire.grid} material={M.grid} scale={[0.4 + 0.6 * gridIn, 1, 0.4 + 0.6 * gridIn]} position={[0, 0.02, 0]} />

      <Instanced items={plinth} t={t} material={M.concrete} />
      <Instanced items={slabs} t={t} material={M.slab} />
      <Instanced items={columns} t={t} material={M.slab} />
      <Instanced items={walls} t={t} material={M.concrete} />
      <Instanced items={crown} t={t} material={M.concrete} />
      <Instanced items={rooms} t={t} material={M.room} shadows={false} colorFn={roomColor} />
      <Instanced items={panes} t={t} material={M.glass} shadows={false} />
      <Instanced items={mullions} t={t} material={M.metal} shadows={false} />
      <Instanced items={balconies} t={t} material={M.slab} />
      <Instanced items={rails} t={t} material={M.rail} shadows={false} />
      <Instanced items={leds} t={t} material={M.led} shadows={false} colorFn={ledColor} />
      <Instanced items={planters} t={t} material={M.concrete} />
      <Instanced items={bollards} t={t} material={M.led} shadows={false} colorFn={ledColor} />

      {wireFade > 0.01 && (
        <>
          <lineSegments geometry={wire.major} material={M.wire} />
          <lineSegments geometry={wire.minor} material={M.wireDim} />
        </>
      )}
      {scanOn && (
        <lineSegments position={[0, wireH, 0]}>
          <edgesGeometry args={[new THREE.BoxGeometry(SPEC.W + 14, 0.001, SPEC.D + 14)]} />
          <lineBasicMaterial color="#c8f0ff" transparent opacity={0.9} />
        </lineSegments>
      )}
    </group>
  );
};

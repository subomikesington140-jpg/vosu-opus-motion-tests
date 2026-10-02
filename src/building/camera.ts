import * as THREE from 'three';

/**
 * The whole camera move as one deterministic function of time. Keys are in
 * orbit space around the building (azimuth from the south facade, distance,
 * height, look-at height, sideways framing offset, fov) and are joined with a
 * C1-continuous cubic Hermite spline, so the move never stops between keys.
 * The overlay uses the same function to pin labels to 3D points.
 */
type Key = {t: number; az: number; r: number; h: number; ty: number; s: number; fov: number};
const KEYS: Key[] = [
  {t: 0, az: 40, r: 104, h: 6, ty: 9, s: 0, fov: 30},
  {t: 2, az: 35, r: 96, h: 8, ty: 10, s: 0, fov: 30},
  {t: 4.6, az: 26, r: 92, h: 11, ty: 11, s: 6, fov: 30},
  {t: 5.6, az: 18, r: 90, h: 10, ty: 11, s: 12, fov: 30},
  {t: 7.8, az: 14, r: 88, h: 10, ty: 11, s: 12, fov: 30},
  {t: 11, az: -14, r: 74, h: 4.5, ty: 10.5, s: -3, fov: 32},
  {t: 13, az: -62, r: 98, h: 16, ty: 11, s: 5, fov: 32},
  {t: 15, az: -70, r: 96, h: 13, ty: 10.5, s: 16, fov: 30},
];
const CH = ['az', 'r', 'h', 'ty', 's', 'fov'] as const;

function channel(t: number, c: (typeof CH)[number]) {
  const k = KEYS;
  if (t <= k[0].t) return k[0][c];
  if (t >= k[k.length - 1].t) return k[k.length - 1][c];
  let i = 0;
  while (t > k[i + 1].t) i++;
  const tan = (j: number) => {
    if (j === 0 || j === k.length - 1) return 0;
    const a = (k[j][c] - k[j - 1][c]) / (k[j].t - k[j - 1].t);
    const b = (k[j + 1][c] - k[j][c]) / (k[j + 1].t - k[j].t);
    // monotone-ish: no overshoot when the channel changes direction
    return a * b <= 0 ? 0 : (a + b) / 2;
  };
  const h = k[i + 1].t - k[i].t;
  const u = (t - k[i].t) / h;
  const u2 = u * u;
  const u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * k[i][c] + (u3 - 2 * u2 + u) * h * tan(i) + (-2 * u3 + 3 * u2) * k[i + 1][c] + (u3 - u2) * h * tan(i + 1);
}

export function camAt(t: number) {
  const az = (channel(t, 'az') * Math.PI) / 180;
  const r = channel(t, 'r');
  const pos = new THREE.Vector3(Math.sin(az) * r, channel(t, 'h'), Math.cos(az) * r);
  const base = new THREE.Vector3(0, channel(t, 'ty'), 0);
  // shift the look-at point to the camera's right so the building sits left of centre
  const right = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az));
  const target = base.addScaledVector(right, channel(t, 's'));
  return {pos, target, fov: channel(t, 'fov')};
}

const tmpCam = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 2000);
export function applyCam(cam: THREE.PerspectiveCamera, t: number) {
  const c = camAt(t);
  cam.position.copy(c.pos);
  cam.fov = c.fov;
  cam.near = 0.5;
  cam.far = 2000;
  cam.updateProjectionMatrix();
  cam.lookAt(c.target);
  cam.updateMatrixWorld(true);
}

/** Project a world point to 1920x1080 screen pixels for time t. */
export function project(t: number, p: [number, number, number], Wpx = 1920, Hpx = 1080) {
  applyCam(tmpCam, t);
  const v = new THREE.Vector3(...p).project(tmpCam);
  return {x: ((v.x + 1) / 2) * Wpx, y: ((1 - v.y) / 2) * Hpx, front: v.z < 1};
}

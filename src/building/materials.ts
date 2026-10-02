import * as THREE from 'three';

let seed = 99;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

/** Board-formed concrete: horizontal plank bands, grain noise and form-tie holes. */
function boardFormed(): THREE.Texture {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const planks = 8; // 512px = 2.4 m of wall -> 0.3 m boards
  for (let p = 0; p < planks; p++) {
    const v = 178 + rnd() * 26;
    g.fillStyle = `rgb(${v},${v - 3},${v - 9})`;
    g.fillRect(0, (p * S) / planks, S, S / planks);
    g.fillStyle = 'rgba(60,55,50,0.35)';
    g.fillRect(0, (p * S) / planks, S, 2);
  }
  const img = g.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 22 + Math.sin(i * 0.0007) * 4;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  g.fillStyle = 'rgba(70,65,60,0.55)';
  for (let x = 32; x < S; x += 128)
    for (let y = 32; y < S; y += 128) {
      g.beginPath();
      g.arc(x, y, 4, 0, Math.PI * 2);
      g.fill();
    }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Large-format paving with fine joints. */
function paving(): THREE.Texture {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  for (let x = 0; x < 4; x++)
    for (let y = 0; y < 4; y++) {
      const v = 120 + rnd() * 18;
      g.fillStyle = `rgb(${v},${v - 2},${v - 5})`;
      g.fillRect((x * S) / 4, (y * S) / 4, S / 4, S / 4);
    }
  g.strokeStyle = 'rgba(30,30,30,0.6)';
  g.lineWidth = 3;
  for (let k = 0; k <= 4; k++) {
    g.beginPath();
    g.moveTo((k * S) / 4, 0);
    g.lineTo((k * S) / 4, S);
    g.moveTo(0, (k * S) / 4);
    g.lineTo(S, (k * S) / 4);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export type MatUniforms = {uMat: {value: number}};

/**
 * MeshStandardMaterial with a world-space mapped texture whose influence is
 * controlled by uMat: 0 = untextured architectural "clay", 1 = real material.
 */
function worldMapped(tex: THREE.Texture, scale: number, params: THREE.MeshStandardMaterialParameters) {
  const m = new THREE.MeshStandardMaterial(params) as THREE.MeshStandardMaterial & {userData: MatUniforms};
  const uniforms = {uMat: {value: 0}, uTex: {value: tex}, uScale: {value: scale}};
  m.userData = uniforms as unknown as MatUniforms;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 bwp = vec4(transformed, 1.0);
        vec3 bwn = objectNormal;
        #ifdef USE_INSTANCING
          bwp = instanceMatrix * bwp;
          bwn = mat3(instanceMatrix) * bwn;
        #endif
        vWPos = (modelMatrix * bwp).xyz;
        vWNrm = normalize(mat3(modelMatrix) * bwn);`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;\nuniform sampler2D uTex;\nuniform float uMat;\nuniform float uScale;')
      .replace(
        '#include <map_fragment>',
        `vec3 an = abs(vWNrm);
        vec2 wuv = an.y > 0.5 ? vWPos.xz : (an.x > 0.5 ? vWPos.zy : vWPos.xy);
        vec3 tx = texture2D(uTex, wuv * uScale).rgb / 0.72;
        diffuseColor.rgb *= mix(vec3(1.0), tx, uMat);`,
      );
  };
  return m;
}

export function createMaterials() {
  const board = boardFormed();
  const pave = paving();
  return {
    concrete: worldMapped(board, 1 / 2.4, {color: '#e8e5df', roughness: 0.92, metalness: 0}),
    slab: worldMapped(board, 1 / 6, {color: '#ecebe7', roughness: 0.7, metalness: 0}),
    ground: worldMapped(pave, 1 / 4.8, {color: '#d8d6d2', roughness: 0.75, metalness: 0}),
    glass: new THREE.MeshStandardMaterial({color: '#e4e9ec', roughness: 0.5, metalness: 0, transparent: true, opacity: 0.9, envMapIntensity: 1}),
    rail: new THREE.MeshStandardMaterial({color: '#dfe7ea', roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.35}),
    metal: new THREE.MeshStandardMaterial({color: '#cfcfcf', roughness: 0.5, metalness: 0}),
    room: new THREE.MeshBasicMaterial({color: '#ffffff', toneMapped: true}),
    led: new THREE.MeshBasicMaterial({color: '#ffffff', toneMapped: true}),
    wire: new THREE.LineBasicMaterial({color: '#7fd4ff', transparent: true, opacity: 0.9, depthWrite: false}),
    wireDim: new THREE.LineBasicMaterial({color: '#7fd4ff', transparent: true, opacity: 0.35, depthWrite: false}),
    grid: new THREE.LineBasicMaterial({color: '#3d7ea6', transparent: true, opacity: 0.4, depthWrite: false}),
  };
}
export type Materials = ReturnType<typeof createMaterials>;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const cA = new THREE.Color();
const cB = new THREE.Color();

/** Blend every material from clay (m = 0) to its real finish (m = 1). */
export function applyMaterialMix(M: Materials, m: number) {
  for (const k of ['concrete', 'slab', 'ground'] as const) (M[k].userData as MatUniforms).uMat.value = m;
  M.concrete.color.copy(cA.set('#e8e5df').lerp(cB.set('#cfc9bf'), m));
  M.concrete.roughness = lerp(0.92, 0.88, m);
  M.slab.color.copy(cA.set('#ecebe7').lerp(cB.set('#f1efea'), m));
  M.ground.color.copy(cA.set('#d8d6d2').lerp(cB.set('#8d8a86'), m));
  M.ground.roughness = lerp(0.75, 0.45, m);
  // glass: frosted clay -> dark, reflective low-iron glazing
  M.glass.color.copy(cA.set('#e4e9ec').lerp(cB.set('#1c2a33'), m));
  M.glass.roughness = lerp(0.5, 0.04, m);
  M.glass.metalness = lerp(0, 0.85, m);
  M.glass.opacity = lerp(0.9, 0.58, m);
  M.glass.envMapIntensity = lerp(0.6, 1.6, m);
  M.rail.opacity = lerp(0.35, 0.22, m);
  M.metal.color.copy(cA.set('#cfcfcf').lerp(cB.set('#2b2e33'), m));
  M.metal.roughness = lerp(0.5, 0.3, m);
  M.metal.metalness = lerp(0, 0.8, m);
}

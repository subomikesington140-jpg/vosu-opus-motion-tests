import * as THREE from 'three';

let seed = 99;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

function canvasTex(S: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Board-formed concrete: plank bands, grain and form-tie holes (mean ~0.75). */
const boardFormed = () =>
  canvasTex(512, (g) => {
    const planks = 8;
    for (let p = 0; p < planks; p++) {
      const v = 182 + rnd() * 22;
      g.fillStyle = `rgb(${v},${v - 2},${v - 6})`;
      g.fillRect(0, (p * 512) / planks, 512, 512 / planks);
      g.fillStyle = 'rgba(70,64,58,0.35)';
      g.fillRect(0, (p * 512) / planks, 512, 2);
    }
    const img = g.getImageData(0, 0, 512, 512);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (rnd() - 0.5) * 20;
      img.data[i] += n;
      img.data[i + 1] += n;
      img.data[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
    g.fillStyle = 'rgba(80,74,68,0.6)';
    for (let x = 32; x < 512; x += 128)
      for (let y = 32; y < 512; y += 128) {
        g.beginPath();
        g.arc(x, y, 4, 0, Math.PI * 2);
        g.fill();
      }
  });

/** Large-format stone paving with fine joints. */
const paving = () =>
  canvasTex(512, (g) => {
    for (let x = 0; x < 4; x++)
      for (let y = 0; y < 8; y++) {
        const v = 176 + rnd() * 30;
        g.fillStyle = `rgb(${v},${v - 1},${v - 4})`;
        g.fillRect(x * 128 + (y % 2) * 64, y * 64, 128, 64);
        g.fillRect(x * 128 + (y % 2) * 64 - 512, y * 64, 128, 64);
      }
    g.strokeStyle = 'rgba(40,40,40,0.55)';
    g.lineWidth = 2;
    for (let y = 0; y <= 8; y++) {
      g.beginPath();
      g.moveTo(0, y * 64);
      g.lineTo(512, y * 64);
      g.stroke();
      for (let x = 0; x <= 4; x++) {
        g.beginPath();
        g.moveTo(x * 128 + (y % 2) * 64, y * 64);
        g.lineTo(x * 128 + (y % 2) * 64, y * 64 + 64);
        g.stroke();
      }
    }
  });

/** Distant city facades: a grid of windows, some lit warm. */
const cityWindows = () =>
  canvasTex(256, (g) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const r = rnd();
        if (r < 0.7) continue;
        const v = r > 0.95 ? '#ffe2b0' : r > 0.85 ? '#d99a5c' : '#6e4426';
        g.fillStyle = v;
        g.fillRect(x * 16 + 5, y * 16 + 4, 6, 8);
      }
  });

/** Apartment interior seen through the glass: warm ceiling wash, a cove light, furniture silhouettes. */
const interior = (variant: number) =>
  canvasTex(256, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#fff1da');
    grad.addColorStop(0.12, '#ffd59a');
    grad.addColorStop(0.55, '#c9884e');
    grad.addColorStop(1, '#4a2f1d');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = 'rgba(255,250,235,0.95)';
    g.fillRect(0, 10, 256, 6); // cove light
    // back-wall art / shelving
    g.fillStyle = 'rgba(80,50,30,0.35)';
    if (variant % 2) g.fillRect(40 + variant * 20, 70, 70, 50);
    else for (let k = 0; k < 4; k++) g.fillRect(150, 60 + k * 26, 80, 4);
    // furniture silhouettes
    g.fillStyle = 'rgba(30,20,14,0.85)';
    if (variant === 0) {
      g.fillRect(30, 190, 120, 40);
      g.fillRect(30, 170, 20, 60);
      g.fillRect(170, 150, 6, 80);
      g.beginPath();
      g.arc(173, 148, 16, Math.PI, 0);
      g.fill();
    } else if (variant === 1) {
      g.fillRect(90, 200, 110, 10);
      g.fillRect(100, 210, 6, 30);
      g.fillRect(186, 210, 6, 30);
      for (let k = 0; k < 3; k++) g.fillRect(100 + k * 34, 170, 18, 34);
    } else if (variant === 2) {
      g.beginPath();
      g.ellipse(200, 170, 26, 44, 0, 0, Math.PI * 2);
      g.fill();
      g.fillRect(196, 200, 8, 40);
      g.fillRect(40, 200, 90, 34);
    }
    // sheer curtain on one side
    if (variant !== 3) {
      g.fillStyle = 'rgba(255,236,205,0.28)';
      g.fillRect(variant === 1 ? 0 : 214, 16, 42, 240);
    }
  });

/** Shared reveal state: everything below uReveal (world y) shows its real finish. */
export const REVEAL = {uReveal: {value: -100}, uBand: {value: 0}, uBandColor: {value: new THREE.Color('#9fe3ff')}};

type Look = {color: string; rough: number; metal: number; opacity?: number};
type RevealOpts = {clay: Look; real: Look; tex?: THREE.Texture; texScale?: number; transparent?: boolean; env?: number; emissiveTex?: THREE.Texture; band?: boolean};

/**
 * MeshStandardMaterial that blends from architectural "clay" to its real finish
 * per fragment, driven by the world-space height of the reveal sweep. Real
 * textures are world-mapped (box projection), so instanced boxes of any scale
 * share one continuous material.
 */
function revealMaterial(o: RevealOpts) {
  const m = new THREE.MeshStandardMaterial({
    color: o.real.color,
    roughness: o.real.rough,
    metalness: o.real.metal,
    transparent: !!o.transparent,
    opacity: o.real.opacity ?? 1,
    envMapIntensity: o.env ?? 1,
  });
  const u = {
    uClay: {value: new THREE.Color(o.clay.color)},
    uClayRough: {value: o.clay.rough},
    uClayMetal: {value: o.clay.metal},
    uClayOpacity: {value: o.clay.opacity ?? 1},
    uTex: {value: o.tex ?? null},
    uHasTex: {value: o.tex ? 1 : 0},
    uScale: {value: o.texScale ?? 0.25},
    uWin: {value: o.emissiveTex ?? null},
    uWinOn: {value: 0},
    uBandMul: {value: o.band === false ? 0 : 1},
  };
  m.userData = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u, REVEAL);
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
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWPos; varying vec3 vWNrm;
        uniform vec3 uClay; uniform float uClayRough; uniform float uClayMetal; uniform float uClayOpacity;
        uniform sampler2D uTex; uniform float uHasTex; uniform float uScale;
        uniform sampler2D uWin; uniform float uWinOn;
        uniform float uReveal; uniform float uBand; uniform vec3 uBandColor; uniform float uBandMul;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float rv = smoothstep(uReveal + 0.9, uReveal - 0.9, vWPos.y);
        vec3 an = abs(vWNrm);
        vec2 wuv = an.y > 0.5 ? vWPos.xz : (an.x > 0.5 ? vWPos.zy : vWPos.xy);
        vec3 tx = uHasTex > 0.5 ? texture2D(uTex, wuv * uScale).rgb / 0.62 : vec3(1.0);
        diffuseColor.rgb = mix(uClay, diffuseColor.rgb * tx, rv);
        diffuseColor.a = mix(uClayOpacity, diffuseColor.a, rv);`,
      )
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(uClayRough, roughness, rv);')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = mix(uClayMetal, metalness, rv);')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float bandD = (vWPos.y - uReveal) / 0.22;
        totalEmissiveRadiance += uBandColor * exp(-bandD * bandD) * uBand * uBandMul * 2.5;
        if (uWinOn > 0.0) {
          vec2 cuv = an.y > 0.5 ? vec2(0.0) : (an.x > 0.5 ? vWPos.zy : vWPos.xy) / 9.0;
          totalEmissiveRadiance += texture2D(uWin, cuv).rgb * uWinOn * (an.y > 0.5 ? 0.0 : 1.0);
        }`,
      );
  };
  return m;
}

/** Unlit interior: plain clay grey until the reveal sweep passes, then its texture. */
function roomMaterial(tex: THREE.Texture) {
  const m = new THREE.MeshBasicMaterial({color: '#ffffff', map: tex});
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, REVEAL);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vWY;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 rwp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          rwp = instanceMatrix * rwp;
        #endif
        vWY = (modelMatrix * rwp).y;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vWY;\nuniform float uReveal;')
      .replace(
        '#include <map_fragment>',
        `vec4 sampledDiffuseColor = texture2D(map, vMapUv);
        float rv = smoothstep(uReveal + 0.9, uReveal - 0.9, vWY);
        diffuseColor *= vec4(mix(vec3(0.82), sampledDiffuseColor.rgb, rv), 1.0);`,
      );
  };
  return m;
}

export function createMaterials() {
  const board = boardFormed();
  const pave = paving();
  return {
    concrete: revealMaterial({clay: {color: '#dcdad5', rough: 0.85, metal: 0}, real: {color: '#a9a7a2', rough: 0.88, metal: 0}, tex: board, texScale: 1 / 2.4}),
    slab: revealMaterial({clay: {color: '#efedea', rough: 0.8, metal: 0}, real: {color: '#cdcac4', rough: 0.7, metal: 0}, tex: board, texScale: 1 / 7}),
    glass: revealMaterial({clay: {color: '#bcd3e2', rough: 0.35, metal: 0, opacity: 0.32}, real: {color: '#2b3b48', rough: 0.02, metal: 0.82, opacity: 0.76}, transparent: true, env: 2.2}),
    rail: revealMaterial({clay: {color: '#d6e6ef', rough: 0.3, metal: 0, opacity: 0.25}, real: {color: '#9db4c0', rough: 0.05, metal: 0.4, opacity: 0.28}, transparent: true, env: 1.4}),
    metal: revealMaterial({clay: {color: '#d0d0ce', rough: 0.6, metal: 0}, real: {color: '#5a4636', rough: 0.32, metal: 0.9}, env: 1.3}),
    ground: revealMaterial({clay: {color: '#0b0e14', rough: 1, metal: 0}, real: {color: '#3a3b3e', rough: 0.55, metal: 0}, tex: pave, texScale: 1 / 6, env: 0.35, band: false}),
    context: revealMaterial({clay: {color: '#0d1118', rough: 0.9, metal: 0}, real: {color: '#232833', rough: 0.75, metal: 0.1}, emissiveTex: cityWindows(), band: false}),
    foliage: new THREE.MeshStandardMaterial({color: '#ffffff', roughness: 0.85}),
    bark: new THREE.MeshStandardMaterial({color: '#3a3029', roughness: 0.9}),
    rooms: [0, 1, 2, 3].map((k) => roomMaterial(interior(k))),
    led: new THREE.MeshBasicMaterial({color: '#ffffff'}),
  };
}
export type Materials = ReturnType<typeof createMaterials>;

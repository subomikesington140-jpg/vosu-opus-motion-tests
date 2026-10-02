// "Construct" soundtrack: cinematic score + construction / transition sound design
// for the 15s apartment-tower film (VOSU-generated picture, three 5s clips).
// Picture beats: 0-5 blueprint -> foundation -> floors | 5-10 walls, glass,
// balconies, materials | 10-15 lighting + orbit.
// Output: public/building/soundtrack.wav (44.1 kHz, 16-bit stereo, -14 LUFS)

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SR = 44100;
const DUR = 15;
const N = SR * DUR;

const bus = () => [new Float32Array(N), new Float32Array(N)];
const music = bus();
const perc = bus();
const sfx = bus();
const verb = bus();

let seed = 21;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const noise = () => rnd() * 2 - 1;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const write = (b, i, l, r = l) => {
  if (i >= 0 && i < N) {
    b[0][i] += l;
    b[1][i] += r;
  }
};
const panLR = (p) => [Math.cos(((p + 1) * Math.PI) / 4), Math.sin(((p + 1) * Math.PI) / 4)];

class Biquad {
  constructor() {
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
  }
  set(type, f, q) {
    const w = (2 * Math.PI * clamp(f, 10, SR * 0.45)) / SR;
    const cs = Math.cos(w);
    const a = Math.sin(w) / (2 * q);
    let b0, b1, b2;
    if (type === 'lp') [b0, b1, b2] = [(1 - cs) / 2, 1 - cs, (1 - cs) / 2];
    else if (type === 'hp') [b0, b1, b2] = [(1 + cs) / 2, -(1 + cs), (1 + cs) / 2];
    else [b0, b1, b2] = [a, 0, -a];
    const a0 = 1 + a;
    Object.assign(this, {b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: (-2 * cs) / a0, a2: (1 - a) / a0});
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

// ---------------------------------------------------------------- instruments
/** Detuned saw voice through a low-pass; `cutoffAt(x)` lets pads open over time. */
function saw(t, dur, midi, o = {}) {
  const {gain = 0.2, cutoff = 1200, cutoffTo = cutoff, env = 0, decay = 6, attack = 0.01, detune = 0.12, voices = 3, pan = 0, send = 0.3, q = 0.8, release = 0.4, b = music} = o;
  const s = Math.floor(t * SR);
  const fl = new Biquad();
  const fr = new Biquad();
  const ph = Array.from({length: voices * 2}, () => rnd());
  const base = mtof(midi);
  const [pl, pr] = panLR(pan);
  const total = (dur + release) * SR;
  for (let i = 0; i < total; i++) {
    const x = i / SR;
    const amp = Math.min(1, x / attack) * (x < dur ? 1 : Math.exp(-(x - dur) * (4 / release)));
    if (i % 32 === 0) {
      const fc = cutoff + (cutoffTo - cutoff) * Math.min(1, x / dur) + env * Math.exp(-x * decay);
      fl.set('lp', fc, q);
      fr.set('lp', fc * 1.02, q);
    }
    let l = 0;
    let r = 0;
    for (let v = 0; v < voices; v++) {
      const d = voices === 1 ? 0 : (v / (voices - 1) - 0.5) * detune;
      ph[v] = (ph[v] + (base * Math.pow(2, d / 12)) / SR) % 1;
      ph[v + voices] = (ph[v + voices] + (base * Math.pow(2, -d / 12)) / SR) % 1;
      l += ph[v] * 2 - 1;
      r += ph[v + voices] * 2 - 1;
    }
    l = fl.run(l / voices) * amp * gain;
    r = fr.run(r / voices) * amp * gain;
    write(b, s + i, l * pl * 1.4, r * pr * 1.4);
    write(verb, s + i, l * send, r * send);
  }
}
function sine(t, dur, midi, g = 0.3, attack = 0.01, b = music) {
  const s = Math.floor(t * SR);
  const f = mtof(midi);
  for (let i = 0; i < (dur + 0.3) * SR; i++) {
    const x = i / SR;
    const env = Math.min(1, x / attack) * (x < dur ? 1 : Math.exp(-(x - dur) * 12));
    write(b, s + i, Math.sin(2 * Math.PI * f * x) * env * g);
  }
}
/** Taiko-style drum: pitched body + skin noise, long room tail. */
function taiko(t, g = 0.7, midi = 36, pan = 0) {
  const s = Math.floor(t * SR);
  const lp = new Biquad();
  lp.set('lp', 900, 0.7);
  const [pl, pr] = panLR(pan);
  let ph = 0;
  for (let i = 0; i < 1.4 * SR; i++) {
    const x = i / SR;
    ph += (2 * Math.PI * mtof(midi) * (1 + 0.6 * Math.exp(-x * 30))) / SR;
    const v = (Math.sin(ph) * Math.exp(-x * 4.5) + lp.run(noise()) * Math.exp(-x * 22) * 0.6) * g;
    write(perc, s + i, v * pl, v * pr);
    write(verb, s + i, v * 0.35);
  }
}
function boom(t, g = 0.6, midi = 26, len = 2.5) {
  const s = Math.floor(t * SR);
  let ph = 0;
  const lp = new Biquad();
  lp.set('lp', 200, 0.7);
  for (let i = 0; i < len * SR; i++) {
    const x = i / SR;
    ph += (2 * Math.PI * mtof(midi) * (1 + 1.2 * Math.exp(-x * 9))) / SR;
    const v = (Math.sin(ph) * 0.9 + lp.run(noise()) * 0.5 * Math.exp(-x * 6)) * Math.exp(-x * (2.2 / len) * 1.6) * g;
    write(sfx, s + i, v);
    write(verb, s + i, v * 0.2);
  }
}
/** Construction clunk: inharmonic metal partials + a concrete thump. */
function clunk(t, g = 0.3, pitch = 0, pan = 0) {
  const s = Math.floor(t * SR);
  const [pl, pr] = panLR(pan);
  const f0 = 180 * Math.pow(2, pitch / 12);
  const parts = [1, 2.76, 5.4, 8.93].map((r, k) => [f0 * r, [1, 0.5, 0.3, 0.15][k], [18, 26, 40, 60][k]]);
  const lp = new Biquad();
  lp.set('lp', 400, 0.8);
  for (let i = 0; i < 0.6 * SR; i++) {
    const x = i / SR;
    let v = 0;
    for (const [f, a, d] of parts) v += Math.sin(2 * Math.PI * f * x) * a * Math.exp(-x * d);
    v = v * 0.5 + lp.run(noise()) * Math.exp(-x * 30) * 1.6 + Math.sin(2 * Math.PI * 60 * x) * Math.exp(-x * 20) * 0.8;
    v *= g;
    write(sfx, s + i, v * pl, v * pr);
    write(verb, s + i, v * 0.25);
  }
}
function tick(t, g = 0.08, pan = 0, f = 3800) {
  const s = Math.floor(t * SR);
  const [pl, pr] = panLR(pan);
  for (let i = 0; i < 0.015 * SR; i++) {
    const v = Math.sin((2 * Math.PI * f * i) / SR) * Math.exp((-i / SR) * 450) * g;
    write(sfx, s + i, v * pl, v * pr);
    write(verb, s + i, v * 0.3);
  }
}
function bell(t, midi, g = 0.1, o = {}) {
  const {ratio = 2.01, index = 1.2, decay = 9, pan = 0, send = 0.8} = o;
  const s = Math.floor(t * SR);
  const f = mtof(midi);
  const [pl, pr] = panLR(pan);
  for (let i = 0; i < 1.5 * SR; i++) {
    const x = i / SR;
    const env = Math.exp(-x * decay) * Math.min(1, x / 0.002);
    const v = Math.sin(2 * Math.PI * f * x + Math.sin(2 * Math.PI * f * ratio * x) * index * Math.exp(-x * decay * 1.4)) * env * g;
    write(sfx, s + i, v * pl, v * pr);
    write(verb, s + i, v * send);
  }
}
/** Glass: a sweep of crystalline FM pings across the stereo field. */
function glassSweep(t, dur, g = 0.07, notes = [74, 77, 81, 84, 86, 89, 93]) {
  const n = Math.floor(dur * 22);
  for (let k = 0; k < n; k++) bell(t + (k / n) * dur, notes[k % notes.length], g * (0.5 + 0.5 * Math.sin((Math.PI * k) / n)), {ratio: 3.01, index: 0.8, decay: 12, pan: -0.8 + (1.6 * k) / n});
}
function whoosh(t, dur, o = {}) {
  const {gain = 0.4, from = 300, to = 6000, shape = 'swish', pan = 0, panTo = pan, q = 1.6} = o;
  const s = Math.floor(t * SR);
  const bl = new Biquad();
  const br = new Biquad();
  for (let i = 0; i < dur * SR; i++) {
    const p = i / (dur * SR);
    const env = shape === 'up' ? Math.pow(p, 2) * (p > 0.96 ? (1 - p) / 0.04 : 1) : shape === 'down' ? Math.pow(1 - p, 1.5) * Math.min(1, p / 0.03) : Math.sin(Math.PI * p) ** 2;
    const fp = shape === 'up' ? p : shape === 'down' ? 1 - p : Math.sin(Math.PI * p);
    if (i % 16 === 0) {
      const f = from * Math.pow(to / from, fp);
      bl.set('bp', f, q);
      br.set('bp', f * 1.06, q);
    }
    const [pl, pr] = panLR(pan + (panTo - pan) * p);
    const l = bl.run(noise()) * env * gain;
    const r = br.run(noise()) * env * gain;
    write(sfx, s + i, l * pl * 1.4, r * pr * 1.4);
    write(verb, s + i, (l + r) * 0.15);
  }
}
/** Reverse cymbal-style swell ending exactly at tEnd. */
function swell(tEnd, dur, g = 0.3) {
  const s = Math.floor((tEnd - dur) * SR);
  const hp = new Biquad();
  hp.set('hp', 3000, 0.7);
  for (let i = 0; i < dur * SR; i++) {
    const e = Math.pow(i / (dur * SR), 3) * g;
    const l = hp.run(noise()) * e;
    write(sfx, s + i, l, l * 0.8 + noise() * e * 0.15);
  }
}
/** Electrical "power on" hum: 50 Hz harmonics fading in with a filter opening. */
function powerOn(t, dur, g = 0.12) {
  const s = Math.floor(t * SR);
  const lp = new Biquad();
  for (let i = 0; i < dur * SR; i++) {
    const x = i / SR;
    const p = x / dur;
    if (i % 32 === 0) lp.set('lp', 200 + 3000 * p * p, 1.2);
    let v = 0;
    for (let h = 1; h <= 8; h++) v += Math.sin(2 * Math.PI * 55 * h * x) / h;
    v = lp.run(v) * g * Math.sin(Math.PI * p) ** 0.7;
    write(sfx, s + i, v);
  }
}

// ---------------------------------------------------------------- score (D minor, 90 BPM)
const BEAT = 60 / 90;
// sustained string pads: Dm | Bbmaj7 | C | F | Dm(add9)
const PADS = [
  {t: 0, d: 5, notes: [50, 57, 62, 65], cut: [260, 900]},
  {t: 5, d: 2.5, notes: [46, 58, 62, 65, 69], cut: [900, 1300]},
  {t: 7.5, d: 2.5, notes: [48, 55, 64, 67, 72], cut: [1100, 1700]},
  {t: 10, d: 2.5, notes: [41, 53, 60, 65, 69, 72], cut: [1600, 2400]},
  {t: 12.5, d: 2.5, notes: [38, 50, 57, 62, 64, 65, 69], cut: [2200, 1400]},
];
PADS.forEach((p, k) =>
  p.notes.forEach((m, j) =>
    saw(p.t, p.d + 0.05, m, {gain: k === 0 ? 0.04 : 0.048, cutoff: p.cut[0], cutoffTo: p.cut[1], attack: k === 0 ? 2.2 : 0.35, voices: 4, detune: 0.2, pan: (j / (p.notes.length - 1) - 0.5) * 1.2, send: 0.6, release: k === 4 ? 1.2 : 0.5}),
  ),
);
// sub drone under everything
sine(0, 15, 26, 0.16, 1.5);
// low-string ostinato: 8ths from the foundation, 16ths from the light-up
const OST = [
  [2.0, 5, [38, 38, 45, 38]],
  [5, 7.5, [34, 34, 41, 46]],
  [7.5, 10, [36, 36, 43, 48]],
  [10, 12.5, [41, 41, 48, 53]],
  [12.5, 14.2, [38, 38, 45, 50]],
];
for (const [a, b, pat] of OST) {
  const step = a >= 10 ? BEAT / 4 : BEAT / 2;
  let k = 0;
  for (let t = a; t < b - 0.02; t += step, k++) {
    const accent = k % 4 === 0;
    saw(t, step * 0.8, pat[k % 4], {gain: (a < 5 ? 0.05 : 0.07) * (accent ? 1.25 : 1), cutoff: 260, env: a >= 10 ? 2200 : 1200, decay: 18, voices: 2, detune: 0.1, pan: k % 2 ? 0.25 : -0.25, send: 0.2, release: 0.08});
  }
}
// high "heroic" line over the reveal
[[10, 0.75, 81], [10.75, 0.75, 79], [11.5, 1.0, 77], [12.5, 0.75, 76], [13.25, 0.75, 74], [14.0, 1.0, 74]].forEach(([t, d, m]) =>
  saw(t, d, m, {gain: 0.03, cutoff: 1800, attack: 0.08, voices: 3, detune: 0.1, send: 0.7, release: 0.5}),
);
// taiko pattern: sparse in the build, driving in the orbit
[2.0, 3.333, 4.667].forEach((t) => taiko(t, 0.55, 36));
[5, 6.333, 7.5, 8.833].forEach((t) => taiko(t, 0.5, 38, 0.2));
for (let t = 10; t < 14.0; t += BEAT) taiko(t, Math.round((t - 10) / BEAT) % 2 ? 0.45 : 0.7, 36, Math.round((t - 10) / BEAT) % 2 ? 0.3 : -0.3);
for (let k = 0; k < 6; k++) taiko(13.33 + k * (BEAT / 4), 0.3 + k * 0.06, 41, k % 2 ? 0.4 : -0.4); // roll into the final hit
taiko(14.0, 0.95, 33);

// ---------------------------------------------------------------- sound design
// 0-2s blueprint: scanning ticks as the wireframe draws
for (let k = 0; k < 18; k++) tick(0.3 + k * 0.095, 0.05 + k * 0.003, -0.6 + k * 0.07, 3200 + k * 60);
whoosh(0.0, 1.6, {gain: 0.12, from: 2000, to: 9000, shape: 'up', q: 3});
// foundation drop
swell(1.95, 0.6, 0.12);
boom(1.95, 0.55, 26, 2.2);
// floors: one clunk per storey, climbing
for (let k = 0; k < 12; k++) clunk(2.35 + k * 0.22, 0.24 + k * 0.006, k * 0.6, (k % 2 ? 0.35 : -0.35) * (1 - k / 14));
// cut 1 -> walls and glass
whoosh(4.6, 0.8, {gain: 0.38, from: 250, to: 6000, pan: -0.7, panTo: 0.7});
[5.4, 5.9, 6.4].forEach((t, k) => whoosh(t, 0.45, {gain: 0.2, from: 400, to: 2500, pan: -0.6 + k * 0.6}));
glassSweep(6.2, 1.6, 0.06);
// balconies: staggered air pushes
[7.9, 8.2, 8.5, 8.8, 9.1].forEach((t, k) => whoosh(t, 0.35, {gain: 0.16, from: 600, to: 3500, pan: k % 2 ? 0.5 : -0.5}));
// materials -> lighting riser
whoosh(8.8, 1.2, {gain: 0.32, from: 200, to: 8000, shape: 'up', q: 1.2});
swell(10.0, 1.4, 0.3);
// 10s light-up hit
boom(10.0, 0.75, 26, 3.0);
powerOn(9.9, 1.6, 0.1);
glassSweep(10.05, 0.9, 0.05, [81, 84, 86, 89, 93, 96]);
bell(10.0, 62, 0.12, {ratio: 1, index: 2.2, decay: 2, send: 1});
// orbit: wind passes
whoosh(11.2, 1.8, {gain: 0.18, from: 300, to: 1800, pan: 0.8, panTo: -0.8, q: 1});
whoosh(12.8, 1.4, {gain: 0.15, from: 300, to: 1500, pan: -0.6, panTo: 0.6, q: 1});
// final resolve
boom(14.0, 0.8, 24, 1.0);
bell(14.0, 74, 0.08, {ratio: 2, index: 1.5, decay: 3, send: 1});

// ---------------------------------------------------------------- mix
function reverb(input) {
  const out = [new Float32Array(N), new Float32Array(N)];
  for (let ch = 0; ch < 2; ch++) {
    const acc = new Float32Array(N);
    for (const d0 of [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116]) {
      const d = Math.round((d0 + ch * 23) * 1.6); // big hall
      const buf = new Float32Array(d);
      let idx = 0;
      let lp = 0;
      for (let i = 0; i < N; i++) {
        const y = buf[idx];
        lp = y * 0.6 + lp * 0.4;
        buf[idx] = input[ch][i] + lp * 0.86;
        acc[i] += y;
        idx = (idx + 1) % d;
      }
    }
    let sig = acc;
    for (const d0 of [225, 556, 441, 341]) {
      const d = d0 + ch * 7;
      const buf = new Float32Array(d);
      let idx = 0;
      const o = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const bo = buf[idx];
        o[i] = -sig[i] * 0.5 + bo;
        buf[idx] = sig[i] + bo * 0.5;
        idx = (idx + 1) % d;
      }
      sig = o;
    }
    out[ch] = sig;
  }
  return out;
}
const wet = reverb(verb);
const L = new Float32Array(N);
const R = new Float32Array(N);
for (let i = 0; i < N; i++) {
  for (const [o, ch] of [[L, 0], [R, 1]]) o[i] = music[ch][i] * 0.9 + perc[ch][i] * 0.7 + sfx[ch][i] * 0.85 + wet[ch][i] * 0.06;
}
const fade = Math.floor(0.6 * SR);
for (let i = 0; i < fade; i++) {
  const g = Math.pow(1 - i / fade, 2);
  L[N - fade + i] *= g;
  R[N - fade + i] *= g;
}
let peak = 0;
for (let i = 0; i < N; i++) {
  L[i] = Math.tanh(L[i] * 1.1);
  R[i] = Math.tanh(R[i] * 1.1);
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = Math.pow(10, -1 / 20) / peak;
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0);
buf.writeUInt32LE(36 + N * 4, 4);
buf.write('WAVEfmt ', 8);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32);
buf.writeUInt16LE(16, 34);
buf.write('data', 36);
buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.round(clamp(L[i] * norm, -1, 1) * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(clamp(R[i] * norm, -1, 1) * 32767), 46 + i * 4);
}
fs.mkdirSync(path.join(root, 'public/building'), {recursive: true});
const outPath = path.join(root, 'public/building/soundtrack.wav');
const prePath = outPath.replace('.wav', '.pre.wav');
fs.writeFileSync(prePath, buf);
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', prePath, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=9,aresample=44100', '-c:a', 'pcm_s16le', outPath]);
fs.unlinkSync(prePath);
console.log(`wrote public/building/soundtrack.wav (${DUR}s)`);

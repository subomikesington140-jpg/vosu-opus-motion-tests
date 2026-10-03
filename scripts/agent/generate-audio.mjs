// Soundtrack for the AgentExplainer composition: warm music bed ducked under the
// Kokoro voiceover, plus UI / data sound design. Every hit is placed from
// src/agent/timeline.json and the VO word timings in src/agent/vo.json.
// Output: public/agent/soundtrack.wav (44.1 kHz, 16-bit stereo, -14 LUFS)

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = JSON.parse(fs.readFileSync(path.join(root, 'src/agent/timeline.json'), 'utf8'));
const VO = JSON.parse(fs.readFileSync(path.join(root, 'src/agent/vo.json'), 'utf8'));
const C = T.cues;
const W = (line, i) => T.vo[line] + VO[line].words[i].start;

const SR = 44100;
const DUR = T.durationInFrames / T.fps;
const N = Math.ceil(SR * DUR);

const bus = () => [new Float32Array(N), new Float32Array(N)];
const music = bus();
const perc = bus();
const sfx = bus();
const voice = bus();
const verb = bus();

let seed = 5;
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

/** Soft UI blip for labels: sine with a small pitch drop and a tick. */
function pop(t, midi = 84, g = 0.1, pan = 0) {
  const s = Math.floor(t * SR);
  const f0 = mtof(midi);
  const [pl, pr] = panLR(pan);
  let ph = 0;
  for (let i = 0; i < 0.14 * SR; i++) {
    const x = i / SR;
    ph += (2 * Math.PI * f0 * (1 + 0.3 * Math.exp(-x * 70))) / SR;
    const v = (Math.sin(ph) * Math.exp(-x * 30) + (i < 30 ? noise() * 0.15 * (1 - i / 30) : 0)) * g;
    write(sfx, s + i, v * pl, v * pr);
    write(verb, s + i, v * 0.35);
  }
}

// ---------------------------------------------------------------- music (F major, 100 BPM, light and curious)
const BEAT = 0.6;
const BAR = BEAT * 4;
const CH = [
  {root: 41, notes: [65, 69, 72, 76]}, // Fmaj7
  {root: 45, notes: [64, 67, 69, 72]}, // Am7
  {root: 38, notes: [62, 65, 69, 76]}, // Dm9
  {root: 46, notes: [62, 65, 69, 74]}, // Bbmaj7
];
const bars = Math.ceil(C.summary / BAR);
for (let b = 0; b < bars; b++) {
  const ch = CH[b % 4];
  const t0 = b * BAR;
  const intro = t0 < T.vo.need - 0.2;
  ch.notes.forEach((m, j) => saw(t0, BAR, m - 12, {gain: 0.022, cutoff: intro ? 500 : 800, cutoffTo: intro ? 800 : 1000, attack: 0.5, voices: 4, detune: 0.2, pan: (j - 1.5) * 0.4, send: 0.6, release: 0.6}));
  // soft plucked arpeggio
  const pat = [0, 2, 1, 3, 2, 1, 3, 2];
  for (let k = 0; k < 8; k++) {
    if (intro && k % 2) continue;
    saw(t0 + k * (BEAT / 2), 0.12, ch.notes[pat[k]] + (k >= 4 ? 12 : 0), {gain: 0.03, cutoff: 600, env: 2600, decay: 26, voices: 2, detune: 0.06, pan: k % 2 ? 0.45 : -0.45, send: 0.45, release: 0.25});
  }
  if (!intro) {
    sine(t0, BAR - 0.1, ch.root - 12, 0.1, 0.05);
    for (let k = 0; k < 4; k++) {
      softKick(t0 + k * BEAT, k % 2 ? 0.18 : 0.32);
      shaker(t0 + k * BEAT + BEAT / 2, 0.05);
    }
  }
}
// resolve: Fadd9 under the summary
[53, 60, 65, 67, 69, 72, 79].forEach((m, j) => saw(C.summary, DUR - C.summary, m, {gain: 0.026, cutoff: 900, cutoffTo: 1400, attack: 0.2, voices: 4, detune: 0.18, pan: (j - 3) * 0.25, send: 0.8, release: 1.2}));
sine(C.summary, DUR - C.summary, 29, 0.12, 0.05);

function softKick(t, g) {
  const s = Math.floor(t * SR);
  let ph = 0;
  for (let i = 0; i < 0.3 * SR; i++) {
    const x = i / SR;
    ph += (2 * Math.PI * (52 + 70 * Math.exp(-x * 40))) / SR;
    write(perc, s + i, Math.sin(ph) * Math.exp(-x * 11) * g);
  }
}
function shaker(t, g) {
  const s = Math.floor(t * SR);
  const hp = new Biquad();
  hp.set('hp', 7000, 0.8);
  for (let i = 0; i < 0.06 * SR; i++) {
    const x = i / SR;
    const v = hp.run(noise()) * Math.min(1, x / 0.01) * Math.exp(-x * 60) * g;
    write(perc, s + i, v * 0.8, v);
  }
}
/** Short mechanical click (a request being sent). */
function click(t, g = 0.3) {
  const s0 = Math.floor(t * SR);
  const hp = new Biquad();
  hp.set('hp', 2200, 0.7);
  for (let i = 0; i < 0.04 * SR; i++) {
    const x = i / SR;
    const v = hp.run(noise()) * (Math.exp(-x * 900) + (x > 0.018 ? Math.exp(-(x - 0.018) * 900) * 0.5 : 0)) * g;
    write(sfx, s0 + i, v * 0.6, v);
  }
}
/** Two-tone data blip. */
function blip(t, up = true, g = 0.06, pan = 0) {
  const [a, b] = up ? [88, 95] : [95, 88];
  bell(t, a, g, {ratio: 2, index: 0.6, decay: 22, pan, send: 0.3});
  bell(t + 0.06, b, g, {ratio: 2, index: 0.6, decay: 18, pan, send: 0.3});
}

// ---------------------------------------------------------------- sound design
const ACT = [W('tools', 8), W('tools', 10), W('tools', 13)].map((t) => t - 0.3);
const STEP_IN = [W('plan', 4), W('plan', 5), W('plan', 6)].map((t) => t - 0.15);
const TAG_IN = [W('need', 2), W('need', 4), W('need', 7)].map((t) => t - 0.1);
const TOOLS_IN = W('tools', 4);
const TOG = T.vo.together;
const RES = W('result', 3);

pop(0.15, 79, 0.05);
const chars = 'Plan a weekend in Lisbon under $800'.length;
for (let k = 0; k < chars; k++) {
  const t = C.typeStart + (k / chars) * (C.typeEnd - C.typeStart);
  if ('Plan a weekend in Lisbon under $800'[k] !== ' ') tick(t, 0.035 + rnd() * 0.02, 0.2 + (rnd() - 0.5) * 0.3, 2600 + rnd() * 1800);
}
pop(C.send, 72, 0.12, 0.2);
whoosh(C.dotLaunch, C.dotArrive - C.dotLaunch, {gain: 0.12, from: 600, to: 3500, shape: 'up', pan: -0.4, panTo: 0.3, q: 2});
// agent wakes
bell(C.dotArrive, 77, 0.08, {ratio: 1, index: 1.4, decay: 3, send: 0.9});
bell(C.dotArrive + 0.08, 84, 0.05, {ratio: 2, index: 1, decay: 3.5, send: 0.9});
sine(C.dotArrive, 0.5, 41, 0.12, 0.01);
TAG_IN.forEach((t, i) => pop(t, 84 + i * 3, 0.07, [-0.5, 0.4, -0.1][i]));
// planning = deciding: soft draft ideas, a scan weighs them, two are rejected, three are kept
const THINK = C.think;
const REJECT = W('plan', 4) - 0.05;
for (let i = 0; i < 5; i++) bell(THINK + 0.05 + i * 0.09, [86, 89, 84, 91, 88][i], 0.022, {ratio: 3, index: 0.5, decay: 9, pan: i % 2 ? 0.4 : -0.1, send: 0.9});
whoosh(THINK + 0.3, REJECT - THINK - 0.2, {gain: 0.07, from: 900, to: 2600, shape: 'up', q: 3});
for (const pan of [0.35, 0.55]) {
  pop(REJECT + (pan > 0.4 ? 0.06 : 0), 67, 0.07, pan);
  whoosh(REJECT + 0.45, 0.4, {gain: 0.06, from: 1800, to: 400, shape: 'down', pan});
}
STEP_IN.forEach((t, i) => pop(t + 0.15, 79 + [0, 4, 7][i], 0.09, 0.3));
bell(STEP_IN[2] + 0.55, 91, 0.03, {ratio: 2, index: 0.8, decay: 6, send: 0.8}); // plan ready
// tools = external actions: boundary, request typed, process runs, done
whoosh(TOOLS_IN - 0.35, 0.5, {gain: 0.08, from: 400, to: 1600, pan: 0.5});
for (let i = 0; i < 3; i++) tick(TOOLS_IN + 0.15 + i * 0.08, 0.04, 0.5, 3600);
ACT.forEach((t, i) => {
  click(t - 0.05, 0.25);
  for (let k = 0; k < 6; k++) tick(t - 0.05 + k * 0.05, 0.025, 0.6, 2800 + rnd() * 1500);
  for (let k = 0; k < 10; k++) tick(t + 0.25 + k * 0.03, 0.03, 0.6, 1800 + k * 160);
  bell(t + 0.55, 93, 0.045, {ratio: 2, index: 0.7, decay: 12, pan: 0.6, send: 0.4});
  pop(t + 0.8, 86 + i * 2, 0.06, 0.1);
});
// results converge into one answer
whoosh(TOG - 0.1, 0.8, {gain: 0.14, from: 3000, to: 500, shape: 'down', pan: 0.4, panTo: -0.1, q: 1.5});
pop(TOG + 0.45, 72, 0.1);
for (let i = 0; i < 3; i++) tick(TOG + 0.7 + i * 0.16, 0.04, 0, 3000 + i * 400);
for (let k = 0; k < 8; k++) tick(TOG + 1.45 + k * 0.08, 0.02, 0, 5200);
bell(RES, 84, 0.07, {ratio: 1, index: 1.2, decay: 2.5, send: 1});
bell(RES + 0.07, 88, 0.06, {ratio: 1, index: 1.2, decay: 2.5, send: 1});
bell(RES + 0.14, 91, 0.05, {ratio: 1, index: 1.2, decay: 2.5, send: 1});
// summary pull-back
whoosh(C.summary - 0.1, 1.2, {gain: 0.14, from: 400, to: 4000, shape: 'swish', q: 1.2});
bell(C.title, 77, 0.05, {ratio: 2, index: 1, decay: 2, send: 1});

// ---------------------------------------------------------------- voiceover
function readWav(file) {
  const b = fs.readFileSync(file);
  let o = 12;
  let data = null;
  let rate = 0;
  while (o < b.length) {
    const id = b.toString('ascii', o, o + 4);
    const size = b.readUInt32LE(o + 4);
    if (id === 'fmt ') rate = b.readUInt32LE(o + 12);
    if (id === 'data') data = b.subarray(o + 8, o + 8 + size);
    o += 8 + size + (size % 2);
  }
  if (rate !== SR) throw new Error(`${file}: expected ${SR} Hz`);
  const out = new Float32Array(data.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = data.readInt16LE(i * 2) / 32768;
  return out;
}
const voEnv = new Float32Array(N);
for (const [key, start] of Object.entries(T.vo)) {
  const pcm = readWav(path.join(root, `public/agent/vo/${key}.wav`));
  const s = Math.floor(start * SR);
  for (let i = 0; i < pcm.length; i++) {
    write(voice, s + i, pcm[i]);
    write(verb, s + i, pcm[i] * 0.03);
    if (s + i < N) voEnv[s + i] = Math.max(voEnv[s + i], Math.abs(pcm[i]));
  }
}
const duck = new Float32Array(N);
{
  const look = Math.floor(0.05 * SR);
  const hold = Math.exp(-1 / (0.15 * SR));
  const att = Math.exp(-1 / (0.05 * SR));
  const rel = Math.exp(-1 / (0.4 * SR));
  let pk = 0;
  let y = 0;
  for (let i = 0; i < N; i++) {
    pk = Math.max(voEnv[Math.min(N - 1, i + look)], pk * hold);
    const x = pk > 0.03 ? 1 : 0;
    y = x > y ? att * y + (1 - att) * x : rel * y + (1 - rel) * x;
    duck[i] = y;
  }
}

// ---------------------------------------------------------------- mix
function reverb(input) {
  const out = [new Float32Array(N), new Float32Array(N)];
  for (let ch = 0; ch < 2; ch++) {
    const acc = new Float32Array(N);
    for (const d0 of [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116]) {
      const d = Math.round((d0 + ch * 23) * 1.2); // medium room
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
  const md = 1 - 0.55 * duck[i];
  for (const [o, ch] of [[L, 0], [R, 1]]) o[i] = (music[ch][i] * 0.9 + perc[ch][i] * 0.6) * md + sfx[ch][i] * 0.8 * (1 - 0.3 * duck[i]) + voice[ch][i] * 1.6 + wet[ch][i] * 0.06;
}
const fade = Math.floor(0.4 * SR);
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
fs.mkdirSync(path.join(root, 'public/agent'), {recursive: true});
const outPath = path.join(root, 'public/agent/soundtrack.wav');
const prePath = outPath.replace('.wav', '.pre.wav');
fs.writeFileSync(prePath, buf);
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', prePath, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=9,aresample=44100', '-c:a', 'pcm_s16le', outPath]);
fs.unlinkSync(prePath);
console.log(`wrote public/agent/soundtrack.wav (${DUR}s)`);

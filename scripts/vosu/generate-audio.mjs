// VOSU promo soundtrack: synthesized music + UI sound design + voiceover mix.
// Every hit is placed from src/vosu/timeline.json and the VO word timings in
// src/vosu/vo.json, the same cue sheet the picture reads.
// Output: public/vosu/soundtrack.wav (44.1 kHz, 16-bit stereo)

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = JSON.parse(fs.readFileSync(path.join(root, 'src/vosu/timeline.json'), 'utf8'));
const VO = JSON.parse(fs.readFileSync(path.join(root, 'src/vosu/vo.json'), 'utf8'));
const C = T.cues;

const SR = 44100;
const DUR = T.durationInFrames / T.fps;
const N = Math.ceil(SR * DUR);
const BEAT = 60 / T.bpm;
const b2s = (b) => b * BEAT;
const f2s = (f) => f / T.fps;
const wordAt = (k) => {
  const [line, i] = T.words[k];
  return T.vo[line] + VO[line].words[i].start;
};

// ---------------------------------------------------------------- buses
const bus = () => [new Float32Array(N), new Float32Array(N)];
const drums = bus();
const music = bus(); // ducked by kick and by VO
const sfx = bus(); // lightly ducked by VO
const voice = bus();
const verb = bus();

let seed = 7;
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
const kicks = [];
function kick(t, g = 1) {
  kicks.push(t);
  const s = Math.floor(t * SR);
  let ph = 0;
  for (let i = 0; i < 0.4 * SR; i++) {
    const x = i / SR;
    ph += (2 * Math.PI * (48 + 110 * Math.exp(-x * 32))) / SR;
    const v = Math.tanh(Math.sin(ph) * 1.4) * Math.exp(-x * 8) * 0.85 + (i < 60 ? noise() * 0.2 * (1 - i / 60) : 0);
    write(drums, s + i, v * g);
  }
}
function clap(t, g = 1) {
  const s = Math.floor(t * SR);
  const bp = new Biquad();
  bp.set('bp', 1600, 1.2);
  for (let i = 0; i < 0.3 * SR; i++) {
    const x = i / SR;
    const fl = [0, 0.01, 0.02].reduce((a, o) => a + (x >= o ? Math.exp(-(x - o) * 200) : 0), 0);
    const v = bp.run(noise()) * (fl * 0.55 + Math.exp(-x * 18) * 0.45) * 2 * g;
    write(drums, s + i, v * 0.9, v);
    write(verb, s + i, v * 0.4);
  }
}
function hat(t, g = 1, pan = 0.25, open = false) {
  const s = Math.floor(t * SR);
  const hp = new Biquad();
  hp.set('hp', 8500, 0.8);
  const [l, r] = panLR(pan);
  for (let i = 0; i < (open ? 0.2 : 0.045) * SR; i++) {
    const v = hp.run(noise()) * Math.exp((-i / SR) * (open ? 16 : 95)) * 0.3 * g;
    write(drums, s + i, v * l, v * r);
  }
}
function saw(t, dur, midi, o = {}) {
  const {gain = 0.2, cutoff = 1200, env = 2000, decay = 6, attack = 0.005, detune = 0.12, voices = 3, pan = 0, send = 0.2, q = 0.9, release = 0.3} = o;
  const s = Math.floor(t * SR);
  const fl = new Biquad();
  const fr = new Biquad();
  const ph = Array.from({length: voices * 2}, () => rnd());
  const base = mtof(midi);
  const [pl, pr] = panLR(pan);
  for (let i = 0; i < (dur + release) * SR; i++) {
    const x = i / SR;
    const amp = Math.min(1, x / attack) * (x < dur ? 1 : Math.exp(-(x - dur) * (4 / release)));
    if (i % 32 === 0) {
      const fc = cutoff + env * Math.exp(-x * decay);
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
    write(music, s + i, l * pl * 1.4, r * pr * 1.4);
    write(verb, s + i, l * send, r * send);
  }
}
function sub(t, dur, midi, g = 0.3) {
  const s = Math.floor(t * SR);
  const f = mtof(midi);
  for (let i = 0; i < (dur + 0.08) * SR; i++) {
    const x = i / SR;
    const env = Math.min(1, x / 0.008) * (x < dur ? 1 : Math.exp(-(x - dur) * 50));
    write(music, s + i, Math.sin(2 * Math.PI * f * x) * env * g);
  }
}
function bell(t, midi, g = 0.2, o = {}) {
  const {ratio = 3.5, index = 3, decay = 6, pan = 0, send = 0.5, bus: b = sfx} = o;
  const s = Math.floor(t * SR);
  const f = mtof(midi);
  const [pl, pr] = panLR(pan);
  for (let i = 0; i < 1.5 * SR; i++) {
    const x = i / SR;
    const env = Math.exp(-x * decay) * Math.min(1, x / 0.002);
    const v = Math.sin(2 * Math.PI * f * x + Math.sin(2 * Math.PI * f * ratio * x) * index * Math.exp(-x * decay * 1.4)) * env * g;
    write(b, s + i, v * pl, v * pr);
    write(verb, s + i, v * send);
  }
}
function whoosh(t, dur, o = {}) {
  const {gain = 0.4, from = 300, to = 6000, shape = 'swish', pan = 0, panTo = pan, q = 2} = o;
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
// soft UI "pop": a short sine blip with a pitch drop and a tiny noise transient
function pop(t, midi = 84, g = 0.18, pan = 0) {
  const s = Math.floor(t * SR);
  const f0 = mtof(midi);
  const [pl, pr] = panLR(pan);
  let ph = 0;
  for (let i = 0; i < 0.12 * SR; i++) {
    const x = i / SR;
    ph += (2 * Math.PI * f0 * (1 + 0.5 * Math.exp(-x * 60))) / SR;
    const v = (Math.sin(ph) * Math.exp(-x * 38) + (i < 40 ? noise() * 0.3 * (1 - i / 40) : 0)) * g;
    write(sfx, s + i, v * pl, v * pr);
    write(verb, s + i, v * 0.2);
  }
}
// mouse click: two tight transients
function click(t, g = 0.5) {
  const s = Math.floor(t * SR);
  const hp = new Biquad();
  hp.set('hp', 2500, 0.7);
  for (let i = 0; i < 0.05 * SR; i++) {
    const x = i / SR;
    const v = hp.run(noise()) * (Math.exp(-x * 900) + (x > 0.028 ? Math.exp(-(x - 0.028) * 900) * 0.6 : 0)) * g;
    write(sfx, s + i, v);
  }
}
function tick(t, g = 0.08, pan = 0) {
  const s = Math.floor(t * SR);
  const [pl, pr] = panLR(pan);
  for (let i = 0; i < 0.01 * SR; i++) {
    const v = Math.sin((2 * Math.PI * 4200 * i) / SR) * Math.exp((-i / SR) * 600) * g;
    write(sfx, s + i, v * pl, v * pr);
  }
}
function shimmer(t, dur, g = 0.1) {
  const notes = [77, 81, 84, 88, 89, 93, 96];
  const n = Math.floor(dur * 26);
  for (let k = 0; k < n; k++) bell(t + (k / n) * dur, notes[k % notes.length], g * (1 - k / n), {ratio: 2.01, index: 1.1, decay: 14, pan: (rnd() - 0.5) * 1.4, send: 0.9});
}
function swell(tEnd, dur, g = 0.3) {
  const s = Math.floor((tEnd - dur) * SR);
  const hp = new Biquad();
  hp.set('hp', 2500, 0.7);
  for (let i = 0; i < dur * SR; i++) {
    const e = Math.pow(i / (dur * SR), 3) * g;
    const l = hp.run(noise()) * e;
    write(sfx, s + i, l, l * 0.7 + noise() * e * 0.2);
  }
}
function boom(t, g = 0.6, midi = 29) {
  const s = Math.floor(t * SR);
  let ph = 0;
  for (let i = 0; i < 1.6 * SR; i++) {
    const x = i / SR;
    ph += (2 * Math.PI * mtof(midi) * (1 + 0.8 * Math.exp(-x * 10))) / SR;
    write(sfx, s + i, Math.sin(ph) * Math.exp(-x * 2.6) * g);
  }
}

// ---------------------------------------------------------------- music (F major, 120 BPM)
// bars of 2s: Dm | Bb | F | C | Dm | Bb | C | F
const CHORDS = [
  {root: 38, notes: [62, 65, 69, 72]}, // Dm7
  {root: 34, notes: [62, 65, 69, 70]}, // Bbmaj7
  {root: 41, notes: [60, 65, 69, 72]}, // F
  {root: 36, notes: [60, 64, 67, 70]}, // C7sus-ish
  {root: 38, notes: [62, 65, 69, 72]},
  {root: 34, notes: [62, 65, 69, 74]},
  {root: 36, notes: [60, 64, 67, 72]},
  {root: 41, notes: [60, 65, 69, 76]}, // Fadd9 resolve
];
CHORDS.forEach((ch, bar) => {
  const t0 = b2s(bar * 4);
  const intro = bar === 0;
  // warm pad
  ch.notes.forEach((m, j) =>
    saw(t0, b2s(4) - 0.05, m - 12, {gain: intro ? 0.035 : 0.045, cutoff: intro ? 500 : 1100, env: 0, attack: intro ? 1.2 : 0.25, voices: 3, detune: 0.18, pan: (j - 1.5) * 0.35, send: 0.5, release: 0.4}),
  );
  if (bar === 7) return; // the last bar is the held end chord (below)
  // pluck arpeggio in 16ths (sparser in the intro)
  const pattern = [0, 1, 2, 3, 2, 1, 2, 3];
  for (let k = 0; k < 16; k++) {
    if (intro && k % 2) continue;
    const m = ch.notes[pattern[k % 8]] + (k % 8 >= 4 ? 12 : 0);
    saw(t0 + b2s(k * 0.25), b2s(0.2), m, {gain: intro ? 0.05 : 0.07, cutoff: 500, env: 3800, decay: 22, voices: 2, detune: 0.08, pan: k % 2 ? 0.4 : -0.4, send: 0.35, release: 0.15});
  }
  if (!intro) {
    for (let k = 0; k < 8; k++) sub(t0 + b2s(k * 0.5), b2s(0.42), ch.root - 12, 0.22);
  }
});
// final held chord on the end card
CHORDS[7].notes.forEach((m, j) => saw(f2s(C.finalChord), 1.0, m, {gain: 0.05, cutoff: 900, env: 2500, decay: 3, voices: 3, detune: 0.15, pan: (j - 1.5) * 0.4, send: 0.7, release: 0.6}));
sub(f2s(C.finalChord), 0.9, 29, 0.28);

// drums: soft heartbeat intro, groove from bar 1, a breath before the end card
for (let b = 0; b < 4; b++) kick(b2s(b), 0.3 + b * 0.08);
for (let b = 4; b < 26; b++) kick(b2s(b), 0.85);
for (let b = 5; b < 26; b += 2) clap(b2s(b), 0.55);
for (let k = 8; k < 52; k++) hat(b2s(k * 0.5 + 0.25), k % 2 ? 0.5 : 0.35, k % 2 ? 0.3 : -0.2);
for (let k = 0; k < 8; k++) hat(b2s(26 + k * 0.25), 0.25 + k * 0.05, 0.2); // build into the end card
kick(f2s(C.finalChord), 0.9);

// ---------------------------------------------------------------- sound design
// 1. Logo: rising swell, a tonal pop per letter, glint, fly-through the star
swell(f2s(C.letters[0]), 1.0, 0.18);
C.letters.forEach((f, i) => {
  pop(f2s(f), 72 + [0, 4, 7, 12][i], 0.2, (i - 1.5) * 0.4);
  whoosh(f2s(f) - 0.12, 0.18, {gain: 0.12, from: 2000, to: 7000, shape: 'up'});
});
shimmer(f2s(C.glint), 0.5, 0.06);
whoosh(f2s(C.zoomThrough), f2s(18), {gain: 0.45, from: 200, to: 5000, shape: 'up', q: 1.4});
boom(f2s(C.zoomThrough + 17), 0.4, 33);

// 2. Studio: element pops, typing ticks, a tone per category word, card whooshes
pop(f2s(47), 79, 0.1);
pop(wordAt('studio'), 82, 0.13, -0.6); // Studios pill
for (let f = C.typeOn; f < C.typeOn + 16; f += 1.5) tick(f2s(f), 0.05 + rnd() * 0.04, (rnd() - 0.5) * 0.4);
['video', 'image', 'audio', 'threeD'].forEach((w, i) => {
  pop(wordAt(w), [84, 86, 88, 91][i], 0.14, [-0.5, -0.4, 0.4, 0.5][i]);
  whoosh(wordAt(w) - 0.15, 0.4, {gain: 0.16, from: 600, to: 4000, pan: i < 2 ? -0.6 : 0.6});
});
whoosh(f2s(141), 0.42, {gain: 0.5, from: 300, to: 6500, pan: 0.8, panTo: -0.8, q: 1.6}); // whip pan

// 3. Nodes: a pop per node, signal blips, glow on the video node
C.nodePops.forEach((f, i) => pop(f2s(f), [79, 83, 86, 88][i], 0.13, -0.5 + i * 0.25));
pop(wordAt('cinematic'), 91, 0.15, 0.4);
shimmer(wordAt('cinematic') + 0.05, 0.35, 0.05);
for (let k = 0; k < 6; k++) tick(f2s(196 + k * 3), 0.05, 0.3);
whoosh(f2s(229), 0.5, {gain: 0.45, from: 400, to: 6000, shape: 'swish', q: 1.6});

// 4. Tools: cascade ticks, push-in, the click
for (let k = 0; k < 7; k++) pop(f2s(C.toolsCascade + k * 2.5), 86 + (k % 3) * 2, 0.08, (k % 4) / 2 - 0.75);
whoosh(f2s(C.toolsPush), 0.45, {gain: 0.3, from: 300, to: 3000, shape: 'up'});
click(wordAt('click'), 0.55);
bell(wordAt('click') + 0.02, 88, 0.08, {ratio: 2, index: 1, decay: 8});
whoosh(f2s(304), 0.55, {gain: 0.4, from: 300, to: 5000, shape: 'up', q: 1.4});

// 5. Market: build pops, sparkle on "Get Paid", button press, card whooshes
[318, 322, 327, 332, 336, 341].forEach((f, i) => pop(f2s(f), 76 + i * 2, 0.09, -0.4));
shimmer(f2s(327), 0.4, 0.05);
[326, 330, 334, 338].forEach((f, i) => whoosh(f2s(f) - 0.1, 0.4, {gain: 0.14, from: 800, to: 4500, pan: i % 2 ? 0.7 : -0.2}));
pop(wordAt('creator'), 91, 0.1, -0.5);
click(f2s(C.buttonPress), 0.5);
bell(f2s(C.buttonPress) + 0.02, 84, 0.07, {ratio: 2, index: 1, decay: 8});
swell(f2s(C.endBloom), 0.9, 0.3);
whoosh(f2s(C.endBloom) - 0.6, 0.62, {gain: 0.4, from: 300, to: 8000, shape: 'up', q: 1.2});

// 6. End card: bright bloom, logo pops, final chord glint
bell(f2s(C.endBloom), 77, 0.12, {ratio: 1, index: 2, decay: 2.2, send: 1});
boom(f2s(C.endBloom), 0.3, 29);
[0, 2, 4, 6].forEach((d, i) => pop(f2s(C.endBloom + 2 + d), 79 + [0, 4, 7, 12][i], 0.1, (i - 1.5) * 0.4));
shimmer(f2s(C.finalGlint), 0.6, 0.06);

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
  const pcm = readWav(path.join(root, `public/vosu/vo/${key}.wav`));
  const s = Math.floor(start * SR);
  for (let i = 0; i < pcm.length; i++) {
    write(voice, s + i, pcm[i] * 0.95);
    write(verb, s + i, pcm[i] * 0.05); // a touch of room
    if (s + i < N) voEnv[s + i] = Math.max(voEnv[s + i], Math.abs(pcm[i]));
  }
}

// ---------------------------------------------------------------- mix
// VO ducking: smooth envelope follower (fast attack, slow release)
const voDuck = new Float32Array(N);
{
  // peak-hold follower -> gate -> attack/release smoothing, shifted 40 ms early
  const look = Math.floor(0.04 * SR);
  const hold = Math.exp(-1 / (0.12 * SR));
  const att = Math.exp(-1 / (0.03 * SR));
  const rel = Math.exp(-1 / (0.3 * SR));
  let pk = 0;
  let y = 0;
  for (let i = 0; i < N; i++) {
    pk = Math.max(voEnv[Math.min(N - 1, i + look)], pk * hold);
    const x = pk > 0.03 ? 1 : 0;
    y = x > y ? att * y + (1 - att) * x : rel * y + (1 - rel) * x;
    voDuck[i] = y;
  }
}
const kickDuck = new Float32Array(N).fill(1);
for (const t of kicks) {
  const s = Math.floor(t * SR);
  for (let i = 0; i < 0.25 * SR && s + i < N; i++) kickDuck[s + i] = Math.min(kickDuck[s + i], 1 - 0.5 * Math.exp((-i / SR) * 16));
}
function reverb(input) {
  const out = [new Float32Array(N), new Float32Array(N)];
  for (let ch = 0; ch < 2; ch++) {
    const acc = new Float32Array(N);
    for (const d0 of [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116]) {
      const d = d0 + ch * 23;
      const buf = new Float32Array(d);
      let idx = 0;
      let lp = 0;
      for (let i = 0; i < N; i++) {
        const y = buf[idx];
        lp = y * 0.7 + lp * 0.3;
        buf[idx] = input[ch][i] + lp * 0.82;
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
  const md = (1 - 0.72 * voDuck[i]) * kickDuck[i];
  const dd = 1 - 0.5 * voDuck[i];
  const sd = 1 - 0.4 * voDuck[i];
  for (const [o, ch] of [[L, 0], [R, 1]]) {
    o[i] = drums[ch][i] * 0.75 * dd + music[ch][i] * md + sfx[ch][i] * 0.85 * sd + voice[ch][i] * 1.6 + wet[ch][i] * 0.07;
  }
}
const fade = Math.floor(0.22 * SR);
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
const outPath = path.join(root, 'public/vosu/soundtrack.wav');
const prePath = outPath.replace('.wav', '.pre.wav');
fs.writeFileSync(prePath, buf);
// master to the -14 LUFS web/social standard with a -1.5 dBTP ceiling
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', prePath, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=9,aresample=44100', '-c:a', 'pcm_s16le', outPath]);
fs.unlinkSync(prePath);
console.log(`wrote public/vosu/soundtrack.wav (${DUR.toFixed(2)}s)`);

// report: voice vs. bed level while the VO is speaking (target: voice >= +8 dB over bed)
{
  let v = 0;
  let bed = 0;
  let n = 0;
  for (let i = 0; i < N; i++) {
    if (voDuck[i] < 0.9) continue;
    const md = (1 - 0.72 * voDuck[i]) * kickDuck[i];
    const b = drums[0][i] * 0.75 * (1 - 0.5 * voDuck[i]) + music[0][i] * md + sfx[0][i] * 0.85 * (1 - 0.4 * voDuck[i]);
    v += (voice[0][i] * 1.6) ** 2;
    bed += b * b;
    n++;
  }
  console.log(`VO over bed while speaking: ${(10 * Math.log10(v / bed)).toFixed(1)} dB`);
}

// Synthesizes the reel's soundtrack + sound design from scratch (no samples).
// Every hit is placed from src/timeline.json so picture and sound share one cue sheet.
// Output: public/audio/soundtrack.wav (44.1 kHz, 16-bit stereo)

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = JSON.parse(fs.readFileSync(path.join(root, 'src/timeline.json'), 'utf8'));
const C = T.cues;

const SR = 44100;
const DURATION = T.durationInFrames / T.fps;
const N = Math.ceil(SR * DURATION);
const BEAT = 60 / T.bpm;
const b2s = (b) => b * BEAT;

// ---------------------------------------------------------------- buses
const bus = () => [new Float32Array(N), new Float32Array(N)];
const drums = bus(); // never ducked
const music = bus(); // ducked by the kick (sidechain)
const sfx = bus(); // whooshes, risers, impacts
const verbSend = bus(); // shared reverb send

// ---------------------------------------------------------------- utils
let seed = 1337;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const noise = () => rnd() * 2 - 1;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

const write = (b, i, l, r = l) => {
  if (i < 0 || i >= N) return;
  b[0][i] += l;
  b[1][i] += r;
};
const panLR = (p) => [Math.cos((p + 1) * Math.PI / 4), Math.sin((p + 1) * Math.PI / 4)];

// RBJ biquad with per-sample coefficient updates (for sweeps)
class Biquad {
  constructor() {
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
  }
  set(type, f, q) {
    const w = 2 * Math.PI * clamp(f, 10, SR * 0.45) / SR;
    const cs = Math.cos(w);
    const a = Math.sin(w) / (2 * q);
    let b0, b1, b2;
    if (type === 'lp') [b0, b1, b2] = [(1 - cs) / 2, 1 - cs, (1 - cs) / 2];
    else if (type === 'hp') [b0, b1, b2] = [(1 + cs) / 2, -(1 + cs), (1 + cs) / 2];
    else [b0, b1, b2] = [a, 0, -a]; // band-pass (0 dB peak)
    const a0 = 1 + a;
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = (-2 * cs) / a0;
    this.a2 = (1 - a) / a0;
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
const kickTimes = [];

function kick(t, gain = 1, {tone = 1, len = 0.45} = {}) {
  kickTimes.push(t);
  const s = Math.floor(t * SR);
  let ph = 0;
  for (let i = 0; i < len * SR; i++) {
    const x = i / SR;
    const f = 45 * tone + 140 * tone * Math.exp(-x * 28);
    ph += (2 * Math.PI * f) / SR;
    const env = Math.exp(-x * 7.5);
    const click = i < 90 ? noise() * 0.35 * (1 - i / 90) : 0;
    const v = Math.tanh(Math.sin(ph) * 1.6) * env * 0.9 + click;
    write(drums, s + i, v * gain);
  }
}

function clap(t, gain = 1) {
  const s = Math.floor(t * SR);
  const bp = new Biquad();
  bp.set('bp', 1400, 1.1);
  for (let i = 0; i < 0.35 * SR; i++) {
    const x = i / SR;
    // three quick flams then a tail
    const fl = [0, 0.011, 0.022].reduce((acc, o) => acc + (x >= o ? Math.exp(-(x - o) * 180) : 0), 0);
    const env = fl * 0.6 + Math.exp(-x * 16) * 0.5;
    const v = bp.run(noise()) * env * 2.2 * gain;
    write(drums, s + i, v * 0.9, v);
    write(verbSend, s + i, v * 0.35);
  }
}

function hat(t, gain = 1, open = false, pan = 0.25) {
  const s = Math.floor(t * SR);
  const hp = new Biquad();
  hp.set('hp', 8000, 0.8);
  const [l, r] = panLR(pan);
  const len = open ? 0.22 : 0.05;
  for (let i = 0; i < len * SR; i++) {
    const x = i / SR;
    const env = Math.exp(-x * (open ? 18 : 90));
    const v = hp.run(noise()) * env * 0.38 * gain;
    write(drums, s + i, v * l, v * r);
  }
}

function snare(t, gain = 1) {
  const s = Math.floor(t * SR);
  const hp = new Biquad();
  hp.set('hp', 1800, 0.7);
  let ph = 0;
  for (let i = 0; i < 0.18 * SR; i++) {
    const x = i / SR;
    ph += (2 * Math.PI * (190 + 60 * Math.exp(-x * 40))) / SR;
    const v = (hp.run(noise()) * Math.exp(-x * 22) * 0.7 + Math.sin(ph) * Math.exp(-x * 30) * 0.4) * gain;
    write(drums, s + i, v);
    write(verbSend, s + i, v * 0.25);
  }
}

// Supersaw-ish voice with a filter envelope
function saw(t, dur, midi, {gain = 0.2, cutoff = 1200, envAmt = 2000, decay = 6, attack = 0.005, detune = 0.12, voices = 3, pan = 0, verb = 0.2, q = 0.9} = {}) {
  const s = Math.floor(t * SR);
  const len = Math.floor((dur + 0.3) * SR);
  const fl = new Biquad();
  const fr = new Biquad();
  const phases = Array.from({length: voices * 2}, () => rnd());
  const base = mtof(midi);
  const [pl, pr] = panLR(pan);
  for (let i = 0; i < len; i++) {
    const x = i / SR;
    const gate = x < dur ? 1 : Math.exp(-(x - dur) * 18);
    const amp = Math.min(1, x / attack) * gate;
    const fc = cutoff + envAmt * Math.exp(-x * decay);
    if (i % 32 === 0) {
      fl.set('lp', fc, q);
      fr.set('lp', fc * 1.03, q);
    }
    let l = 0;
    let r = 0;
    for (let v = 0; v < voices; v++) {
      const d = voices === 1 ? 0 : (v / (voices - 1) - 0.5) * detune;
      const fL = base * Math.pow(2, d / 12);
      const fR = base * Math.pow(2, -d / 12);
      phases[v] = (phases[v] + fL / SR) % 1;
      phases[v + voices] = (phases[v + voices] + fR / SR) % 1;
      l += phases[v] * 2 - 1;
      r += phases[v + voices] * 2 - 1;
    }
    l = fl.run(l / voices) * amp * gain;
    r = fr.run(r / voices) * amp * gain;
    write(music, s + i, l * pl * 1.4, r * pr * 1.4);
    write(verbSend, s + i, l * verb, r * verb);
  }
}

function sub(t, dur, midi, gain = 0.35) {
  const s = Math.floor(t * SR);
  let ph = 0;
  const f = mtof(midi);
  for (let i = 0; i < (dur + 0.1) * SR; i++) {
    const x = i / SR;
    ph += (2 * Math.PI * f) / SR;
    const env = Math.min(1, x / 0.01) * (x < dur ? 1 : Math.exp(-(x - dur) * 40));
    write(music, s + i, Math.sin(ph) * env * gain);
  }
}

// FM bell/blip for UI and morph accents
function blip(t, midi, gain = 0.25, {ratio = 3.5, index = 4, decay = 9, pan = 0, verb = 0.5} = {}) {
  const s = Math.floor(t * SR);
  const f = mtof(midi);
  const [pl, pr] = panLR(pan);
  for (let i = 0; i < 1.2 * SR; i++) {
    const x = i / SR;
    const env = Math.exp(-x * decay) * Math.min(1, x / 0.002);
    const m = Math.sin(2 * Math.PI * f * ratio * x) * index * Math.exp(-x * decay * 1.5);
    const v = Math.sin(2 * Math.PI * f * x + m) * env * gain;
    write(sfx, s + i, v * pl, v * pr);
    write(verbSend, s + i, v * verb);
  }
}

// Band-passed noise sweep. Direction 'up' rises, 'down' falls, 'swish' up+down.
function whoosh(t, dur, {gain = 0.5, from = 300, to = 6000, shape = 'swish', pan = 0, panTo = pan, q = 2.5} = {}) {
  const s = Math.floor(t * SR);
  const bpL = new Biquad();
  const bpR = new Biquad();
  for (let i = 0; i < dur * SR; i++) {
    const p = i / (dur * SR);
    let env;
    let fp;
    if (shape === 'up') {
      env = Math.pow(p, 2.2) * (p > 0.97 ? (1 - p) / 0.03 : 1);
      fp = p;
    } else if (shape === 'down') {
      env = Math.pow(1 - p, 1.6) * Math.min(1, p / 0.02);
      fp = 1 - p;
    } else {
      env = Math.sin(Math.PI * p) ** 2;
      fp = Math.sin(Math.PI * p);
    }
    const f = from * Math.pow(to / from, fp);
    if (i % 16 === 0) {
      bpL.set('bp', f, q);
      bpR.set('bp', f * 1.07, q);
    }
    const pp = pan + (panTo - pan) * p;
    const [pl, pr] = panLR(pp);
    const l = bpL.run(noise()) * env * gain;
    const r = bpR.run(noise()) * env * gain;
    write(sfx, s + i, l * pl * 1.4, r * pr * 1.4);
    write(verbSend, s + i, (l + r) * 0.2);
  }
}

// Pitched riser: detuned saw stack gliding up with the noise sweep on top
function riser(t, dur, gain = 0.3) {
  const s = Math.floor(t * SR);
  const lp = new Biquad();
  const phs = [0, 0.3, 0.6];
  for (let i = 0; i < dur * SR; i++) {
    const p = i / (dur * SR);
    const f = mtof(45 + 24 * Math.pow(p, 1.5));
    if (i % 32 === 0) lp.set('lp', 300 + 7000 * p * p, 1.5);
    let v = 0;
    phs.forEach((_, k) => {
      phs[k] = (phs[k] + (f * (1 + (k - 1) * 0.01)) / SR) % 1;
      v += phs[k] * 2 - 1;
    });
    v = lp.run(v / 3) * Math.pow(p, 2) * gain;
    write(sfx, s + i, v);
    write(verbSend, s + i, v * 0.3);
  }
  whoosh(t, dur, {gain: gain * 1.1, from: 400, to: 9000, shape: 'up', q: 1.4});
}

function impact(t, gain = 1, {sub: subMidi = 33} = {}) {
  kick(t, gain * 1.1, {tone: 0.85, len: 0.9});
  const s = Math.floor(t * SR);
  let ph = 0;
  const lp = new Biquad();
  lp.set('lp', 2400, 0.7);
  for (let i = 0; i < 2.2 * SR; i++) {
    const x = i / SR;
    ph += (2 * Math.PI * mtof(subMidi) * (1 + 0.6 * Math.exp(-x * 9))) / SR;
    const boom = Math.sin(ph) * Math.exp(-x * 2.2) * 0.55;
    const crack = lp.run(noise()) * Math.exp(-x * 7) * 0.5;
    const v = (boom + crack) * gain;
    write(sfx, s + i, v, v * 0.98);
    write(verbSend, s + i, crack * 0.7 * gain);
  }
}

// Exponential noise swell that cuts dead at its end (reverse cymbal)
function reverseSwell(tEnd, dur, gain = 0.4) {
  const s = Math.floor((tEnd - dur) * SR);
  const hp = new Biquad();
  hp.set('hp', 3000, 0.7);
  for (let i = 0; i < dur * SR; i++) {
    const p = i / (dur * SR);
    const env = Math.pow(p, 3.5);
    const l = hp.run(noise()) * env * gain;
    write(sfx, s + i, l, noise() * env * gain * 0.25 + l * 0.75);
  }
}

// Tiny granular sparkles for the particle section
function sparkles(t0, t1, density = 40, gain = 0.08) {
  const scale = [69, 72, 76, 79, 81, 84, 88, 91];
  const count = Math.floor((t1 - t0) * density);
  for (let k = 0; k < count; k++) {
    const t = t0 + rnd() * (t1 - t0);
    const m = scale[Math.floor(rnd() * scale.length)] + 12;
    blip(t, m, gain * (0.4 + rnd() * 0.6), {ratio: 2.01, index: 1.2, decay: 30, pan: rnd() * 1.6 - 0.8, verb: 0.9});
  }
}

function tick(t, gain = 0.12, pan = 0) {
  const s = Math.floor(t * SR);
  const [pl, pr] = panLR(pan);
  for (let i = 0; i < 0.012 * SR; i++) {
    const v = Math.sin((2 * Math.PI * 3200 * i) / SR) * Math.exp(-i / SR * 500) * gain;
    write(sfx, s + i, v * pl, v * pr);
  }
}

// ---------------------------------------------------------------- arrangement
// A minor. Chord tones as MIDI.
const CH = {
  Am: [57, 60, 64, 67, 71], // Am9-ish
  F: [53, 57, 60, 64, 67], // Fmaj9
  G: [55, 59, 62, 66, 69], // G6/9
  Dm: [50, 53, 57, 60, 64],
};
const BASS = {Am: 33, F: 29, G: 31, Dm: 26};
const bars = ['Am', 'Am', 'F', 'G', 'Am', 'F', 'Am', 'Am'];
const barOf = (beat) => bars[Math.min(bars.length - 1, Math.floor(beat / 4))];

// --- 1. Ignition (beats 0-4): heartbeat on the dot pulses, drone, HUD ticks
for (let b = 0; b < 4; b++) {
  kick(b2s(b), 0.45 + b * 0.12, {tone: 0.9, len: 0.5});
  blip(b2s(b), 81 + b * 2, 0.06, {ratio: 1.5, index: 0.5, decay: 14});
}
for (let k = 0; k < 16; k++) tick(b2s(k * 0.25), 0.05 + (k % 4 === 0 ? 0.04 : 0), (k % 2) * 0.6 - 0.3);
sub(0, b2s(4), 33, 0.12);
saw(0, b2s(4), 45, {gain: 0.12, cutoff: 200, envAmt: 0, attack: 1.2, voices: 4, detune: 0.2, verb: 0.4});
saw(0, b2s(4), 64, {gain: 0.05, cutoff: 600, envAmt: 0, attack: 1.5, voices: 3, verb: 0.6});
reverseSwell(b2s(4), b2s(1.5), 0.35);
whoosh(b2s(3.2), b2s(0.8), {gain: 0.5, from: 200, to: 5000, shape: 'up'}); // iris expand

// --- 2. Type (beats 4-8): letters slam on 8ths
for (let b = 4; b < 8; b++) kick(b2s(b), 0.95);
clap(b2s(5), 0.8);
clap(b2s(7), 0.85);
C.typeLetterBeats.forEach((b, i) => {
  const notes = [45, 45, 48, 45, 52, 50];
  saw(b2s(b), b2s(0.35), notes[i], {gain: 0.22, cutoff: 300, envAmt: 3500, decay: 14, voices: 2, verb: 0.1});
  sub(b2s(b), b2s(0.35), notes[i] - 12, 0.3);
  tick(b2s(b), 0.12, i % 2 ? 0.4 : -0.4);
});
for (let k = 0; k < 16; k++) hat(b2s(4 + k * 0.25), k % 2 ? 0.5 : 0.25, false, k % 2 ? 0.3 : -0.2);
// split/stretch moment and the diagonal wipe
blip(b2s(C.typeSplitBeat), 76, 0.12, {ratio: 0.5, index: 6, decay: 6});
whoosh(b2s(C.typeWipeBeat - 0.1), b2s(0.7), {gain: 0.6, from: 400, to: 7000, shape: 'swish', pan: -0.8, panTo: 0.8});

// --- 3. Morph (beats 8-13): a kick + rising FM chime per shape
C.morphBeats.forEach((b, i) => {
  kick(b2s(b), 1);
  blip(b2s(b), [69, 72, 74, 76, 79][i], 0.16, {ratio: 3.01, index: 3, decay: 5, pan: (i % 2 ? 0.35 : -0.35), verb: 0.6});
  whoosh(b2s(b - 0.4), b2s(0.45), {gain: 0.22, from: 800, to: 4000, shape: 'up', q: 3});
});
for (let k = 0; k < 20; k++) hat(b2s(8 + k * 0.25), k % 4 === 2 ? 0.6 : 0.28, k % 4 === 2, k % 2 ? 0.35 : -0.25);
clap(b2s(9), 0.7);
clap(b2s(11), 0.75);
for (let b = 8; b < 13; b += 0.5) {
  const ch = barOf(b);
  sub(b2s(b), b2s(0.42), BASS[ch], 0.28);
  saw(b2s(b), b2s(0.4), BASS[ch] + 12, {gain: 0.13, cutoff: 200, envAmt: 1400, decay: 12, voices: 2, verb: 0.05});
}
saw(b2s(8), b2s(5), CH.F[1], {gain: 0.05, cutoff: 900, envAmt: 0, attack: 0.6, voices: 3, verb: 0.6});
saw(b2s(8), b2s(5), CH.F[3], {gain: 0.04, cutoff: 900, envAmt: 0, attack: 0.6, voices: 3, verb: 0.6, pan: 0.3});
reverseSwell(b2s(C.shatterBeat), b2s(1), 0.3);

// --- 4. Swarm (beats 13-18): shatter impact, weightless half-time, regroup
impact(b2s(C.shatterBeat), 0.85, {sub: 31});
hat(b2s(C.shatterBeat), 1, true, 0);
sparkles(b2s(13.1), b2s(16), 30, 0.07);
saw(b2s(13), b2s(3), CH.G[0], {gain: 0.06, cutoff: 1800, envAmt: 0, attack: 0.3, voices: 4, detune: 0.25, verb: 0.8});
saw(b2s(13), b2s(3), CH.G[2], {gain: 0.05, cutoff: 1800, envAmt: 0, attack: 0.3, voices: 4, detune: 0.25, verb: 0.8, pan: -0.4});
saw(b2s(13), b2s(3), CH.G[4], {gain: 0.04, cutoff: 1800, envAmt: 0, attack: 0.3, voices: 4, detune: 0.25, verb: 0.8, pan: 0.4});
sub(b2s(13), b2s(3), 31, 0.18);
reverseSwell(b2s(C.regroupBeat), b2s(1.6), 0.45);
whoosh(b2s(15), b2s(1), {gain: 0.4, from: 6000, to: 300, shape: 'down', pan: 0.6, panTo: -0.2});
kick(b2s(C.regroupBeat), 0.9);
blip(b2s(C.regroupBeat), 69, 0.14, {ratio: 2, index: 2, decay: 4, verb: 0.7});
blip(b2s(C.regroupBeat), 76, 0.1, {ratio: 2, index: 2, decay: 4, verb: 0.7});
kick(b2s(17), 0.9);
clap(b2s(17), 0.6);
for (let k = 0; k < 8; k++) hat(b2s(16 + k * 0.25), 0.3 + (k % 2) * 0.2, false, 0.25);

// --- 5. Dive (beats 18-24): driving four-on-floor, whoosh per plane, build
for (let b = 18; b < 23.5; b++) kick(b2s(b), 1);
[19, 21, 23].forEach((b) => clap(b2s(b), 0.6));
for (let k = 0; k < 20; k++) hat(b2s(18 + k * 0.25), k % 2 ? 0.55 : 0.25, false, k % 2 ? 0.3 : -0.3);
for (let b = 18; b < 23.5; b += 0.5) {
  const ch = barOf(b);
  sub(b2s(b), b2s(0.4), BASS[ch], 0.26);
  saw(b2s(b + 0.25), b2s(0.2), BASS[ch] + 24, {gain: 0.1, cutoff: 400, envAmt: 2500, decay: 18, voices: 2, verb: 0.05});
}
C.divePassBeats.forEach((b, i) => {
  whoosh(b2s(b - 0.35), b2s(0.6), {gain: 0.55, from: 250, to: 6500, shape: 'swish', pan: i % 2 ? 0.7 : -0.7, panTo: i % 2 ? -0.7 : 0.7, q: 2});
});
// accelerating snare roll into the drop
{
  let tt = 22;
  let step = 0.5;
  while (tt < 23.75) {
    snare(b2s(tt), 0.25 + 0.6 * ((tt - 22) / 1.75));
    tt += step;
    if (tt >= 23) step = 0.125;
    else if (tt >= 22.5) step = 0.25;
  }
}
riser(b2s(20), b2s(3.85), 0.28);
saw(b2s(20), b2s(4), CH.F[2], {gain: 0.05, cutoff: 500, envAmt: 0, attack: 1.5, voices: 4, verb: 0.5});

// --- 6. Drop (beats 24-28): impact, full groove, chord stabs, collapse suck
impact(b2s(C.dropBeat), 1.15);
hat(b2s(C.dropBeat), 1.2, true, 0);
blip(b2s(C.dropBeat), 57, 0.22, {ratio: 1, index: 3, decay: 2.5, verb: 0.9});
for (let b = 25; b < 27; b++) kick(b2s(b), 1);
clap(b2s(25), 0.9);
clap(b2s(26.5), 0.5);
for (let k = 0; k < 12; k++) hat(b2s(24 + k * 0.25), k % 2 ? 0.6 : 0.3, k % 4 === 2, k % 2 ? 0.35 : -0.3);
for (let b = 24; b < 27; b += 0.5) {
  sub(b2s(b), b2s(0.45), BASS.Am, 0.32);
  saw(b2s(b), b2s(0.45), BASS.Am + 12, {gain: 0.16, cutoff: 250, envAmt: 2400, decay: 9, voices: 3, verb: 0.05});
}
[24.5, 25, 25.5, 25.75, 26.5].forEach((b, i) => {
  CH.Am.forEach((m, j) =>
    saw(b2s(b), b2s(0.2), m + 12, {gain: 0.05, cutoff: 900, envAmt: 5000, decay: 14, voices: 2, pan: (j - 2) * 0.25, verb: 0.45}),
  );
});
reverseSwell(b2s(C.finalBeat), b2s(1.4), 0.55);
whoosh(b2s(C.collapseBeat - 0.2), b2s(1.2), {gain: 0.5, from: 7000, to: 150, shape: 'down', q: 1.8});

// --- 7. Resolve (beats 28-30): final hit and bell chord
impact(b2s(C.finalBeat), 1, {sub: 33});
CH.Am.forEach((m, j) => blip(b2s(C.finalBeat) + j * 0.012, m + 12, 0.08, {ratio: 2.0, index: 1.5, decay: 1.6, pan: (j - 2) * 0.3, verb: 1}));
saw(b2s(C.finalBeat), b2s(2), 45, {gain: 0.1, cutoff: 700, envAmt: 600, decay: 2, voices: 4, detune: 0.2, verb: 0.7});
sub(b2s(C.finalBeat), b2s(1.8), 33, 0.22);

// ---------------------------------------------------------------- mix
// Sidechain: duck the music bus after each kick
const duck = new Float32Array(N).fill(1);
for (const t of kickTimes) {
  const s = Math.floor(t * SR);
  for (let i = 0; i < 0.3 * SR && s + i < N; i++) {
    const x = i / SR;
    const g = 1 - 0.65 * Math.exp(-x * 14);
    duck[s + i] = Math.min(duck[s + i], g);
  }
}

// Schroeder reverb on the send
function reverb(input) {
  const out = [new Float32Array(N), new Float32Array(N)];
  const combs = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116];
  const aps = [225, 556, 441, 341];
  for (let ch = 0; ch < 2; ch++) {
    const src = input[ch];
    const acc = new Float32Array(N);
    combs.forEach((d0) => {
      const d = d0 + ch * 23;
      const buf = new Float32Array(d);
      let idx = 0;
      let lp = 0;
      for (let i = 0; i < N; i++) {
        const y = buf[idx];
        lp = y * 0.75 + lp * 0.25;
        buf[idx] = src[i] + lp * 0.84;
        acc[i] += y;
        idx = (idx + 1) % d;
      }
    });
    let sig = acc;
    aps.forEach((d0) => {
      const d = d0 + ch * 7;
      const buf = new Float32Array(d);
      let idx = 0;
      const o = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const bo = buf[idx];
        const y = -sig[i] * 0.5 + bo;
        buf[idx] = sig[i] + bo * 0.5;
        o[i] = y;
        idx = (idx + 1) % d;
      }
      sig = o;
    });
    out[ch] = sig;
  }
  return out;
}

const wet = reverb(verbSend);
const L = new Float32Array(N);
const R = new Float32Array(N);
for (let i = 0; i < N; i++) {
  L[i] = drums[0][i] * 0.9 + music[0][i] * duck[i] + sfx[0][i] * 0.8 + wet[0][i] * 0.09;
  R[i] = drums[1][i] * 0.9 + music[1][i] * duck[i] + sfx[1][i] * 0.8 + wet[1][i] * 0.09;
}
// fade the last half second
const fadeLen = Math.floor(0.5 * SR);
for (let i = 0; i < fadeLen; i++) {
  const g = Math.pow(1 - i / fadeLen, 2);
  L[N - fadeLen + i] *= g;
  R[N - fadeLen + i] *= g;
}
// soft clip + normalize to -1 dBFS
let peak = 0;
for (let i = 0; i < N; i++) {
  L[i] = Math.tanh(L[i] * 1.2);
  R[i] = Math.tanh(R[i] * 1.2);
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = Math.pow(10, -1 / 20) / peak;

const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0);
buf.writeUInt32LE(36 + N * 4, 4);
buf.write('WAVE', 8);
buf.write('fmt ', 12);
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
const outPath = path.join(root, 'public/audio/soundtrack.wav');
fs.writeFileSync(outPath, buf);
console.log(`wrote ${path.relative(root, outPath)} (${DURATION.toFixed(2)}s, peak ${(20 * Math.log10(peak)).toFixed(1)} dB pre-norm)`);

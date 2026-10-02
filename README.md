# SIGNAL / NOISE — motion showreel

A 15-second, 1920×1080 / 30 fps motion graphics reel built entirely in code with
[Remotion](https://www.remotion.dev). Picture and sound are both generated from one
cue sheet, so every cut, morph and impact lands on the music.

**Rendered output:** [`out/showreel.mp4`](out/showreel.mp4)

## Concept

One point of energy becomes a whole system, then resolves back to a point.
The palette is ink, paper, signal orange and ultramarine. Type pairs heavy Inter Tight Black
with JetBrains Mono labels. Everything runs on a 120 BPM grid (1 beat = 15 frames).

| # | Time | Shot | What happens | Transition out |
|---|------|------|--------------|----------------|
| 01 | 0.0–2.0s | **Ignition** | A dot pulses on a heartbeat kick, emits rings, draws a crosshair and reveals a dot grid | Iris: the dot swallows the frame in orange |
| 02 | 2.0–4.0s | **Kinetic type** | `MOTION` slams in letter by letter on 8th notes with squash/stretch, skew and a white hit-flash, then echoes into an outlined stack | Layered diagonal wipe (ultramarine, then ink) |
| 03 | 4.0–6.5s | **Morph** | Circle → triangle → square → hexagon → star, one per kick, using spring overshoot, rotational follow-through, echo trails and a CSS-3D orbiting camera with parallax layers | Anticipation squash, then a white-hot flash |
| 04 | 6.5–9.0s | **Swarm** | The star shatters into 720 particles riding a curl-noise flow field, which snap into a grid on the downbeat, with ripple waves on each kick | Camera dives into the grid |
| 05 | 9.0–12.0s | **Depth** | A pseudo-3D camera surges through floating type planes on each beat, with depth-of-field blur and velocity streaks | Rack focus and crash-zoom into the title, match-cut on the drop |
| 06 | 12.0–14.0s | **Drop** | Impact flash, a chromatic-split title, a wave-driven field of the morph shapes, and ticker bands | Everything spins and collapses to a point |
| 07 | 14.0–15.0s | **Resolve** | The point pops, rings out and slides aside to reveal the wordmark | (end) |

A persistent HUD (timecode, section, BPM and beat counter, crop marks), film grain, a
vignette and impact-driven camera shake sit over everything.

## Sound

`scripts/generate-audio.mjs` synthesizes the whole soundtrack in plain Node. It uses no
samples. It produces kick, clap, hats, snare roll, sub and saw bass, pads, FM chimes,
band-passed whooshes, risers, reverse swells, impacts and granular sparkles. The mix has
kick sidechain ducking, a Schroeder reverb, soft clipping and normalization. All hits are
placed from `src/timeline.json`, the same cue sheet the scenes read.

## Commands

```bash
npm install
npm run studio   # generate audio + open Remotion Studio
npm run render   # generate audio + render out/showreel.mp4
```

In sandboxed environments without Remotion's own browser download, point it at a local
Chromium headless shell:

```bash
REMOTION_BROWSER=/path/to/headless_shell npm run render
```

## Structure

```
src/timeline.json      shared cue sheet: scene ranges and musical cues (in beats)
src/lib/ease.ts        bezier easings, closed-form damped spring, keyframe helper
src/lib/noise.ts       seeded 3D simplex + curl noise
src/lib/shapes.ts      arc-length resampled shapes for vertex-to-vertex morphing
src/lib/timing.ts      beat ↔ frame helpers and beat-pulse envelopes
src/scenes/*.tsx       the seven shots
src/components/        HUD and film grain overlays
scripts/generate-audio.mjs  soundtrack synthesizer
```

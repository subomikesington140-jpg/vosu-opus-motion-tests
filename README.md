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
| 06 | 12.0–14.0s | **Drop** | Impact flash, a chromatic-split title, a wave-driven field of the morph shapes, and ticker bands | The frame strains, then implodes into a singularity: a debris vortex, converging rays and a glowing core, followed by a 2-frame blackout with matching audio silence |
| 07 | 14.0–15.0s | **Resolve** | Detonation: a white-out, an orange afterflash, stacked shockwaves, a ray burst, debris and a zoom punch. The point then slides aside to reveal the wordmark | (end) |

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

---

# VOSU: 15-second product film

**Rendered output:** [`out/vosu-promo.mp4`](out/vosu-promo.mp4) (composition `VosuPromo`)

A commercial-style introduction to VOSU, built from the supplied logo and screenshots.
The UI is never redrawn. `scripts/vosu/extract_assets.py` cuts the real screenshots into
51 separate components (headline halves, prompt box, each category pill, every node,
each tool card, the marketplace copy, button and trust items, and the floating media
cards, which are de-rotated from their corner points). Each component then animates
independently and lands back on its original layout.

| Time | Shot | Animation | Voiceover |
|------|------|-----------|-----------|
| 0–2s | Logo | V·O·S·U land one per beat, glint and specular sweep, then the camera flies through the star cut into the "O" | "Meet VOSU." |
| 2–5s | Home / studio | Headline rises, the prompt placeholder types on, each category pill (Studios, Video, Images, Audio, 3D) lights on its spoken word as the matching media card floats in | "Your AI studio for videos, images, audio and 3D." |
| 5–8s | Node editor | Whip pan in, nodes pop in sequence, real wires revealed left to right, signal pulses, camera tracks to the video generator | "Turn ideas into cinematic sequences." |
| 8–10.5s | Popular tools | Cards cascade with a 3D flip, push onto Background Remover, the button is clicked on "click", kinetic "One click away." | "Pro tools, one click away." |
| 10.5–13s | Creator Marketplace | Hero builds piece by piece, cards orbit into place, CTA pressed on the beat, camera dives into the white card | "And get paid on the Creator Marketplace." |
| 13–15s | End card | The mark on light, then the product's own line set word by word with the voice, and vosu.ai | "VOSU. What are you creating today?" |

**Sound:** the voiceover is [Kokoro](https://github.com/thewh1teagle/kokoro-onnx), a natural-sounding
neural TTS, synthesized locally with the `am_michael` voice. "VOSU" is passed to the voice as exact
phonemes (/ˈvoʊsuː/, "VO-soo" with a full second syllable, at natural speed) and stays VOSU on screen.
The script patches the ONNX graph in memory to expose Kokoro's per-phoneme durations, which gives
exact word timings. Takes are edited like a human VO: edge silence is trimmed, overlong pauses are
shortened to natural breaths, and each line is loudness-matched. Phoneme alignments give per-word
timestamps (`src/vosu/vo.json`), which drive the pill highlights, the click and the
end-card words. The music (F major, 120 BPM) and the UI sound design are synthesized in
`scripts/vosu/generate-audio.mjs`. Music ducks under the voice, which sits about +9.6 dB
over the bed while speaking, and the master is normalized to −14 LUFS.

```bash
npm run vosu:render      # mix audio + render out/vosu-promo.mp4 (uses committed crops and VO)

# regenerate inputs (Python: pip install pillow kokoro-onnx onnx)
npm run vosu:assets      # re-cut UI components from assets/vosu-source/
KOKORO_DIR=/path/with/kokoro-v1.0.onnx+voices-v1.0.bin npm run vosu:vo   # re-record the voiceover
```

---

# PROJECT 01: architectural construction film

**Rendered output:** [`out/arch-film.mp4`](out/arch-film.mp4) (composition `ArchFilm`)

A 15-second, 1920×1080 / 30 fps architectural presentation of a 5-level mixed-use
building, built as a real Three.js scene (`@remotion/three` + `@react-three/fiber`).
The building is procedural. Foundation, columns, slabs, structural walls and core,
window panes, mullions, balconies, balustrades, soffit LEDs, interior light planes
and roof are separate instanced components, and each instance has its own build cue
and motion.

| Time | Stage | What happens |
|------|-------|--------------|
| 0–2s | Framework | The ground grid, structural axes and dimension strings draw out. The building wireframe draws itself bottom-up, segment by segment |
| 2–5s | Construction | Foundation, then LEVEL 01–05 (columns grow, slabs drop and settle), structural walls, glazing ripple, balconies slide out. Leader-line labels per stage |
| 5–8s | Program | Each floor highlights in brass and gets a pinned leader label: lobby, offices, executive suites, residential, penthouse |
| 8–11s | Materiality | A scan band sweeps up the building, blending white clay into board-formed concrete, reflective glazing and bronze metal per fragment. Interiors switch on and the dark stage turns into a blue-hour sky. The city rises in |
| 11–13s | Context | Wide orbit around the south-west corner |
| 13–15s | Presentation | Project panel with a self-drawing floor plan, then the title THE FUTURE OF URBAN LIVING |

How it works:

- `src/building/model.ts`: the procedural building and site as instanced items with build cues
- `src/building/materials.ts`: clay-to-real reveal shader (world-height driven), canvas textures
- `src/building/lines.ts`: self-drawing line segments (wireframe, grid, axes, dimensions)
- `src/building/camera.ts`: the camera move as one Hermite spline. The overlay projects 3D anchors through the same function, so labels stay pinned to floors
- `src/building/Overlay.tsx`: typography, HUD, leaders, presentation panel
- `scripts/building/generate-audio.mjs`: score and sound effects synthesized from the same cue sheet (`src/building/timeline.json`)

```bash
npm run arch:render   # soundtrack + out/arch-film.mp4
```

Rendering needs WebGL. Without a GPU, use SwiftShader through ANGLE (`--gl=swangle`,
already set in `remotion.config.ts`).

---

# How an AI agent works: 20-second explainer

**Rendered output:** [`out/agent-explainer.mp4`](out/agent-explainer.mp4) (composition `AgentExplainer`)

USER PROMPT → AI AGENT → PLAN → TOOLS → RESULT, told through one example ("Plan a weekend
in Lisbon under $800") on a single continuous canvas. The camera travels along the
connecting lines, and the final pull-back turns the whole journey into one diagram.
The voiceover is Kokoro TTS (`af_heart`), with per-word timings in `src/agent/vo.json`. Tags,
plan steps, tool calls and the result card are each placed on the word that names them.
The music bed ducks under the voice, and every transition has a sound effect.

```bash
npm run agent:vo       # narration (needs the Kokoro model in voices/kokoro)
npm run agent:render   # soundtrack + out/agent-explainer.mp4
```

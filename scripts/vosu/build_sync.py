"""Time map that re-paces the existing VOSU film to a supplied voiceover.

Pairs every cue word of the current film's voice (src/vosu/vo.json + timeline.json)
with the same word in the new recording (src/vosu/sync/voice.json). Between those
anchors the picture and sound design are re-timed linearly, so every word-synced
animation (pills, click, end-card words) lands on the new voice. Nothing else in
the film changes.

Writes src/vosu/sync/warp.json: anchors [[old_s, new_s], ...], the voice offset and
the new length.
"""
import json
import math
from pathlib import Path

import numpy as np
from scipy.interpolate import PchipInterpolator

import sys

# the film to re-pace (defaults to this checkout; render_synced.sh points it at a past cut)
ROOT = Path(sys.argv[sys.argv.index("--root") + 1]).resolve() if "--root" in sys.argv else Path(__file__).resolve().parents[2]
FPS = 30
TAIL = 0.45  # hold after the last word, as in the original cut

T = json.loads((ROOT / "src/vosu/timeline.json").read_text())
OLD = json.loads((ROOT / "src/vosu/vo.json").read_text())
NEW = json.loads((ROOT / "src/vosu/sync/voice.json").read_text())

old_words = {(k, i): T["vo"][k] + w["start"] for k, v in OLD.items() for i, w in enumerate(v["words"])}
new_words = {(w["line"], w["i"]): w["start"] for w in NEW["words"]}

# only the words that drive animation are anchors; a smooth monotone curve runs
# between them so the pace changes gradually instead of lurching word to word
CUES = {(line, i) for line, i in T["words"].values()} | {(k, 0) for k in OLD}

# keep the first word where it was, so the opening is unchanged
first = ("intro", 0)
offset = old_words[first] - new_words[first]
pairs = sorted((old_words[k], new_words[k] + offset) for k in CUES if k in new_words)

anchors = [(0.0, 0.0)]
for o, n in pairs:
    if o > anchors[-1][0] + 0.05 and n > anchors[-1][1] + 0.05:  # keep strictly increasing
        anchors.append((round(o, 3), round(n, 3)))
old_end = T["durationInFrames"] / FPS
last_o, last_n = anchors[-1]
voice_end = offset + NEW["phrases"][-1][1]
new_end = max(voice_end + TAIL, last_n + (old_end - last_o))
anchors.append((old_end, round(new_end, 3)))
frames = math.ceil(new_end * FPS)

curve = PchipInterpolator([a[0] for a in anchors], [a[1] for a in anchors])
grid = np.arange(0, old_end + 1e-9, 0.005)
fwd = curve(grid)
slopes = curve.derivative()(grid)
# inverse: for each new frame, which original frame to show (fractional frames are fine)
inv = np.interp(np.arange(frames) / FPS, fwd, grid) * FPS
out = {
    "voiceOffset": round(offset, 3),
    "durationInFrames": frames,
    "anchors": anchors,
    "oldStep": 0.005,
    "oldToNew": [round(float(v), 4) for v in fwd],
    "frameMap": [round(float(v), 3) for v in inv],
}
(ROOT / "src/vosu/sync/warp.json").write_text(json.dumps(out, indent=1))
print(f"voice offset {offset:+.3f}s, new length {frames} frames ({frames / FPS:.2f}s), {len(anchors)} anchors")
print("pace range: x%.2f (slowest) to x%.2f (fastest)" % (slopes.max(), slopes.min()))
for o, n in anchors:
    print(f"  {o:5.2f}s -> {n:5.2f}s")

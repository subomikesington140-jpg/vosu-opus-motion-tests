"""Measure word timings in a supplied voiceover recording (e.g. an ElevenLabs take).

1. Finds the spoken phrases in the recording by energy and groups them into the
   film's six VO lines.
2. Gets exact word timings by forced alignment: the same text is synthesized with
   Kokoro (whose word timings are known exactly), then matched to the recording
   with dynamic time warping over MFCC features, carrying each word boundary across.
3. Copies the recording, untouched apart from one overall gain, to
   public/vosu/sync/voice.wav and writes src/vosu/sync/voice.json (word times in
   seconds from the start of the recording).

Usage:
  python3 scripts/vosu/align_vo.py --audio take.mp3 --model-dir voices/kokoro
"""
import argparse
import importlib.util
import json
import re
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/vosu/sync"
SR = 22050
HOP = 256

_spec = importlib.util.spec_from_file_location("generate_vo", Path(__file__).with_name("generate_vo.py"))
gv = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gv)

# line key -> (text, number of pause-separated phrases it spans in the recording)
LINES = {
    "intro": ("Meet VOSU.", 1),
    "studio": ("Your AI studio for videos, images, audio and 3D.", 1),
    "nodes": ("Turn ideas into cinematic sequences.", 1),
    "tools": ("Pro tools, one click away.", 1),
    "market": ("And get paid on the Creator Marketplace.", 1),
    "outro": ("VOSU. What are you creating today?", 2),
}


def phrases(y):
    """Speech regions separated by pauses of at least 0.12 s."""
    iv = librosa.effects.split(y, top_db=34, frame_length=1024, hop_length=128)
    merged = []
    for a, b in iv:
        if merged and (a - merged[-1][1]) / SR < 0.12:
            merged[-1][1] = b
        else:
            merged.append([a, b])
    return [(a / SR, b / SR) for a, b in merged if (b - a) / SR > 0.08]


def pauses(y):
    """Every breath or gap of at least 60 ms inside the speech, as (start, end) s."""
    iv = librosa.effects.split(y, top_db=36, frame_length=512, hop_length=64)
    return [(iv[i][1] / SR, iv[i + 1][0] / SR) for i in range(len(iv) - 1) if (iv[i + 1][0] - iv[i][1]) / SR >= 0.06]


def features(y):
    m = librosa.feature.mfcc(y=y, sr=SR, n_mfcc=20, hop_length=HOP, n_fft=1024)[1:]
    f = np.vstack([m, librosa.feature.delta(m)])
    return (f - f.mean(axis=1, keepdims=True)) / (f.std(axis=1, keepdims=True) + 1e-6)


def reference(sess, tok, style_bank, text):
    """Kokoro read of the line with exact per-word times (seconds, from its first word)."""
    pcm_all, words, t0 = [], [], 0.0
    for phrase in [text]:
        ph = gv.phonemize(tok, phrase)
        ids = [tok.vocab[c] for c in ph if c in tok.vocab]
        kept = [c for c in ph if c in tok.vocab]
        audio, dur = sess.run(None, {"tokens": [[0, *ids, 0]], "style": style_bank[len(ids)], "speed": np.array([1.0], dtype=np.float32)})
        dur = dur.reshape(-1)
        pos, cur = int(dur[0]) * gv.HOP, None
        for c, d in zip(kept, dur[1:-1]):
            if c == " " or c in ".,?!":
                if cur:
                    cur["end"] = pos / gv.SR
                    words.append(cur)
                    cur = None
            elif cur is None:
                cur = {"ph": c, "start": pos / gv.SR}
            else:
                cur["ph"] += c
            pos += int(d) * gv.HOP
        if cur:
            cur["end"] = pos / gv.SR
            words.append(cur)
        pcm = (np.clip(audio, -1, 1) * 32767).astype(np.int16)
        ws = [w for w in words if "_o" not in w]
        pcm, ws = gv.tighten(pcm, ws, 0.12)
        for w in ws:
            w["start"] += t0
            w["end"] += t0
            w["_o"] = 1
        pcm_all.append(pcm)
        t0 += len(pcm) / gv.SR
    for w in words:
        w.pop("_o", None)
    ref = librosa.resample(np.concatenate(pcm_all).astype(np.float32) / 32768, orig_sr=gv.SR, target_sr=SR)
    return ref, words


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--audio", required=True, type=Path)
    ap.add_argument("--model-dir", required=True, type=Path)
    args = ap.parse_args()

    y, _ = librosa.load(args.audio, sr=SR, mono=True)
    ph = phrases(y)
    need = sum(n for _, n in LINES.values())
    if len(ph) != need:
        raise SystemExit(f"found {len(ph)} spoken phrases, expected {need}: {[(round(a, 2), round(b, 2)) for a, b in ph]}")

    sess = gv.load_session(args.model_dir)
    tok = gv.Tokenizer()
    style_bank = np.load(args.model_dir / "voices-v1.0.bin")["am_michael"]

    OUT.mkdir(parents=True, exist_ok=True)
    gaps = pauses(y)
    words_out, k = [], 0
    for key, (text, n) in LINES.items():
        a, b = ph[k][0], ph[k + n - 1][1]
        k += n
        # split the line at its punctuation; if the read has a breath at each mark,
        # align chunk by chunk between breaths (much tighter than the whole line)
        chunks = [c for c in re.split(r"(?<=[,.?])\s+", text) if c]
        inner = sorted([g for g in gaps if a < g[0] and g[1] < b], key=lambda g: g[0] - g[1])[: len(chunks) - 1]
        if len(inner) == len(chunks) - 1:
            inner.sort()
            bounds = [a] + [x for g in inner for x in g] + [b]
            spans = [(bounds[2 * i], bounds[2 * i + 1]) for i in range(len(chunks))]
        else:
            chunks, spans = [text], [(a, b)]
        i0 = 0
        for chunk, (ca, cb) in zip(chunks, spans):
            a0, b1 = max(0.0, ca - 0.03), min(len(y) / SR, cb + 0.05)
            clip = y[int(a0 * SR) : int(b1 * SR)]
            ref, rwords = reference(sess, tok, style_bank, chunk)
            # align: reference frame -> recording frame along the DTW path
            _, wp = librosa.sequence.dtw(X=features(ref), Y=features(clip), metric="cosine")
            wp = wp[::-1]
            r2u = np.zeros(wp[:, 0].max() + 1)
            for i in range(len(r2u)):
                r2u[i] = wp[wp[:, 0] == i, 1].mean()
            to_rec = lambda t: a0 + float(r2u[min(len(r2u) - 1, int(t * SR / HOP))] * HOP / SR)
            for j, w in enumerate(rwords):
                # a chunk's first word starts exactly where the breath before it ends; DTW
                # tends to drift at the edges, so it is pinned (mid-chunk words are reliable)
                st = ca if j == 0 else to_rec(w["start"])
                words_out.append({"line": key, "i": i0 + j, "ph": w["ph"], "start": round(st, 3), "end": round(min(to_rec(w["end"]), cb), 3)})
            i0 += len(rwords)
        print(f"{key:7s} {a:6.2f}-{b:5.2f}s {len(spans)} chunk(s)  " + " ".join(f"{w['ph']}@{w['start']:.2f}" for w in words_out if w["line"] == key))
    # one overall gain to a -17 dB RMS speaking level; the performance is otherwise untouched
    gain = 10 ** ((-17 - 20 * np.log10(np.sqrt(np.mean(y[int(ph[0][0] * SR) :] ** 2)) + 1e-9)) / 20)
    full, sr0 = librosa.load(args.audio, sr=None, mono=True)
    sf.write(OUT / "voice.wav", np.clip(full * gain, -1, 1), sr0, subtype="PCM_16")
    meta = {"source": args.audio.name, "duration": round(len(full) / sr0, 3), "phrases": [[round(a, 3), round(b, 3)] for a, b in ph], "words": words_out}
    (ROOT / "src/vosu/sync").mkdir(parents=True, exist_ok=True)
    (ROOT / "src/vosu/sync/voice.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False))
    print(f"wrote public/vosu/sync/voice.wav and src/vosu/sync/voice.json ({meta['duration']}s)")


if __name__ == "__main__":
    main()

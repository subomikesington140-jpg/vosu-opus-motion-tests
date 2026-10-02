"""Voiceover for the VOSU promo, synthesized locally with Kokoro (82M neural TTS).

Writes one WAV per line to public/vosu/vo/ plus src/vosu/vo.json with each line's
duration and per-word start/end times. The ONNX graph is patched in memory to also
return Kokoro's predicted per-phoneme durations (600 samples each at 24 kHz), so the
word timings are exact and the picture can sync to individual words.

Usage:
  python3 scripts/vosu/generate_vo.py --model-dir voices/kokoro [--voice am_michael]
Model files (kokoro-v1.0.onnx, voices-v1.0.bin):
  github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
Python deps: pip install kokoro-onnx onnx soundfile
"""
import argparse
import json
import subprocess
import wave
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
from kokoro_onnx.tokenizer import Tokenizer
from onnx import TensorProto, helper

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/vosu/vo"
SR = 24000
HOP = 600  # audio samples per predicted duration frame
DUR_TENSOR = "/encoder/Cast_output_0"

# "VOSU" is said "VO-soo" (/ˈvoʊsuː/): a full second syllable at natural speed.
BRAND_PH = "vˈoʊsuː"
# key: (text, speed). " | " splits a line into phrases spoken with a short beat between.
LINES = {
    "intro": ("Meet VOSU.", 1.0),
    "studio": ("Your AI studio for videos, images, audio and 3D.", 1.0),
    "nodes": ("Turn ideas into cinematic sequences.", 1.05),
    "tools": ("Pro tools, one click away.", 1.05),
    "market": ("And get paid on the Creator Marketplace.", 1.07),
    "outro": ("VOSU. | What are you creating today?", 1.0),
}
MAX_GAP = 0.17  # longest pause kept inside a phrase (Kokoro breathes at commas)
PHRASE_GAP = 0.16
HEAD = 0.03  # silence kept before the first word of a phrase
TAIL = 0.08  # and after the last


def load_session(model_dir):
    m = onnx.load(str(model_dir / "kokoro-v1.0.onnx"))
    m.graph.output.append(helper.make_tensor_value_info(DUR_TENSOR, TensorProto.INT64, None))
    return ort.InferenceSession(m.SerializeToString())


def phonemize(tok, text):
    """espeak phonemes with the brand swapped for its exact pronunciation."""
    out = []
    for i, part in enumerate(text.split("VOSU")):
        if i:
            out.append(BRAND_PH)
        core = part.strip()
        if not core:
            continue
        if all(ch in ".,?!" for ch in core):
            out[-1] = out[-1] + core  # punctuation right after the brand
        else:
            out.append(tok.phonemize(core, "en-us").strip())
    return " ".join(out)


def tighten(pcm, words, max_gap):
    """Edit like a VO editor: trim edge silence to HEAD/TAIL and shorten any internal
    pause longer than max_gap. Word times (relative to pcm) are shifted to match."""
    win = int(0.01 * SR)
    n = len(pcm) // win
    rms = np.sqrt((pcm[: n * win].astype(np.float32).reshape(n, win) ** 2).mean(axis=1)) / 32768
    loud = rms > 10 ** (-42 / 20)
    if not loud.any():
        return pcm, words
    first = int(np.argmax(loud))
    last = n - 1 - int(np.argmax(loud[::-1]))
    keep = [(max(0, first * win - int(HEAD * SR)), min(len(pcm), (last + 1) * win + int(TAIL * SR)))]
    # split the kept span at long internal silences
    i = first
    while i <= last:
        if not loud[i]:
            j = i
            while j <= last and not loud[j]:
                j += 1
            if (j - i) * win > max_gap * SR:
                a, b = keep.pop()
                cut0 = i * win + int(max_gap * SR / 2)
                cut1 = j * win - int(max_gap * SR / 2)
                keep += [(a, cut0), (cut1, b)]
            i = j
        else:
            i += 1
    out, mapping, t = [], [], 0
    for a, b in keep:
        seg = pcm[a:b].astype(np.float32)
        r = min(int(0.008 * SR), len(seg) // 2)  # tiny fades so cuts never click
        seg[:r] *= np.linspace(0, 1, r)
        seg[len(seg) - r :] *= np.linspace(1, 0, r)
        out.append(seg.astype(np.int16))
        mapping.append((a, b, t))
        t += b - a

    def remap(x):
        smp = x * SR
        for a, b, t0 in mapping:
            if smp < b:
                return (t0 + max(0, smp - a)) / SR
        return t / SR

    for w in words:
        w["start"], w["end"] = remap(w["start"]), remap(w["end"])
    return np.concatenate(out), words


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model-dir", required=True, type=Path)
    ap.add_argument("--voice", default="am_michael")
    args = ap.parse_args()

    sess = load_session(args.model_dir)
    tok = Tokenizer()
    style_bank = np.load(args.model_dir / "voices-v1.0.bin")[args.voice]
    OUT.mkdir(parents=True, exist_ok=True)
    meta = {}
    for key, (text, speed) in LINES.items():
        pieces, words, t_out = [], [], 0
        phrases = text.split(" | ")
        for pi, phrase in enumerate(phrases):
            ph = phonemize(tok, phrase)
            ids = [tok.vocab[c] for c in ph if c in tok.vocab]
            kept = [c for c in ph if c in tok.vocab]
            audio, dur = sess.run(
                None, {"tokens": [[0, *ids, 0]], "style": style_bank[len(ids)], "speed": np.array([speed], dtype=np.float32)}
            )
            dur = dur.reshape(-1)
            pcm = (np.clip(audio, -1, 1) * 32767).astype(np.int16)
            pw, cur, pos = [], None, int(dur[0]) * HOP  # after the leading pad token
            for c, d in zip(kept, dur[1:-1]):
                boundary = c == " " or c in ".,?!;:"
                if boundary and cur:
                    cur["end"] = pos / SR
                    pw.append(cur)
                    cur = None
                elif not boundary:
                    if cur is None:
                        cur = {"ph": c, "start": pos / SR}
                    else:
                        cur["ph"] += c
                pos += int(d) * HOP
            if cur:
                cur["end"] = pos / SR
                pw.append(cur)
            pcm, pw = tighten(pcm, pw, MAX_GAP)
            for w in pw:
                w["start"] += t_out / SR
                w["end"] += t_out / SR
            words += pw
            pieces.append(pcm)
            t_out += len(pcm)
            if pi < len(phrases) - 1:
                gap = np.zeros(int(PHRASE_GAP * SR), dtype=np.int16)
                pieces.append(gap)
                t_out += len(gap)
        pcm = np.concatenate(pieces)
        raw = OUT / f"{key}.raw.wav"
        with wave.open(str(raw), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(pcm.tobytes())
        # light broadcast polish (Kokoro is already clean): rumble cut, a touch of
        # presence and air, gentle levelling, 44.1 kHz
        subprocess.run(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(raw), "-af",
             "highpass=f=70,equalizer=f=3000:t=q:w=1.2:g=1.5,equalizer=f=9000:t=q:w=1:g=1,"
             "acompressor=threshold=-22dB:ratio=2.2:attack=8:release=120:makeup=1.5,"
             "loudnorm=I=-16:TP=-1.5:LRA=7,aresample=44100:resampler=soxr",
             "-ac", "1", "-sample_fmt", "s16", str(OUT / f"{key}.wav")],
            check=True,
        )
        raw.unlink()
        # display labels; "3D" is two phoneme words (three, dee)
        labels = []
        for t in text.replace("|", " ").replace(",", "").replace(".", "").replace("?", "").split():
            labels += [t, "3D"] if t == "3D" else [t]
        for i, wd in enumerate(words):
            wd["word"] = labels[i] if len(labels) == len(words) else wd["ph"]
            wd["start"] = round(wd["start"], 3)
            wd["end"] = round(wd["end"], 3)
        meta[key] = {"text": text.replace(" | ", " "), "voice": args.voice, "duration": round(len(pcm) / SR, 3), "words": words}
        print(f"{key:7s} {len(pcm) / SR:5.2f}s  " + " ".join(f"{w['word']}({w['ph']})@{w['start']:.2f}" for w in words))
    (ROOT / "src/vosu/vo.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()

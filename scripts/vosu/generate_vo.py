"""Voiceover for the VOSU promo, synthesized locally with Piper (neural TTS).

Writes one WAV per line to public/vosu/vo/ plus src/vosu/vo.json with each
line's duration and per-word start/end times (from phoneme alignments), so
the picture can sync to individual words.

Usage: python3 scripts/vosu/generate_vo.py --voice /path/to/en-us-ryan-high.onnx
Voice files: github.com/rhasspy/piper/releases/download/v0.0.2/voice-en-us-ryan-high.tar.gz
"""
import argparse
import json
import subprocess
import wave
from pathlib import Path

import numpy as np
from piper import PiperVoice, SynthesisConfig

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/vosu/vo"
# The brand is passed as raw phonemes: "VO-soo" (/ˈvoʊsuː/) with a full second
# syllable, read at natural speed so it is neither clipped ("Vos") nor dragged.
BRAND = "[[ vˈoʊsuː ]]"
# key: (spoken text, on-screen words used for timing labels)
LINES = {
    "intro": (f"Meet {BRAND}.", "Meet VOSU"),
    "studio": ("Your AI studio for videos, images, audio, and 3D.", "Your AI studio for videos images audio and 3D"),
    "nodes": ("Turn ideas into cinematic sequences.", "Turn ideas into cinematic sequences"),
    "tools": ("Pro tools, one click away.", "Pro tools one click away"),
    "market": ("And get paid on the Creator Marketplace.", "And get paid on the Creator Marketplace"),
    # " | " splits a line into separately spoken phrases with a short beat between them
    "outro": (f"{BRAND} | What are you creating today?", "VOSU What are you creating today"),
}
# calm, even read: slower pace on the list line, steadier rhythm everywhere
PACE = {"intro": 1.0, "studio": 1.32, "nodes": 1.1, "tools": 1.1, "market": 1.08, "outro": 1.03}
# breaths inserted after punctuation (seconds)
PAUSE = {",": 0.2, ".": 0.16}
PHRASE_GAP = 0.26


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", required=True)
    ap.add_argument("--length-scale", type=float, default=1.0)
    args = ap.parse_args()

    voice = PiperVoice.load(args.voice, config_path=args.voice + ".json", include_alignments=True)
    OUT.mkdir(parents=True, exist_ok=True)
    meta = {}
    for key, (text, display) in LINES.items():
        cfg = SynthesisConfig(length_scale=PACE[key] * args.length_scale, noise_scale=0.5, noise_w_scale=0.55)
        pieces, words, sr = [], [], None
        out_pos = 0  # samples written so far, including inserted pauses
        phrases = text.split(" | ")
        chunks = []
        for pi, phrase in enumerate(phrases):
            chunks += [(c, pi < len(phrases) - 1) for c in voice.synthesize(phrase, cfg, include_alignments=True)]
        for chunk, gap_after in chunks:
            sr = chunk.sample_rate
            pcm = chunk.audio_int16_array
            pos = 0
            cur = None
            last_cut = 0
            for al in chunk.phoneme_alignments:
                n = int(al.num_samples)
                ph = al.phoneme
                boundary = ph in (" ", "^", "$") or ph in ".,?!"
                if boundary and cur:
                    cur["end"] = (out_pos + pos - last_cut) / sr
                    words.append(cur)
                    cur = None
                elif not boundary:
                    if cur is None:
                        cur = {"ph": ph, "start": (out_pos + pos - last_cut) / sr}
                    else:
                        cur["ph"] += ph
                pos += n
                if ph in PAUSE and pos < len(pcm) - int(0.05 * sr):
                    # cut here and insert a short breath of silence
                    pieces.append(pcm[last_cut:pos])
                    out_pos += pos - last_cut
                    gap = np.zeros(int(PAUSE[ph] * sr), dtype=np.int16)
                    pieces.append(gap)
                    out_pos += len(gap)
                    last_cut = pos
            if cur:
                cur["end"] = (out_pos + pos - last_cut) / sr
                words.append(cur)
            pieces.append(pcm[last_cut:])
            out_pos += len(pcm) - last_cut
            if gap_after:
                gap = np.zeros(int(PHRASE_GAP * sr), dtype=np.int16)
                pieces.append(gap)
                out_pos += len(gap)
        pcm = np.concatenate(pieces)
        raw = OUT / f"{key}.raw.wav"
        with wave.open(str(raw), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(sr)
            w.writeframes(pcm.tobytes())
        # broadcast polish: rumble cut, presence lift, gentle compression, 44.1k
        subprocess.run(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(raw), "-af",
             "highpass=f=85,equalizer=f=180:t=q:w=1:g=1.5,equalizer=f=3500:t=q:w=1.2:g=2.5,"
             "acompressor=threshold=-20dB:ratio=3:attack=5:release=80:makeup=2,aresample=44100",
             "-ac", "1", "-sample_fmt", "s16", str(OUT / f"{key}.wav")],
            check=True,
        )
        raw.unlink()
        # "3D" is two phoneme words (three, dee); give the label to the first
        tw = display.split()
        labels = []
        for t in tw:
            labels += ([t, "3D"] if t == "3D" else [t])
        for i, wd in enumerate(words):
            wd["word"] = labels[i] if len(labels) == len(words) else wd["ph"]
            wd["start"] = round(wd["start"], 3)
            wd["end"] = round(wd["end"], 3)
        meta[key] = {"text": display, "duration": round(len(pcm) / sr, 3), "words": words}
        print(f"{key:7s} {len(pcm) / sr:5.2f}s  " + " ".join(f"{w['word']}({w['ph']})@{w['start']:.2f}" for w in words))
    (ROOT / "src/vosu/vo.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()

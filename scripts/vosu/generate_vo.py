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
# "Vohsoo" spells the brand phonetically (/voʊsuː/, VOH-soo); on screen it stays VOSU.
LINES = {
    "intro": "Meet Vohsoo.",
    "studio": "Your AI studio for video, image, audio, and 3D.",
    "nodes": "Turn ideas into cinematic sequences.",
    "tools": "Pro tools, one click away.",
    "market": "And get paid on the Creator Marketplace.",
    "outro": "Vohsoo. What are you creating today?",
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", required=True)
    ap.add_argument("--length-scale", type=float, default=1.06)
    args = ap.parse_args()

    voice = PiperVoice.load(args.voice, config_path=args.voice + ".json", include_alignments=True)
    # the list line and the brand intro get a slightly more measured read
    pace = {"intro": 1.12, "studio": 1.14}
    OUT.mkdir(parents=True, exist_ok=True)
    meta = {}
    for key, text in LINES.items():
        audio, words, sr, t0 = [], [], None, 0
        cfg = SynthesisConfig(length_scale=pace.get(key, args.length_scale), noise_scale=0.6, noise_w_scale=0.7)
        for chunk in voice.synthesize(text, cfg, include_alignments=True):
            sr = chunk.sample_rate
            pos = t0
            cur = None
            for al in chunk.phoneme_alignments:
                n = int(al.num_samples)
                if al.phoneme in (" ", "^", "$") or al.phoneme in ".,?!":
                    if cur:
                        cur["end"] = pos / sr
                        words.append(cur)
                        cur = None
                elif cur is None:
                    cur = {"ph": al.phoneme, "start": pos / sr}
                else:
                    cur["ph"] += al.phoneme
                pos += n
            if cur:
                cur["end"] = pos / sr
                words.append(cur)
            audio.append(chunk.audio_int16_array)
            t0 += len(chunk.audio_int16_array)
        pcm = np.concatenate(audio)
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
        # attach the display words (counts match for these lines; fall back to phonemes)
        tw = text.replace(",", "").replace(".", "").replace("?", "").split()
        for i, wd in enumerate(words):
            wd["word"] = tw[i] if len(tw) == len(words) else wd["ph"]
            wd["start"] = round(wd["start"], 3)
            wd["end"] = round(wd["end"], 3)
        meta[key] = {"text": text, "duration": round(len(pcm) / sr, 3), "words": words}
        print(f"{key:7s} {len(pcm) / sr:5.2f}s  " + " ".join(f"{w['word']}@{w['start']:.2f}" for w in words))
    (ROOT / "src/vosu/vo.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()

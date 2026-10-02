#!/usr/bin/env bash
# Assemble the "Construct" film: three VOSU-generated 5s clips (Kling O3, chained
# by shared keyframes) + the synthesized soundtrack -> out/construct.mp4
# Usage: scripts/building/assemble.sh <clipA.mp4> <clipB.mp4> <clipC.mp4>
set -euo pipefail
cd "$(dirname "$0")/../.."
[ -f public/building/soundtrack.wav ] || node scripts/building/generate-audio.mjs

# Each clip is normalised to exactly 5.000s @ 30fps 1920x1080. Clips share their
# boundary frames, so a straight cut (with a 2-frame dissolve to hide any
# encoder mismatch) reads as one continuous shot.
ffmpeg -hide_banner -loglevel error -y \
  -i "$1" -i "$2" -i "$3" -i public/building/soundtrack.wav \
  -filter_complex "
    [0:v]scale=1920:1080:flags=lanczos,fps=30,setsar=1,trim=duration=5.0667,setpts=PTS-STARTPTS[a];
    [1:v]scale=1920:1080:flags=lanczos,fps=30,setsar=1,trim=duration=5.0667,setpts=PTS-STARTPTS[b];
    [2:v]scale=1920:1080:flags=lanczos,fps=30,setsar=1,trim=duration=5.0667,setpts=PTS-STARTPTS[c];
    [a][b]xfade=transition=fade:duration=0.0667:offset=5.0[ab];
    [ab][c]xfade=transition=fade:duration=0.0667:offset=10.0,
      trim=duration=15,
      eq=contrast=1.04:saturation=1.05,
      vignette=angle=PI/5,
      fade=t=in:st=0:d=0.3,fade=t=out:st=14.5:d=0.5[v]" \
  -map "[v]" -map 3:a -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p \
  -c:a aac -b:a 256k -shortest -movflags +faststart out/construct.mp4
echo "wrote out/construct.mp4"

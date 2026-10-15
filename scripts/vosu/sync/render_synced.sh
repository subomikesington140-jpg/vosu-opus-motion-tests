#!/usr/bin/env bash
# Re-pace a cut of the VOSU film to a supplied voiceover, changing nothing else.
#
# The chosen cut (default 157d7bd, the first version) is checked out into a temporary
# worktree. Only the sync layer is added on top: the voice, a time map from that cut's
# own word timings to the voice (build_sync.py), frame remapping (VosuSynced.tsx) and
# time-mapped sound design (generate-audio-sync.patch). Design, animation and music
# are the cut's own.
#
# Prerequisite: python3 scripts/vosu/align_vo.py --audio <voice> --model-dir <kokoro>
# Usage: scripts/vosu/sync/render_synced.sh [base-commit] [output.mp4]
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
BASE=${1:-157d7bd}
OUT=${2:-$ROOT/out/vosu-promo-synced.mp4}
WT=$(mktemp -d "${TMPDIR:-/tmp}/vosu-sync.XXXX")/base
git -C "$ROOT" worktree add --detach "$WT" "$BASE" >/dev/null
trap 'git -C "$ROOT" worktree remove --force "$WT"' EXIT
ln -s "$ROOT/node_modules" "$WT/node_modules"
cd "$WT"

git apply "$ROOT/scripts/vosu/sync/generate-audio-sync.patch"
git apply "$ROOT/scripts/vosu/sync/vosupromo-audio-prop.patch"
mkdir -p src/vosu/sync public/vosu/sync
cp "$ROOT/src/vosu/sync/voice.json" src/vosu/sync/
cp "$ROOT/public/vosu/sync/voice.wav" public/vosu/sync/
cp "$ROOT/src/vosu/VosuSynced.tsx" src/vosu/
python3 - <<'PY'
from pathlib import Path
p = Path("src/Root.tsx"); s = p.read_text()
s = s.replace("import vosuTimeline from './vosu/timeline.json';",
              "import vosuTimeline from './vosu/timeline.json';\nimport {VosuSynced} from './vosu/VosuSynced';\nimport vosuWarp from './vosu/sync/warp.json';")
s = s.replace("  </>\n);", "    <Composition id=\"VosuSynced\" component={VosuSynced} durationInFrames={vosuWarp.durationInFrames} fps={30} width={W} height={H} />\n  </>\n);")
p.write_text(s)
PY

python3 "$ROOT/scripts/vosu/build_sync.py" --root "$WT"
node scripts/vosu/generate-audio.mjs --sync
npx remotion render VosuSynced "$OUT" --log=error
cp src/vosu/sync/warp.json "$ROOT/src/vosu/sync/warp.json"
echo "rendered $OUT from $BASE"

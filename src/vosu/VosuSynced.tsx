import React from 'react';
import {AbsoluteFill, Audio, Freeze, staticFile, useCurrentFrame} from 'remotion';
import {VosuPromo} from './VosuPromo';
import warp from './sync/warp.json';

/**
 * The VOSU film re-paced to the supplied voiceover. Every output frame shows the
 * original film at the moment the time map points to (see scripts/vosu/build_sync.py),
 * so the visuals are unchanged and only their timing follows the voice.
 */
export const VosuSynced: React.FC = () => {
  const f = useCurrentFrame();
  const map = warp.frameMap;
  const old = map[Math.min(map.length - 1, Math.max(0, Math.round(f)))];
  return (
    <AbsoluteFill>
      <Freeze frame={old}>
        <VosuPromo withAudio={false} />
      </Freeze>
      <Audio src={staticFile('vosu/sync/soundtrack.wav')} />
    </AbsoluteFill>
  );
};

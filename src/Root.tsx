import React from 'react';
import {Composition} from 'remotion';
import {Showreel} from './Showreel';
import {VosuPromo} from './vosu/VosuPromo';
import vosuTimeline from './vosu/timeline.json';
import {ArchFilm} from './building/ArchFilm';
import archTimeline from './building/timeline.json';
import {T} from './lib/timing';
import {H, W} from './theme';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Showreel" component={Showreel} durationInFrames={T.durationInFrames} fps={T.fps} width={W} height={H} />
    <Composition id="VosuPromo" component={VosuPromo} durationInFrames={vosuTimeline.durationInFrames} fps={vosuTimeline.fps} width={W} height={H} />
    <Composition id="ArchFilm" component={ArchFilm} durationInFrames={archTimeline.durationInFrames} fps={archTimeline.fps} width={W} height={H} />
  </>
);

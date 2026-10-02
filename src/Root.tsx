import React from 'react';
import {Composition} from 'remotion';
import {Showreel} from './Showreel';
import {T} from './lib/timing';
import {H, W} from './theme';

export const RemotionRoot: React.FC = () => (
  <Composition id="Showreel" component={Showreel} durationInFrames={T.durationInFrames} fps={T.fps} width={W} height={H} />
);

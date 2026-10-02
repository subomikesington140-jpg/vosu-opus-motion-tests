import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {Grain} from './components/Grain';
import {Hud} from './components/Hud';
import {loadFonts} from './fonts';
import {beat, pulse, T} from './lib/timing';
import {noise3} from './lib/noise';
import {Ignition} from './scenes/Ignition';
import {KineticType} from './scenes/KineticType';
import {Morph} from './scenes/Morph';
import {Swarm} from './scenes/Swarm';
import {Dive} from './scenes/Dive';
import {Drop} from './scenes/Drop';
import {Resolve} from './scenes/Resolve';
import {COLORS} from './theme';

loadFonts();

const S = T.scenes;
const IMPACTS = [beat(T.cues.shatterBeat), beat(T.cues.dropBeat), beat(T.cues.finalBeat)];
const BUMPS = T.cues.typeLetterBeats.map(beat).concat(T.cues.morphBeats.map(beat));

/** Global handheld-style camera shake, driven by the impact cues. */
const Shake: React.FC<{children: React.ReactNode}> = ({children}) => {
  const f = useCurrentFrame();
  const amp = 22 * pulse(f, IMPACTS, 0.16) + 4 * pulse(f, BUMPS, 0.3) + 0.8;
  const x = noise3(f * 0.35, 0, 0) * amp;
  const y = noise3(0, f * 0.35, 10) * amp;
  const r = noise3(5, 5, f * 0.3) * amp * 0.04;
  return <AbsoluteFill style={{transform: `translate(${x}px, ${y}px) rotate(${r}deg) scale(1.03)`}}>{children}</AbsoluteFill>;
};

const scene = (k: keyof typeof S) => ({from: S[k].from, durationInFrames: S[k].to - S[k].from});

export const Showreel: React.FC = () => (
  <AbsoluteFill style={{background: COLORS.ink}}>
    <Shake>
      <Sequence {...scene('ignition')} name="01 Ignition"><Ignition /></Sequence>
      <Sequence {...scene('type')} name="02 Kinetic Type"><KineticType /></Sequence>
      <Sequence {...scene('morph')} name="03 Morph"><Morph /></Sequence>
      <Sequence {...scene('swarm')} name="04 Swarm"><Swarm /></Sequence>
      <Sequence {...scene('dive')} name="05 Depth"><Dive /></Sequence>
      <Sequence {...scene('drop')} name="06 Drop"><Drop /></Sequence>
      <Sequence {...scene('resolve')} name="07 Resolve"><Resolve /></Sequence>
    </Shake>
    <Hud />
    <Grain />
    <Audio src={staticFile('audio/soundtrack.wav')} />
  </AbsoluteFill>
);

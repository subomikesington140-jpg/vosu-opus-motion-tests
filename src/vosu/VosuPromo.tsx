import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile} from 'remotion';
import {Grain} from '../components/Grain';
import {loadFonts} from '../fonts';
import {BRAND, VT} from './lib';
import {LogoOpen} from './scenes/LogoOpen';
import {Studio} from './scenes/Studio';
import {Nodes} from './scenes/Nodes';
import {Tools} from './scenes/Tools';
import {Market} from './scenes/Market';
import {EndCard} from './scenes/EndCard';

loadFonts();

const S = VT.scenes;
const seq = (k: keyof typeof S) => ({from: S[k].from, durationInFrames: S[k].to - S[k].from});

/**
 * VOSU — 15s product film. Scenes overlap for their transitions; the JSX order
 * sets stacking (the logo sits over the studio for the fly-through, the market
 * over the end card for the dive into white).
 */
export const VosuPromo: React.FC = () => (
  <AbsoluteFill style={{background: BRAND.bg}}>
    <Sequence {...seq('studio')} name="02 Studio"><Studio /></Sequence>
    <Sequence {...seq('logo')} name="01 Logo"><LogoOpen /></Sequence>
    <Sequence {...seq('nodes')} name="03 Nodes"><Nodes /></Sequence>
    <Sequence {...seq('tools')} name="04 Tools"><Tools /></Sequence>
    <Sequence {...seq('end')} name="06 End card"><EndCard /></Sequence>
    <Sequence {...seq('market')} name="05 Marketplace"><Market /></Sequence>
    <Grain opacity={0.05} vignette={0.3} />
    <Audio src={staticFile('vosu/soundtrack.wav')} />
  </AbsoluteFill>
);

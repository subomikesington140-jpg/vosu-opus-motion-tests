import React from 'react';
import {AbsoluteFill, Audio, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {useThree} from '@react-three/fiber';
import {ThreeCanvas} from '@remotion/three';
import {EffectComposer, Bloom, ToneMapping, SMAA} from '@react-three/postprocessing';
import {ToneMappingMode} from 'postprocessing';
import * as THREE from 'three';
import {ArchScene} from './Building';
import {Overlay} from './Overlay';
import {Grain} from '../components/Grain';
import {loadFonts} from '../fonts';

loadFonts();

/**
 * The post-processing composer wires up its passes after the first render, so
 * the first frame each render tab draws would come out black. Render once more
 * (after layout) before Remotion captures the frame.
 */
const SecondPass: React.FC<{frame: number}> = ({frame}) => {
  const advance = useThree((s) => s.advance);
  React.useEffect(() => {
    const h = delayRender('second render pass');
    const id = requestAnimationFrame(() => {
      advance(performance.now());
      continueRender(h);
    });
    return () => {
      cancelAnimationFrame(id);
      continueRender(h);
    };
  }, [frame, advance]);
  return null;
};

export const ArchFilm: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const t = frame / fps;
  return (
    <AbsoluteFill style={{background: '#04060a'}}>
      <ThreeCanvas
        width={width}
        height={height}
        shadows="soft"
        dpr={1}
        gl={{antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true}}
        camera={{fov: 30, near: 0.5, far: 2000, position: [0, 10, 80]}}
        onCreated={({gl}) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <ArchScene t={t} />
        <SecondPass frame={frame} />
        <EffectComposer multisampling={0} frameBufferType={THREE.UnsignedByteType}>
          <Bloom intensity={0.75} luminanceThreshold={0.82} luminanceSmoothing={0.2} mipmapBlur radius={0.7} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          <SMAA />
        </EffectComposer>
      </ThreeCanvas>
      <Overlay t={t} />
      <Grain opacity={0.06} vignette={0.42} />
      <Audio src={staticFile('building/soundtrack.wav')} />
    </AbsoluteFill>
  );
};

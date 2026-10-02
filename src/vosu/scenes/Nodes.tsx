import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {E, keys, lerp, prog, springAt} from '../../lib/ease';
import {Backdrop, Bokeh} from '../Backdrop';
import {A, BRAND, MotionBlur, UI, VT, wordFrame} from '../lib';

const FROM = VT.scenes.nodes.from;
const C = VT.cues;
const BG = (A as unknown as Record<string, Record<string, string>>)._colors.nodesBg;

const NODES = [
  {id: 'node_upload', at: C.nodePops[0]},
  {id: 'node_gen1', at: C.nodePops[1]},
  {id: 'node_gen2', at: C.nodePops[2]},
  {id: 'node_gen3', at: C.nodePops[3]},
  {id: 'node_video', at: Math.round(wordFrame('cinematic'))},
];

// connection ports read off the screenshot (source px); pulses ride node-editor style curves
const LINKS: {a: [number, number]; b: [number, number]; at: number}[] = [
  {a: [276, 84], b: [392, 131], at: C.nodePops[1] - 6},
  {a: [600, 106], b: [712, 447], at: wordFrame('cinematic') - 10},
  {a: [605, 311], b: [712, 447], at: wordFrame('cinematic') - 6},
  {a: [606, 494], b: [712, 447], at: wordFrame('cinematic') - 2},
];
const bez = (a: [number, number], b: [number, number], t: number) => {
  const dx = (b[0] - a[0]) * 0.5;
  const p1 = [a[0] + dx, a[1]];
  const p2 = [b[0] - dx, b[1]];
  const u = 1 - t;
  return [
    u * u * u * a[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * b[0],
    u * u * u * a[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * b[1],
  ];
};

/**
 * 03 — "Turn ideas into cinematic sequences." The real node graph assembles:
 * nodes pop in, the actual wires are revealed left to right, signal pulses run
 * along them, and the camera tracks the chain to the video generator.
 */
export const Nodes: React.FC = () => {
  const g = useCurrentFrame() + FROM;

  // camera keyframes in source px
  const KF = [FROM, 166, 186, 206, 226, 242];
  const fx = keys(g, KF, [230, 300, 540, 800, 530, 530], E.quartInOut);
  const fy = keys(g, KF, [175, 200, 340, 525, 340, 335], E.quartInOut);
  const zoom = keys(g, KF, [2.05, 1.9, 1.6, 1.95, 1.45, 1.5], E.quartInOut);

  // in: rides the studio's whip pan; out: vertical swipe shared with the tools scene
  const whip = prog(g, C.whip, 12, E.expoInOut);
  const inX = 1920 * (1 - whip);
  const inBlur = Math.abs(1920 * (whip - prog(g - 1, C.whip, 12, E.expoInOut))) * 0.3;
  const out = prog(g, C.swipe, 14, E.expoInOut);
  const outY = -1080 * out;
  const outBlur = Math.abs(1080 * (out - prog(g - 1, C.swipe, 14, E.expoInOut))) * 0.3;

  const wireX = keys(g, [150, 212], [270, 960], E.quartInOut);
  const vid = NODES[4].at;
  const vidGlow = prog(g, vid, 8, E.expoOut) * (1 - prog(g, vid + 14, 22, E.quartInOut));
  const vn = [698, 433, 932, 628];

  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <MotionBlur id="nodes-blur" x={inBlur} y={outBlur} />
      <AbsoluteFill style={{background: BG, transform: `translate(${inX}px, ${outY}px)`, filter: inBlur + outBlur > 0.5 ? 'url(#nodes-blur)' : undefined}}>
        <Backdrop base={BG} intensity={0} parallaxX={-fx * 0.6} parallaxY={-fy * 0.6} />
        <div style={{position: 'absolute', left: 960 - fx * zoom, top: 560 - fy * zoom, width: 1000, height: 700, transform: `scale(${zoom})`, transformOrigin: '0 0'}}>
          <UI id="node_wires" style={{clipPath: `inset(0 ${Math.max(0, 960 - wireX)}px 0 0)`}} />
          {/* signal pulses */}
          <svg width={1000} height={700} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
            {LINKS.map((l, i) => {
              const t = prog(g, l.at, 14, E.quartInOut);
              if (t <= 0 || t >= 1) return null;
              return [0, 0.06, 0.12].map((lag, j) => {
                const [x, y] = bez(l.a, l.b, Math.max(0, t - lag));
                return <circle key={`${i}-${j}`} cx={x} cy={y} r={3.2 - j} fill={j ? BRAND.magenta : '#FFB27A'} opacity={1 - j * 0.3} style={{filter: 'drop-shadow(0 0 4px #FF6A3D)'}} />;
              });
            })}
          </svg>
          {/* glow around the video generator as it lands */}
          <div
            style={{
              position: 'absolute',
              left: vn[0] + 14,
              top: vn[1] + 14,
              width: vn[2] - vn[0] - 28,
              height: vn[3] - vn[1] - 28,
              borderRadius: 14,
              background: BRAND.gradient,
              filter: 'blur(22px)',
              opacity: vidGlow * 0.8,
            }}
          />
          {NODES.map(({id, at}) => {
            const s = springAt(g, at - 3, 0.45, 0.55);
            const vis = prog(g, at - 3, 5);
            return <UI key={id} id={id} style={{opacity: vis, transform: `translateY(${(1 - s) * 18}px) scale(${lerp(0.88, 1, s)})`}} />;
          })}
        </div>
        {/* the real canvas stays flat; depth comes from foreground bokeh */}
        <Bokeh parallaxX={-fx * zoom} parallaxY={-fy * zoom} opacity={0.06} />
      </AbsoluteFill>
      {/* real breadcrumb from the editor's top bar, pinned like a title */}
      {(() => {
        const p = prog(g, FROM + 6, 14, E.expoOut) * (1 - prog(g, 182, 10, E.quartInOut));
        const a = A.node_breadcrumb;
        return (
          <div style={{position: 'absolute', left: 70, top: 56, width: a.w * 1.5, height: a.h * 1.5, opacity: p, transform: `translateY(${(1 - p) * -16}px)`}}>
            <UI id="node_breadcrumb" k={1.5} ox={a.x} oy={a.y} />
          </div>
        );
      })()}
    </AbsoluteFill>
  );
};

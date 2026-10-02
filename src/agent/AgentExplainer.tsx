import React from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {E, clamp01, lerp, prog, springAt} from '../lib/ease';
import {loadFonts} from '../fonts';
import {Arrow, Bed, Calendar, Check, Pin, Plane, Spark, Wallet, Weather} from './icons';
import T from './timeline.json';
import VO from './vo.json';

loadFonts();

// ---------------------------------------------------------------- design tokens
const BG = '#F4F2ED';
const INK = '#16171B';
const SUB = '#5E5F66';
const GREY = '#A3A3A8';
const LINE = '#CFCCC4';
const BLUE = '#2F5BFF';
const AMBER = '#F0952B';
const GREEN = '#1E9E63';
const CARD = '#FFFFFF';
const SHADOW = '0 18px 40px rgba(20,22,30,0.08), 0 3px 8px rgba(20,22,30,0.06)';
const SANS = '"Plus Jakarta Sans SemiBold", sans-serif';
const SANS_B = '"Plus Jakarta Sans ExtraBold", sans-serif';
const DISPLAY = '"Inter Tight Black", sans-serif';
const MONO = '"JetBrains Mono", monospace';
const C = T.cues;

type Line = keyof typeof VO;
/** Absolute time (s) of word `i` of a voiceover line. */
const W = (line: Line, i: number) => T.vo[line] + VO[line].words[i].start;

// ---------------------------------------------------------------- world layout (px in canvas space)
const AG = {x: 900, y: 0, r: 92};
const ROWS = [-170, 0, 170];
const STEP_X = 1460; // card left
const STEP_W = 400;
const TOOL_X = 2260; // node centre
const CHIP_X = 2345;
const RES = {x: 3250, y: 0, w: 540, h: 470};
const STAGE_X = [0, 900, 1660, 2440, 3250];

// tool activations land on the word that names them
const ACT = [W('tools', 8), W('tools', 10), W('tools', 13)].map((t) => t - 0.3);
const STEP_IN = [W('plan', 4), W('plan', 5), W('plan', 6)].map((t) => t - 0.15);
const TAG_IN = [W('need', 2), W('need', 4), W('need', 7)].map((t) => t - 0.1);
const TOOLS_IN = W('tools', 4);
const TOGETHER = T.vo.together;
const RESULT_HIT = W('result', 3);

// ---------------------------------------------------------------- camera: one continuous move along the diagram
type Key = [number, number, number, number]; // t, cx, cy, zoom
const CAM: Key[] = [
  [0, 0, 0, 1.42],
  [2.9, 60, 0, 1.3],
  [4.4, 900, 10, 1.32],
  [6.3, 1010, 10, 1.22],
  [7.6, 1380, 0, 1.16],
  [9.5, 1440, 0, 1.15],
  [10.9, 2080, 0, 1.1],
  [14.7, 2170, 0, 1.1],
  [15.9, 2930, 0, 1.12],
  [18.0, 2965, 0, 1.15],
  [19.3, 1565, -30, 0.47],
  [20, 1565, -30, 0.465],
];
function cam(t: number) {
  const k = CAM;
  const ch = (c: 1 | 2 | 3) => {
    if (t <= k[0][0]) return k[0][c];
    if (t >= k[k.length - 1][0]) return k[k.length - 1][c];
    let i = 0;
    while (t > k[i + 1][0]) i++;
    const tan = (j: number) => {
      if (j === 0 || j === k.length - 1) return 0;
      const a = (k[j][c] - k[j - 1][c]) / (k[j][0] - k[j - 1][0]);
      const b = (k[j + 1][c] - k[j][c]) / (k[j + 1][0] - k[j][0]);
      return a * b <= 0 ? 0 : (a + b) / 2;
    };
    const h = k[i + 1][0] - k[i][0];
    const u = (t - k[i][0]) / h;
    const u2 = u * u;
    const u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * k[i][c] + (u3 - 2 * u2 + u) * h * tan(i) + (-2 * u3 + 3 * u2) * k[i + 1][c] + (u3 - u2) * h * tan(i + 1);
  };
  return {x: ch(1), y: ch(2), z: ch(3)};
}

// ---------------------------------------------------------------- connectors
type Pt = [number, number];
/** Horizontal-tangent cubic from a to b. */
const curve = (a: Pt, b: Pt) => {
  const dx = (b[0] - a[0]) * 0.5;
  return {a, c1: [a[0] + dx, a[1]] as Pt, c2: [b[0] - dx, b[1]] as Pt, b};
};
type Curve = ReturnType<typeof curve>;
const at = (c: Curve, t: number): Pt => {
  const m = 1 - t;
  const f = (i: 0 | 1) => m * m * m * c.a[i] + 3 * m * m * t * c.c1[i] + 3 * m * t * t * c.c2[i] + t * t * t * c.b[i];
  return [f(0), f(1)];
};
const d = (c: Curve) => `M${c.a} C${c.c1} ${c.c2} ${c.b}`;

const Wire: React.FC<{c: Curve; p: number; color?: string; width?: number; dashed?: boolean; opacity?: number}> = ({c, p, color = LINE, width = 2.5, dashed, opacity = 1}) =>
  p <= 0 ? null : (
    <path
      d={d(c)}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      pathLength={1}
      strokeDasharray={dashed ? '0.012 0.012' : '1 1'}
      strokeDashoffset={dashed ? 0 : 1 - p}
      style={{opacity: dashed ? opacity * clamp01(p * 3) : opacity}}
    />
  );
/** A glowing packet travelling along a connector during [t0, t1]. */
const Packet: React.FC<{c: Curve; t: number; t0: number; t1: number; color: string; reverse?: boolean}> = ({c, t, t0, t1, color, reverse}) => {
  const u = (t - t0) / (t1 - t0);
  if (u < 0 || u > 1) return null;
  const e = E.quartInOut(u);
  const [x, y] = at(c, reverse ? 1 - e : e);
  const fade = Math.min(1, u * 8, (1 - u) * 8);
  return (
    <g opacity={fade}>
      <circle cx={x} cy={y} r={16} fill={color} opacity={0.18} />
      <circle cx={x} cy={y} r={7} fill={color} />
    </g>
  );
};

const L1 = curve([392, 0], [AG.x - AG.r - 6, 0]);
const L_STEP = ROWS.map((y) => curve([AG.x + AG.r + 6, 0], [STEP_X, y]));
const L_TOOL = ROWS.map((y) => curve([STEP_X + STEP_W, y], [TOOL_X - 58, y]));
const L_RES = ROWS.map((y) => curve([CHIP_X + 300, y], [RES.x - RES.w / 2 - 4, y * 0.25]));

// ---------------------------------------------------------------- composition
export const AgentExplainer: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const cm = cam(t);
  const sum = prog(t, C.summary, 1.0, E.quartInOut);
  return (
    <AbsoluteFill style={{background: BG, overflow: 'hidden'}}>
      {/* dot grid, locked to the canvas */}
      <AbsoluteFill
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(22,23,27,0.13) 1.3px, transparent 1.8px)',
          backgroundSize: `${36 * cm.z}px ${36 * cm.z}px`,
          backgroundPosition: `${960 - cm.x * cm.z}px ${540 - cm.y * cm.z}px`,
          opacity: 0.8,
        }}
      />
      <div style={{position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: `translate(${960 - cm.x * cm.z}px, ${540 - cm.y * cm.z}px) scale(${cm.z})`}}>
        <Wires t={t} />
        <StageLabels t={t} sum={sum} z={cm.z} />
        <PromptBox t={t} />
        <Agent t={t} />
        <Tags t={t} />
        <Steps t={t} />
        <Tools t={t} />
        <Result t={t} />
      </div>
      <Stepper t={t} />
      <Title t={t} />
      <Audio src={staticFile('agent/soundtrack.wav')} />
    </AbsoluteFill>
  );
};

const abs = (x: number, y: number, s: React.CSSProperties = {}): React.CSSProperties => ({position: 'absolute', left: x, top: y, ...s});
const pop = (t: number, t0: number) => {
  const s = springAt(t * 30, t0 * 30, 0.32, 0.55);
  return {opacity: clamp01((t - t0) / 0.15), transform: `scale(${lerp(0.6, 1, s)})`};
};

// ---------------------------------------------------------------- wires layer
const Wires: React.FC<{t: number}> = ({t}) => (
  <svg style={{position: 'absolute', left: -1000, top: -1000, overflow: 'visible'}} width={6000} height={2000} viewBox="-1000 -1000 6000 2000">
    <Wire c={L1} p={prog(t, C.send - 0.05, 0.5, E.quartInOut)} />
    <Packet c={L1} t={t} t0={C.dotLaunch} t1={C.dotArrive} color={BLUE} />
    {L_STEP.map((c, i) => (
      <React.Fragment key={i}>
        <Wire c={c} p={prog(t, STEP_IN[i] - 0.1, 0.45, E.quartInOut)} />
        <Packet c={c} t={t} t0={STEP_IN[i] - 0.1} t1={STEP_IN[i] + 0.35} color={BLUE} />
      </React.Fragment>
    ))}
    {L_TOOL.map((c, i) => (
      <React.Fragment key={i}>
        <Wire c={c} p={prog(t, TOOLS_IN + 0.05 + i * 0.06, 0.4, E.quartInOut)} dashed opacity={0.9} />
        <Wire c={c} p={prog(t, ACT[i] - 0.05, 0.35, E.quartInOut)} color={i === 0 || t > ACT[i] ? BLUE : LINE} width={2.5} />
        <Packet c={c} t={t} t0={ACT[i] - 0.05} t1={ACT[i] + 0.3} color={BLUE} />
        <Packet c={c} t={t} t0={ACT[i] + 0.45} t1={ACT[i] + 0.8} color={AMBER} reverse />
      </React.Fragment>
    ))}
    {L_RES.map((c, i) => (
      <React.Fragment key={i}>
        <Wire c={c} p={prog(t, TOGETHER - 0.05 + i * 0.07, 0.45, E.quartInOut)} color={AMBER} />
        <Packet c={c} t={t} t0={TOGETHER + 0.1 + i * 0.08} t1={TOGETHER + 0.6 + i * 0.08} color={AMBER} />
      </React.Fragment>
    ))}
  </svg>
);

// ---------------------------------------------------------------- 01 prompt
const PROMPT = 'Plan a weekend in Lisbon under $800';
const PromptBox: React.FC<{t: number}> = ({t}) => {
  const n = Math.floor(clamp01((t - C.typeStart) / (C.typeEnd - C.typeStart)) * PROMPT.length);
  const typed = PROMPT.slice(0, n);
  const caret = t < C.send + 0.1 && Math.floor(t * 2.4) % 2 === 0;
  const press = t > C.send && t < C.send + 0.25 ? 0.88 + 0.12 * ((t - C.send) / 0.25) : 1;
  const sent = prog(t, C.dotArrive, 0.6);
  const p = pop(t, 0.15);
  return (
    <div style={abs(-390, -54, {width: 780, height: 108, ...p, opacity: p.opacity * lerp(1, 0.55, sent)})}>
      <div style={{position: 'absolute', inset: 0, background: CARD, borderRadius: 30, boxShadow: SHADOW, border: `1.5px solid ${t > C.typeStart && t < C.send + 0.3 ? 'rgba(47,91,255,0.45)' : 'rgba(22,23,27,0.06)'}`}} />
      <div style={abs(34, 0, {height: 108, display: 'flex', alignItems: 'center', fontFamily: SANS, fontSize: 30, color: n ? INK : GREY, whiteSpace: 'nowrap'})}>
        {n ? typed : 'Ask your agent anything…'}
        {caret && <span style={{display: 'inline-block', width: 3, height: 36, background: BLUE, marginLeft: n ? 3 : -2, transform: n ? 'none' : 'translateX(-100%)'}} />}
      </div>
      <div style={abs(780 - 86, 22, {width: 64, height: 64, borderRadius: 32, background: n === PROMPT.length ? BLUE : '#DCDDE3', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${press})`})}>
        <Arrow size={30} color="#fff" stroke={2.4} />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- 02 agent
const Agent: React.FC<{t: number}> = ({t}) => {
  const p = pop(t, 3.15);
  const wake = prog(t, C.dotArrive - 0.05, 0.5, E.expoOut);
  const busy = clamp01((t - C.dotArrive) / 0.4) * (1 - prog(t, 17.8, 0.6));
  const spin = t * 30 + busy * t * 50;
  const breathe = 1 + 0.025 * Math.sin(t * 3.2) * busy;
  const ring = (t - C.dotArrive) / 0.9;
  return (
    <div style={abs(AG.x - AG.r, AG.y - AG.r, {width: AG.r * 2, height: AG.r * 2, ...p})}>
      {ring > 0 && ring < 1 && <div style={abs(-AG.r * ring * 0.9, -AG.r * ring * 0.9, {width: AG.r * 2 * (1 + ring * 0.9), height: AG.r * 2 * (1 + ring * 0.9), borderRadius: '50%', border: `3px solid ${BLUE}`, opacity: 1 - ring})} />}
      <svg style={abs(-60, -60)} width={AG.r * 2 + 120} height={AG.r * 2 + 120} viewBox={`${-AG.r - 60} ${-AG.r - 60} ${AG.r * 2 + 120} ${AG.r * 2 + 120}`}>
        <g transform={`rotate(${spin})`}>
          <ellipse rx={AG.r + 34} ry={AG.r + 12} fill="none" stroke={BLUE} strokeOpacity={0.25 + 0.25 * wake} strokeWidth={2} strokeDasharray="4 10" />
          <circle cx={AG.r + 34} cy={0} r={6} fill={BLUE} opacity={wake} />
        </g>
        <g transform={`rotate(${-spin * 0.7 + 60})`}>
          <ellipse rx={AG.r + 22} ry={AG.r + 40} fill="none" stroke={BLUE} strokeOpacity={0.15 + 0.2 * wake} strokeWidth={1.5} />
          <circle cx={0} cy={-(AG.r + 40)} r={4.5} fill={AMBER} opacity={wake} />
        </g>
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `radial-gradient(circle at 35% 30%, #6E8CFF 0%, ${BLUE} 55%, #1C3BD1 100%)`,
          boxShadow: `0 20px 50px rgba(47,91,255,${0.18 + 0.25 * wake}), 0 0 0 ${10 * wake}px rgba(47,91,255,0.10)`,
          transform: `scale(${breathe})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          filter: `saturate(${lerp(0.25, 1, wake)}) brightness(${lerp(1.25, 1, wake)})`,
        }}
      >
        <Spark size={78} color="#fff" fill="#fff" stroke={1} style={{transform: `rotate(${busy * Math.sin(t * 2) * 8}deg)`}} />
      </div>
    </div>
  );
};

const TAGS: [React.FC<{size?: number; color?: string}>, string, number, number][] = [
  [Pin, 'LISBON', AG.x - 205, -190],
  [Calendar, '2 DAYS', AG.x + 40, -205],
  [Wallet, 'UNDER $800', AG.x - 120, 175],
];
const Tags: React.FC<{t: number}> = ({t}) => (
  <>
    <svg style={{position: 'absolute', left: -1000, top: -1000, overflow: 'visible'}} width={4000} height={2000} viewBox="-1000 -1000 4000 2000">
      {TAGS.map(([, , x, y], i) => {
        const pr = prog(t, TAG_IN[i] - 0.05, 0.3, E.quartInOut);
        const tx = x + 85;
        const ty = y + 24;
        return pr > 0 ? <line key={i} x1={AG.x} y1={AG.y} x2={lerp(AG.x, tx, pr)} y2={lerp(AG.y, ty, pr)} stroke={BLUE} strokeOpacity={0.35 * lerp(1, 0.5, prog(t, 7, 0.6))} strokeWidth={2} strokeDasharray="3 6" /> : null;
      })}
    </svg>
    {TAGS.map(([Icon, label, x, y], i) => {
      const p = pop(t, TAG_IN[i]);
      return (
        <div key={label} style={abs(x, y, {...p, opacity: p.opacity * lerp(1, 0.55, prog(t, 7, 0.6))})}>
          <div style={{display: 'flex', alignItems: 'center', gap: 10, padding: '11px 18px', borderRadius: 26, background: CARD, boxShadow: SHADOW, border: '1.5px solid rgba(47,91,255,0.25)'}}>
            <Icon size={22} color={BLUE} />
            <span style={{fontFamily: MONO, fontSize: 18, letterSpacing: '0.12em', color: INK, whiteSpace: 'nowrap'}}>{label}</span>
          </div>
        </div>
      );
    })}
  </>
);

// ---------------------------------------------------------------- 03 plan
const STEPS = ['Find flights', 'Pick a hotel', 'Check the weather'];
const Steps: React.FC<{t: number}> = ({t}) => (
  <>
    {STEPS.map((s, i) => {
      const a = STEP_IN[i] + 0.2;
      const pr = prog(t, a, 0.45, E.quintOut);
      if (pr <= 0) return null;
      const done = prog(t, ACT[i] + 0.8, 0.25, E.expoOut);
      const active = t > ACT[i] - 0.1 && t < ACT[i] + 0.9;
      return (
        <div key={s} style={abs(STEP_X, ROWS[i] - 42, {width: STEP_W, height: 84, opacity: pr, transform: `translateX(${(1 - pr) * -30}px)`})}>
          <div style={{position: 'absolute', inset: 0, background: CARD, borderRadius: 22, boxShadow: SHADOW, border: `1.5px solid ${active ? BLUE : 'rgba(22,23,27,0.06)'}`}} />
          <div style={abs(20, 20, {width: 44, height: 44, borderRadius: 22, background: done > 0 ? GREEN : 'transparent', border: `2px solid ${done > 0 ? GREEN : BLUE}`, display: 'flex', alignItems: 'center', justifyContent: 'center'})}>
            {done > 0 ? (
              <Check size={26} color="#fff" stroke={3} style={{transform: `scale(${lerp(0.4, 1, done)})`}} />
            ) : (
              <span style={{fontFamily: SANS_B, fontSize: 20, color: BLUE}}>{i + 1}</span>
            )}
          </div>
          <div style={abs(84, 0, {height: 84, display: 'flex', alignItems: 'center', fontFamily: SANS, fontSize: 28, color: INK, whiteSpace: 'nowrap'})}>{s}</div>
        </div>
      );
    })}
  </>
);

// ---------------------------------------------------------------- 04 tools
const TOOLS: [React.FC<{size?: number; color?: string; stroke?: number}>, string, string][] = [
  [Plane, 'FLIGHT SEARCH', '$312 return'],
  [Bed, 'HOTEL COMPARE', '4.7★ · $90 / night'],
  [Weather, 'WEATHER', '24°C · Sunny'],
];
const Tools: React.FC<{t: number}> = ({t}) => (
  <>
    {TOOLS.map(([Icon, name, val], i) => {
      const p = pop(t, TOOLS_IN + 0.15 + i * 0.08);
      const on = prog(t, ACT[i] + 0.25, 0.3, E.expoOut);
      const chip = prog(t, ACT[i] + 0.45, 0.4, E.quintOut);
      const flash = Math.max(0, 1 - Math.abs(t - (ACT[i] + 0.3)) / 0.35);
      return (
        <React.Fragment key={name}>
          <div style={abs(TOOL_X - 56, ROWS[i] - 56, {width: 112, height: 112, ...p})}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 30,
                background: CARD,
                boxShadow: on > 0 ? `0 18px 40px rgba(240,149,43,${0.12 + 0.2 * flash}), 0 0 0 ${8 * flash}px rgba(240,149,43,0.15)` : SHADOW,
                border: `2px solid ${on > 0 ? AMBER : 'rgba(22,23,27,0.08)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon size={54} color={on > 0 ? AMBER : GREY} stroke={1.9} />
            </div>
          </div>
          <div style={abs(CHIP_X, ROWS[i] - 46, {opacity: p.opacity})}>
            <div style={{fontFamily: MONO, fontSize: 18, letterSpacing: '0.14em', color: on > 0 ? '#C26F0E' : SUB, whiteSpace: 'nowrap'}}>{name}</div>
            <div
              style={{
                marginTop: 10,
                display: 'inline-block',
                padding: '10px 18px',
                borderRadius: 16,
                background: 'rgba(240,149,43,0.12)',
                fontFamily: SANS_B,
                fontSize: 25,
                color: INK,
                whiteSpace: 'nowrap',
                opacity: chip,
                transform: `translateX(${(1 - chip) * -24}px)`,
              }}
            >
              {val}
            </div>
          </div>
        </React.Fragment>
      );
    })}
  </>
);

// ---------------------------------------------------------------- 05 result
const ROWS_RES: [React.FC<{size?: number; color?: string}>, string, string][] = [
  [Plane, 'Return flight', '$312'],
  [Bed, 'Hotel · 2 nights', '$180'],
  [Weather, 'Forecast', '24°C ☀'],
];
const Result: React.FC<{t: number}> = ({t}) => {
  const a = TOGETHER + 0.45;
  const p = pop(t, a);
  if (t < a) return null;
  const total = Math.round(492 * E.expoOut(clamp01((t - (a + 1.0)) / 0.7)));
  const badge = pop(t, RESULT_HIT - 0.05);
  return (
    <div style={abs(RES.x - RES.w / 2, RES.y - RES.h / 2, {width: RES.w, height: RES.h, ...p})}>
      <div style={{position: 'absolute', inset: 0, background: CARD, borderRadius: 32, boxShadow: '0 30px 70px rgba(20,22,30,0.12), 0 4px 10px rgba(20,22,30,0.06)'}} />
      <div style={abs(40, 36)}>
        <div style={{fontFamily: MONO, fontSize: 15, letterSpacing: '0.18em', color: SUB}}>YOUR TRIP · 2 DAYS</div>
        <div style={{fontFamily: SANS_B, fontSize: 40, color: INK, marginTop: 8}}>Lisbon weekend</div>
      </div>
      {ROWS_RES.map(([Icon, label, val], i) => {
        const r = prog(t, a + 0.25 + i * 0.16, 0.35, E.quintOut);
        return (
          <div key={label} style={abs(40, 148 + i * 66, {width: RES.w - 80, height: 50, display: 'flex', alignItems: 'center', opacity: r, transform: `translateY(${(1 - r) * 12}px)`})}>
            <Icon size={26} color={AMBER} />
            <span style={{fontFamily: SANS, fontSize: 25, color: INK, marginLeft: 16, flex: 1}}>{label}</span>
            <span style={{fontFamily: SANS_B, fontSize: 25, color: INK}}>{val}</span>
          </div>
        );
      })}
      <div style={abs(40, 352, {width: RES.w - 80, height: 1.5, background: 'rgba(22,23,27,0.1)', transform: `scaleX(${prog(t, a + 0.75, 0.4, E.quartInOut)})`, transformOrigin: '0 0'})} />
      <div style={abs(40, 372, {width: RES.w - 80, display: 'flex', alignItems: 'center', opacity: prog(t, a + 0.9, 0.3)})}>
        <span style={{fontFamily: SANS_B, fontSize: 30, color: INK, flex: 1}}>Total</span>
        <span style={{fontFamily: SANS_B, fontSize: 44, color: INK}}>${total}</span>
      </div>
      <div style={abs(RES.w - 200, -24, {...badge, transformOrigin: '50% 50%'})}>
        <div style={{display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 24, background: GREEN, boxShadow: '0 10px 24px rgba(30,158,99,0.3)'}}>
          <Check size={22} color="#fff" stroke={3} />
          <span style={{fontFamily: MONO, fontSize: 16, letterSpacing: '0.12em', color: '#fff', whiteSpace: 'nowrap'}}>UNDER BUDGET</span>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- stage labels in the canvas (they become the summary diagram)
const StageLabels: React.FC<{t: number; sum: number; z: number}> = ({t, sum, z}) => {
  const grow = lerp(1, 0.95 / z, sum);
  return (
    <>
      {T.stages.map((s, i) => {
        const a = prog(t, C.summary + 0.2 + i * 0.1, 0.5, E.quintOut);
        const active = false;
        return (
          <div key={s.key} style={abs(STAGE_X[i], -330, {transform: `translate(-50%, ${(1 - a) * 30 - 50}%) scale(${grow})`, opacity: a})}>
            <div style={{display: 'flex', alignItems: 'center', gap: 12, whiteSpace: 'nowrap'}}>
              <span style={{fontFamily: MONO, fontSize: 16, color: active || sum > 0 ? BLUE : GREY}}>0{i + 1}</span>
              <span style={{fontFamily: MONO, fontSize: 18, letterSpacing: '0.2em', color: active || sum > 0 ? INK : SUB}}>{s.label}</span>
            </div>
          </div>
        );
      })}
      {/* arrows between stages in the summary */}
      {sum > 0 &&
        STAGE_X.slice(0, -1).map((x, i) => {
          const mid = (x + STAGE_X[i + 1]) / 2;
          const ap = prog(t, C.summary + 0.35 + i * 0.1, 0.4, E.quintOut);
          return (
            <div key={i} style={abs(mid, -330, {transform: `translate(-50%, -50%) scale(${grow * 1.2})`, opacity: ap})}>
              <Arrow size={30} color={BLUE} stroke={2.2} />
            </div>
          );
        })}
    </>
  );
};

// ---------------------------------------------------------------- screen-space: stage tracker + title
const Stepper: React.FC<{t: number}> = ({t}) => {
  const a = prog(t, 0.2, 0.5) * (1 - prog(t, C.summary - 0.2, 0.4));
  const idx = T.stages.findIndex((s) => t >= s.from && t < s.to);
  const GAP = 230;
  const x0 = 960 - (GAP * (T.stages.length - 1)) / 2;
  return (
    <div style={{opacity: a}}>
      <div style={abs(x0, 78, {width: GAP * (T.stages.length - 1), height: 2, background: 'rgba(22,23,27,0.1)'})} />
      <div style={abs(x0, 78, {width: GAP * Math.max(0, idx + clamp01((t - T.stages[Math.max(0, idx)].from) / 0.5) - 1), height: 2, background: BLUE})} />
      {T.stages.map((s, i) => {
        const done = i < idx;
        const on = i === idx;
        return (
          <div key={s.key} style={abs(x0 + i * GAP, 79, {transform: 'translate(-50%, -50%)'})}>
            <div style={{width: on ? 16 : 10, height: on ? 16 : 10, borderRadius: 8, margin: '0 auto', background: done || on ? BLUE : BG, border: `2px solid ${done || on ? BLUE : 'rgba(22,23,27,0.2)'}`, boxShadow: on ? '0 0 0 6px rgba(47,91,255,0.15)' : 'none'}} />
            <div style={{position: 'absolute', top: 30, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontFamily: MONO, fontSize: 14, letterSpacing: '0.18em', color: on ? INK : done ? SUB : GREY}}>{s.label}</div>
          </div>
        );
      })}
    </div>
  );
};

const Title: React.FC<{t: number}> = ({t}) => {
  const a = prog(t, C.title, 0.7, E.quintOut);
  if (a <= 0) return null;
  return (
    <div style={abs(960, 150, {transform: `translate(-50%, ${(1 - a) * 20}px)`, opacity: a, textAlign: 'center'})}>
      <div style={{fontFamily: MONO, fontSize: 16, letterSpacing: '0.3em', color: BLUE}}>EXPLAINED IN 20 SECONDS</div>
      <div style={{fontFamily: DISPLAY, fontSize: 76, color: INK, marginTop: 14, letterSpacing: '-0.01em', whiteSpace: 'nowrap'}}>How an AI agent works</div>
    </div>
  );
};

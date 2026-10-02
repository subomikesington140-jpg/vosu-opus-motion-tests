import React from 'react';
import {AbsoluteFill} from 'remotion';
import {E, clamp01, lerp, prog} from '../lib/ease';
import {project} from './camera';
import {highlight} from './Building';
import {BASE, C, COL_X, H, HD, HW, LEVELS, PH_X1, PROGRAM, ROOF, levelMid, levelY} from './model';
import timeline from './timeline.json';

const CYAN = '#9fe3ff';
const BRASS = '#e3bd7c';
const PAPER = 'rgba(242,240,234,0.94)';
const DIM = 'rgba(242,240,234,0.5)';
const MONO = '"JetBrains Mono", monospace';
const LIGHT = '"Inter Tight Light", "Inter Tight", sans-serif';

const mono = (size: number, color = PAPER, track = 0.22): React.CSSProperties => ({fontFamily: MONO, fontSize: size, letterSpacing: `${track}em`, color, whiteSpace: 'nowrap'});
const light = (size: number, color = PAPER, track = 0.16): React.CSSProperties => ({fontFamily: LIGHT, fontSize: size, letterSpacing: `${track}em`, color, whiteSpace: 'nowrap', textTransform: 'uppercase'});
const abs = (x: number, y: number, extra: React.CSSProperties = {}): React.CSSProperties => ({position: 'absolute', left: x, top: y, ...extra});

/** Fades in at `a`, out at `b` (each over `d` seconds). */
const life = (t: number, a: number, b: number, d = 0.35) => prog(t, a, d, E.quintOut) * (1 - prog(t, b, d, E.quartInOut));

export const Overlay: React.FC<{t: number}> = ({t}) => (
  <AbsoluteFill style={{pointerEvents: 'none'}}>
    <Hud t={t} />
    <TechLabels t={t} />
    <BuildLabels t={t} />
    <ProgramLabels t={t} />
    <SpecTags t={t} />
    <Panel t={t} />
    <Title t={t} />
  </AbsoluteFill>
);

// ---------------------------------------------------------------- frame + HUD
const Hud: React.FC<{t: number}> = ({t}) => {
  const a = prog(t, 0.1, 0.6);
  const stage = timeline.stages.find((s) => t >= s.from && t < s.to) ?? timeline.stages[timeline.stages.length - 1];
  const sub =
    stage.key === 'build'
      ? t < C.levels[0] ? 'FOUNDATION' : t < C.walls ? 'STRUCTURE' : t < C.windows ? 'STRUCTURAL WALLS' : t < C.balconies ? 'GLAZING' : 'BALCONIES'
      : '';
  const f = Math.round(t * 30);
  const tc = `00:00:${String(Math.floor(f / 30)).padStart(2, '0')}:${String(f % 30).padStart(2, '0')}`;
  const intro = life(t, C.introLabel, C.panel - 0.2, 0.5);
  const corner = (x: number, y: number, sx: number, sy: number) => (
    <div key={`${x}${y}`} style={abs(x, y, {width: 26, height: 26, borderLeft: sx > 0 ? `1px solid ${DIM}` : undefined, borderRight: sx < 0 ? `1px solid ${DIM}` : undefined, borderTop: sy > 0 ? `1px solid ${DIM}` : undefined, borderBottom: sy < 0 ? `1px solid ${DIM}` : undefined})} />
  );
  return (
    <div style={{opacity: a}}>
      {corner(44, 44, 1, 1)}
      {corner(1920 - 70, 44, -1, 1)}
      {corner(44, 1080 - 70, 1, -1)}
      {corner(1920 - 70, 1080 - 70, -1, -1)}

      {/* project label */}
      <div style={abs(84, 78, {opacity: intro})}>
        <div style={{...mono(13, BRASS, 0.34), transform: `translateY(${(1 - prog(t, C.introLabel, 0.6)) * 10}px)`}}>PROJECT 01</div>
        <div style={{width: 240 * prog(t, C.introLabel + 0.15, 0.7, E.quartInOut), height: 1, background: DIM, margin: '10px 0 10px'}} />
        <div style={{...mono(13, PAPER, 0.26), opacity: prog(t, C.introLabel + 0.35, 0.5)}}>LUXURY RESIDENTIAL DEVELOPMENT</div>
      </div>

      <div style={abs(1920 - 84, 78, {transform: 'translateX(-100%)', textAlign: 'right', opacity: 1 - prog(t, C.panel - 0.3, 0.5)})}>
        <div style={mono(12, DIM, 0.24)}>SITE 01 · SCALE 1:200</div>
        <div style={{...mono(12, DIM, 0.24), marginTop: 8}}>MIXED-USE · REV A</div>
      </div>

      {/* stage indicator */}
      <div style={abs(84, 1080 - 112, {opacity: 1 - prog(t, C.title - 0.3, 0.4)})}>
        <div style={{display: 'flex', gap: 18, alignItems: 'baseline'}}>
          <span style={mono(13, PAPER, 0.28)}>{stage.label}</span>
          {sub && <span style={mono(12, CYAN, 0.28)}>{sub}</span>}
        </div>
        <div style={{position: 'relative', width: 360, height: 1, background: 'rgba(242,240,234,0.18)', marginTop: 14}}>
          <div style={{position: 'absolute', left: 0, top: 0, height: 1, width: 360 * clamp01(t / 15), background: BRASS}} />
          {timeline.stages.map((s) => (
            <div key={s.key} style={{position: 'absolute', left: 360 * (s.from / 15), top: -3, width: 1, height: 7, background: DIM}} />
          ))}
        </div>
      </div>
      <div style={abs(1920 - 84, 1080 - 100, {transform: 'translateX(-100%)', ...mono(12, DIM, 0.2)})}>{tc}</div>
    </div>
  );
};

// ---------------------------------------------------------------- technical annotations (wireframe stage)
const TechLabels: React.FC<{t: number}> = ({t}) => {
  const tech = 1 - prog(t, C.skyStart - 0.3, 0.8, E.quartInOut);
  const dim = tech * (1 - 0.45 * prog(t, C.program[0], 0.5));
  if (tech <= 0) return null;
  const y = BASE;
  const tags: [string, [number, number, number], number][] = [
    ['32.00', [0, y, HD + 9.5], C.dimStart + 0.4],
    ['18.00', [-HW - 9.5, y, 0], C.dimStart + 0.5],
    [`+${(ROOF - BASE).toFixed(2)}`, [HW + 6, ROOF + 1.2, HD], C.dimStart + 0.7],
  ];
  const bubbles: [string, [number, number, number], number][] = [
    ...COL_X.map((x, i) => [String(i + 1), [x, y, HD + 14.2], C.wireStart + 0.35 + 0.05 * i] as [string, [number, number, number], number]),
    ['A', [-HW - 14.2, y, -7.8], C.wireStart + 0.45],
    ['B', [-HW - 14.2, y, 7.8], C.wireStart + 0.5],
  ];
  return (
    <div style={{opacity: dim}}>
      {tags.map(([txt, p, d]) => {
        const s = project(t, p);
        return (
          <div key={txt} style={abs(s.x, s.y, {transform: 'translate(-50%, -150%)', ...mono(12, CYAN, 0.18), opacity: prog(t, d, 0.4)})}>
            {txt}
          </div>
        );
      })}
      {bubbles.map(([txt, p, d]) => {
        const s = project(t, p);
        return (
          <div key={txt} style={abs(s.x, s.y, {transform: 'translate(-50%, -50%)', ...mono(11, CYAN, 0), opacity: 0.85 * prog(t, d, 0.4)})}>
            {txt}
          </div>
        );
      })}
    </div>
  );
};

/** A leader: dot at the anchor, a hairline that draws out, then text. */
const Leader: React.FC<{x: number; y: number; dx: number; draw: number; color: string; children: React.ReactNode; textIn: number; align?: 'left' | 'right'}> = ({x, y, dx, draw, color, children, textIn, align = 'left'}) => {
  const len = Math.abs(dx) * draw;
  const dir = Math.sign(dx);
  return (
    <>
      <div style={abs(x - 3, y - 3, {width: 6, height: 6, borderRadius: 3, background: color, opacity: Math.min(1, draw * 3)})} />
      <div style={abs(dir > 0 ? x : x - len, y, {width: len, height: 1, background: color, opacity: 0.85})} />
      <div
        style={abs(x + dx + dir * 14, y, {
          transform: `translate(${align === 'right' ? '-100%' : '0'}, -50%) translateX(${dir * (1 - textIn) * 12}px)`,
          opacity: textIn,
        })}
      >
        {children}
      </div>
    </>
  );
};

// ---------------------------------------------------------------- construction labels
const BuildLabels: React.FC<{t: number}> = ({t}) => {
  const out = 1 - prog(t, C.buildLabelsOut, 0.4, E.quartInOut);
  if (out <= 0 || t < C.foundation) return null;
  const items: [string, [number, number, number], number][] = [
    ['FOUNDATION', [-HW - 3, BASE, HD + 3.5], C.foundation + 0.1],
    ...H.map((_, i) => [`LEVEL 0${i + 1}`, [-HW, levelY(i) + 0.2, HD], C.levels[i] + 0.08] as [string, [number, number, number], number]),
  ];
  return (
    <div style={{opacity: out}}>
      {items.map(([txt, p, a], k) => {
        if (t < a) return null;
        const s = project(t, p);
        const next = k < items.length - 1 ? prog(t, items[k + 1][2], 0.3) : 0;
        return (
          <div key={txt} style={{opacity: lerp(1, 0.42, next)}}>
            <Leader x={s.x} y={s.y} dx={-70} draw={prog(t, a, 0.3, E.quartInOut)} color={CYAN} textIn={prog(t, a + 0.1, 0.3)} align="right">
              <span style={mono(13, k === 0 ? CYAN : PAPER, 0.26)}>{txt}</span>
            </Leader>
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------- program labels
const ProgramLabels: React.FC<{t: number}> = ({t}) => {
  if (t < C.program[0] || t > C.programOut + 0.6) return null;
  const COL = 1250;
  return (
    <>
      {H.map((_, i) => {
        const a = C.program[i];
        if (t < a) return null;
        const x1 = i === LEVELS - 1 ? PH_X1 : HW + 0.6;
        const s = project(t, [x1, levelMid(i), HD]);
        const env = highlight(t, i);
        const out = 1 - prog(t, C.programOut, 0.45, E.quartInOut);
        return (
          <div key={i} style={{opacity: out * lerp(0.55, 1, clamp01(env * 1.6))}}>
            <Leader x={s.x} y={s.y} dx={COL - s.x} draw={prog(t, a, 0.4, E.quartInOut)} color={BRASS} textIn={prog(t, a + 0.18, 0.35)}>
              <span style={mono(14, BRASS, 0.24)}>LEVEL 0{i + 1}</span>
              <span style={{...mono(14, DIM, 0.1), margin: '0 12px'}}>—</span>
              <span style={light(22, PAPER, 0.14)}>{PROGRAM[i]}</span>
            </Leader>
          </div>
        );
      })}
    </>
  );
};

// ---------------------------------------------------------------- material spec tags
const SpecTags: React.FC<{t: number}> = ({t}) => {
  const tags: [string, string, [number, number, number]][] = [
    ['M01', 'BOARD-FORMED CONCRETE', [-HW - 2.4, levelY(1) - 0.15, HD + 2.4]],
    ['M02', 'LOW-IRON REFLECTIVE GLAZING', [-6, levelMid(2), HD - 0.6]],
    ['M03', 'BRONZE ANODISED METAL', [-HW - 2.4, levelY(3) + 1.1, HD + 2.4]],
  ];
  return (
    <>
      {tags.map(([id, txt, p], k) => {
        const a = C.specTags[k];
        const l = life(t, a, C.specOut + k * 0.08, 0.35);
        if (l <= 0) return null;
        const s = project(t, p);
        const COL = 470;
        return (
          <div key={id} style={{opacity: l}}>
            <Leader x={s.x} y={s.y} dx={Math.min(-40, COL - s.x)} draw={prog(t, a, 0.35, E.quartInOut)} color={PAPER} textIn={prog(t, a + 0.12, 0.35)} align="right">
              <span style={mono(11, BRASS, 0.24)}>{id}</span>
              <span style={{...mono(12, PAPER, 0.22), marginLeft: 12}}>{txt}</span>
            </Leader>
          </div>
        );
      })}
    </>
  );
};

// ---------------------------------------------------------------- presentation panel
const Panel: React.FC<{t: number}> = ({t}) => {
  const a = C.panel;
  if (t < a) return null;
  const X = 1290;
  const Y = 250;
  const line = prog(t, a, 0.6, E.quartInOut);
  const row = (k: number) => {
    const p = prog(t, a + 0.15 + k * 0.12, 0.45, E.quintOut);
    return {opacity: p, transform: `translateY(${(1 - p) * 14}px)`};
  };
  const scrim = prog(t, a - 0.2, 0.8, E.quartInOut);
  return (
    <>
    <div style={abs(0, 0, {width: 1920, height: 1080, opacity: scrim, background: 'linear-gradient(90deg, rgba(3,5,10,0) 52%, rgba(3,5,10,0.62) 70%, rgba(3,5,10,0.72) 100%), linear-gradient(0deg, rgba(3,5,10,0.6) 0%, rgba(3,5,10,0) 30%)'})} />
    <div style={abs(X, Y)}>
      <div style={abs(0, 0, {width: 1, height: 520 * line, background: DIM})} />
      <div style={abs(36, 0, {width: 520})}>
        <div style={{...mono(13, BRASS, 0.36), ...row(0)}}>PROJECT 01</div>
        <div style={{...light(34, PAPER, 0.12), lineHeight: 1.18, marginTop: 18, ...row(1)}}>
          LUXURY RESIDENTIAL
          <br />
          DEVELOPMENT
        </div>
        <div style={{width: 440 * prog(t, a + 0.45, 0.6, E.quartInOut), height: 1, background: DIM, margin: '30px 0 26px'}} />
        {[
          ['5 LEVELS', `HEIGHT ${(ROOF - BASE).toFixed(2)} M`],
          ['RESIDENTIAL + COMMERCIAL', 'MIXED-USE PROGRAM'],
        ].map(([big, small], k) => (
          <div key={big} style={{marginBottom: 20, ...row(2 + k)}}>
            <div style={light(22, PAPER, 0.14)}>{big}</div>
            <div style={{...mono(11, DIM, 0.24), marginTop: 6}}>{small}</div>
          </div>
        ))}
        <div style={{...mono(12, BRASS, 0.3), marginTop: 8, ...row(4)}}>PROJECT PLAN</div>
        <Plan t={t} start={a + 0.75} />
      </div>
    </div>
    </>
  );
};

/** Ground-floor plan that draws itself (footprint, grid, core, balconies). */
const Plan: React.FC<{t: number; start: number}> = ({t, start}) => {
  const S = 9; // px per metre
  const ox = 30;
  const oy = 16;
  const P = (x: number, z: number) => [ox + (x + HW + 2.4) * S, oy + (z + HD) * S];
  const path = (pts: number[][]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const draw = (k: number, len = 400) => {
    const p = prog(t, start + k * 0.08, 0.55, E.quartInOut);
    return {strokeDasharray: len, strokeDashoffset: len * (1 - p)};
  };
  const foot = path([P(-HW, -HD), P(HW, -HD), P(HW, HD), P(-HW, HD), P(-HW, -HD)]);
  const core = path([P(-3, -9.4), P(3, -9.4), P(3, -5.8), P(-3, -5.8), P(-3, -9.4)]);
  const balc = path([P(6, HD), P(6, HD + 2.4), P(-HW - 2.4, HD + 2.4), P(-HW - 2.4, -3), P(-HW, -3)]);
  return (
    <svg width={400} height={230} style={{marginTop: 12, overflow: 'visible'}}>
      {COL_X.map((x, i) => {
        const [px, py0] = P(x, -HD - 2);
        const [, py1] = P(x, HD + 4);
        return <line key={i} x1={px} y1={py0} x2={px} y2={py1} stroke={CYAN} strokeOpacity={0.35} strokeWidth={1} style={draw(i * 0.3, 260)} />;
      })}
      <path d={foot} fill="none" stroke={PAPER} strokeWidth={1.4} style={draw(1, 900)} />
      <path d={core} fill="rgba(227,189,124,0.12)" stroke={BRASS} strokeWidth={1.2} style={draw(2, 200)} />
      <path d={balc} fill="none" stroke={PAPER} strokeOpacity={0.6} strokeWidth={1} strokeDasharray="4 3" style={{opacity: prog(t, start + 0.4, 0.4)}} />
      {COL_X.flatMap((x) => [-7.8, 7.8].map((z) => P(x, z))).map(([x, y], i) => (
        <rect key={i} x={x - 2} y={y - 2} width={4} height={4} fill={PAPER} opacity={prog(t, start + 0.3 + i * 0.02, 0.3)} />
      ))}
      <text x={P(0, HD)[0]} y={P(0, HD)[1] + 46} textAnchor="middle" style={{...mono(10, DIM, 0.24), opacity: prog(t, start + 0.5, 0.4)}} fill={DIM}>
        LEVEL 01 · 32.00 × 18.00 M
      </text>
    </svg>
  );
};

const Title: React.FC<{t: number}> = ({t}) => {
  const a = C.title;
  if (t < a) return null;
  const wipe = prog(t, a, 0.9, E.quartInOut);
  const track = lerp(0.42, 0.24, prog(t, a, 1.2, E.expoOut));
  return (
    <div style={abs(84, 880)}>
      <div style={{width: 64 * prog(t, a, 0.5, E.quartInOut), height: 2, background: BRASS, marginBottom: 22}} />
      <div style={{clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)`, ...light(52, PAPER, track)}}>THE FUTURE OF URBAN LIVING</div>
    </div>
  );
};

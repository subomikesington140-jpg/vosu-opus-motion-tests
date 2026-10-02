import timeline from '../timeline.json';

export const T = timeline;
export const FPB = timeline.framesPerBeat;
export const beat = (b: number) => b * FPB;

/** Frame of a cue, relative to a scene's start. */
export const local = (b: number, sceneFrom: number) => beat(b) - sceneFrom;

/**
 * Decaying pulse envelope triggered on each listed beat.
 * Returns 1 at the hit and falls off exponentially (k = decay per frame).
 */
export const pulse = (frame: number, hits: number[], k = 0.18) => {
  let v = 0;
  for (const h of hits) {
    const d = frame - h;
    if (d >= 0) v = Math.max(v, Math.exp(-d * k));
  }
  return v;
};

/** Every beat from a..b (exclusive), in frames. */
export const beatsBetween = (a: number, b: number, step = 1) => {
  const out: number[] = [];
  for (let x = a; x < b; x += step) out.push(beat(x));
  return out;
};

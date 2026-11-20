import { mulberry32, randRange } from "../sim/rng.js";
import type { InputFrame, Tuning } from "../sim/types.js";

function nightDurationS(night: 1 | 2 | 3, tuning: Tuning): number {
  if (night === 2) return tuning.night2_duration_s;
  if (night === 3) return tuning.night3_duration_s;
  return tuning.night1_duration_s;
}

/** Input ngẫu nhiên theo seed cho soak test. */
export function generateSoakFrames(seed: number, night: 1 | 2 | 3, tuning: Tuning): InputFrame[] {
  const totalTicks = Math.ceil(nightDurationS(night, tuning) * 60) + 120;
  const rng = mulberry32(seed);
  const byTick = new Map<number, InputFrame>();
  const frameAt = (t: number): InputFrame => {
    let f = byTick.get(t);
    if (!f) {
      f = { tick: t };
      byTick.set(t, f);
    }
    return f;
  };
  let move: [number, number] = [0, 1];

  for (let t = 0; t < totalTicks; t++) {
    if (t % 30 === 0) {
      const angle = randRange(rng, 0, Math.PI * 2);
      let mx = Math.round(Math.sin(angle));
      let mz = Math.round(Math.cos(angle));
      if (mx === 0 && mz === 0) mz = 1;
      move = [mx, mz];
      const f = frameAt(t);
      f.move = move;
      f.cam_yaw_deg = Math.floor(randRange(rng, 0, 360));
    }
    const pulse = (tick: number, key: keyof InputFrame, prob: number) => {
      if (rng() >= prob) return;
      frameAt(tick)[key] = true as never;
      if (tick + 1 < totalTicks) frameAt(tick + 1)[key] = false as never;
    };
    pulse(t, "jump", 0.05);
    pulse(t, "dash", 0.03);
    pulse(t, "pulse", 0.02);
    pulse(t, "interact", 0.1);
    const cur = byTick.get(t);
    if (cur && cur.move === undefined) cur.move = move;
  }
  return [...byTick.values()].sort((a, b) => a.tick - b.tick);
}
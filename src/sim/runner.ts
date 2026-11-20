import { heldAtTick, prevHeldAtTick } from "./input.js";
import type { InputFrame, Scenario, SimState, Tuning } from "./types.js";
import { DEFAULT_HELD } from "./types.js";
import { endLine, eventsToLines, snapshotLine } from "./serialize.js";
import { step } from "./step.js";
import { createInitialState } from "./world.js";

export interface RunHeadlessResult {
  lines: string[];
  finalState: SimState;
  ticksRun: number;
}

export function runHeadless(options: {
  seed: number;
  tuning: Tuning;
  scenario: Scenario | null;
  frames: InputFrame[];
  ticks: number;
  snapshotEvery: number;
  night?: 1 | 2 | 3;
}): RunHeadlessResult {
  const { seed, tuning, scenario, frames, ticks, snapshotEvery } = options;
  const night = options.night ?? 1;
  const state = createInitialState({ seed, scenario, tuning, night });
  const lines: string[] = [];

  const writeSnapshot = (s: SimState) => {
    if (s.tick % snapshotEvery === 0) lines.push(snapshotLine(s, tuning));
  };

  writeSnapshot(state);
  lines.push(
    JSON.stringify({
      type: "event",
      tick: 0,
      name: "night_start",
      data: { night },
    }),
  );

  let run = 0;
  for (let k = 0; k < ticks; k++) {
    if (state.state !== "playing") break;
    const held = frames.length ? heldAtTick(frames, k) : { ...DEFAULT_HELD };
    const prev = frames.length ? prevHeldAtTick(frames, k) : { ...DEFAULT_HELD };
    const events = step(state, tuning, held, prev);
    lines.push(...eventsToLines(events));
    writeSnapshot(state);
    run += 1;
    if (state.state !== "playing") break;
  }

  lines.push(endLine(state, run));
  return { lines, finalState: state, ticksRun: run };
}
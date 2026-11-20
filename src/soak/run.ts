import { runHeadless } from "../sim/runner.js";
import type { Tuning } from "../sim/types.js";
import { generateSoakFrames } from "./inputs.js";

export interface SoakResult {
  nights: number;
  crashes: number;
  results: ("won" | "lost")[];
  mem_start_mb: number;
  mem_end_mb: number;
  duration_s: number;
}

function rssMb(): number {
  return Math.round((process.memoryUsage().rss / (1024 * 1024)) * 10) / 10;
}

function nightDurationTicks(night: 1 | 2 | 3, tuning: Tuning): number {
  const s = night === 2 ? tuning.night2_duration_s : night === 3 ? tuning.night3_duration_s : tuning.night1_duration_s;
  return Math.ceil(s * 60) + 300;
}

export function runSoak(options: {
  baseSeed: number;
  nights: number;
  tuning: Tuning;
}): SoakResult {
  const { baseSeed, nights, tuning } = options;
  const results: ("won" | "lost")[] = [];
  let crashes = 0;
  const t0 = performance.now();
  let memStart = 0;
  let memEnd = 0;

  for (let i = 0; i < nights; i++) {
    const night = ((i % 3) + 1) as 1 | 2 | 3;
    const seed = baseSeed + i;
    const frames = generateSoakFrames(seed, night, tuning);
    const ticks = nightDurationTicks(night, tuning);
    try {
      const out = runHeadless({
        seed,
        tuning,
        scenario: null,
        frames,
        ticks,
        snapshotEvery: 10_000,
        night,
      });
      results.push(out.finalState.state === "won" ? "won" : "lost");
      if (i === 0) memStart = rssMb();
      memEnd = rssMb();
    } catch {
      crashes += 1;
      results.push("lost");
    }
  }

  return {
    nights,
    crashes,
    results,
    mem_start_mb: memStart,
    mem_end_mb: memEnd,
    duration_s: Math.round(((performance.now() - t0) / 1000) * 10) / 10,
  };
}
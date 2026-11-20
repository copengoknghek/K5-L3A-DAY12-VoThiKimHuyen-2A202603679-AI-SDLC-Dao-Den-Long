import { night1Map } from "./maps.js";
import { mulberry32 } from "./rng.js";
import { ISLAND_RADIUS, type Scenario, type Vec3 } from "./types.js";

/** Cảnh benchmark Đêm 1: 200 Bóng wander, 100 đom đóm, L1–L3 sáng fuel 100. */
export function buildBenchScenario(seed: number): Scenario {
  const rng = mulberry32(seed);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const maxR = ISLAND_RADIUS - 2;

  const shades: NonNullable<Scenario["shades"]> = [];
  for (let i = 0; i < 200; i++) {
    const t = (i + 0.5) / 200;
    const r = Math.sqrt(t) * maxR;
    const a = i * golden + rng() * 0.02;
    shades.push({
      id: `S${i + 1}`,
      pos: [Math.sin(a) * r, 0, Math.cos(a) * r],
      state: "wander",
    });
  }

  const motes: Vec3[] = [];
  for (let i = 0; i < 100; i++) {
    const t = (i + 0.5) / 100;
    const r = Math.sqrt(t) * (maxR - 2);
    const a = i * golden * 1.71 + 1.3 + rng() * 0.02;
    motes.push([Math.sin(a) * r, 0.5, Math.cos(a) * r]);
  }

  void night1Map();

  return {
    random_motes: false,
    random_shades: false,
    random_drifters: false,
    wind_enabled: false,
    bench_freeze: true,
    motes,
    shades,
    lanterns: [
      { id: "L1", lit: true, fuel: 100 },
      { id: "L2", lit: true, fuel: 100 },
      { id: "L3", lit: true, fuel: 100 },
    ],
    time_left_s: 99999,
  };
}
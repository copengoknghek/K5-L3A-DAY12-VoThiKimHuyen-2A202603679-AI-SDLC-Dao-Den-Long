import { mulberry32, randRange } from "./rng.js";
import type { Scenario, SimState, Tuning, Vec3 } from "./types.js";
import {
  ISLAND_RADIUS,
  LANTERN_RING_RADIUS,
  PLAY_MOTE_COUNT,
  PLAY_SHADE_COUNT,
} from "./types.js";

function defaultLanterns(count: number): SimState["lanterns"] {
  const lanterns: SimState["lanterns"] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i * 2 * Math.PI) / count;
    const x = Math.sin(angle) * LANTERN_RING_RADIUS;
    const z = Math.cos(angle) * LANTERN_RING_RADIUS;
    lanterns.push({
      id: `L${i + 1}`,
      pos: [x, 0, z],
      lit: false,
      deposited: 0,
    });
  }
  return lanterns;
}

function vecFromRaw(raw: Vec3 | number[]): Vec3 {
  return [raw[0], raw[1] ?? 0, raw[2]];
}

function spawnPlayMotes(rng: () => number, count: number): SimState["motes"] {
  const motes: SimState["motes"] = [];
  for (let i = 0; i < count; i++) {
    const angle = rng() * Math.PI * 2;
    const r = randRange(rng, 3, ISLAND_RADIUS - 5);
    motes.push({
      id: `M${i + 1}`,
      pos: [Math.sin(angle) * r, 0, Math.cos(angle) * r],
    });
  }
  motes.sort((a, b) => a.id.localeCompare(b.id));
  return motes;
}

function spawnPlayShades(rng: () => number, count: number): SimState["shades"] {
  const shades: SimState["shades"] = [];
  for (let i = 0; i < count; i++) {
    const angle = rng() * Math.PI * 2;
    const r = randRange(rng, 12, ISLAND_RADIUS - 8);
    shades.push({
      id: `S${i + 1}`,
      pos: [Math.sin(angle) * r, 1, Math.cos(angle) * r],
      state: "chase",
      stunS: 0,
    });
  }
  shades.sort((a, b) => a.id.localeCompare(b.id));
  return shades;
}

export function parseScenario(json: unknown): Scenario {
  if (json === null || typeof json !== "object") {
    throw new Error("Invalid scenario");
  }
  return json as Scenario;
}

export function createInitialState(args: {
  seed: number;
  scenario: Scenario | null;
  tuning: Tuning;
}): SimState {
  const { seed, scenario, tuning } = args;
  const rng = mulberry32(seed);
  const count = tuning.lantern_count_night1;

  let lanterns = defaultLanterns(count);
  let motes: SimState["motes"] = [];
  let shades: SimState["shades"] = [];
  const randomMotes = scenario?.random_motes !== false;
  const randomShades = scenario?.random_shades !== false;

  if (scenario?.lanterns) {
    for (const patch of scenario.lanterns) {
      const existing = lanterns.find((l) => l.id === patch.id);
      if (existing) {
        if (patch.pos) existing.pos = vecFromRaw(patch.pos);
        if (patch.deposited !== undefined) existing.deposited = patch.deposited;
        if (patch.lit !== undefined) existing.lit = patch.lit;
      } else {
        lanterns.push({
          id: patch.id,
          pos: patch.pos ? vecFromRaw(patch.pos) : [0, 0, 0],
          lit: patch.lit ?? false,
          deposited: patch.deposited ?? 0,
        });
      }
    }
    lanterns.sort((a, b) => a.id.localeCompare(b.id));
  }

  if (scenario?.motes) {
    motes = scenario.motes.map((m, i) => ({
      id: `M${i + 1}`,
      pos: vecFromRaw(m),
    }));
  } else if (randomMotes) {
    motes = spawnPlayMotes(rng, PLAY_MOTE_COUNT);
  }

  if (scenario?.shades) {
    shades = scenario.shades.map((s, i) => ({
      id: s.id ?? `S${i + 1}`,
      pos: vecFromRaw(s.pos),
      state: "chase" as const,
      stunS: 0,
    }));
  } else if (randomShades) {
    shades = spawnPlayShades(rng, PLAY_SHADE_COUNT);
  }

  const durationS = scenario?.time_left_s ?? tuning.night1_duration_s;
  const playerFlames =
    scenario?.player?.flames ?? tuning.flames;
  const playerCarried = scenario?.player?.carried ?? 0;
  const playerPos: Vec3 = scenario?.player?.pos
    ? vecFromRaw(scenario.player.pos)
    : [0, 0, 0];

  return {
    tick: 0,
    state: "playing",
    timeLeftS: durationS,
    durationS,
    score: 0,
    player: {
      pos: [...playerPos] as Vec3,
      vy: 0,
      flames: playerFlames,
      carried: playerCarried,
      invulnS: 0,
    },
    lanterns,
    shades,
    motes,
    pulseCooldownS: 0,
    reason: null,
    islandRadius: ISLAND_RADIUS,
  };
}
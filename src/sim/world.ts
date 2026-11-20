import { FLAMES_MAX, FUEL_MAX_SIXTIETHS, NIGHT_DURATION, START_MOTES } from "./constants.js";
import { mapForNight, type NightMap } from "./maps.js";
import { distXZ } from "./math.js";
import type {
  Scenario,
  SimCharm,
  SimMote,
  SimShade,
  SimState,
  Tuning,
  Vec3,
} from "./types.js";

function vecFromRaw(raw: Vec3 | number[]): Vec3 {
  return [raw[0], raw[1] ?? 0, raw[2]];
}

export function parseScenario(json: unknown): Scenario {
  if (json === null || typeof json !== "object") {
    throw new Error("Invalid scenario");
  }
  return json as Scenario;
}

function parseMotes(raw: Scenario["motes"]): SimMote[] {
  if (!raw) return [];
  return raw.map((m, i) => {
    if (Array.isArray(m)) {
      return {
        id: `M${i + 1}`,
        pos: vecFromRaw(m),
        kind: "random" as const,
        ttl: null,
        interactDelay: 0,
      };
    }
    return {
      id: m.id ?? `M${i + 1}`,
      pos: vecFromRaw(m.pos),
      kind: m.kind ?? "random",
      ttl: m.ttl_s !== undefined ? Math.round(m.ttl_s * 60) : null,
      interactDelay: 0,
    };
  });
}

export function createInitialState(args: {
  seed: number;
  scenario: Scenario | null;
  tuning: Tuning;
  night?: 1 | 2 | 3;
}): SimState {
  const night = args.night ?? 1;
  const { seed, scenario, tuning } = args;
  const map: NightMap = mapForNight(night);

  let lanterns = map.lanterns.map((l) => ({
    id: l.id,
    pos: [...l.pos] as Vec3,
    lit: false,
    deposited: 0,
    pushTicks: 0,
    fuelSixtieths: 0,
    everLit: false,
    relitCount: 0,
    scenarioPreset: false,
  }));

  if (scenario?.lanterns) {
    for (const patch of scenario.lanterns) {
      const existing = lanterns.find((l) => l.id === patch.id);
      const target =
        existing ??
        ({
          id: patch.id,
          pos: patch.pos ? vecFromRaw(patch.pos) : [0, 0, 0],
          lit: false,
          deposited: 0,
          pushTicks: 0,
          fuelSixtieths: 0,
          everLit: false,
          relitCount: 0,
          scenarioPreset: false,
        } as (typeof lanterns)[0]);
      if (!existing) lanterns.push(target);
      if (patch.pos) target.pos = vecFromRaw(patch.pos);
      if (patch.deposited !== undefined) target.deposited = patch.deposited;
      if (patch.ever_lit !== undefined) target.everLit = patch.ever_lit;
      if (patch.lit !== undefined) {
        target.lit = patch.lit;
        if (patch.lit) {
          target.scenarioPreset = true;
          target.everLit = patch.ever_lit ?? true;
          const fuelUnits = patch.fuel ?? 100;
          target.fuelSixtieths = Math.round(fuelUnits * 60);
        }
      } else if (patch.fuel !== undefined) {
        target.fuelSixtieths = Math.round(patch.fuel * 60);
      }
    }
    lanterns.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  }

  const randomMotes = scenario?.random_motes !== false;
  const randomShades = scenario?.random_shades !== false;
  const randomDrifters = scenario?.random_drifters !== false;
  const windEnabled = scenario?.wind_enabled !== false && night === 3;

  let motes: SimMote[] = [];
  if (scenario?.motes) {
    motes = parseMotes(scenario.motes);
  } else if (randomMotes) {
    const pts = map.moteSpawns.slice(0, START_MOTES);
    motes = pts.map((p, i) => ({
      id: `M${i + 1}`,
      pos: [...p] as Vec3,
      kind: "random" as const,
      ttl: null,
      interactDelay: 0,
    }));
  }

  let shades: SimShade[] = [];
  if (scenario?.shades) {
    shades = scenario.shades.map((s, i) => ({
      id: s.id ?? `S${i + 1}`,
      pos: vecFromRaw(s.pos),
      state: s.state ?? "wander",
      stateTicks: s.state_ticks_left ?? 0,
      interactDelay: 0,
      targetLanternId: s.target_lantern_id ?? null,
      drainLogTicks: 0,
    }));
  } else if (randomShades) {
    shades = [];
  }

  let drifters: SimState["drifters"] = [];
  if (scenario?.drifters) {
    drifters = scenario.drifters.map((d, i) => ({
      id: d.id ?? `D${i + 1}`,
      pos: vecFromRaw(d.pos),
      state: d.state ?? "idle",
      stolen: d.stolen ?? 0,
      stateTicks: 0,
      interactDelay: 0,
      facing: [1, 0] as [number, number],
    }));
  } else if (!randomDrifters) {
    drifters = [];
  }

  let charms: SimCharm[] = map.charms.map((c) => ({
    id: c.id,
    pos: [...c.pos] as Vec3,
    available: true,
    respawnTicks: 0,
  }));
  if (scenario?.charms) {
    charms = scenario.charms.map((c) => ({
      id: c.id,
      pos: c.pos ? vecFromRaw(c.pos) : [0, 0, 0],
      available: c.available ?? true,
      respawnTicks: c.respawn_s !== undefined ? Math.round(c.respawn_s * 60) : 0,
    }));
  }

  const durationS =
    scenario?.time_left_s ??
    (night === 2 ? tuning.night2_duration_s : night === 3 ? tuning.night3_duration_s : tuning.night1_duration_s) ??
    NIGHT_DURATION[night];

  const p = scenario?.player;
  const pos: Vec3 = p?.pos ? vecFromRaw(p.pos) : [...map.spawn];

  return {
    tick: 0,
    simTick: 0,
    night,
    paused: false,
    state: "playing",
    timeLeftS: durationS,
    durationS,
    score: 0,
    player: {
      pos,
      vel: [0, 0, 0],
      facing: [...map.facing],
      grounded: true,
      flames: p?.flames ?? tuning.flames ?? FLAMES_MAX,
      carried: p?.carried ?? 0,
      successfulLights: p?.successful_lights ?? 0,
      invulnTicks: p?.invuln_ticks ?? 0,
      dashTicks: 0,
      dashCdTicks: p?.dash_cd_ticks ?? 0,
      pulseCdTicks: p?.pulse_cd_ticks ?? 0,
      charmTicks: p?.charm_ticks ?? 0,
      fallWaitTicks: 0,
      launched: false,
    },
    lanterns,
    shades,
    motes,
    drifters,
    charms,
    reason: null,
    windActive: false,
    windDirDeg: 0,
    windTicks: windEnabled ? 0 : -1,
    rngState: seed >>> 0,
    nextMoteId: motes.length + 1,
    nextShadeId: shades.length + 1,
    nextDrifterId: drifters.length + 1,
    nightStartEmitted: false,
    benchFreeze: scenario?.bench_freeze === true,
  };
}

export function moteOccupies(motes: SimMote[], spawn: Vec3): boolean {
  return motes.some((m) => distXZ(m.pos, spawn) < 0.6);
}
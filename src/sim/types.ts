export type Vec3 = [number, number, number];

export type GameStateKind = "playing" | "won" | "lost" | "paused";
export type ShadeState = "spawning" | "wander" | "chase" | "recoil" | "stunned";
export type DrifterState = "idle" | "chase" | "flee" | "removed";
export type MoteKind = "random" | "dropped";

export interface ScoreTuning {
  per_mote: number;
  per_lantern: number;
  per_stun: number;
  per_second_left: number;
  per_flame_left: number;
}

export interface Tuning {
  player_speed: number;
  carry_capacity: number;
  lantern_cost: number;
  lantern_count_night1: number;
  pickup_radius: number;
  interact_radius: number;
  pulse_cost: number;
  pulse_radius: number;
  night1_duration_s: number;
  night2_duration_s: number;
  night3_duration_s: number;
  flames: number;
  invuln_s: number;
  hit_drop_ratio: number;
  pulse_stun_s: number;
  pulse_push_m: number;
  pulse_cooldown_s: number;
  dash_speed: number;
  dash_duration_s: number;
  dash_cooldown_s: number;
  safe_radius: number;
  shade_speed: number;
  shade_hit_radius: number;
  fall_enabled: boolean;
  score: ScoreTuning;
}

export interface HeldInput {
  move: [number, number];
  camYawDeg: number;
  jump: boolean;
  interact: boolean;
  pulse: boolean;
  dash: boolean;
  pause: boolean;
}

export const DEFAULT_HELD: HeldInput = {
  move: [0, 0],
  camYawDeg: 0,
  jump: false,
  interact: false,
  pulse: false,
  dash: false,
  pause: false,
};

export interface SimLantern {
  id: string;
  pos: Vec3;
  lit: boolean;
  deposited: number;
  pushTicks: number;
}

export interface SimShade {
  id: string;
  pos: Vec3;
  state: ShadeState;
  stateTicks: number;
  interactDelay: number;
}

export interface SimMote {
  id: string;
  pos: Vec3;
  kind: MoteKind;
  ttl: number | null;
  interactDelay: number;
}

export interface SimDrifter {
  id: string;
  pos: Vec3;
  state: DrifterState;
  stolen: number;
  stateTicks: number;
  interactDelay: number;
  facing: [number, number];
}

export interface SimCharm {
  id: string;
  pos: Vec3;
  available: boolean;
  respawnTicks: number;
}

export interface SimState {
  tick: number;
  simTick: number;
  night: 1 | 2 | 3;
  paused: boolean;
  state: "playing" | "won" | "lost";
  timeLeftS: number;
  durationS: number;
  score: number;
  player: {
    pos: Vec3;
    vel: Vec3;
    facing: [number, number];
    grounded: boolean;
    flames: number;
    carried: number;
    invulnTicks: number;
    dashTicks: number;
    dashCdTicks: number;
    pulseCdTicks: number;
    charmTicks: number;
    fallWaitTicks: number;
    launched: boolean;
  };
  lanterns: SimLantern[];
  shades: SimShade[];
  motes: SimMote[];
  drifters: SimDrifter[];
  charms: SimCharm[];
  reason: "all_lit" | "dawn" | "no_flames" | null;
  windActive: boolean;
  windDirDeg: number;
  windTicks: number;
  rngState: number;
  nextMoteId: number;
  nextShadeId: number;
  nextDrifterId: number;
  nightStartEmitted: boolean;
}

export interface ScenarioPlayer {
  pos?: Vec3;
  carried?: number;
  flames?: number;
  invuln_ticks?: number;
  dash_cd_ticks?: number;
  pulse_cd_ticks?: number;
  charm_ticks?: number;
}

export interface ScenarioShade {
  id?: string;
  pos: Vec3;
  state?: ShadeState;
  state_ticks_left?: number;
}

export interface ScenarioLantern {
  id: string;
  pos?: Vec3;
  deposited?: number;
  lit?: boolean;
}

export interface ScenarioDrifter {
  id?: string;
  pos: Vec3;
  state?: DrifterState;
  stolen?: number;
}

export interface ScenarioCharm {
  id: string;
  pos?: Vec3;
  available?: boolean;
  respawn_s?: number;
}

export interface Scenario {
  player?: ScenarioPlayer;
  random_motes?: boolean;
  random_shades?: boolean;
  random_drifters?: boolean;
  wind_enabled?: boolean;
  motes?: Vec3[] | { id?: string; pos: Vec3; kind?: MoteKind; ttl_s?: number }[];
  shades?: ScenarioShade[];
  lanterns?: ScenarioLantern[];
  drifters?: ScenarioDrifter[];
  charms?: ScenarioCharm[];
  time_left_s?: number;
}

export interface InputFrame {
  tick: number;
  move?: [number, number];
  cam_yaw_deg?: number;
  jump?: boolean;
  interact?: boolean;
  pulse?: boolean;
  dash?: boolean;
  pause?: boolean;
}

export interface InputsFile {
  frames: InputFrame[];
}

export type SimEvent =
  | { type: "mote_picked"; tick: number; data: { carried: number } }
  | {
      type: "deposit";
      tick: number;
      data: { lantern_id: string; amount: number; deposited: number };
    }
  | { type: "lantern_lit"; tick: number; data: { lantern_id: string } }
  | { type: "pulse"; tick: number; data: { stunned_ids: string[] } }
  | {
      type: "player_hit";
      tick: number;
      data: { by: "shade" | "fall"; flames: number; dropped: number; lost?: number };
    }
  | { type: "shade_spawned"; tick: number; data: { id: string } }
  | { type: "dash"; tick: number; data: Record<string, never> }
  | { type: "charm_picked"; tick: number; data: { charm_id: string; charm_ticks: number } }
  | {
      type: "drifter_steal";
      tick: number;
      data: { drifter_id: string; amount: number; carried: number };
    }
  | { type: "drifter_drop"; tick: number; data: { drifter_id: string; amount: number } }
  | { type: "night_start"; tick: number; data: { night: number } }
  | { type: "paused"; tick: number; data: Record<string, never> }
  | { type: "resumed"; tick: number; data: Record<string, never> }
  | {
      type: "game_over";
      tick: number;
      data: { result: "won" | "lost"; reason: string };
    };

export const TICK_DT = 1 / 60;
export const ISLAND_RADIUS = 40;
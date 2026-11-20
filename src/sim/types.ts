export type Vec3 = [number, number, number];

export type GameStateKind = "playing" | "won" | "lost";
export type LoseReason = "all_lit" | "dawn" | "no_flames";
export type ShadeState = "chase" | "stunned";

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
  flames: number;
  invuln_s: number;
  hit_drop_ratio: number;
  pulse_stun_s: number;
  pulse_push_m: number;
  pulse_cooldown_s: number;
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
}

export const DEFAULT_HELD: HeldInput = {
  move: [0, 0],
  camYawDeg: 0,
  jump: false,
  interact: false,
  pulse: false,
};

export interface SimState {
  tick: number;
  state: GameStateKind;
  timeLeftS: number;
  durationS: number;
  score: number;
  player: {
    pos: Vec3;
    vy: number;
    flames: number;
    carried: number;
    invulnS: number;
  };
  lanterns: { id: string; pos: Vec3; lit: boolean; deposited: number }[];
  shades: {
    id: string;
    pos: Vec3;
    state: ShadeState;
    stunS: number;
  }[];
  motes: { id: string; pos: Vec3 }[];
  pulseCooldownS: number;
  reason: "all_lit" | "dawn" | "no_flames" | null;
  islandRadius: number;
}

export interface ScenarioPlayer {
  pos?: Vec3;
  carried?: number;
  flames?: number;
}

export interface ScenarioShade {
  id?: string;
  pos: Vec3;
}

export interface ScenarioLantern {
  id: string;
  pos?: Vec3;
  deposited?: number;
  lit?: boolean;
}

export interface Scenario {
  player?: ScenarioPlayer;
  random_motes?: boolean;
  random_shades?: boolean;
  motes?: Vec3[];
  shades?: ScenarioShade[];
  lanterns?: ScenarioLantern[];
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
      data: { by: "shade" | "fall"; flames: number; dropped: number };
    }
  | { type: "shade_spawned"; tick: number; data: { id: string } }
  | {
      type: "game_over";
      tick: number;
      data: { result: "won" | "lost"; reason: string };
    };

export const JUMP_SPEED = 7.5;
export const GRAVITY = 24;
export const ISLAND_RADIUS = 40;
export const LANTERN_RING_RADIUS = 25;
export const TICK_DT = 1 / 60;
export const PLAY_MOTE_COUNT = 30;
export const PLAY_SHADE_COUNT = 3;
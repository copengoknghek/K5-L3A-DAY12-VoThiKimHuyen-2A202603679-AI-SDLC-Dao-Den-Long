import { edgeActivate } from "./input.js";
import { clampToIsland, distXZ, normalizeXZ } from "./math.js";
import type { HeldInput, SimEvent, SimState, Tuning } from "./types.js";
import { GRAVITY, JUMP_SPEED, TICK_DT } from "./types.js";

function worldMoveDir(held: HeldInput): [number, number] {
  const yaw = (held.camYawDeg * Math.PI) / 180;
  let x = held.move[0] * Math.cos(yaw) + held.move[1] * Math.sin(yaw);
  let z = -held.move[0] * Math.sin(yaw) + held.move[1] * Math.cos(yaw);
  const len = Math.hypot(x, z);
  if (len > 1) {
    x /= len;
    z /= len;
  }
  return [x, z];
}

function playerInSafeZone(state: SimState, tuning: Tuning): boolean {
  for (const lan of state.lanterns) {
    if (!lan.lit) continue;
    if (distXZ(state.player.pos, lan.pos) <= tuning.safe_radius) return true;
  }
  return false;
}

function applyMovement(state: SimState, tuning: Tuning, held: HeldInput, prev: HeldInput): void {
  if (state.state !== "playing") return;

  const [dx, dz] = worldMoveDir(held);
  const speed = tuning.player_speed * TICK_DT;
  state.player.pos[0] += dx * speed;
  state.player.pos[2] += dz * speed;

  if (edgeActivate(prev.jump, held.jump) && state.player.pos[1] <= 0.001 && state.player.vy <= 0) {
    state.player.vy = JUMP_SPEED;
  }

  state.player.vy -= GRAVITY * TICK_DT;
  state.player.pos[1] += state.player.vy * TICK_DT;
  if (state.player.pos[1] < 0) {
    state.player.pos[1] = 0;
    state.player.vy = 0;
  }

  if (!tuning.fall_enabled) {
    const clamped = clampToIsland(state.player.pos, state.islandRadius);
    state.player.pos[0] = clamped[0];
    state.player.pos[2] = clamped[2];
  }

  if (state.pulseCooldownS > 0) {
    state.pulseCooldownS = Math.max(0, state.pulseCooldownS - TICK_DT);
  }
  if (state.player.invulnS > 0) {
    state.player.invulnS = Math.max(0, state.player.invulnS - TICK_DT);
  }
}

function applyPickup(state: SimState, tuning: Tuning, nextTick: number, events: SimEvent[]): void {
  if (state.state !== "playing") return;

  while (state.player.carried < tuning.carry_capacity) {
    const next = state.motes
      .map((m) => ({ m, d: distXZ(state.player.pos, m.pos) }))
      .filter((x) => x.d <= tuning.pickup_radius)
      .sort((a, b) => a.d - b.d || a.m.id.localeCompare(b.m.id));
    if (next.length === 0) break;
    const pick = next[0].m;
    const idx = state.motes.findIndex((m) => m.id === pick.id);
    if (idx < 0) break;
    state.motes.splice(idx, 1);
    state.player.carried += 1;
    state.score += tuning.score.per_mote;
    events.push({
      type: "mote_picked",
      tick: nextTick,
      data: { carried: state.player.carried },
    });
  }
}

function applyDeposit(
  state: SimState,
  tuning: Tuning,
  held: HeldInput,
  prev: HeldInput,
  nextTick: number,
  events: SimEvent[],
): void {
  if (state.state !== "playing" || !edgeActivate(prev.interact, held.interact)) return;
  if (state.player.carried <= 0) return;

  const candidates = state.lanterns
    .filter((l) => !l.lit && l.deposited < tuning.lantern_cost)
    .map((l) => ({ l, d: distXZ(state.player.pos, l.pos) }))
    .filter((x) => x.d <= tuning.interact_radius)
    .sort((a, b) => a.d - b.d || a.l.id.localeCompare(b.l.id));

  if (candidates.length === 0) return;
  const lantern = candidates[0].l;
  const need = tuning.lantern_cost - lantern.deposited;
  const amount = Math.min(state.player.carried, need);
  if (amount <= 0) return;

  state.player.carried -= amount;
  lantern.deposited += amount;
  events.push({
    type: "deposit",
    tick: nextTick,
    data: {
      lantern_id: lantern.id,
      amount,
      deposited: lantern.deposited,
    },
  });

  if (lantern.deposited >= tuning.lantern_cost && !lantern.lit) {
    lantern.lit = true;
    state.score += tuning.score.per_lantern;
    events.push({
      type: "lantern_lit",
      tick: nextTick,
      data: { lantern_id: lantern.id },
    });
  }
}

function applyPulse(
  state: SimState,
  tuning: Tuning,
  held: HeldInput,
  prev: HeldInput,
  nextTick: number,
  events: SimEvent[],
): void {
  if (state.state !== "playing" || !edgeActivate(prev.pulse, held.pulse)) return;
  if (state.pulseCooldownS > 0) return;
  if (state.player.flames < tuning.pulse_cost) return;

  state.player.flames -= tuning.pulse_cost;
  state.pulseCooldownS = tuning.pulse_cooldown_s;

  const stunned: string[] = [];
  for (const shade of state.shades) {
    if (distXZ(state.player.pos, shade.pos) > tuning.pulse_radius) continue;
    shade.state = "stunned";
    shade.stunS = tuning.pulse_stun_s;
    const [nx, nz] = normalizeXZ(
      shade.pos[0] - state.player.pos[0],
      shade.pos[2] - state.player.pos[2],
    );
    if (nx === 0 && nz === 0) {
      shade.pos[0] += tuning.pulse_push_m;
    } else {
      shade.pos[0] += nx * tuning.pulse_push_m;
      shade.pos[2] += nz * tuning.pulse_push_m;
    }
    stunned.push(shade.id);
  }
  stunned.sort();
  if (stunned.length > 0) {
    state.score += tuning.score.per_stun * stunned.length;
  }
  events.push({
    type: "pulse",
    tick: nextTick,
    data: { stunned_ids: stunned },
  });
}

function applyShades(state: SimState, tuning: Tuning): void {
  if (state.state !== "playing") return;
  const safe = playerInSafeZone(state, tuning);

  for (const shade of state.shades) {
    if (shade.state === "stunned") {
      shade.stunS -= TICK_DT;
      if (shade.stunS <= 0) {
        shade.stunS = 0;
        shade.state = "chase";
      }
      continue;
    }
    if (safe) continue;

    const [nx, nz] = normalizeXZ(
      state.player.pos[0] - shade.pos[0],
      state.player.pos[2] - shade.pos[2],
    );
    const speed = tuning.shade_speed * TICK_DT;
    shade.pos[0] += nx * speed;
    shade.pos[2] += nz * speed;
  }
}

function dropMotes(
  state: SimState,
  tuning: Tuning,
  fromShade: { pos: [number, number, number] },
): number {
  const dropCount = Math.floor(state.player.carried * tuning.hit_drop_ratio);
  if (dropCount <= 0) return 0;

  const actual = Math.min(dropCount, state.player.carried);
  state.player.carried -= actual;

  let [dx, dz] = normalizeXZ(
    state.player.pos[0] - fromShade.pos[0],
    state.player.pos[2] - fromShade.pos[2],
  );
  if (dx === 0 && dz === 0) {
    dx = 1;
    dz = 0;
  }
  const dropDist = tuning.pickup_radius + 0.15;
  let nextId = state.motes.length + 1;
  for (let i = 0; i < actual; i++) {
    const spread = (i - (actual - 1) / 2) * 0.2;
    state.motes.push({
      id: `MD${nextId++}`,
      pos: [
        state.player.pos[0] + dx * dropDist + dz * spread,
        0,
        state.player.pos[2] + dz * dropDist - dx * spread,
      ],
    });
  }
  return actual;
}

function applyHits(state: SimState, tuning: Tuning, nextTick: number, events: SimEvent[]): void {
  if (state.state !== "playing" || state.player.invulnS > 0) return;

  for (const shade of state.shades) {
    if (shade.state === "stunned") continue;
    if (distXZ(state.player.pos, shade.pos) > tuning.shade_hit_radius) continue;

    state.player.flames -= 1;
    state.player.invulnS = tuning.invuln_s;
    const dropped = dropMotes(state, tuning, shade);
    events.push({
      type: "player_hit",
      tick: nextTick,
      data: { by: "shade", flames: state.player.flames, dropped },
    });
    break;
  }
}

function checkEnd(state: SimState, tuning: Tuning, nextTick: number, events: SimEvent[]): void {
  if (state.state !== "playing") return;

  const allLit =
    state.lanterns.length >= tuning.lantern_count_night1 &&
    state.lanterns.filter((l) => l.lit).length >= tuning.lantern_count_night1;

  state.timeLeftS = state.durationS - nextTick / 60;

  if (allLit) {
    const bonus =
      Math.floor(state.timeLeftS) * tuning.score.per_second_left +
      state.player.flames * tuning.score.per_flame_left;
    state.score += bonus;
    state.state = "won";
    state.reason = "all_lit";
    events.push({
      type: "game_over",
      tick: nextTick,
      data: { result: "won", reason: "all_lit" },
    });
    return;
  }

  if (state.player.flames <= 0) {
    state.state = "lost";
    state.reason = "no_flames";
    events.push({
      type: "game_over",
      tick: nextTick,
      data: { result: "lost", reason: "no_flames" },
    });
    return;
  }

  if (state.timeLeftS <= 0) {
    state.state = "lost";
    state.reason = "dawn";
    events.push({
      type: "game_over",
      tick: nextTick,
      data: { result: "lost", reason: "dawn" },
    });
  }
}

export function step(
  state: SimState,
  tuning: Tuning,
  held: HeldInput,
  prev: HeldInput,
): SimEvent[] {
  if (state.state !== "playing") return [];

  const events: SimEvent[] = [];
  const nextTick = state.tick + 1;

  applyMovement(state, tuning, held, prev);
  applyPickup(state, tuning, nextTick, events);
  applyDeposit(state, tuning, held, prev, nextTick, events);
  applyPulse(state, tuning, held, prev, nextTick, events);
  applyShades(state, tuning);
  applyHits(state, tuning, nextTick, events);
  checkEnd(state, tuning, nextTick, events);

  state.tick = nextTick;
  if (state.state === "playing") {
    state.timeLeftS = state.durationS - state.tick / 60;
  }

  return events;
}
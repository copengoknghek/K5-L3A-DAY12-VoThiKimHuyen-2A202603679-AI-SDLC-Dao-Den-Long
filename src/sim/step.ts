import {
  ACCEL_TIME_S,
  CHARM_SPEED,
  CHARM_TICKS,
  CHARM_RESPAWN_TICKS,
  DASH_CD_TICKS,
  DASH_SPEED,
  DASH_TICKS,
  DETECT_R,
  DRAIN_ENTER_XZ,
  DRAIN_PER_TICK,
  DRIFTER_AGGRO_R,
  DRIFTER_FADE_TICKS,
  DRIFTER_FAST,
  DRIFTER_FIRST,
  DRIFTER_FLEE_TICKS,
  DRIFTER_IDLE,
  DRIFTER_INTERVAL,
  DRIFTER_MAX,
  DRIFTER_TOUCH,
  DROP_RING_MAX,
  DROP_RING_MIN,
  DROP_TTL_TICKS,
  FALL_WAIT_TICKS,
  FALL_Y,
  FUEL_DECAY_PER_TICK,
  FUEL_MAX_SIXTIETHS,
  FUEL_PER_MOTE_SIXTIETHS,
  GRAVITY,
  HIT_XZ,
  HIT_Y,
  INTERACT_R,
  INVULN_TICKS,
  JUMP_SPEED,
  LANTERN_COST,
  LOSE_CHASE_R,
  LOW_FUEL_SIXTIETHS,
  MOTE_CAP,
  MOTE_SPAWN_EVERY,
  PICKUP_XZ,
  PICKUP_Y,
  PULSE_CD_TICKS,
  PULSE_MOTE_COST,
  PULSE_ORIGIN_Y,
  PULSE_PUSH_M,
  PULSE_PUSH_TICKS,
  PULSE_RADIUS,
  PULSE_STUN_TICKS,
  RELIGHT_COST,
  SAFE_PUSH_TICKS,
  SAFE_R,
  SCORE_DAWN_FLAME,
  SCORE_DAWN_LIT,
  SCORE_LANTERN_FIRST,
  SCORE_LANTERN_RELIGHT,
  SCORE_MOTE,
  SCORE_PULSE,
  SCORE_PULSE_DRAIN_BONUS,
  SHADE_FIRST_TICK,
  SHADE_INTERVAL,
  SHADE_MAX,
  SHADE_RECOIL_M,
  SHADE_RECOIL_TICKS,
  SHADE_SPEED_N12,
  SHADE_SPEED_N3,
  TICK_DT,
  WIN_RATIO,
  WIND_DUR,
  WIND_PERIOD,
  WIND_PUSH,
} from "./constants.js";
import { edgeActivate } from "./input.js";
import { groundY, mapForNight, padAt, towerBlocks } from "./maps.js";
import { dist3, distXZ, normalizeXZ } from "./math.js";
import { stepRng } from "./rng.js";
import {
  fuelDisplay,
  playerCapacity,
  type HeldInput,
  type SimEvent,
  type SimLantern,
  type SimMote,
  type SimShade,
  type SimState,
  type Tuning,
  type Vec3,
} from "./types.js";
import { moteOccupies } from "./world.js";

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

function rng01(state: SimState): number {
  const r = stepRng(state.rngState);
  state.rngState = r.next;
  return r.value;
}

function shadeSpeed(night: number): number {
  return night === 3 ? SHADE_SPEED_N3 : SHADE_SPEED_N12;
}

function lanternSafe(lan: SimLantern): boolean {
  return lan.lit && lan.fuelSixtieths >= LOW_FUEL_SIXTIETHS;
}

function applySafeBlock(state: SimState, nx: number, nz: number): [number, number] {
  let x = nx;
  let z = nz;
  for (const lan of state.lanterns) {
    if (!lanternSafe(lan)) continue;
    const d = Math.hypot(x - lan.pos[0], z - lan.pos[2]);
    if (d < SAFE_R && d > 1e-6) {
      const s = SAFE_R / d;
      x = lan.pos[0] + (x - lan.pos[0]) * s;
      z = lan.pos[2] + (z - lan.pos[2]) * s;
    } else if (d < 1e-6) {
      x = lan.pos[0] + SAFE_R;
    }
  }
  return [x, z];
}

function insideSafe(state: SimState, pos: Vec3): boolean {
  return state.lanterns.some((l) => lanternSafe(l) && distXZ(pos, l.pos) < SAFE_R);
}

function lightCost(lan: SimLantern): number {
  return lan.everLit ? RELIGHT_COST : LANTERN_COST;
}

function interactableLanterns(state: SimState): SimLantern[] {
  return state.lanterns.filter((l) => {
    if (!l.lit) {
      const cost = lightCost(l);
      return l.deposited < cost;
    }
    return l.fuelSixtieths < FUEL_MAX_SIXTIETHS;
  });
}

function tickCounters(state: SimState): void {
  state.player.invulnTicks = Math.max(0, state.player.invulnTicks - 1);
  state.player.dashCdTicks = Math.max(0, state.player.dashCdTicks - 1);
  state.player.pulseCdTicks = Math.max(0, state.player.pulseCdTicks - 1);
  state.player.charmTicks = Math.max(0, state.player.charmTicks - 1);
  if (state.player.dashTicks > 0) state.player.dashTicks -= 1;
  if (state.player.fallWaitTicks > 0) {
    state.player.fallWaitTicks -= 1;
    if (state.player.fallWaitTicks === 0 && state.player.flames > 0) {
      const map = mapForNight(state.night);
      state.player.pos = [...map.spawn];
      state.player.vel = [0, 0, 0];
      state.player.grounded = true;
      state.player.launched = false;
      state.player.invulnTicks = INVULN_TICKS;
    }
  }
  for (const s of state.shades) {
    if (s.stateTicks > 0) s.stateTicks -= 1;
    if (s.interactDelay > 0) s.interactDelay -= 1;
  }
  for (const d of state.drifters) {
    if (d.stateTicks > 0) d.stateTicks -= 1;
    if (d.interactDelay > 0) d.interactDelay -= 1;
  }
  for (const m of state.motes) {
    if (m.interactDelay > 0) m.interactDelay -= 1;
    if (m.ttl !== null) m.ttl -= 1;
  }
  state.motes = state.motes.filter((m) => m.ttl === null || m.ttl > 0);
  for (const c of state.charms) {
    if (!c.available && c.respawnTicks > 0) {
      c.respawnTicks -= 1;
      if (c.respawnTicks <= 0) c.available = true;
    }
  }
  for (const l of state.lanterns) {
    if (l.pushTicks > 0) l.pushTicks -= 1;
  }
  if (state.windTicks >= 0) {
    state.windTicks += 1;
    const cycle = state.windTicks % WIND_PERIOD;
    state.windActive = cycle >= WIND_PERIOD - WIND_DUR;
    if (cycle === WIND_PERIOD - WIND_DUR) {
      state.windDirDeg = rng01(state) * 360;
    }
  }
  state.timeLeftS = state.durationS - (state.simTick + 1) / 60;
}

function movePlayer(
  state: SimState,
  held: HeldInput,
  prev: HeldInput,
  nextTick: number,
  events: SimEvent[],
): void {
  const p = state.player;
  if (p.fallWaitTicks > 0) return;

  const map = mapForNight(state.night);
  const [mx, mz] = worldMoveDir(held);
  const moving = Math.hypot(mx, mz) > 1e-6;
  if (moving) p.facing = normalizeXZ(mx, mz);

  const pad = padAt(map, p.pos, p.grounded);
  if (pad) {
    p.vel[1] = pad.vy;
    p.vel[0] = pad.dir[0] * pad.horiz;
    p.vel[2] = pad.dir[1] * pad.horiz;
    p.launched = true;
    p.grounded = false;
  }

  const dashEdge = edgeActivate(prev.dash, held.dash);
  if (dashEdge && p.dashTicks === 0 && (p.charmTicks > 0 || p.dashCdTicks === 0)) {
    const [dx, dz] = moving ? [mx, mz] : p.facing;
    const [nx, nz] = normalizeXZ(dx, dz);
    p.facing = [nx, nz];
    p.dashTicks = DASH_TICKS;
    p.dashCdTicks = p.charmTicks > 0 ? 0 : DASH_CD_TICKS;
    p.vel[0] = nx * DASH_SPEED;
    p.vel[2] = nz * DASH_SPEED;
    if (!p.grounded) {
      p.vel[1] = 0;
    }
    events.push({ type: "dash", tick: nextTick, data: {} });
  }

  const speedMax = p.charmTicks > 0 ? CHARM_SPEED : 6;
  const accel = speedMax / ACCEL_TIME_S;

  if (p.dashTicks > 0) {
    if (!p.grounded) p.vel[1] = 0;
  } else if (p.launched && !p.grounded) {
    /* keep horizontal until land */
  } else {
    const tx = mx * speedMax;
    const tz = mz * speedMax;
    const ax = tx - p.vel[0];
    const az = tz - p.vel[2];
    const alen = Math.hypot(ax, az);
    const maxA = accel * TICK_DT;
    if (alen <= maxA) {
      p.vel[0] = tx;
      p.vel[2] = tz;
    } else {
      p.vel[0] += (ax / alen) * maxA;
      p.vel[2] += (az / alen) * maxA;
    }
  }

  if (edgeActivate(prev.jump, held.jump) && p.grounded && p.dashTicks === 0) {
    p.vel[1] = JUMP_SPEED;
    p.grounded = false;
  }

  if (!(p.dashTicks > 0 && !p.grounded)) {
    p.vel[1] -= GRAVITY * TICK_DT;
  }

  if (state.windActive && state.night === 3) {
    const wr = (state.windDirDeg * Math.PI) / 180;
    p.vel[0] += Math.cos(wr) * WIND_PUSH * TICK_DT;
    p.vel[2] += Math.sin(wr) * WIND_PUSH * TICK_DT;
  }

  const nx = p.pos[0] + p.vel[0] * TICK_DT;
  const ny = p.pos[1] + p.vel[1] * TICK_DT;
  const nz = p.pos[2] + p.vel[2] * TICK_DT;

  if (towerBlocks(nx, nz, ny)) {
    p.vel[0] = 0;
    p.vel[2] = 0;
  } else {
    p.pos[0] = nx;
    p.pos[2] = nz;
  }
  p.pos[1] = ny;

  const gy = groundY(state.night, p.pos[0], p.pos[2]);
  if (gy !== null && p.pos[1] <= gy + 0.02 && p.vel[1] <= 0) {
    p.pos[1] = gy;
    p.vel[1] = 0;
    p.grounded = true;
    p.launched = false;
  } else {
    p.grounded = false;
  }

  if (p.pos[1] < FALL_Y && p.fallWaitTicks === 0) {
    applyFall(state, nextTick, events);
  }
}

function applyFall(state: SimState, nextTick: number, events: SimEvent[]): void {
  const p = state.player;
  const lost = p.carried;
  p.carried = 0;
  p.flames -= 1;
  p.vel = [0, 0, 0];
  p.launched = false;
  p.pos[1] = FALL_Y;
  events.push({
    type: "player_hit",
    tick: nextTick,
    data: { by: "fall", flames: p.flames, dropped: 0, lost },
  });
  if (p.flames <= 0) return;
  p.fallWaitTicks = FALL_WAIT_TICKS;
}

function pickup(state: SimState, tuning: Tuning, nextTick: number, events: SimEvent[]): void {
  const p = state.player;
  if (p.fallWaitTicks > 0) return;
  const cap = playerCapacity(state, tuning);

  while (p.carried < cap) {
    const cand = state.motes
      .filter(
        (m) =>
          m.interactDelay === 0 &&
          distXZ(p.pos, m.pos) <= PICKUP_XZ &&
          Math.abs(p.pos[1] - m.pos[1]) <= PICKUP_Y,
      )
      .sort((a, b) => distXZ(p.pos, a.pos) - distXZ(p.pos, b.pos) || a.id.localeCompare(b.id));
    if (!cand.length) break;
    const m = cand[0];
    state.motes = state.motes.filter((x) => x.id !== m.id);
    p.carried += 1;
    events.push({ type: "mote_picked", tick: nextTick, data: { carried: p.carried } });
  }

  for (const c of state.charms) {
    if (!c.available) continue;
    if (distXZ(p.pos, c.pos) <= PICKUP_XZ && Math.abs(p.pos[1] - c.pos[1]) <= PICKUP_Y) {
      c.available = false;
      c.respawnTicks = CHARM_RESPAWN_TICKS;
      p.charmTicks = CHARM_TICKS;
      events.push({
        type: "charm_picked",
        tick: nextTick,
        data: { charm_id: c.id, charm_ticks: CHARM_TICKS },
      });
    }
  }
}

function pushShadesNearLantern(state: SimState, lan: SimLantern): void {
  lan.pushTicks = SAFE_PUSH_TICKS;
}

function finishLighting(
  state: SimState,
  lantern: SimLantern,
  wasRelight: boolean,
  nextTick: number,
  events: SimEvent[],
): void {
  lantern.lit = true;
  lantern.fuelSixtieths = FUEL_MAX_SIXTIETHS;
  lantern.deposited = 0;
  lantern.everLit = true;
  if (wasRelight) lantern.relitCount += 1;
  if (!lantern.scenarioPreset) state.player.successfulLights += 1;
  pushShadesNearLantern(state, lantern);
  state.score += wasRelight ? SCORE_LANTERN_RELIGHT : SCORE_LANTERN_FIRST;
  events.push({
    type: "lantern_lit",
    tick: nextTick,
    data: { lantern_id: lantern.id, relight: wasRelight },
  });
}

function interact(
  state: SimState,
  held: HeldInput,
  prev: HeldInput,
  nextTick: number,
  events: SimEvent[],
): void {
  if (!edgeActivate(prev.interact, held.interact) || state.player.carried <= 0) return;
  const p = state.player;
  const cands = interactableLanterns(state)
    .map((l) => ({ l, d: distXZ(p.pos, l.pos) }))
    .filter((x) => x.d <= INTERACT_R)
    .sort((a, b) => a.d - b.d || a.l.id.localeCompare(b.l.id, undefined, { numeric: true }));
  if (!cands.length) return;
  const lantern = cands[0].l;

  if (!lantern.lit) {
    const cost = lightCost(lantern);
    const need = cost - lantern.deposited;
    const amount = Math.min(p.carried, need);
    if (amount <= 0) return;
    p.carried -= amount;
    lantern.deposited += amount;
    state.score += SCORE_MOTE * amount;
    events.push({
      type: "deposit",
      tick: nextTick,
      data: { lantern_id: lantern.id, amount, deposited: lantern.deposited },
    });
    if (lantern.deposited >= cost) {
      finishLighting(state, lantern, lantern.everLit, nextTick, events);
    }
    return;
  }

  const room = FUEL_MAX_SIXTIETHS - lantern.fuelSixtieths;
  const used = Math.min(p.carried, Math.ceil(room / FUEL_PER_MOTE_SIXTIETHS));
  if (used <= 0) return;
  const prevFuel = lantern.fuelSixtieths;
  p.carried -= used;
  lantern.fuelSixtieths = Math.min(FUEL_MAX_SIXTIETHS, lantern.fuelSixtieths + used * FUEL_PER_MOTE_SIXTIETHS);
  state.score += SCORE_MOTE * used;
  events.push({
    type: "refuel",
    tick: nextTick,
    data: { lantern_id: lantern.id, amount: used, fuel: fuelDisplay(lantern.fuelSixtieths) },
  });
  if (prevFuel < LOW_FUEL_SIXTIETHS && lantern.fuelSixtieths >= LOW_FUEL_SIXTIETHS) {
    const nearShade = state.shades.some((s) => distXZ(s.pos, lantern.pos) < SAFE_R);
    if (nearShade) pushShadesNearLantern(state, lantern);
  }
}

function tickFuelAndExtinguish(state: SimState, nextTick: number, events: SimEvent[]): void {
  for (const lan of state.lanterns) {
    if (!lan.lit) continue;
    lan.fuelSixtieths -= FUEL_DECAY_PER_TICK;
    for (const s of state.shades) {
      if (s.state !== "drain" || s.targetLanternId !== lan.id) continue;
      lan.fuelSixtieths -= DRAIN_PER_TICK;
      s.drainLogTicks += 1;
      if (s.drainLogTicks >= 60) {
        s.drainLogTicks = 0;
        events.push({
          type: "fuel_drain",
          tick: nextTick,
          data: {
            lantern_id: lan.id,
            shade_id: s.id,
            fuel: fuelDisplay(lan.fuelSixtieths),
          },
        });
      }
    }
    if (lan.fuelSixtieths <= 0) {
      lan.fuelSixtieths = 0;
      lan.lit = false;
      lan.deposited = 0;
      events.push({ type: "lantern_out", tick: nextTick, data: { lantern_id: lan.id } });
    }
  }
}

function updateSafePush(state: SimState): void {
  for (const lan of state.lanterns) {
    if (!lanternSafe(lan) || lan.pushTicks <= 0) continue;
    for (const s of state.shades) {
      const d = distXZ(s.pos, lan.pos);
      if (d >= SAFE_R || d < 1e-9) continue;
      const remain = lan.pushTicks;
      const need = SAFE_R - d;
      const stepLen = need / remain;
      const [nx, nz] = normalizeXZ(s.pos[0] - lan.pos[0], s.pos[2] - lan.pos[2]);
      s.pos[0] += nx * stepLen;
      s.pos[2] += nz * stepLen;
    }
  }
}

function pulse(
  state: SimState,
  held: HeldInput,
  prev: HeldInput,
  nextTick: number,
  events: SimEvent[],
): void {
  if (!edgeActivate(prev.pulse, held.pulse)) return;
  if (state.player.pulseCdTicks > 0) return;
  if (state.player.carried < PULSE_MOTE_COST) return;
  state.player.carried -= PULSE_MOTE_COST;
  state.player.pulseCdTicks = PULSE_CD_TICKS;
  const origin: Vec3 = [state.player.pos[0], state.player.pos[1] + PULSE_ORIGIN_Y, state.player.pos[2]];
  const stunned: string[] = [];
  for (const s of state.shades) {
    if (s.interactDelay > 0) continue;
    if (dist3(origin, s.pos) > PULSE_RADIUS) continue;
    const wasDrain = s.state === "drain";
    s.state = "stunned";
    s.stateTicks = PULSE_STUN_TICKS;
    s.drainLogTicks = 0;
    stunned.push(s.id);
    state.score += SCORE_PULSE;
    if (wasDrain) state.score += SCORE_PULSE_DRAIN_BONUS;
  }
  stunned.sort();
  events.push({ type: "pulse", tick: nextTick, data: { stunned_ids: stunned } });

  for (const d of state.drifters) {
    if (d.state === "removed" || d.interactDelay > 0) continue;
    if (dist3(origin, d.pos) > PULSE_RADIUS) continue;
    if (d.state === "chase") {
      d.state = "flee";
      d.stateTicks = DRIFTER_FLEE_TICKS;
    } else if (d.state === "flee" && d.stolen > 0) {
      dropStolen(state, d);
      events.push({
        type: "drifter_drop",
        tick: nextTick,
        data: { drifter_id: d.id, amount: d.stolen },
      });
      d.stolen = 0;
      d.state = "flee";
      d.stateTicks = DRIFTER_FADE_TICKS;
    }
  }
}

function dropStolen(state: SimState, d: SimState["drifters"][0]): void {
  for (let i = 0; i < d.stolen; i++) {
    const ang = rng01(state) * Math.PI * 2;
    const r = DROP_RING_MIN + rng01(state) * (DROP_RING_MAX - DROP_RING_MIN);
    state.motes.push({
      id: `M${state.nextMoteId++}`,
      pos: [d.pos[0] + Math.cos(ang) * r, d.pos[1], d.pos[2] + Math.sin(ang) * r],
      kind: "dropped",
      ttl: DROP_TTL_TICKS,
      interactDelay: 1,
    });
  }
}

function wanderTargetLantern(state: SimState, shadePos: Vec3): SimLantern | null {
  const weak = state.lanterns
    .filter((l) => l.lit && l.fuelSixtieths < LOW_FUEL_SIXTIETHS)
    .map((l) => ({ l, d: distXZ(shadePos, l.pos) }))
    .sort((a, b) => a.d - b.d || a.l.id.localeCompare(b.l.id, undefined, { numeric: true }));
  if (weak.length) return weak[0].l;
  const unlit = state.lanterns
    .filter((l) => !l.lit)
    .map((l) => ({ l, d: distXZ(shadePos, l.pos) }))
    .sort((a, b) => a.d - b.d || a.l.id.localeCompare(b.l.id, undefined, { numeric: true }));
  if (unlit.length) return unlit[0].l;
  return null;
}

function targetLanternPos(state: SimState, s: SimShade): Vec3 | null {
  if (s.targetLanternId) {
    const lan = state.lanterns.find((l) => l.id === s.targetLanternId);
    if (lan) return lan.pos;
  }
  const t = wanderTargetLantern(state, s.pos);
  if (t) {
    s.targetLanternId = t.id;
    return t.pos;
  }
  return null;
}

function updateDrainState(state: SimState, s: SimShade): void {
  if (s.state !== "drain") return;
  const lan = state.lanterns.find((l) => l.id === s.targetLanternId);
  if (!lan || !lan.lit) {
    s.state = "wander";
    s.drainLogTicks = 0;
    return;
  }
  const dLan = distXZ(s.pos, lan.pos);
  const dPl = distXZ(s.pos, state.player.pos);
  if (dPl <= SAFE_R) {
    s.state = "chase";
    s.drainLogTicks = 0;
    return;
  }
  if (lan.fuelSixtieths >= LOW_FUEL_SIXTIETHS || dLan > DRAIN_ENTER_XZ) {
    s.state = "wander";
    s.drainLogTicks = 0;
    return;
  }
}

function moveShades(state: SimState): void {
  const p = state.player.pos;
  const spd = shadeSpeed(state.night) * TICK_DT;
  for (const s of state.shades) {
    if (s.interactDelay > 0) continue;
    if (s.state === "spawning") {
      if (s.stateTicks <= 0) s.state = "wander";
      continue;
    }
    if (s.state === "stunned") {
      const elapsed = PULSE_STUN_TICKS - s.stateTicks;
      if (elapsed < PULSE_PUSH_TICKS) {
        let [nx, nz] = normalizeXZ(s.pos[0] - p[0], s.pos[2] - p[2]);
        if (nx === 0 && nz === 0) nx = 1;
        const stepLen = PULSE_PUSH_M / PULSE_PUSH_TICKS;
        let x = s.pos[0] + nx * stepLen;
        let z = s.pos[2] + nz * stepLen;
        [x, z] = applySafeBlock(state, x, z);
        s.pos[0] = x;
        s.pos[2] = z;
      }
      if (s.stateTicks <= 0) s.state = "wander";
      continue;
    }
    if (s.state === "recoil") {
      const [nx, nz] = normalizeXZ(s.pos[0] - p[0], s.pos[2] - p[2]);
      const stepLen = SHADE_RECOIL_M / SHADE_RECOIL_TICKS;
      let x = s.pos[0] + (nx || 1) * stepLen;
      let z = s.pos[2] + nz * stepLen;
      [x, z] = applySafeBlock(state, x, z);
      s.pos[0] = x;
      s.pos[2] = z;
      if (s.stateTicks <= 0) s.state = "wander";
      continue;
    }

    if (s.state === "drain") {
      updateDrainState(state, s);
      if (s.state === "drain") continue;
    }

    const d = distXZ(s.pos, p);
    if (s.state === "wander" && d <= DETECT_R) s.state = "chase";
    if (s.state === "chase" && d > LOSE_CHASE_R) s.state = "wander";

    if (s.state === "chase") {
      const [nx, nz] = normalizeXZ(p[0] - s.pos[0], p[2] - s.pos[2]);
      let x = s.pos[0] + nx * spd;
      let z = s.pos[2] + nz * spd;
      [x, z] = applySafeBlock(state, x, z);
      s.pos[0] = x;
      s.pos[2] = z;
    } else if (s.state === "wander") {
      const tgt = targetLanternPos(state, s);
      if (tgt) {
        const lan = state.lanterns.find((l) => l.id === s.targetLanternId);
        if (
          lan &&
          lan.lit &&
          lan.fuelSixtieths < LOW_FUEL_SIXTIETHS &&
          distXZ(s.pos, lan.pos) <= DRAIN_ENTER_XZ
        ) {
          s.state = "drain";
          s.drainLogTicks = 0;
          continue;
        }
        const [nx, nz] = normalizeXZ(tgt[0] - s.pos[0], tgt[2] - s.pos[2]);
        const wspd = spd * 0.5;
        let x = s.pos[0] + (nx || 0) * wspd;
        let z = s.pos[2] + (nz || 0) * wspd;
        [x, z] = applySafeBlock(state, x, z);
        s.pos[0] = x;
        s.pos[2] = z;
      } else {
        const ang = (s.id.charCodeAt(s.id.length - 1) + state.simTick * 0.01) % (Math.PI * 2);
        let x = s.pos[0] + Math.cos(ang) * spd * 0.35;
        let z = s.pos[2] + Math.sin(ang) * spd * 0.35;
        [x, z] = applySafeBlock(state, x, z);
        s.pos[0] = x;
        s.pos[2] = z;
      }
    }
  }
}

function moveDrifters(state: SimState): void {
  const p = state.player;
  for (const d of state.drifters) {
    if (d.state === "removed" || d.interactDelay > 0) continue;
    const dist = distXZ(d.pos, p.pos);
    if (d.state === "idle") {
      if (p.carried >= 5 && dist <= DRIFTER_AGGRO_R) d.state = "chase";
      else {
        const ang = state.simTick * 0.03;
        d.pos[0] += Math.cos(ang) * DRIFTER_IDLE * TICK_DT;
        d.pos[2] += Math.sin(ang) * DRIFTER_IDLE * TICK_DT;
      }
    }
    if (d.state === "chase") {
      if (p.carried < 5 || dist > DRIFTER_AGGRO_R) {
        d.state = "idle";
      } else {
        const [nx, nz] = normalizeXZ(p.pos[0] - d.pos[0], p.pos[2] - d.pos[2]);
        d.pos[0] += nx * DRIFTER_FAST * TICK_DT;
        d.pos[2] += nz * DRIFTER_FAST * TICK_DT;
        d.facing = [nx, nz];
      }
    }
    if (d.state === "flee") {
      const [nx, nz] = normalizeXZ(d.pos[0] - p.pos[0], d.pos[2] - p.pos[2]);
      d.pos[0] += (nx || 1) * DRIFTER_FAST * TICK_DT;
      d.pos[2] += nz * DRIFTER_FAST * TICK_DT;
      if (d.stateTicks <= 0) d.state = "removed";
    }
  }
}

function contacts(state: SimState, nextTick: number, events: SimEvent[]): void {
  const p = state.player;
  if (p.fallWaitTicks > 0) return;

  const live = state.drifters
    .filter((d) => d.state === "chase" && d.interactDelay === 0 && d.stolen === 0)
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  for (const d of live) {
    if (distXZ(d.pos, p.pos) <= DRIFTER_TOUCH) {
      const amount = Math.min(3, p.carried);
      if (amount > 0) {
        p.carried -= amount;
        d.stolen = amount;
      }
      d.state = "flee";
      d.stateTicks = DRIFTER_FLEE_TICKS;
      events.push({
        type: "drifter_steal",
        tick: nextTick,
        data: { drifter_id: d.id, amount, carried: p.carried },
      });
      break;
    }
  }

  if (p.invulnTicks > 0) return;
  let hit = false;
  const shades = [...state.shades].sort((a, b) =>
    a.id.localeCompare(b.id, undefined, { numeric: true }),
  );
  for (const s of shades) {
    if (hit) break;
    if (s.interactDelay > 0) continue;
    if (s.state === "stunned" || s.state === "spawning" || s.state === "recoil" || s.state === "drain")
      continue;
    if (
      state.lanterns.some(
        (l) => lanternSafe(l) && l.pushTicks > 0 && distXZ(s.pos, l.pos) < SAFE_R,
      )
    ) {
      continue;
    }
    if (distXZ(s.pos, p.pos) <= HIT_XZ && Math.abs(s.pos[1] - p.pos[1]) <= HIT_Y) {
      p.flames -= 1;
      p.invulnTicks = INVULN_TICKS;
      const dropN = Math.floor(p.carried / 2);
      dropAround(state, dropN);
      p.carried -= dropN;
      s.state = "recoil";
      s.stateTicks = SHADE_RECOIL_TICKS;
      events.push({
        type: "player_hit",
        tick: nextTick,
        data: { by: "shade", flames: p.flames, dropped: dropN },
      });
      hit = true;
    }
  }
}

function dropAround(state: SimState, n: number): void {
  for (let i = 0; i < n; i++) {
    const ang = rng01(state) * Math.PI * 2;
    const r = DROP_RING_MIN + rng01(state) * (DROP_RING_MAX - DROP_RING_MIN);
    const m: SimMote = {
      id: `M${state.nextMoteId++}`,
      pos: [
        state.player.pos[0] + Math.cos(ang) * r,
        state.player.pos[1],
        state.player.pos[2] + Math.sin(ang) * r,
      ],
      kind: "dropped",
      ttl: DROP_TTL_TICKS,
      interactDelay: 1,
    };
    state.motes.push(m);
  }
}

function spawns(state: SimState, nextTick: number, events: SimEvent[]): void {
  const map = mapForNight(state.night);
  const st = state.simTick + 1;

  if (st > 0 && st % MOTE_SPAWN_EVERY === 0 && state.motes.length < MOTE_CAP) {
    const empty = map.moteSpawns.filter((pt) => !moteOccupies(state.motes, pt));
    if (empty.length) {
      const pt = empty[Math.floor(rng01(state) * empty.length)];
      state.motes.push({
        id: `M${state.nextMoteId++}`,
        pos: [...pt] as Vec3,
        kind: "random",
        ttl: null,
        interactDelay: 1,
      });
    }
  }

  const interval = SHADE_INTERVAL[state.night];
  const maxS = SHADE_MAX[state.night];
  const should =
    st === SHADE_FIRST_TICK ||
    (st > SHADE_FIRST_TICK && (st - SHADE_FIRST_TICK) % interval === 0);
  if (should) {
    const count = st === SHADE_FIRST_TICK ? 2 : 1;
    for (let k = 0; k < count; k++) {
      if (state.shades.length >= maxS) break;
      const pts = map.shadeSpawns.filter((pt) => distXZ(pt, state.player.pos) >= 15);
      if (!pts.length) break;
      const pt = pts[Math.floor(rng01(state) * pts.length)];
      const id = `S${state.nextShadeId++}`;
      state.shades.push({
        id,
        pos: [pt[0], pt[1], pt[2]],
        state: "spawning",
        stateTicks: 1,
        interactDelay: 1,
        targetLanternId: null,
        drainLogTicks: 0,
      });
      events.push({ type: "shade_spawned", tick: nextTick, data: { id } });
    }
  }

  if (
    (state.night === 2 || state.night === 3) &&
    st >= DRIFTER_FIRST &&
    (st - DRIFTER_FIRST) % DRIFTER_INTERVAL === 0
  ) {
    const live = state.drifters.filter((d) => d.state !== "removed").length;
    if (live < DRIFTER_MAX) {
      const pts = map.shadeSpawns;
      const pt = pts[Math.floor(rng01(state) * pts.length)];
      const id = `D${state.nextDrifterId++}`;
      state.drifters.push({
        id,
        pos: [...pt] as Vec3,
        state: "idle",
        stolen: 0,
        stateTicks: 0,
        interactDelay: 1,
        facing: [1, 0],
      });
    }
  }
}

function applyDawnScore(state: SimState): void {
  for (const l of state.lanterns) {
    if (!l.lit) continue;
    state.score += SCORE_DAWN_LIT + Math.floor(l.fuelSixtieths / 60);
  }
  state.score += state.player.flames * SCORE_DAWN_FLAME;
}

function checkEnd(state: SimState, nextTick: number, events: SimEvent[]): void {
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
    const need = Math.ceil(state.lanterns.length * WIN_RATIO);
    const litCount = state.lanterns.filter((l) => l.lit).length;
    if (litCount >= need) {
      applyDawnScore(state);
      state.state = "won";
      state.reason = "dawn_survived";
      events.push({
        type: "game_over",
        tick: nextTick,
        data: { result: "won", reason: "dawn_survived" },
      });
    } else {
      state.state = "lost";
      state.reason = "dawn";
      events.push({
        type: "game_over",
        tick: nextTick,
        data: { result: "lost", reason: "dawn" },
      });
    }
  }
}

export function step(
  state: SimState,
  tuning: Tuning,
  held: HeldInput,
  prev: HeldInput,
): SimEvent[] {
  const events: SimEvent[] = [];

  if (state.state !== "playing") return events;

  if (edgeActivate(prev.pause, held.pause)) {
    state.paused = !state.paused;
    state.tick += 1;
    events.push({
      type: state.paused ? "paused" : "resumed",
      tick: state.tick,
      data: {},
    });
    if (state.paused) return events;
  } else if (state.paused) {
    state.tick += 1;
    return events;
  }

  if (state.benchFreeze) {
    const nextTick = state.tick + 1;
    moveShades(state);
    state.tick = nextTick;
    state.simTick += 1;
    return events;
  }

  const nextTick = state.tick + 1;
  tickCounters(state);
  movePlayer(state, held, prev, nextTick, events);
  pickup(state, tuning, nextTick, events);
  interact(state, held, prev, nextTick, events);
  tickFuelAndExtinguish(state, nextTick, events);
  updateSafePush(state);
  pulse(state, held, prev, nextTick, events);
  moveShades(state);
  moveDrifters(state);
  contacts(state, nextTick, events);
  spawns(state, nextTick, events);
  checkEnd(state, nextTick, events);

  state.tick = nextTick;
  state.simTick += 1;
  if (state.state === "playing") {
    state.timeLeftS = state.durationS - state.simTick / 60;
  }
  return events;
}
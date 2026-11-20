import { round3, roundVec3 } from "./math.js";
import type { SimEvent, SimState } from "./types.js";

function eventToJson(e: SimEvent): string {
  const base = { type: "event", tick: e.tick, name: e.type, data: e.data };
  return JSON.stringify(base);
}

export function snapshotLine(state: SimState): string {
  const snapState = state.paused && state.state === "playing" ? "paused" : state.state;
  const p = state.player;
  const obj = {
    type: "snapshot",
    tick: state.tick,
    sim_tick: state.simTick,
    night: state.night,
    state: snapState,
    time_left_s: round3(state.timeLeftS),
    score: state.score,
    wind: { active: state.windActive, dir_deg: round3(state.windDirDeg) },
    player: {
      pos: roundVec3(p.pos),
      vel: roundVec3(p.vel),
      flames: p.flames,
      carried: p.carried,
      grounded: p.grounded,
      invuln: p.invulnTicks > 0,
      dash_cd_s: round3(p.dashCdTicks / 60),
      pulse_cd_s: round3(p.pulseCdTicks / 60),
      charm_s: round3(p.charmTicks / 60),
    },
    lanterns: state.lanterns.map((l) => ({
      id: l.id,
      pos: roundVec3(l.pos),
      lit: l.lit,
      deposited: l.deposited,
    })),
    shades: state.shades.map((s) => ({
      id: s.id,
      pos: roundVec3(s.pos),
      state: s.state,
    })),
    motes_active: state.motes.length,
    motes: state.motes.map((m) => ({
      id: m.id,
      pos: roundVec3(m.pos),
      kind: m.kind,
      ttl_s: m.ttl === null ? null : round3(m.ttl / 60),
    })),
    drifters: state.drifters
      .filter((d) => d.state !== "removed")
      .map((d) => ({
        id: d.id,
        pos: roundVec3(d.pos),
        state: d.state,
        stolen: d.stolen,
      })),
    charms: state.charms.map((c) => ({
      id: c.id,
      available: c.available,
      respawn_s: round3(c.respawnTicks / 60),
    })),
  };
  return JSON.stringify(obj);
}

export function endLine(state: SimState, ticksRun: number): string {
  return JSON.stringify({
    type: "end",
    ticks: ticksRun,
    state: state.state,
    score: state.score,
  });
}

export function eventsToLines(events: SimEvent[]): string[] {
  return events.map(eventToJson);
}
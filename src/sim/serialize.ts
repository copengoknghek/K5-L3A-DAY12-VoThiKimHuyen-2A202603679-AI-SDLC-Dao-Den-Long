import { round3, roundVec3 } from "./math.js";
import type { SimEvent, SimState } from "./types.js";

function eventToJson(e: SimEvent): string {
  if (e.type === "mote_picked") {
    return JSON.stringify({
      type: "event",
      tick: e.tick,
      name: "mote_picked",
      data: { carried: e.data.carried },
    });
  }
  if (e.type === "deposit") {
    return JSON.stringify({
      type: "event",
      tick: e.tick,
      name: "deposit",
      data: {
        lantern_id: e.data.lantern_id,
        amount: e.data.amount,
        deposited: e.data.deposited,
      },
    });
  }
  if (e.type === "lantern_lit") {
    return JSON.stringify({
      type: "event",
      tick: e.tick,
      name: "lantern_lit",
      data: { lantern_id: e.data.lantern_id },
    });
  }
  if (e.type === "pulse") {
    return JSON.stringify({
      type: "event",
      tick: e.tick,
      name: "pulse",
      data: { stunned_ids: e.data.stunned_ids },
    });
  }
  if (e.type === "player_hit") {
    return JSON.stringify({
      type: "event",
      tick: e.tick,
      name: "player_hit",
      data: {
        by: e.data.by,
        flames: e.data.flames,
        dropped: e.data.dropped,
      },
    });
  }
  if (e.type === "shade_spawned") {
    return JSON.stringify({
      type: "event",
      tick: e.tick,
      name: "shade_spawned",
      data: { id: e.data.id },
    });
  }
  return JSON.stringify({
    type: "event",
    tick: e.tick,
    name: "game_over",
    data: { result: e.data.result, reason: e.data.reason },
  });
}

export function snapshotLine(state: SimState): string {
  const obj = {
    type: "snapshot",
    tick: state.tick,
    sim_tick: state.tick,
    state: state.state,
    time_left_s: round3(state.timeLeftS),
    score: state.score,
    player: {
      pos: roundVec3(state.player.pos),
      flames: state.player.flames,
      carried: state.player.carried,
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
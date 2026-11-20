import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { loadContract } from "../src/sim/contract.js";
import { heldAtTick, prevHeldAtTick } from "../src/sim/input.js";
import { runHeadless } from "../src/sim/runner.js";
import { step } from "../src/sim/step.js";
import { createInitialState, parseScenario } from "../src/sim/world.js";
import { DEFAULT_HELD } from "../src/sim/types.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const tuning = loadContract(root).tuning;

function loadScenario(name: string) {
  return parseScenario(
    JSON.parse(readFileSync(join(root, "tests", "fixtures", name), "utf-8")),
  );
}

describe("sim", () => {
  it("zero ticks: snapshot at 0 and end ticks 0 playing", () => {
    const result = runHeadless({
      seed: 1,
      tuning,
      scenario: {
        random_motes: false,
        random_shades: false,
        motes: [],
        shades: [],
        time_left_s: 180,
      },
      frames: [],
      ticks: 0,
      snapshotEvery: 10,
    });
    assert.equal(result.ticksRun, 0);
    assert.match(result.lines[0], /"tick":0/);
    assert.match(result.lines[0], /"time_left_s":180/);
    const last = JSON.parse(result.lines[result.lines.length - 1]);
    assert.equal(last.type, "end");
    assert.equal(last.ticks, 0);
    assert.equal(last.state, "playing");
  });

  it("move +Z 60 ticks at speed 6 is near 6m after accel", () => {
    let state = createInitialState({
      seed: 1,
      scenario: {
        random_motes: false,
        random_shades: false,
        motes: [],
        shades: [],
      },
      tuning,
    });
    const frames = [{ tick: 0, move: [0, 1] as [number, number], cam_yaw_deg: 0 }];
    for (let k = 0; k < 60; k++) {
      const held = heldAtTick(frames, k);
      const prev = prevHeldAtTick(frames, k);
      step(state, tuning, held, prev);
    }
    assert.ok(state.player.pos[2] > 5.5 && state.player.pos[2] < 6.05);
  });

  it("picks mote when walking north", () => {
    const scenario = loadScenario("pickup-mote.json");
    const frames = [{ tick: 0, move: [0, 1] as [number, number], cam_yaw_deg: 0 }];
    const result = runHeadless({
      seed: 42,
      tuning,
      scenario,
      frames,
      ticks: 200,
      snapshotEvery: 50,
    });
    const events = result.lines.filter((l) => l.includes('"name":"mote_picked"'));
    assert.ok(events.length >= 1);
  });

  it("deposit and lantern_lit on interact", () => {
    const scenario = loadScenario("deposit-l1.json");
    const frames = [
      { tick: 0, interact: true },
      { tick: 1, interact: false },
    ];
    const result = runHeadless({
      seed: 1,
      tuning,
      scenario,
      frames,
      ticks: 2,
      snapshotEvery: 100,
    });
    const names = result.lines
      .filter((l) => l.includes('"type":"event"'))
      .map((l) => JSON.parse(l).name);
    assert.ok(names.includes("deposit"));
    assert.ok(names.includes("lantern_lit"));
  });

  it("pre-lit lantern in scenario does not emit deposit at tick 0", () => {
    const state = createInitialState({
      seed: 1,
      scenario: {
        random_motes: false,
        random_shades: false,
        motes: [],
        shades: [],
        lanterns: [{ id: "L1", pos: [0, 0, 25], lit: true, deposited: 10 }],
      },
      tuning,
    });
    assert.equal(state.score, 0);
    assert.equal(state.tick, 0);
    assert.equal(state.lanterns[0].lit, true);
  });

  it("pulse stuns shade in range costing motes", () => {
    const scenario = loadScenario("pulse-shade.json");
    const frames = [
      { tick: 0, pulse: true },
      { tick: 1, pulse: false },
    ];
    const result = runHeadless({
      seed: 1,
      tuning,
      scenario,
      frames,
      ticks: 2,
      snapshotEvery: 100,
    });
    const pulse = result.lines.map((l) => JSON.parse(l)).find((e) => e?.name === "pulse");
    assert.ok(pulse);
    assert.deepEqual(pulse.data.stunned_ids, ["S1"]);
  });

  it("shade hit reduces flames and respects invuln", () => {
    let state = createInitialState({
      seed: 1,
      scenario: {
        random_motes: false,
        random_shades: false,
        motes: [],
        shades: [{ pos: [0.5, 0, 0] }],
        player: { pos: [0, 0, 0], carried: 4, flames: 3 },
      },
      tuning,
    });
    const held = DEFAULT_HELD;
    step(state, tuning, held, held);
    assert.equal(state.player.flames, 2);
    step(state, tuning, held, held);
    assert.equal(state.player.flames, 2);
  });

  it("all lit no longer ends early — replaced by dawn_survived (v1.2)", () => {
    const scenario = {
      random_motes: false,
      random_shades: false,
      motes: [] as [number, number, number][],
      shades: [] as { pos: [number, number, number] }[],
      lanterns: [
        { id: "L1", lit: true, fuel: 100 },
        { id: "L2", lit: true, fuel: 100 },
        { id: "L3", lit: true, fuel: 100 },
        { id: "L4", lit: true, fuel: 100 },
        { id: "L5", lit: true, fuel: 100 },
      ],
      player: { pos: [0, 0, 0] as [number, number, number], flames: 3 },
      time_left_s: 100,
    };
    const result = runHeadless({
      seed: 1,
      tuning,
      scenario,
      frames: [],
      ticks: 5,
      snapshotEvery: 100,
    });
    const last = JSON.parse(result.lines[result.lines.length - 1]);
    assert.equal(last.state, "playing");
  });

  it("dawn_survived when enough lanterns lit at dawn", () => {
    const scenario = {
      random_motes: false,
      random_shades: false,
      motes: [] as [number, number, number][],
      shades: [] as { pos: [number, number, number] }[],
      lanterns: [
        { id: "L1", lit: true, fuel: 80 },
        { id: "L2", lit: true, fuel: 80 },
        { id: "L3", lit: true, fuel: 80 },
        { id: "L4", lit: false },
        { id: "L5", lit: false },
      ],
      player: { flames: 3 },
      time_left_s: 0.05,
    };
    const result = runHeadless({
      seed: 1,
      tuning,
      scenario,
      frames: [],
      ticks: 10,
      snapshotEvery: 100,
    });
    const go = result.lines
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .find((e) => e?.name === "game_over");
    assert.ok(go);
    assert.equal(go.data.reason, "dawn_survived");
    assert.equal(result.finalState.state, "won");
  });

  it("lantern_out when fuel depletes", () => {
    let state = createInitialState({
      seed: 1,
      scenario: {
        random_motes: false,
        random_shades: false,
        motes: [],
        shades: [],
        lanterns: [{ id: "L1", lit: true, fuel: 0.05 }],
      },
      tuning,
    });
    const held = DEFAULT_HELD;
    let ev: ReturnType<typeof step> = [];
    for (let i = 0; i < 5; i++) {
      ev = step(state, tuning, held, held);
      if (ev.some((e) => e.type === "lantern_out")) break;
    }
    assert.ok(ev.some((e) => e.type === "lantern_out"));
    assert.equal(state.lanterns[0].lit, false);
    assert.equal(state.lanterns[0].everLit, true);
  });

  it("deterministic JSONL for same seed scenario inputs", () => {
    const scenario = loadScenario("pickup-mote.json");
    const frames = [{ tick: 0, move: [0, 1] as [number, number], cam_yaw_deg: 0 }];
    const a = runHeadless({
      seed: 99,
      tuning,
      scenario,
      frames,
      ticks: 120,
      snapshotEvery: 10,
    }).lines.join("\n");
    const b = runHeadless({
      seed: 99,
      tuning,
      scenario,
      frames,
      ticks: 120,
      snapshotEvery: 10,
    }).lines.join("\n");
    assert.equal(a, b);
  });
});

describe("phase-2 features", () => {
  it("dash emits event and moves fast", () => {
    const result = runHeadless({
      seed: 1,
      tuning,
      scenario: {
        random_motes: false,
        random_shades: false,
        motes: [],
        shades: [],
      },
      frames: [
        { tick: 0, dash: true, cam_yaw_deg: 0 },
        { tick: 1, dash: false },
      ],
      ticks: 12,
      snapshotEvery: 100,
    });
    assert.ok(result.lines.some((l) => l.includes('"name":"dash"')));
    assert.ok(result.finalState.player.pos[2] > 2);
  });

  it("pause freezes sim_tick", () => {
    const result = runHeadless({
      seed: 1,
      tuning,
      scenario: { random_motes: false, random_shades: false, motes: [], shades: [] },
      frames: [
        { tick: 0, pause: true },
        { tick: 1, pause: false },
      ],
      ticks: 10,
      snapshotEvery: 1,
    });
    assert.ok(result.lines.some((l) => l.includes('"name":"paused"')));
    const snaps = result.lines.filter((l) => l.includes('"type":"snapshot"')).map((l) => JSON.parse(l));
    const paused = snaps.find((s) => s.state === "paused");
    assert.ok(paused);
  });

  it("night 2 charm pickup", () => {
    const result = runHeadless({
      seed: 1,
      night: 2,
      tuning,
      scenario: loadScenario("charm-n2.json"),
      frames: [],
      ticks: 2,
      snapshotEvery: 1,
    });
    assert.ok(result.lines.some((l) => l.includes("charm_picked")));
  });

  it("drifter steals motes", () => {
    const result = runHeadless({
      seed: 1,
      night: 2,
      tuning,
      scenario: loadScenario("drifter.json"),
      frames: [],
      ticks: 3,
      snapshotEvery: 10,
    });
    assert.ok(result.lines.some((l) => l.includes("drifter_steal")));
  });

  it("contract v1.2 keys present in snapshot", () => {
    const result = runHeadless({
      seed: 1,
      night: 3,
      tuning,
      scenario: { random_motes: false, random_shades: false, motes: [], shades: [], wind_enabled: true },
      frames: [],
      ticks: 0,
      snapshotEvery: 10,
    });
    const snap = JSON.parse(result.lines[0]);
    assert.equal(snap.night, 3);
    assert.ok(snap.wind);
    assert.ok("capacity" in snap.player);
    assert.ok("fuel" in snap.lanterns[0]);
    assert.ok("ever_lit" in snap.lanterns[0]);
    assert.ok("dash_cd_s" in snap.player);
    assert.ok(Array.isArray(snap.drifters));
    assert.ok(Array.isArray(snap.charms));
  });
});
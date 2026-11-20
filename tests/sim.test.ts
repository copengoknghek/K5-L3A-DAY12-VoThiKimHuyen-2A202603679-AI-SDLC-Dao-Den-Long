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

  it("move +Z 60 ticks at speed 6 ends at z=6", () => {
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
    assert.ok(Math.abs(state.player.pos[2] - 6) < 0.01);
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
    const events = result.lines
      .filter((l) => l.includes('"name":"mote_picked"'))
      .map((l) => JSON.parse(l));
    assert.ok(events.length >= 1);
    assert.equal(events[0].name, "mote_picked");
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
    const last = JSON.parse(result.lines[result.lines.length - 1]);
    assert.ok(last.score >= tuning.score.per_lantern);
  });

  it("pre-lit lantern in scenario does not emit deposit at tick 0", () => {
    const state = createInitialState({
      seed: 1,
      scenario: {
        random_motes: false,
        random_shades: false,
        motes: [],
        shades: [],
        lanterns: [{ id: "L1", pos: [0, 0, 25], lit: true, deposited: 5 }],
      },
      tuning,
    });
    assert.equal(state.score, 0);
    assert.equal(state.tick, 0);
    assert.equal(state.lanterns[0].lit, true);
  });

  it("pulse stuns shade in range", () => {
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
    const pulse = result.lines
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .find((e) => e?.name === "pulse");
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
        player: { pos: [0, 0, 0], carried: 4, flames: 5 },
      },
      tuning,
    });
    const held = DEFAULT_HELD;
    step(state, tuning, held, held);
    assert.equal(state.player.flames, 4);
    step(state, tuning, held, held);
    assert.equal(state.player.flames, 4);
  });

  it("win all_lit when all lanterns lit", () => {
    const scenario = {
      random_motes: false,
      random_shades: false,
      motes: [] as [number, number, number][],
      shades: [] as { pos: [number, number, number] }[],
      lanterns: [
        { id: "L1", lit: true, deposited: 5 },
        { id: "L2", lit: true, deposited: 5 },
        { id: "L3", lit: true, deposited: 5 },
        { id: "L4", lit: true, deposited: 5 },
        { id: "L5", lit: false, deposited: 0, pos: [0, 0, 2] as [number, number, number] },
      ],
      player: { pos: [0, 0, 0] as [number, number, number], carried: 5, flames: 3 },
      time_left_s: 100,
    };
    const frames = [{ tick: 0, interact: true }, { tick: 1, interact: false }];
    const result = runHeadless({
      seed: 1,
      tuning,
      scenario,
      frames,
      ticks: 3,
      snapshotEvery: 100,
    });
    const last = JSON.parse(result.lines[result.lines.length - 1]);
    assert.equal(last.state, "won");
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
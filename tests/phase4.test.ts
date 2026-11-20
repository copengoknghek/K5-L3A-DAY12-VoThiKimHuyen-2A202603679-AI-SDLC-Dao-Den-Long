import assert from "node:assert/strict";
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { buildBenchJson } from "../src/bench/metrics.js";
import { buildBenchScenario } from "../src/sim/bench-scenario.js";
import { loadContract } from "../src/sim/contract.js";
import { step } from "../src/sim/step.js";
import { DEFAULT_HELD } from "../src/sim/types.js";
import { createInitialState } from "../src/sim/world.js";
import { validateName, addEntry } from "../src/leaderboard-core.js";
import { runSoak } from "../src/soak/run.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");

describe("phase-4 contract v1.3", () => {
  it("game.contract.json has bench and soak commands", () => {
    const c = loadContract(root);
    assert.equal(c.contract_version, "1.3");
    assert.ok(c.bench_cmd?.includes("bench/cli.js"));
    assert.ok(c.soak_cmd?.includes("soak/cli.js"));
  });

  it("bench scenario has 200 shades and bench freeze", () => {
    const scenario = buildBenchScenario(42);
    assert.equal(scenario.shades?.length, 200);
    assert.equal(scenario.motes?.length, 100);
    assert.equal(scenario.bench_freeze, true);
    let state = createInitialState({ seed: 42, scenario, tuning: loadContract(root).tuning, night: 1 });
    const h = DEFAULT_HELD;
    const before = state.shades[0].pos[0];
    for (let i = 0; i < 120; i++) step(state, loadContract(root).tuning, h, h);
    assert.equal(state.player.carried, 0);
    assert.equal(state.state, "playing");
    assert.notEqual(state.shades[0].pos[0], before);
  });

  it("bench metrics math", () => {
    const ms = Array.from({ length: 100 }, () => 10);
    const json = buildBenchJson(ms, {
      contract_version: "1.3",
      load_ms: 100,
      peak_mem_mb: null,
      vsync_off: false,
      renderer: "test",
      os: "test",
    });
    assert.equal(json.frames, 100);
    assert.equal(json.avg_fps, 100);
    assert.equal(json.frame_ms_p95, 10);
  });

  it("leaderboard name validation", () => {
    assert.ok(validateName("Huyen_42"));
    assert.ok(validateName("Kim"));
    assert.ok(!validateName("ab"));
    assert.ok(!validateName("name with space"));
  });

  it("leaderboard ordering", () => {
    const out = addEntry(
      [{ name: "A", score: 10, nights_won: 1, achieved_at: "2026-01-02T00:00:00+07:00", seed: 1 }],
      { name: "B", score: 20, nights_won: 2, achieved_at: "2026-01-03T00:00:00+07:00", seed: 2 },
    );
    assert.equal(out[0].name, "B");
  });

  it("soak runs 3 nights without crash", () => {
    const tuning = loadContract(root).tuning;
    const out = runSoak({ baseSeed: 7, nights: 3, tuning });
    assert.equal(out.crashes, 0);
    assert.equal(out.results.length, 3);
    assert.ok(out.mem_end_mb <= out.mem_start_mb * 1.2 + 0.01);
  });

  it("export leaderboard cli", () => {
    const lb = join(root, "leaderboard.json");
    const prev = existsSync(lb) ? readFileSync(lb, "utf-8") : null;
    writeFileSync(
      lb,
      JSON.stringify({
        entries: [{ name: "Lab", score: 50, nights_won: 1, achieved_at: "2026-03-01T12:00:00+07:00", seed: 3 }],
      }),
    );
    const out = join(root, "dist", "tests", "tmp-lb.json");
    const run = join(root, "dist", "src", "run", "cli.js");
    const r = spawnSync(process.execPath, [run, "--export-leaderboard", out], { cwd: root, encoding: "utf-8" });
    assert.equal(r.status, 0, r.stderr);
    const data = JSON.parse(readFileSync(out, "utf-8"));
    assert.equal(data.entries[0].name, "Lab");
    if (prev) writeFileSync(lb, prev);
    else unlinkSync(lb);
  });
});
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const cli = join(root, "dist", "src", "headless", "cli.js");

describe("cli", () => {
  it("exits 2 on invalid inputs tick order", () => {
    const out = join(root, "dist", "tests", "tmp-bad.jsonl");
    const inputs = join(root, "tests", "fixtures", "bad-inputs.json");
    const r = spawnSync(
      process.execPath,
      [
        cli,
        "--seed",
        "1",
        "--night",
        "1",
        "--inputs",
        inputs,
        "--ticks",
        "5",
        "--out",
        out,
      ],
      { cwd: root, encoding: "utf-8" },
    );
    assert.equal(r.status, 2);
  });

  it("runs pickup scenario and writes mote_picked", () => {
    const out = join(root, "dist", "tests", "tmp-pickup.jsonl");
    const scenario = join(root, "tests", "fixtures", "pickup-mote.json");
    const inputs = join(root, "tests", "fixtures", "move-north.json");
    const r = spawnSync(
      process.execPath,
      [
        cli,
        "--seed",
        "42",
        "--night",
        "1",
        "--scenario",
        scenario,
        "--inputs",
        inputs,
        "--ticks",
        "200",
        "--out",
        out,
      ],
      { cwd: root, encoding: "utf-8" },
    );
    assert.equal(r.status, 0, r.stderr);
    const text = readFileSync(out, "utf-8");
    assert.ok(text.includes("mote_picked"));
  });
});
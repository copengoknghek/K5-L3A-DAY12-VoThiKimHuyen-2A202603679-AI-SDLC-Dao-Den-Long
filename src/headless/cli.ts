#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadContract, repoRoot } from "../sim/contract.js";
import { FormatError, parseInputsFile } from "../sim/input.js";
import { runHeadless } from "../sim/runner.js";
import { parseScenario } from "../sim/world.js";

function usage(): void {
  console.error(
    "Usage: headless --seed <int> --night 1 [--scenario <file>] [--inputs <file>] --ticks <int> --out <file> [--snapshot-every <int>]",
  );
}

function parseArgs(argv: string[]): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--seed") {
      out.seed = Number(argv[++i]);
    } else if (a === "--night") {
      out.night = Number(argv[++i]);
    } else if (a === "--scenario") {
      out.scenario = argv[++i];
    } else if (a === "--inputs") {
      out.inputs = argv[++i];
    } else if (a === "--ticks") {
      out.ticks = Number(argv[++i]);
    } else if (a === "--out") {
      out.out = argv[++i];
    } else if (a === "--snapshot-every") {
      out.snapshotEvery = Number(argv[++i]);
    }
  }
  return out;
}

function main(): void {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (
      args.seed === undefined ||
      args.night === undefined ||
      args.ticks === undefined ||
      args.out === undefined
    ) {
      usage();
      process.exit(1);
    }
    if (args.night !== 1) {
      console.error("Only --night 1 is supported in Phase 1");
      process.exit(1);
    }
    if (!Number.isInteger(args.seed) || !Number.isInteger(args.ticks) || (args.ticks as number) < 0) {
      console.error("Invalid --seed or --ticks");
      process.exit(1);
    }

    const root = repoRoot();
    const contract = loadContract(root);
    let scenario = null;
    if (args.scenario) {
      const path = resolve(String(args.scenario));
      const raw = JSON.parse(readFileSync(path, "utf-8"));
      scenario = parseScenario(raw);
    }

    let frames: ReturnType<typeof parseInputsFile>["frames"] = [];
    if (args.inputs) {
      const path = resolve(String(args.inputs));
      const raw = JSON.parse(readFileSync(path, "utf-8"));
      frames = parseInputsFile(raw).frames;
    }

    const snapshotEvery =
      args.snapshotEvery !== undefined ? Number(args.snapshotEvery) : 10;
    if (!Number.isInteger(snapshotEvery) || snapshotEvery < 1) {
      console.error("Invalid --snapshot-every");
      process.exit(1);
    }

    const result = runHeadless({
      seed: args.seed as number,
      tuning: contract.tuning,
      scenario,
      frames,
      ticks: args.ticks as number,
      snapshotEvery,
    });

    const outPath = resolve(String(args.out));
    writeFileSync(outPath, result.lines.join("\n") + "\n", "utf-8");
    process.exit(0);
  } catch (e) {
    if (e instanceof FormatError) {
      console.error(e.message);
      process.exit(2);
    }
    if (e instanceof SyntaxError) {
      console.error("Invalid JSON in scenario or inputs");
      process.exit(2);
    }
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

main();
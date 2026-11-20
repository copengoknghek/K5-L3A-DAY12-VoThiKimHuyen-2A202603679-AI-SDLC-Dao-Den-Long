#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadContract, repoRoot } from "../sim/contract.js";
import { runSoak } from "./run.js";

function usage(): void {
  console.error("Usage: soak --seed <int> --nights <int> --out <file>");
}

function parseArgs(argv: string[]): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--seed") out.seed = Number(argv[++i]);
    else if (a === "--nights") out.nights = Number(argv[++i]);
    else if (a === "--out") out.out = argv[++i];
  }
  return out;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (args.seed === undefined || args.nights === undefined || args.out === undefined) {
    usage();
    process.exit(1);
  }
  if (!Number.isInteger(args.seed) || !Number.isInteger(args.nights) || (args.nights as number) < 1) {
    console.error("Invalid --seed or --nights");
    process.exit(1);
  }
  const contract = loadContract(repoRoot());
  const result = runSoak({
    baseSeed: args.seed as number,
    nights: args.nights as number,
    tuning: contract.tuning,
  });
  writeFileSync(resolve(String(args.out)), JSON.stringify(result) + "\n", "utf-8");
  process.exit(0);
}

main();
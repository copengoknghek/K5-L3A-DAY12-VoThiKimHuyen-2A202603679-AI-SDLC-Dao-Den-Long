import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Tuning } from "./types.js";

export interface GameContract {
  contract_version: string;
  team: string;
  build_cmd: string;
  run_cmd: string;
  headless_cmd: string;
  tuning: Tuning;
}

export function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
}

export function loadContract(root?: string): GameContract {
  const base = root ?? repoRoot();
  const raw = readFileSync(join(base, "game.contract.json"), "utf-8");
  return JSON.parse(raw) as GameContract;
}
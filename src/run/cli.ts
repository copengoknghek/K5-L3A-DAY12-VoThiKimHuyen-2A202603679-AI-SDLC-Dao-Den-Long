#!/usr/bin/env node
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defaultLeaderboardPath, loadLeaderboardFromFile } from "../leaderboard.js";
import { repoRoot } from "../sim/contract.js";

function usage(): void {
  console.error("Usage: run [--export-leaderboard <file>] | preview (default: start vite preview)");
}

function parseArgs(argv: string[]): { exportPath?: string; preview: boolean } {
  const out: { exportPath?: string; preview: boolean } = { preview: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--export-leaderboard") {
      out.exportPath = argv[++i];
      out.preview = false;
    } else if (a === "preview") {
      out.preview = true;
    }
  }
  return out;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const root = repoRoot();

  if (args.exportPath) {
    const path = defaultLeaderboardPath(root);
    const data = loadLeaderboardFromFile(path);
    writeFileSync(resolve(String(args.exportPath)), JSON.stringify(data) + "\n", "utf-8");
    process.exit(0);
  }

  if (args.preview) {
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    const child = spawn(npm, ["run", "preview"], { cwd: root, stdio: "inherit", shell: true });
    child.on("exit", (code) => process.exit(code ?? 0));
    return;
  }

  usage();
  process.exit(1);
}

main();
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  addEntry,
  sortEntries,
  type LeaderboardEntry,
  type LeaderboardFile,
} from "./leaderboard-core.js";

export type { LeaderboardEntry, LeaderboardFile } from "./leaderboard-core.js";
export { validateName, sortEntries, addEntry } from "./leaderboard-core.js";

export function loadLeaderboardFromFile(path: string): LeaderboardFile {
  if (!existsSync(path)) return { entries: [] };
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8")) as LeaderboardFile;
    if (!raw || !Array.isArray(raw.entries)) return { entries: [] };
    return { entries: sortEntries(raw.entries) };
  } catch {
    return { entries: [] };
  }
}

export function saveLeaderboardToFile(path: string, data: LeaderboardFile): void {
  writeFileSync(path, JSON.stringify({ entries: sortEntries(data.entries) }, null, 2) + "\n", "utf-8");
}

export function defaultLeaderboardPath(root: string): string {
  return join(root, "leaderboard.json");
}
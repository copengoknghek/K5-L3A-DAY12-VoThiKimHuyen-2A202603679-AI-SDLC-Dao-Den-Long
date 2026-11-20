import { addEntry, sortEntries, type LeaderboardEntry } from "../leaderboard-core.js";

const STORAGE_KEY = "ddl-leaderboard-v1";

export function loadLeaderboardBrowser(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as { entries?: LeaderboardEntry[] };
    return sortEntries(data.entries ?? []);
  } catch {
    return [];
  }
}

export function saveLeaderboardBrowser(entries: LeaderboardEntry[]): void {
  const sorted = sortEntries(entries);
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ entries: sorted }));
  void fetch("/__leaderboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entries: sorted }),
  }).catch(() => undefined);
}

export function persistScore(entry: LeaderboardEntry): void {
  const next = addEntry(loadLeaderboardBrowser(), entry);
  saveLeaderboardBrowser(next);
}
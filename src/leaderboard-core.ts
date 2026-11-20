export interface LeaderboardEntry {
  name: string;
  score: number;
  nights_won: number;
  achieved_at: string;
  seed: number;
}

export interface LeaderboardFile {
  entries: LeaderboardEntry[];
}

export function validateName(name: string): boolean {
  const n = name.trim();
  if (n.length < 3 || n.length > 12) return false;
  return /^[\p{L}\p{N}_]+$/u.test(n);
}

export function sortEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.achieved_at.localeCompare(b.achieved_at);
  });
}

export function addEntry(entries: LeaderboardEntry[], entry: LeaderboardEntry): LeaderboardEntry[] {
  return sortEntries([...entries, entry]).slice(0, 10);
}
export interface BenchPayload {
  contract_version: string;
  avg_fps: number;
  p1_low_fps: number;
  frame_ms_p95: number;
  frames: number;
  load_ms: number;
  peak_mem_mb: number | null;
  vsync_off: boolean;
  renderer: string;
  os: string;
}

export function percentile95(sortedAscMs: number[]): number {
  const n = sortedAscMs.length;
  if (n === 0) return 0;
  const idx = Math.min(n - 1, Math.floor(0.95 * n));
  return sortedAscMs[idx];
}

export function buildBenchJson(frameMs: number[], meta: Omit<BenchPayload, "avg_fps" | "p1_low_fps" | "frame_ms_p95" | "frames">): BenchPayload {
  const N = frameMs.length;
  const sum = frameMs.reduce((a, b) => a + b, 0);
  const avg_fps = N === 0 || sum === 0 ? 0 : Math.round(((1000 * N) / sum) * 10) / 10;
  const sortedDesc = [...frameMs].sort((a, b) => b - a);
  const k = Math.max(1, Math.ceil(0.01 * N));
  const p1Avg = sortedDesc.slice(0, k).reduce((a, b) => a + b, 0) / k;
  const p1_low_fps = p1Avg > 0 ? Math.round((1000 / p1Avg) * 10) / 10 : 0;
  const sortedAsc = [...frameMs].sort((a, b) => a - b);
  const frame_ms_p95 = Math.round(percentile95(sortedAsc) * 10) / 10;
  return {
    ...meta,
    avg_fps,
    p1_low_fps,
    frame_ms_p95,
    frames: N,
  };
}
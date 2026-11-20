import type { Vec3 } from "./types.js";

export function dist3(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function distXZ(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dz = a[2] - b[2];
  return Math.hypot(dx, dz);
}

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function roundVec3(v: Vec3): Vec3 {
  return [round3(v[0]), round3(v[1]), round3(v[2])];
}

export function clampToIsland(pos: Vec3, radius: number): Vec3 {
  const dx = pos[0];
  const dz = pos[2];
  const d = Math.hypot(dx, dz);
  if (d <= radius || d < 1e-9) return pos;
  const s = radius / d;
  return [dx * s, pos[1], dz * s];
}

export function normalizeXZ(x: number, z: number): [number, number] {
  const len = Math.hypot(x, z);
  if (len < 1e-9) return [0, 0];
  return [x / len, z / len];
}
import { PAD_R, xzFromDeg } from "./constants.js";
import { distXZ } from "./math.js";
import type { Vec3 } from "./types.js";

export interface JumpPad {
  pos: Vec3;
  vy: number;
  horiz: number;
  dir: [number, number];
}

export interface NightMap {
  night: 1 | 2 | 3;
  lanterns: { id: string; pos: Vec3 }[];
  moteSpawns: Vec3[];
  shadeSpawns: Vec3[];
  pads: JumpPad[];
  charms: { id: string; pos: Vec3 }[];
  spawn: Vec3;
  facing: [number, number];
}

function ring(n: number, r: number, startDeg: number, step: number, y = 0): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < n; i++) out.push(xzFromDeg(r, startDeg + i * step, y));
  return out;
}

export function night1Map(): NightMap {
  const moteSpawns = [
    ...ring(8, 12, 0, 45),
    ...ring(16, 33, 0, 22.5),
  ];
  return {
    night: 1,
    spawn: [0, 0, 0],
    facing: [0, 1],
    lanterns: [
      { id: "L1", pos: [0, 0, 25] },
      { id: "L2", pos: [23.8, 0, 7.7] },
      { id: "L3", pos: [14.7, 0, -20.2] },
      { id: "L4", pos: [-14.7, 0, -20.2] },
      { id: "L5", pos: [-23.8, 0, 7.7] },
    ],
    moteSpawns,
    shadeSpawns: ring(12, 37, 15, 30),
    pads: [],
    charms: [],
  };
}

export function night2Map(): NightMap {
  const around = (cx: number, cz: number): Vec3[] =>
    [
      ...ring(4, 10, 0, 90),
      ...ring(8, 22, 0, 45),
    ].map(([x, y, z]) => [x + cx, y, z + cz] as Vec3);

  const shadeAround = (cx: number, cz: number): Vec3[] =>
    ring(8, 26, 22.5, 45).map(([x, y, z]) => [x + cx, y, z + cz] as Vec3);

  const aToB = [50, -18] as [number, number];
  const lenAB = Math.hypot(aToB[0], aToB[1]);
  const bToA = [-50, 18] as [number, number];
  const lenBA = Math.hypot(bToA[0], bToA[1]);

  return {
    night: 2,
    spawn: [0, 0, 0],
    facing: [0, 1],
    lanterns: [
      { id: "L1", pos: [0, 0, 20] },
      { id: "L2", pos: [17, 0, -10] },
      { id: "L3", pos: [-17, 0, -10] },
      { id: "L4", pos: [70, 0, 20] },
      { id: "L5", pos: [87, 0, -10] },
      { id: "L6", pos: [53, 0, -10] },
    ],
    moteSpawns: [...around(0, 0), ...around(70, 0)],
    shadeSpawns: [...shadeAround(0, 0), ...shadeAround(70, 0)],
    pads: [
      {
        pos: [20, 0, 18],
        vy: 14,
        horiz: 24,
        dir: [aToB[0] / lenAB, aToB[1] / lenAB],
      },
      {
        pos: [50, 0, -18],
        vy: 14,
        horiz: 24,
        dir: [bToA[0] / lenBA, bToA[1] / lenBA],
      },
    ],
    charms: [{ id: "C1", pos: [35, 0, 0] }],
  };
}

export function night3Map(): NightMap {
  return {
    night: 3,
    spawn: [0, 0, 0],
    facing: [0, 1],
    lanterns: [
      { id: "L1", pos: [0, 6, 6] },
      { id: "L2", pos: [18, 3, 10] },
      { id: "L3", pos: [-18, 3, 10] },
      { id: "L4", pos: [35, 0, -10] },
      { id: "L5", pos: [-35, 0, -10] },
      { id: "L6", pos: [20, 0, -35] },
      { id: "L7", pos: [-20, 0, -35] },
    ],
    moteSpawns: [
      ...ring(18, 34, 0, 20, 0),
      ...ring(8, 18, 20, 20, 3),
      ...ring(4, 5, 45, 90, 6),
    ],
    shadeSpawns: ring(16, 43, 0, 22.5, 0),
    pads: [
      {
        pos: [0, 3, 13],
        vy: 12,
        horiz: 8,
        dir: [0, -1],
      },
    ],
    charms: [
      { id: "C1", pos: [30, 0, 25] },
      { id: "C2", pos: [-30, 0, 25] },
    ],
  };
}

export function mapForNight(n: 1 | 2 | 3): NightMap {
  if (n === 2) return night2Map();
  if (n === 3) return night3Map();
  return night1Map();
}

function rampY(x: number, z: number, deg: number): number | null {
  const rad = (deg * Math.PI) / 180;
  const r = Math.hypot(x, z);
  if (r < 24 || r > 30) return null;
  const distLine = Math.abs(x * Math.sin(rad) - z * Math.cos(rad));
  if (distLine > 1.5) return null;
  return (3 * (30 - r)) / 6;
}

/** Ground Y if standing here; null = void (will fall). */
export function groundY(night: 1 | 2 | 3, x: number, z: number): number | null {
  if (night === 1) {
    return Math.hypot(x, z) <= 40 ? 0 : null;
  }
  if (night === 2) {
    if (Math.hypot(x, z) <= 28) return 0;
    if (Math.hypot(x - 70, z) <= 28) return 0;
    if (x >= 26 && x <= 44 && z >= -2 && z <= 2) return 0;
    return null;
  }
  const r = Math.hypot(x, z);
  if (r > 45) return null;
  const yRamp = rampY(x, z, 30) ?? rampY(x, z, 150);
  if (yRamp !== null) return yRamp;
  if (r <= 8) return 6;
  if (z > 0 && r >= 12 && r <= 24) return 3;
  return 0;
}

export function towerBlocks(x: number, z: number, y: number): boolean {
  return y >= 5.5 && Math.hypot(x, z) < 2;
}

export function padAt(map: NightMap, pos: Vec3, grounded: boolean): JumpPad | null {
  if (!grounded) return null;
  for (const p of map.pads) {
    if (distXZ(pos, p.pos) <= PAD_R && Math.abs(pos[1] - p.pos[1]) < 0.4) return p;
  }
  return null;
}
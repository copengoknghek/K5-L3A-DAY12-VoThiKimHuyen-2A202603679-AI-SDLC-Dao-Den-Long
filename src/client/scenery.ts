import * as THREE from "three";
import { mulberry32 } from "../sim/rng.js";
import { ISLAND_RADIUS } from "../sim/types.js";

/** Cỏ, cây, ruộng bậc thang, mây — chỉ hiển thị, không ảnh hưởng sim. */

const TERRACE_TOP_RATIO = 0.18;
const TERRACE_STEPS = 6;
const TERRACE_RISE = 2.4;

/** Mặt bậc tại khoảng cách `dist`. Đỉnh giữa cao nhất, mép đảo chạm mặt nước. */
export function terraceTopY(dist: number, radius: number, rise = TERRACE_RISE): number {
  const n = TERRACE_STEPS - 1;
  const topR = radius * TERRACE_TOP_RATIO;
  const maxY = n * rise;
  if (dist <= topR || radius <= topR) return maxY;
  const t = Math.min(0.999, (dist - topR) / (radius - topR));
  const drop = Math.min(n, Math.floor(t * n) + 1);
  return maxY - drop * rise;
}

export function visualGroundY(x: number, z: number, y: number, night: 1 | 2 | 3): number {
  if (y > 2) return 0;
  if (night === 1) return terraceTopY(Math.hypot(x, z), 40);
  if (night === 2) {
    if (Math.hypot(x, z) <= 28) return terraceTopY(Math.hypot(x, z), 28);
    if (Math.hypot(x - 70, z) <= 28) return terraceTopY(Math.hypot(x - 70, z), 28);
    return 0;
  }
  if (Math.hypot(x, z) <= 45) return terraceTopY(Math.hypot(x, z), 45, 0.32);
  return 0;
}

type CloudDrift = {
  baseX: number;
  baseZ: number;
  y: number;
  phase: number;
  speed: number;
};

export function addGrassAndTrees(scene: THREE.Object3D): void {
  const rng = mulberry32(4242);
  const grassDark = new THREE.MeshStandardMaterial({
    color: 0x5cb85a,
    emissive: 0x143818,
    emissiveIntensity: 0.42,
    roughness: 0.86,
  });
  const grassLight = new THREE.MeshStandardMaterial({
    color: 0x98e068,
    emissive: 0x1a4a20,
    emissiveIntensity: 0.38,
    roughness: 0.82,
  });
  const bladeGeo = new THREE.BoxGeometry(0.07, 0.42, 0.035);
  const tuftGeo = new THREE.ConeGeometry(0.22, 0.55, 5);
  const grassLayers = [
    { count: 1400, mat: grassDark, height: [0.55, 1.15] as [number, number] },
    { count: 900, mat: grassLight, height: [0.35, 0.85] as [number, number] },
    { count: 320, mat: grassLight, geo: tuftGeo, height: [0.7, 1.35] as [number, number] },
  ];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3(1, 1, 1);
  for (const layer of grassLayers) {
    const geo = layer.geo ?? bladeGeo;
    const mesh = new THREE.InstancedMesh(geo, layer.mat, layer.count);
    for (let i = 0; i < layer.count; i++) {
      const angle = rng() * Math.PI * 2;
      const r = 1.5 + rng() * (ISLAND_RADIUS - 2.5);
      const gy = terraceTopY(r, ISLAND_RADIUS);
      const jitter = (rng() - 0.5) * 0.35;
      pos.set(Math.sin(angle) * r + jitter, gy + 0.08 + rng() * 0.12, Math.cos(angle) * r + jitter * 0.6);
      q.setFromEuler(new THREE.Euler(0, angle + rng() * 0.9, (rng() - 0.5) * 0.45));
      const sy = layer.height[0] + rng() * (layer.height[1] - layer.height[0]);
      const sx = 0.75 + rng() * 0.55;
      scale.set(sx, sy, sx);
      m.compose(pos, q, scale);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  }

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a4e2c, roughness: 0.88 });
  const trunkDark = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x3dab52,
    emissive: 0x0e3016,
    emissiveIntensity: 0.38,
    roughness: 0.76,
  });
  const leafBright = new THREE.MeshStandardMaterial({
    color: 0x6fd45a,
    emissive: 0x163a18,
    emissiveIntensity: 0.42,
    roughness: 0.74,
  });

  for (let i = 0; i < 48; i++) {
    const angle = rng() * Math.PI * 2;
    const r = 6 + rng() * (ISLAND_RADIUS - 8);
    const x = Math.sin(angle) * r;
    const z = Math.cos(angle) * r;
    const kind = rng();
    if (kind < 0.35) addBushCluster(scene, x, z, leafMat, leafBright, 0.85 + rng() * 0.55);
    else if (kind < 0.55) addCanopy(scene, x, z, trunkMat, leafMat, 1);
    else if (kind < 0.78) addTallTree(scene, x, z, trunkDark, leafBright);
    else addPalm(scene, x, z, trunkMat, leafMat, 0.9 + rng() * 0.4);
  }

  const landmarks: [number, number, "tall" | "bush"][] = [
    [-30, 10, "tall"],
    [24, -28, "tall"],
    [-20, -22, "bush"],
    [30, 6, "tall"],
    [-6, 32, "bush"],
    [12, 26, "tall"],
    [-32, -6, "tall"],
    [4, -34, "bush"],
    [-36, 14, "tall"],
    [36, -10, "tall"],
  ];
  for (const [x, z, kind] of landmarks) {
    if (kind === "tall") addTallTree(scene, x, z, trunkDark, leafBright, 1.35);
    else addBushCluster(scene, x, z, leafMat, leafBright, 1.4);
  }
}

function islandY(x: number, z: number): number {
  return terraceTopY(Math.hypot(x, z), ISLAND_RADIUS);
}

function addBushCluster(
  scene: THREE.Object3D,
  x: number,
  z: number,
  leafMat: THREE.Material,
  leafBright: THREE.Material,
  scale = 1,
): void {
  const group = new THREE.Group();
  const mats = [leafMat, leafBright];
  const blobs: [number, number, number, number][] = [
    [0, 0.55, 0, 0.95],
    [0.55, 0.45, 0.2, 0.75],
    [-0.5, 0.5, -0.15, 0.8],
    [0.1, 0.85, -0.35, 0.65],
    [-0.2, 0.35, 0.45, 0.7],
  ];
  for (let i = 0; i < blobs.length; i++) {
    const [px, py, pz, s] = blobs[i];
    const ball = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), mats[i % 2]);
    ball.position.set(px * scale, py * scale, pz * scale);
    ball.scale.setScalar(scale);
    group.add(ball);
  }
  const grassRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9 * scale, 1.1 * scale, 0.12, 8),
    new THREE.MeshStandardMaterial({ color: 0x4a9a44, roughness: 0.9 }),
  );
  grassRing.position.y = 0.04;
  group.add(grassRing);
  group.position.set(x, islandY(x, z), z);
  scene.add(group);
}

function addCanopy(
  scene: THREE.Object3D,
  x: number,
  z: number,
  trunkMat: THREE.Material,
  leafMat: THREE.Material,
  scale = 1,
): void {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 2.4, 6), trunkMat);
  trunk.position.y = 1.2;
  trunk.scale.setScalar(scale);
  group.add(trunk);
  const puffs: [number, number, number, number][] = [
    [0, 2.55, 0, 1.15],
    [0.65, 2.35, 0.2, 0.9],
    [-0.6, 2.4, -0.18, 0.95],
    [0.12, 2.9, -0.4, 0.78],
  ];
  for (const [px, py, pz, s] of puffs) {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 6), leafMat);
    ball.position.set(px * scale, py * scale, pz * scale);
    ball.scale.setScalar(scale);
    group.add(ball);
  }
  group.position.set(x, islandY(x, z), z);
  scene.add(group);
}

/** Cây cao kiểu tán tròn / gốc nở (tham chiếu ảnh tán lá). */
function addTallTree(
  scene: THREE.Object3D,
  x: number,
  z: number,
  trunkMat: THREE.Material,
  leafMat: THREE.Material,
  scale = 1.1,
): void {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 4.2, 7), trunkMat);
  trunk.position.y = 2.1;
  group.add(trunk);
  const roots = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 0.35, 6), trunkMat);
  roots.position.y = 0.12;
  group.add(roots);
  const puffs: [number, number, number, number][] = [
    [0, 4.6, 0, 1.55],
    [0.9, 4.35, 0.25, 1.2],
    [-0.85, 4.4, -0.2, 1.25],
    [0.2, 5.2, -0.55, 1],
    [-0.35, 4.15, 0.65, 0.95],
    [0.55, 4.8, 0.45, 0.85],
  ];
  for (const [px, py, pz, s] of puffs) {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), leafMat);
    ball.position.set(px * scale, py * scale, pz * scale);
    ball.scale.setScalar(scale);
    group.add(ball);
  }
  group.position.set(x, islandY(x, z), z);
  scene.add(group);
}

function addPalm(
  scene: THREE.Object3D,
  x: number,
  z: number,
  trunkMat: THREE.Material,
  leafMat: THREE.Material,
  scale = 1,
): void {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, 3.1, 6), trunkMat);
  trunk.position.y = 1.45 * scale;
  trunk.rotation.z = 0.15;
  trunk.scale.setScalar(scale);
  group.add(trunk);
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 1.45), leafMat);
    leaf.position.set(0, 3.05 * scale, 0);
    leaf.rotation.y = (i / 6) * Math.PI * 2;
    leaf.rotation.x = 0.55;
    leaf.translateZ(0.65 * scale);
    leaf.scale.setScalar(scale);
    group.add(leaf);
  }
  group.position.set(x, islandY(x, z), z);
  scene.add(group);
}

/** Đảo là các bậc ruộng chồng lên nhau: mặt ruộng phẳng, thành bậc thẳng. */
export function addSteppedIsland(
  parent: THREE.Object3D,
  cx: number,
  cz: number,
  radius: number,
  rise = TERRACE_RISE,
): void {
  const n = TERRACE_STEPS - 1;
  const topR = radius * TERRACE_TOP_RATIO;
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x5c4630,
    emissive: 0x1a120c,
    emissiveIntensity: 0.2,
    roughness: 0.9,
  });
  for (let k = 0; k < TERRACE_STEPS; k++) {
    const r = topR + ((n - k) / n) * (radius - topR);
    const topY = k * rise;
    const gold = k % 2 === 1;
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, 0.16, 40),
      new THREE.MeshStandardMaterial({
        color: gold ? 0xd2be45 : 0x3c9a4c,
        emissive: gold ? 0x3a320c : 0x0e2814,
        emissiveIntensity: 0.28,
        roughness: 0.84,
      }),
    );
    cap.position.set(cx, topY - 0.08, cz);
    parent.add(cap);
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.99, r * 0.99, rise, 40),
      wallMat,
    );
    wall.position.set(cx, topY - 0.16 - rise / 2, cz);
    parent.add(wall);
  }
}

/** Núi đồi ruộng bậc thang bao quanh khu chơi. */
export function addMountains(parent: THREE.Object3D): void {
  const hills: [number, number, number, number, number][] = [
    [-80, 100, 52, 22, 0],
    [-130, 30, 68, 28, 1],
    [-100, -90, 58, 24, 0],
    [-20, -145, 78, 32, 1],
    [50, -160, 64, 26, 0],
    [130, -120, 70, 28, 1],
    [175, -30, 56, 22, 0],
    [185, 55, 74, 30, 1],
    [110, 140, 60, 24, 0],
    [20, 165, 82, 34, 1],
    [-40, 155, 66, 26, 0],
  ];
  for (const [x, z, height, radius, seed] of hills) addHill(parent, x, z, height, radius, seed);

  const farMat = new THREE.MeshBasicMaterial({ color: 0x7f93be });
  const ridges: [number, number, number, number][] = [
    [0, 230, 90, 48],
    [120, 210, 76, 40],
    [-140, 180, 100, 54],
    [200, 80, 70, 36],
    [-180, -40, 88, 46],
    [60, -230, 96, 50],
    [-60, -210, 80, 42],
  ];
  for (const [x, z, h, r] of ridges) {
    const ridge = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), farMat);
    ridge.position.set(x, h * 0.35 - 10, z);
    parent.add(ridge);
  }
}

function addHill(
  parent: THREE.Object3D,
  x: number,
  z: number,
  height: number,
  radius: number,
  seed: number,
): void {
  const g = new THREE.Group();
  const bands = 8;
  const rise = height / bands;
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x4e3a28,
    emissive: 0x140e0a,
    emissiveIntensity: 0.18,
    roughness: 0.92,
  });
  for (let i = 0; i < bands; i++) {
    const r = Math.max(1.4, radius * (1 - i * 0.11));
    const gold = (i + seed) % 2 === 0;
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, 0.22, 12),
      new THREE.MeshStandardMaterial({
        color: gold ? 0xd2c04a : 0x2f8a42,
        emissive: gold ? 0x3a320e : 0x0c2812,
        emissiveIntensity: gold ? 0.36 : 0.22,
        roughness: 0.86,
      }),
    );
    cap.position.y = rise * i + rise - 0.11;
    g.add(cap);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.98, r * 0.98, rise, 12), wallMat);
    wall.position.y = rise * i + rise / 2 - 0.11;
    g.add(wall);
  }
  g.position.set(x, 0, z);
  parent.add(g);
}

export function addGroundMist(parent: THREE.Object3D, x: number, z: number, radius: number): void {
  const mist = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 40),
    new THREE.MeshBasicMaterial({
      color: 0xd5e0f4,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  mist.rotation.x = -Math.PI / 2;
  mist.position.set(x, 1.35, z);
  parent.add(mist);
}

function makeCloud(scale: number, opacity: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: 0xe7eefc,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const puffs: [number, number, number, number][] = [
    [0, 0, 0, 1],
    [1.1, 0.15, 0.2, 0.75],
    [-1, 0.05, -0.15, 0.7],
    [0.45, 0.35, -0.4, 0.55],
    [-0.3, -0.1, 0.55, 0.5],
  ];
  for (const [x, y, z, s] of puffs) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.9 * s, 16, 12), mat);
    puff.position.set(x, y, z);
    puff.scale.set(1.4, 0.7, 1);
    g.add(puff);
  }
  g.scale.setScalar(scale);
  return g;
}

export function createCloudField(): THREE.Group {
  const g = new THREE.Group();
  g.name = "clouds";
  const spots: [number, number, number, number, number, number, number][] = [
    [0, 5.2, -30, 3.6, 0.38, 0.2, 0.16],
    [16, 6.4, -24, 3.1, 0.32, 1.1, 0.14],
    [-18, 4.8, -26, 3.4, 0.36, 2.0, 0.15],
    [28, 6.8, -12, 2.8, 0.3, 0.5, 0.13],
    [-30, 5.6, -8, 3.2, 0.34, 1.6, 0.12],
    [8, 7.5, -42, 4.2, 0.28, 2.4, 0.11],
    [-12, 4.4, -16, 2.4, 0.26, 0.8, 0.17],
    [22, 5.2, 18, 2.8, 0.3, 1.3, 0.14],
    [-22, 6, 16, 3, 0.32, 2.2, 0.13],
    [-36, 5, 22, 2.6, 0.3, 0.4, 0.15],
    [36, 6.2, 8, 2.7, 0.28, 1.8, 0.12],
    [0, 8.5, -52, 4.6, 0.24, 1.5, 0.1],
    [48, 7, -28, 3.3, 0.3, 0.9, 0.14],
    [-46, 6.5, -22, 3.1, 0.32, 2.6, 0.13],
    [70, 6, 12, 3, 0.3, 1.2, 0.15],
    [62, 5.4, -16, 2.8, 0.28, 0.3, 0.12],
    [-8, 9, 28, 3.8, 0.26, 1.9, 0.11],
  ];
  for (const [x, y, z, scale, opacity, phase, speed] of spots) {
    const cloud = makeCloud(scale, opacity);
    cloud.position.set(x, y, z);
    const drift: CloudDrift = { baseX: x, baseZ: z, y, phase, speed };
    cloud.userData = drift;
    g.add(cloud);
  }
  return g;
}

export function driftClouds(group: THREE.Group, t: number): void {
  for (const cloud of group.children) {
    const u = cloud.userData as CloudDrift;
    if (typeof u.baseX !== "number") continue;
    cloud.position.x = u.baseX + Math.sin(t * u.speed + u.phase) * 4.5;
    cloud.position.z = u.baseZ + Math.cos(t * u.speed * 0.75 + u.phase) * 2.8;
    cloud.position.y = u.y + Math.sin(t * 0.35 + u.phase) * 0.55;
  }
}

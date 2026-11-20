import * as THREE from "three";
import { mulberry32 } from "../sim/rng.js";
import { ISLAND_RADIUS } from "../sim/types.js";

/** Cỏ + cây chỉ hiển thị — không ảnh hưởng sim */

export function addGrassAndTrees(scene: THREE.Object3D): void {
  const rng = mulberry32(4242);
  const grassMat = new THREE.MeshStandardMaterial({
    color: 0x4a8a4a,
    roughness: 0.85,
  });
  const grassGeo = new THREE.BoxGeometry(0.08, 0.35, 0.04);
  const grassCount = 420;
  const grass = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < grassCount; i++) {
    const angle = rng() * Math.PI * 2;
    const r = 2 + rng() * (ISLAND_RADIUS - 3);
    pos.set(Math.sin(angle) * r, 0.12 + rng() * 0.08, Math.cos(angle) * r);
    q.setFromEuler(new THREE.Euler(0, angle + rng() * 0.5, (rng() - 0.5) * 0.3));
    const sy = 0.6 + rng() * 0.9;
    scale.set(1, sy, 1);
    m.compose(pos, q, scale);
    grass.setMatrixAt(i, m);
  }
  grass.instanceMatrix.needsUpdate = true;
  scene.add(grass);

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6a4a32, roughness: 0.88 });
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x3d6e40,
    roughness: 0.8,
  });
  const treePositions: [number, number][] = [
    [-28, 12],
    [22, -30],
    [-18, -24],
    [32, 8],
    [-8, 34],
    [14, 28],
    [-34, -8],
    [6, -36],
  ];
  for (const [x, z] of treePositions) {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 3.2, 6), trunkMat);
    trunk.position.y = 1.6;
    group.add(trunk);
    const foliage = new THREE.Mesh(new THREE.ConeGeometry(2.2, 4.5, 8), leafMat);
    foliage.position.y = 4.2;
    group.add(foliage);
    const foliage2 = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.2, 8), leafMat);
    foliage2.position.y = 5.8;
    group.add(foliage2);
    group.position.set(x, 0, z);
    scene.add(group);
  }
}
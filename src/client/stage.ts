import * as THREE from "three";
import { addGrassAndTrees } from "./scenery.js";

const C = {
  sky: 0x0e1430,
  fog: 0x1b2350,
  grass: 0x2f5d50,
  wood: 0x6b4a2f,
  sea: 0x12384a,
  sand: 0xc9b48a,
};

export function clearGroup(g: THREE.Group): void {
  while (g.children.length) g.remove(g.children[0]);
}

export function buildStage(night: 1 | 2 | 3, parent: THREE.Group): void {
  clearGroup(parent);
  const sea = new THREE.Mesh(
    new THREE.CircleGeometry(120, 48),
    new THREE.MeshBasicMaterial({ color: C.sea, transparent: true, opacity: 0.85 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -0.6;
  parent.add(sea);

  const grassMat = new THREE.MeshStandardMaterial({ color: C.grass, roughness: 0.9 });
  const woodMat = new THREE.MeshStandardMaterial({ color: C.wood, roughness: 0.85 });

  if (night === 1) {
    const island = new THREE.Mesh(new THREE.CylinderGeometry(40, 42, 0.6, 48), grassMat);
    island.position.y = -0.3;
    parent.add(island);
    addGrassAndTrees(parent);
  }
  if (night === 2) {
    const a = new THREE.Mesh(new THREE.CylinderGeometry(28, 29, 0.6, 40), grassMat);
    a.position.y = -0.3;
    parent.add(a);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(28, 29, 0.6, 40), grassMat);
    b.position.set(70, -0.3, 0);
    parent.add(b);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.25, 4), woodMat);
    bridge.position.set(35, 0.05, 0);
    parent.add(bridge);
    for (const p of [
      [20, 0.15, 18],
      [50, 0.15, -18],
    ] as const) {
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(1, 1, 0.2, 16),
        new THREE.MeshStandardMaterial({ color: C.sand, emissive: 0x332200, emissiveIntensity: 0.3 }),
      );
      pad.position.set(p[0], p[1], p[2]);
      parent.add(pad);
    }
  }
  if (night === 3) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(45, 46, 0.6, 48), grassMat);
    base.position.y = -0.3;
    parent.add(base);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(12, 24, 32),
      new THREE.MeshStandardMaterial({ color: C.grass, roughness: 0.9, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 3;
    parent.add(ring);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 0.3, 24), grassMat);
    top.position.y = 6;
    parent.add(top);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 8, 12), woodMat);
    tower.position.y = 10;
    parent.add(tower);
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 0.2, 16),
      new THREE.MeshStandardMaterial({ color: C.sand }),
    );
    pad.position.set(0, 3.15, 13);
    parent.add(pad);
  }
}

export { C };
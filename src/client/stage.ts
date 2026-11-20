import * as THREE from "three";
import {
  addGrassAndTrees,
  addGroundMist,
  addMountains,
  addSteppedIsland,
  addVietnamFlag,
  createCloudField,
} from "./scenery.js";

const C = {
  skyTop: 0x121a38,
  skyMid: 0x2a3d72,
  skyHorizon: 0x4a5d90,
  fog: 0x4a5d90,
  grass: 0x3c8f56,
  grassGlow: 0x102818,
  wood: 0x8a5a34,
  sea: 0x1c5278,
  sand: 0xe6d2a8,
};

export function clearGroup(g: THREE.Group): void {
  while (g.children.length) g.remove(g.children[0]);
}

function grassMat(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: C.grass,
    emissive: C.grassGlow,
    emissiveIntensity: 0.22,
    roughness: 0.86,
  });
}

function addSky(parent: THREE.Object3D): void {
  const geo = new THREE.SphereGeometry(280, 32, 20);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const top = new THREE.Color(C.skyTop);
  const mid = new THREE.Color(C.skyMid);
  const hor = new THREE.Color(C.skyHorizon);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 280;
    const t = (y + 1) / 2;
    if (t < 0.48) c.copy(hor).lerp(mid, t / 0.48);
    else c.copy(mid).lerp(top, (t - 0.48) / 0.52);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const sky = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }),
  );
  parent.add(sky);
}

function addSea(parent: THREE.Object3D): void {
  const sea = new THREE.Mesh(
    new THREE.CircleGeometry(220, 56),
    new THREE.MeshBasicMaterial({ color: C.sea, transparent: true, opacity: 0.92 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -0.6;
  parent.add(sea);
}

function addIsland(parent: THREE.Object3D, x: number, z: number, radius: number, rise?: number): void {
  addSteppedIsland(parent, x, z, radius, rise);
  addGroundMist(parent, x, z, radius + 18);
}

export function buildStage(night: 1 | 2 | 3, parent: THREE.Group): THREE.Group {
  clearGroup(parent);
  addSky(parent);
  addSea(parent);
  addMountains(parent);

  const woodMat = new THREE.MeshStandardMaterial({ color: C.wood, roughness: 0.82 });

  if (night === 1) {
    addIsland(parent, 0, 0, 40);
    addGrassAndTrees(parent, 0, 0, 40, undefined, 4242, 1);
    addVietnamFlag(parent, 0, 0, 1);
  }
  if (night === 2) {
    addIsland(parent, 0, 0, 28);
    addIsland(parent, 70, 0, 28);
    addGrassAndTrees(parent, 0, 0, 28, undefined, 4242, 2);
    addGrassAndTrees(parent, 70, 0, 28, undefined, 5252, 2);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.25, 4), woodMat);
    bridge.position.set(35, 0.05, 0);
    parent.add(bridge);
    for (const p of [
      [20, 0.15, 18],
      [50, 0.15, -18],
    ] as const) {
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(1, 1, 0.2, 16),
        new THREE.MeshStandardMaterial({ color: C.sand, emissive: 0x5a4018, emissiveIntensity: 0.35 }),
      );
      pad.position.set(p[0], p[1], p[2]);
      parent.add(pad);
    }
    addVietnamFlag(parent, 0, 0, 2);
    addVietnamFlag(parent, 70, 0, 2);
  }
  if (night === 3) {
    addIsland(parent, 0, 0, 45, 0.32);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(12, 24, 32),
      new THREE.MeshStandardMaterial({
        color: C.grass,
        emissive: C.grassGlow,
        emissiveIntensity: 0.35,
        roughness: 0.9,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 3;
    parent.add(ring);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 0.3, 24), grassMat());
    top.position.y = 6;
    parent.add(top);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 2.1, 7.5, 12), woodMat);
    tower.position.set(0, 9.75, 0);
    parent.add(tower);
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 0.2, 16),
      new THREE.MeshStandardMaterial({ color: C.sand, emissive: 0x5a4018, emissiveIntensity: 0.3 }),
    );
    pad.position.set(0, 3.15, 13);
    parent.add(pad);
    addGrassAndTrees(parent, 0, 0, 45, 0.32, 6060, 3);
    addVietnamFlag(parent, 0, 0, 3);
  }

  const clouds = createCloudField();
  parent.add(clouds);
  return clouds;
}

export { C };

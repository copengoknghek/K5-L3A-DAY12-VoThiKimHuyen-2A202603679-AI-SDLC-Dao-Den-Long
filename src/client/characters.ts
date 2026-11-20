import * as THREE from "three";

export type AvatarId = "nu" | "nam";

function cloth(color: number, emissive: number, roughness = 0.72): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0,
    emissive,
    emissiveIntensity: 0.16,
  });
}

function add(
  g: THREE.Group,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  pos: [number, number, number],
  rot?: [number, number, number],
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  g.add(m);
  return m;
}

function addTorch(g: THREE.Group, hand: [number, number, number]): void {
  const torch = new THREE.Group();
  torch.name = "torch";
  torch.position.set(hand[0], hand[1], hand[2]);
  torch.rotation.z = -0.12;

  const metal = new THREE.MeshStandardMaterial({
    color: 0xd4b06a,
    metalness: 0.72,
    roughness: 0.28,
  });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 0.62, 8), metal);
  handle.position.y = 0.22;
  torch.add(handle);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.055, 0.1, 10), metal);
  cup.position.y = 0.56;
  torch.add(cup);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.018, 6, 12), metal);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 0.61;
  torch.add(lip);

  const flame = new THREE.Mesh(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.012, 0.3),
        new THREE.Vector2(0.07, 0.22),
        new THREE.Vector2(0.11, 0.12),
        new THREE.Vector2(0.07, 0.03),
        new THREE.Vector2(0.02, 0),
      ],
      8,
    ),
    new THREE.MeshStandardMaterial({
      color: 0xff4a16,
      emissive: 0xffb347,
      emissiveIntensity: 0.7,
      roughness: 0.45,
      side: THREE.DoubleSide,
    }),
  );
  flame.name = "flame";
  flame.position.y = 0.66;
  torch.add(flame);

  const core = new THREE.Mesh(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.01, 0.18),
        new THREE.Vector2(0.04, 0.1),
        new THREE.Vector2(0.02, 0),
      ],
      6,
    ),
    new THREE.MeshBasicMaterial({ color: 0xfff3b0, side: THREE.DoubleSide }),
  );
  core.name = "flameCore";
  core.position.y = 0.74;
  torch.add(core);

  const light = new THREE.PointLight(0xff8a3a, 0.7, 6, 1);
  light.name = "torchLight";
  light.position.y = 0.8;
  torch.add(light);
  g.add(torch);
}

function buildNu(): THREE.Group {
  const g = new THREE.Group();
  const skin = cloth(0xf0c8a6, 0x3a2418, 0.6);
  const cream = cloth(0xf7f1e6, 0x3a3428, 0.75);
  const pants = cloth(0xe6d8c0, 0x322818, 0.8);
  const shoe = cloth(0x4a3224, 0x140e0a, 0.7);
  const hair = cloth(0x3a2418, 0x100804, 0.65);
  const straw = cloth(0xf3e6c4, 0x4a3c20, 0.85);
  const eye = cloth(0x2a1a14, 0x000000, 0.4);

  add(g, new THREE.BoxGeometry(0.12, 0.08, 0.2), shoe, [-0.11, 0.04, 0.02]);
  add(g, new THREE.BoxGeometry(0.12, 0.08, 0.2), shoe, [0.11, 0.04, 0.02]);
  add(g, new THREE.CylinderGeometry(0.07, 0.075, 0.58, 8), pants, [-0.11, 0.37, 0]);
  add(g, new THREE.CylinderGeometry(0.07, 0.075, 0.58, 8), pants, [0.11, 0.37, 0]);
  add(g, new THREE.CylinderGeometry(0.16, 0.24, 0.62, 10), cream, [0, 0.86, 0]);
  add(g, new THREE.CylinderGeometry(0.15, 0.17, 0.34, 10), cream, [0, 1.28, 0]);
  add(g, new THREE.CylinderGeometry(0.055, 0.065, 0.14, 8), skin, [0, 1.5, 0]);
  add(g, new THREE.SphereGeometry(0.17, 14, 12), skin, [0, 1.7, 0.02]);
  add(g, new THREE.SphereGeometry(0.18, 12, 10), hair, [0, 1.74, -0.05]);
  add(g, new THREE.CapsuleGeometry(0.045, 0.42, 3, 6), hair, [-0.12, 1.42, -0.06]);
  add(g, new THREE.CapsuleGeometry(0.045, 0.42, 3, 6), hair, [0.12, 1.42, -0.06]);
  add(g, new THREE.SphereGeometry(0.028, 8, 8), eye, [-0.06, 1.72, 0.15]);
  add(g, new THREE.SphereGeometry(0.028, 8, 8), eye, [0.06, 1.72, 0.15]);
  add(g, new THREE.CylinderGeometry(0.05, 0.055, 0.36, 6), cream, [-0.22, 1.08, 0.02], [0, 0, 0.35]);
  add(g, new THREE.CylinderGeometry(0.05, 0.055, 0.36, 6), cream, [0.24, 1.02, 0.08], [0.15, 0, -0.7]);
  add(g, new THREE.ConeGeometry(0.42, 0.3, 20), straw, [0, 1.96, 0]);
  addTorch(g, [0.46, 0.92, 0.14]);
  return g;
}

function buildNam(): THREE.Group {
  const g = new THREE.Group();
  const skin = cloth(0xe8c09a, 0x3a2418, 0.6);
  const green = cloth(0x2f7a38, 0x0e3416, 0.7);
  const vest = cloth(0x3e8f46, 0x123818, 0.62);
  const dark = cloth(0x1d4a28, 0x0a2412, 0.65);
  const boot = cloth(0x243028, 0x0a100c, 0.8);

  add(g, new THREE.CylinderGeometry(0.09, 0.1, 0.28, 6), boot, [-0.12, 0.14, 0]);
  add(g, new THREE.CylinderGeometry(0.09, 0.1, 0.28, 6), boot, [0.12, 0.14, 0]);
  add(g, new THREE.CylinderGeometry(0.12, 0.14, 0.55, 8), green, [-0.12, 0.52, 0]);
  add(g, new THREE.CylinderGeometry(0.12, 0.14, 0.55, 8), green, [0.12, 0.52, 0]);
  add(g, new THREE.CylinderGeometry(0.26, 0.3, 0.55, 8), green, [0, 1.02, 0]);
  add(g, new THREE.BoxGeometry(0.46, 0.42, 0.24), vest, [0, 1.04, 0.06]);
  const cape = add(g, new THREE.ConeGeometry(0.46, 0.7, 8, 1, true), dark, [0, 1.0, -0.16]);
  cape.scale.z = 0.42;
  add(g, new THREE.TorusGeometry(0.16, 0.04, 6, 10), dark, [0, 1.28, 0], [Math.PI / 2, 0, 0]);
  add(g, new THREE.CylinderGeometry(0.06, 0.07, 0.42, 6), green, [-0.34, 1.02, 0.02], [0, 0, 0.55]);
  add(g, new THREE.CylinderGeometry(0.06, 0.07, 0.4, 6), green, [0.34, 0.98, 0.08], [0.2, 0, -1]);
  add(g, new THREE.SphereGeometry(0.2, 14, 12), skin, [0, 1.5, 0.02]);
  add(g, new THREE.SphereGeometry(0.035, 8, 8), cloth(0x2a1a14, 0x000000, 0.4), [-0.07, 1.52, 0.16]);
  add(g, new THREE.SphereGeometry(0.035, 8, 8), cloth(0x2a1a14, 0x000000, 0.4), [0.07, 1.52, 0.16]);
  add(g, new THREE.SphereGeometry(0.26, 12, 10, 0, Math.PI * 2, 0, Math.PI / 1.65), green, [0, 1.58, 0]);
  add(g, new THREE.CylinderGeometry(0.32, 0.32, 0.045, 12), dark, [0, 1.5, 0]);
  const net = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x14381c, wireframe: true }),
  );
  net.position.y = 1.6;
  g.add(net);
  addTorch(g, [0.55, 0.72, 0.18]);
  return g;
}

export function buildAvatar(id: AvatarId): THREE.Group {
  return id === "nam" ? buildNam() : buildNu();
}

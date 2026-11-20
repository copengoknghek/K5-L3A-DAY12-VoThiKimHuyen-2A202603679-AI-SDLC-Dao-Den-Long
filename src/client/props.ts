import * as THREE from "three";

/** Đèn lồng Hội An — chỉ hình, không đổi sim. */
export type SilkLantern = {
  group: THREE.Group;
  paper: THREE.MeshStandardMaterial;
  body: THREE.Mesh;
  coreMat: THREE.MeshBasicMaterial;
  light: THREE.PointLight;
  fill: THREE.PointLight;
  fuelBar: THREE.Mesh;
};

function lanternProfile(): THREE.Vector2[] {
  const raw: [number, number][] = [
    [0.015, 0],
    [0.07, 0.1],
    [0.16, 0.28],
    [0.3, 0.52],
    [0.4, 0.78],
    [0.42, 0.98],
    [0.34, 1.18],
    [0.2, 1.34],
    [0.08, 1.46],
    [0.03, 1.52],
  ];
  return raw.map(([x, y]) => new THREE.Vector2(x, y));
}

export function buildSilkLantern(): SilkLantern {
  const g = new THREE.Group();
  const paper = new THREE.MeshStandardMaterial({
    color: 0x5c1418,
    emissive: 0x1a0608,
    emissiveIntensity: 0.08,
    roughness: 0.55,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const body = new THREE.Mesh(new THREE.LatheGeometry(lanternProfile(), 18), paper);
  body.position.y = 1.35;
  g.add(body);

  const barMat = new THREE.MeshBasicMaterial({ color: 0xffc857 });
  const fuelBar = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.07), barMat);
  fuelBar.position.set(0, 2.95, 0.44);
  fuelBar.visible = false;
  g.add(fuelBar);

  const ribMat = new THREE.MeshStandardMaterial({
    color: 0x8e1a16,
    emissive: 0x3a0a0c,
    emissiveIntensity: 0.35,
    roughness: 0.55,
  });
  for (let i = 0; i < 10; i++) {
    const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.95, 4), ribMat);
    const a = (i / 10) * Math.PI * 2;
    rib.position.set(Math.cos(a) * 0.38, 2.15, Math.sin(a) * 0.38);
    g.add(rib);
  }

  const capMat = new THREE.MeshStandardMaterial({ color: 0x2a1214, roughness: 0.5 });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.08, 8), capMat);
  cap.position.y = 2.9;
  g.add(cap);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 10), capMat);
  hook.position.y = 3.0;
  g.add(hook);

  const band = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), capMat);
  band.position.y = 1.38;
  g.add(band);
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), capMat);
  bead.position.y = 1.22;
  g.add(bead);
  const tassel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.03, 0.36, 6),
    new THREE.MeshStandardMaterial({ color: 0x6a1814, roughness: 0.7 }),
  );
  tassel.position.y = 1.0;
  g.add(tassel);

  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xfff1c0,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), coreMat);
  core.position.y = 2.2;
  g.add(core);

  const light = new THREE.PointLight(0xff7424, 0, 8, 1);
  light.position.y = 2.2;
  g.add(light);
  const fill = new THREE.PointLight(0xffc48a, 0, 10, 1);
  fill.position.y = 1.8;
  g.add(fill);

  return { group: g, paper, body, coreMat, light, fill, fuelBar };
}

export function applyLanternLit(
  view: SilkLantern,
  lit: boolean,
  t = 0,
  fuelSixtieths = 0,
): void {
  const fuel = fuelSixtieths / 60;
  const low = lit && fuel < 30;
  const lowBlink = low ? 0.55 + 0.45 * (Math.sin(t * Math.PI * 2) > 0 ? 1 : 0) : 1;
  const flicker = lit ? (0.9 + Math.sin(t * 6.5 + view.group.position.x) * 0.1) * lowBlink : 1;
  view.paper.color.setHex(lit ? 0xff6a28 : 0x4e1218);
  view.paper.emissive.setHex(lit ? 0xffb45c : 0x140406);
  view.paper.emissiveIntensity = lit ? 1.7 * flicker : 0.05;
  view.paper.roughness = lit ? 0.55 : 0.72;
  view.coreMat.opacity = lit ? 0.85 * lowBlink : 0;
  view.coreMat.color.setHex(lit ? 0xfff3c4 : 0x3a1010);
  view.light.intensity = lit ? 20 * flicker : 0;
  view.light.distance = lit ? 42 : 1;
  view.fill.intensity = lit ? 6 * lowBlink : 0;
  view.fill.distance = lit ? 52 : 1;
  const squash = lit ? 1 : 0.8;
  view.body.scale.set(1, squash, 1);
  view.fuelBar.visible = lit;
  if (lit) {
    const pct = Math.max(0.05, fuel / 100);
    view.fuelBar.scale.x = pct;
    const barMat = view.fuelBar.material as THREE.MeshBasicMaterial;
    barMat.color.setHex(low ? 0xff5a5f : 0xffc857);
    barMat.opacity = lowBlink;
    barMat.transparent = low;
  }
}

function starGeometry(): THREE.BufferGeometry {
  const outer = 0.36;
  const inner = 0.15;
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const verts: number[] = [];
  const push = (x: number, y: number, z: number) => verts.push(x, y, z);
  const zf = 0.07;
  const zb = -0.07;
  for (let i = 0; i < 10; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % 10]!;
    push(0, 0, zf);
    push(a[0], a[1], zf);
    push(b[0], b[1], zf);
  }
  for (let i = 0; i < 10; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % 10]!;
    push(0, 0, zb);
    push(b[0], b[1], zb);
    push(a[0], a[1], zb);
  }
  for (let i = 0; i < 10; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % 10]!;
    push(a[0], a[1], zf);
    push(a[0], a[1], zb);
    push(b[0], b[1], zf);
    push(b[0], b[1], zf);
    push(a[0], a[1], zb);
    push(b[0], b[1], zb);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  return geo;
}

const sharedStar = starGeometry();
const starMat = new THREE.MeshStandardMaterial({
  color: 0xffd84a,
  emissive: 0xffcc22,
  emissiveIntensity: 1.6,
  metalness: 0.45,
  roughness: 0.22,
});
const starHaloMat = new THREE.MeshBasicMaterial({
  color: 0xffe98a,
  transparent: true,
  opacity: 0.38,
  depthWrite: false,
});

/** Sao vàng 5 cánh — ánh sáng nhặt được. */
export function createStarMote(): THREE.Group {
  const g = new THREE.Group();
  const star = new THREE.Mesh(sharedStar, starMat);
  star.name = "starSpin";
  g.add(star);
  const halo = new THREE.Mesh(sharedStar, starHaloMat);
  halo.scale.setScalar(1.45);
  g.add(halo);
  return g;
}

import * as THREE from "three";
import contract from "../../game.contract.json";
import { DEFAULT_HELD, type HeldInput, type Tuning } from "../sim/types.js";
import type { SimState } from "../sim/types.js";
import { createInitialState } from "../sim/world.js";
import { step } from "../sim/step.js";
import { TICK_DT } from "../sim/types.js";

const tuning = contract.tuning as Tuning;

const canvas = document.getElementById("game") as HTMLCanvasElement;
const hudFlames = document.getElementById("hud-flames")!;
const hudCarried = document.getElementById("hud-carried")!;
const hudLanterns = document.getElementById("hud-lanterns")!;
const hudScore = document.getElementById("hud-score")!;
const hudTime = document.getElementById("hud-time")!;
const hudStatus = document.getElementById("hud-status")!;
const btnReplay = document.getElementById("btn-replay") as HTMLButtonElement;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x0a0612, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x1a0a28, 0.018);

const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 300);

const hemi = new THREE.HemisphereLight(0x3a2060, 0x0a0408, 0.35);
scene.add(hemi);

const islandGeo = new THREE.CylinderGeometry(40, 42, 0.6, 48);
const islandMat = new THREE.MeshStandardMaterial({
  color: 0x2a3d28,
  roughness: 0.9,
});
const island = new THREE.Mesh(islandGeo, islandMat);
island.position.y = -0.3;
scene.add(island);

const waterGeo = new THREE.CircleGeometry(80, 64);
const waterMat = new THREE.MeshBasicMaterial({
  color: 0x120820,
  transparent: true,
  opacity: 0.7,
});
const water = new THREE.Mesh(waterGeo, waterMat);
water.rotation.x = -Math.PI / 2;
water.position.y = -0.5;
scene.add(water);

const playerGroup = new THREE.Group();
const body = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.35, 0.7, 4, 8),
  new THREE.MeshStandardMaterial({ color: 0xe8c4a0 }),
);
body.position.y = 0.85;
playerGroup.add(body);

const hat = new THREE.Mesh(
  new THREE.ConeGeometry(0.55, 0.25, 8),
  new THREE.MeshStandardMaterial({ color: 0x4a6741 }),
);
hat.position.y = 1.55;
hat.rotation.x = Math.PI;
playerGroup.add(hat);

const smallLantern = new THREE.Mesh(
  new THREE.BoxGeometry(0.2, 0.28, 0.2),
  new THREE.MeshStandardMaterial({
    color: 0xffa040,
    emissive: 0xff8020,
    emissiveIntensity: 0.4,
  }),
);
smallLantern.position.set(0.35, 1.1, 0.2);
playerGroup.add(smallLantern);

scene.add(playerGroup);

const moteMeshes = new Map<string, THREE.Mesh>();
const shadeMeshes = new Map<string, THREE.Mesh>();
const lanternMeshes = new Map<
  string,
  { mesh: THREE.Mesh; light: THREE.PointLight }
>();

let seed = Date.now() & 0xfffffff;
let state: SimState;
let held: HeldInput = { ...DEFAULT_HELD };
let prevHeld: HeldInput = { ...DEFAULT_HELD };
let camYawDeg = 0;
let simAccum = 0;
let lastT = performance.now();

const keys = new Set<string>();

function newGame(): void {
  seed = (seed + 1) | 0;
  state = createInitialState({ seed, scenario: null, tuning });
  held = { ...DEFAULT_HELD };
  prevHeld = { ...DEFAULT_HELD };
  camYawDeg = 0;
  simAccum = 0;
  document.body.classList.remove("ended");
  btnReplay.hidden = true;
  hudStatus.textContent = "";
  rebuildWorldMeshes();
}

function rebuildWorldMeshes(): void {
  for (const m of moteMeshes.values()) scene.remove(m);
  for (const s of shadeMeshes.values()) scene.remove(s);
  for (const l of lanternMeshes.values()) {
    scene.remove(l.mesh);
    scene.remove(l.light);
  }
  moteMeshes.clear();
  shadeMeshes.clear();
  lanternMeshes.clear();

  for (const m of state.motes) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0xffcc55,
        emissive: 0xffaa22,
        emissiveIntensity: 1.2,
      }),
    );
    mesh.userData.id = m.id;
    scene.add(mesh);
    moteMeshes.set(m.id, mesh);
  }

  for (const sh of state.shades) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 12, 12),
      new THREE.MeshStandardMaterial({
        color: 0x1a0828,
        emissive: 0x402060,
        emissiveIntensity: 0.5,
      }),
    );
    scene.add(mesh);
    shadeMeshes.set(sh.id, mesh);
  }

  for (const lan of state.lanterns) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.5, 2.2, 8),
      new THREE.MeshStandardMaterial({
        color: 0x5c4030,
        roughness: 0.8,
      }),
    );
    const light = new THREE.PointLight(0xffaa44, lan.lit ? 2.2 : 0.15, 25);
    light.position.set(0, 1.8, 0);
    mesh.add(light);
    scene.add(mesh);
    lanternMeshes.set(lan.id, { mesh, light });
  }
}

function syncMeshes(visualTime: number): void {
  playerGroup.position.set(
    state.player.pos[0],
    state.player.pos[1],
    state.player.pos[2],
  );
  playerGroup.rotation.y = (-camYawDeg * Math.PI) / 180;

  const ids = new Set(state.motes.map((m) => m.id));
  for (const [id, mesh] of moteMeshes) {
    if (!ids.has(id)) {
      scene.remove(mesh);
      moteMeshes.delete(id);
    }
  }
  for (const m of state.motes) {
    let mesh = moteMeshes.get(m.id);
    if (!mesh) {
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 8, 8),
        new THREE.MeshStandardMaterial({
          color: 0xffcc55,
          emissive: 0xffaa22,
          emissiveIntensity: 1.2,
        }),
      );
      scene.add(mesh);
      moteMeshes.set(m.id, mesh);
    }
    mesh.position.set(m.pos[0], 0.35 + Math.sin(visualTime * 4 + m.pos[0]) * 0.08, m.pos[2]);
    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 1 + 0.4 * Math.sin(visualTime * 6);
  }

  for (const sh of state.shades) {
    let mesh = shadeMeshes.get(sh.id);
    if (!mesh) {
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 12, 12),
        new THREE.MeshStandardMaterial({
          color: 0x1a0828,
          emissive: 0x402060,
          emissiveIntensity: 0.5,
        }),
      );
      scene.add(mesh);
      shadeMeshes.set(sh.id, mesh);
    }
    mesh.position.set(sh.pos[0], sh.pos[1] + 0.5, sh.pos[2]);
  }

  for (const lan of state.lanterns) {
    const entry = lanternMeshes.get(lan.id);
    if (!entry) continue;
    entry.mesh.position.set(lan.pos[0], 0, lan.pos[2]);
    const target = lan.lit ? 2.5 : 0.12;
    entry.light.intensity += (target - entry.light.intensity) * 0.05;
    const pillar = entry.mesh.material as THREE.MeshStandardMaterial;
    pillar.emissive?.setHex(lan.lit ? 0x442200 : 0x000000);
    pillar.emissiveIntensity = lan.lit ? 0.3 : 0;
  }

  const yawRad = (camYawDeg * Math.PI) / 180;
  const backZ = -8;
  const camX = state.player.pos[0] - Math.sin(yawRad) * backZ;
  const camZ = state.player.pos[2] - Math.cos(yawRad) * backZ;
  camera.position.set(camX, state.player.pos[1] + 5, camZ);
  camera.lookAt(
    state.player.pos[0],
    state.player.pos[1] + 1,
    state.player.pos[2],
  );
}

function readHeldFromKeys(): void {
  prevHeld = { ...held, move: [...held.move] as [number, number] };
  let mx = 0;
  let mz = 0;
  if (keys.has("KeyA")) mx -= 1;
  if (keys.has("KeyD")) mx += 1;
  if (keys.has("KeyW")) mz += 1;
  if (keys.has("KeyS")) mz -= 1;
  held.move = [mx, mz];
  held.camYawDeg = camYawDeg;
  held.jump = keys.has("Space");
  held.interact = keys.has("KeyE");
  held.pulse = keys.has("KeyF");
}

function updateHud(): void {
  const lit = state.lanterns.filter((l) => l.lit).length;
  hudFlames.textContent = String(state.player.flames);
  hudCarried.textContent = String(state.player.carried);
  hudLanterns.textContent = `${lit}/${tuning.lantern_count_night1}`;
  hudScore.textContent = String(state.score);
  hudTime.textContent = `${Math.max(0, state.timeLeftS).toFixed(0)}s`;
  if (state.state === "won") {
    hudStatus.textContent = "Thắng — đã thắp hết đèn!";
    btnReplay.hidden = false;
    document.body.classList.add("ended");
  } else if (state.state === "lost") {
    hudStatus.textContent =
      state.reason === "dawn"
        ? "Thua — hết đêm (bình minh)"
        : "Thua — hết ánh sáng";
    btnReplay.hidden = false;
    document.body.classList.add("ended");
  }
}

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function frame(now: number): void {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  readHeldFromKeys();
  simAccum += dt;
  while (simAccum >= TICK_DT && state.state === "playing") {
    step(state, tuning, held, prevHeld);
    prevHeld = { ...held, move: [...held.move] as [number, number] };
    simAccum -= TICK_DT;
  }
  syncMeshes(now / 1000);
  updateHud();
  renderer.render(scene, camera);
}

window.addEventListener("resize", resize);
window.addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (e.code === "KeyR" && state.state !== "playing") newGame();
});
window.addEventListener("keyup", (e) => keys.delete(e.code));

canvas.addEventListener("click", () => {
  canvas.requestPointerLock();
});
document.addEventListener("mousemove", (e) => {
  if (document.pointerLockElement === canvas) {
    camYawDeg -= e.movementX * 0.15;
  }
});

btnReplay.addEventListener("click", () => newGame());

resize();
newGame();
requestAnimationFrame(frame);
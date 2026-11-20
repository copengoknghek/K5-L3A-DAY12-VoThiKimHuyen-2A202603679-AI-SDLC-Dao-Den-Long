import * as THREE from "three";
import contract from "../../game.contract.json";
import { GameAudio } from "./audio.js";
import { buildStage } from "./stage.js";
import { DEFAULT_HELD, type HeldInput, type Tuning } from "../sim/types.js";
import type { SimState } from "../sim/types.js";
import { createInitialState } from "../sim/world.js";
import { step } from "../sim/step.js";
import { TICK_DT } from "../sim/constants.js";
import { edgeActivate } from "../sim/input.js";
import { distXZ } from "../sim/math.js";
import { INTERACT_R } from "../sim/constants.js";

const tuning = contract.tuning as Tuning;
const audio = new GameAudio();
const STORIES: Record<1 | 2 | 3, { title: string; story: string }> = {
  1: {
    title: "Đêm 1 — Đảo Bến",
    story: "Ông Đăng: Sương nuốt hết lửa. Gom đom đóm, thắp năm đèn. Né Bóng Mực.",
  },
  2: {
    title: "Đêm 2 — Đảo Cau",
    story: "Ông Đăng: Hai bờ, một cầu tre. Bục nhảy đưa sang đảo kia. Coi chừng Gió Lạc.",
  },
  3: {
    title: "Đêm 3 — Đảo Chuông",
    story: "Ông Đăng: Lên tầng chuông trước bình minh. Gió mạnh sẽ đẩy chân cháu.",
  },
};

type Ui = "menu" | "intro" | "play" | "result" | "dawn" | "settings" | "pause";

const $ = (id: string) => document.getElementById(id)!;
const canvas = $("game") as HTMLCanvasElement;
const overlayMenu = $("overlay-menu");
const overlayIntro = $("overlay-intro");
const overlayResult = $("overlay-result");
const overlayPause = $("overlay-pause");
const overlaySettings = $("overlay-settings");
const hud = $("hud");

let ui: Ui = "menu";
let night: 1 | 2 | 3 = 1;
let totalScore = 0;
let sessionActive = false;
let settingsBack: Ui = "menu";

function loadSettings(): { vol: number; sens: number } {
  try {
    return JSON.parse(localStorage.getItem("ddl-settings") || "") as { vol: number; sens: number };
  } catch {
    return { vol: 70, sens: 15 };
  }
}
function saveSettings(s: { vol: number; sens: number }): void {
  localStorage.setItem("ddl-settings", JSON.stringify(s));
}
let settings = loadSettings();
audio.volume = settings.vol / 100;
($("set-vol") as HTMLInputElement).value = String(settings.vol);
($("set-sens") as HTMLInputElement).value = String(settings.sens);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x0e1430, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x1b2350, 35, 110);
scene.background = new THREE.Color(0x0e1430);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 300);
const hemi = new THREE.HemisphereLight(0x8a9cc8, 0x2f5d50, 0.15);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0xc8d0ff, 0.35);
moon.position.set(-18, 50, 22);
scene.add(moon);
const stage = new THREE.Group();
scene.add(stage);
const playerFill = new THREE.PointLight(0xffe0b0, 1.1, 14);
scene.add(playerFill);

function buildMay(): THREE.Group {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xf0d4b8 });
  const ao = new THREE.MeshStandardMaterial({ color: 0xe8e2d0 });
  const khan = new THREE.MeshStandardMaterial({ color: 0xc8102e });
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.55, 8), ao);
  legs.position.y = 0.35;
  g.add(legs);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.55, 8), ao);
  torso.position.y = 0.92;
  g.add(torso);
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 6, 10), khan);
  scarf.position.y = 1.18;
  scarf.rotation.x = Math.PI / 2;
  g.add(scarf);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), skin);
  head.position.y = 1.35;
  g.add(head);
  const brim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 0.04, 12),
    new THREE.MeshStandardMaterial({ color: 0x4a6741 }),
  );
  brim.position.y = 1.52;
  g.add(brim);
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.42, 0.35, 10),
    new THREE.MeshStandardMaterial({ color: 0x4a6741 }),
  );
  cone.position.y = 1.72;
  g.add(cone);
  const lantern = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.22, 0.16),
    new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xffb347, emissiveIntensity: 0.9 }),
  );
  lantern.position.set(0.48, 1.18, 0.22);
  g.add(lantern);
  return g;
}

const playerGroup = buildMay();
scene.add(playerGroup);

const moteMeshes = new Map<string, THREE.Mesh>();
const shadeMeshes = new Map<string, THREE.Mesh>();
const lanternMeshes = new Map<string, { group: THREE.Group; light: THREE.PointLight }>();
const drifterMeshes = new Map<string, THREE.Mesh>();

let seed = 1;
let state: SimState;
let held: HeldInput = { ...DEFAULT_HELD };
let prevHeld: HeldInput = { ...DEFAULT_HELD };
let camYawDeg = 0;
let simAccum = 0;
let lastT = performance.now();
let prevCarried = 0;
let prevLit = 0;
let prevFlames = 3;
const keys = new Set<string>();

function show(el: HTMLElement, on: boolean): void {
  el.hidden = !on;
}

function setUi(next: Ui): void {
  ui = next;
  show(overlayMenu, next === "menu");
  show(overlayIntro, next === "intro");
  show(overlayResult, next === "result" || next === "dawn");
  show(overlayPause, next === "pause");
  show(overlaySettings, next === "settings");
  show(hud, next === "play" || next === "pause");
  sessionActive = next === "play";
}

function startNight(): void {
  seed = (Date.now() ^ night) >>> 0;
  state = createInitialState({ seed, scenario: null, tuning, night });
  held = { ...DEFAULT_HELD };
  prevHeld = { ...DEFAULT_HELD };
  camYawDeg = 0;
  simAccum = 0;
  prevCarried = 0;
  prevLit = 0;
  prevFlames = state.player.flames;
  buildStage(night, stage);
  rebuildEntities();
  setUi("play");
  canvas.requestPointerLock();
}

function rebuildEntities(): void {
  for (const m of moteMeshes.values()) scene.remove(m);
  for (const s of shadeMeshes.values()) scene.remove(s);
  for (const d of drifterMeshes.values()) scene.remove(d);
  for (const l of lanternMeshes.values()) scene.remove(l.group);
  moteMeshes.clear();
  shadeMeshes.clear();
  drifterMeshes.clear();
  lanternMeshes.clear();
  for (const lan of state.lanterns) {
    const g = new THREE.Group();
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.3, 1.6, 8),
      new THREE.MeshStandardMaterial({ color: 0x6b4a2f }),
    );
    post.position.y = 0.8;
    g.add(post);
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.7, 0.55),
      new THREE.MeshStandardMaterial({
        color: lan.lit ? 0xffb347 : 0x5b5f6e,
        emissive: lan.lit ? 0xffe9b0 : 0x222222,
        emissiveIntensity: lan.lit ? 1.2 : 0.2,
      }),
    );
    box.position.y = 1.85;
    g.add(box);
    const light = new THREE.PointLight(0xffb347, lan.lit ? 4 : 1.2, 18);
    light.position.y = 2;
    g.add(light);
    g.position.set(lan.pos[0], lan.pos[1], lan.pos[2]);
    scene.add(g);
    lanternMeshes.set(lan.id, { group: g, light });
  }
}

function syncVisual(t: number): void {
  const p = state.player;
  playerGroup.position.set(p.pos[0], p.pos[1], p.pos[2]);
  playerGroup.rotation.y = Math.atan2(p.facing[0], p.facing[1]);
  playerFill.position.set(p.pos[0], p.pos[1] + 3, p.pos[2]);

  const lit = state.lanterns.filter((l) => l.lit).length;
  const amb = 0.15 + 0.55 * (lit / Math.max(1, state.lanterns.length));
  hemi.intensity = amb;
  moon.intensity = 0.25 + amb * 0.5;

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
        new THREE.SphereGeometry(0.14, 8, 8),
        new THREE.MeshStandardMaterial({
          color: 0xfff6c2,
          emissive: 0xffe58a,
          emissiveIntensity: 1.5,
        }),
      );
      scene.add(mesh);
      moteMeshes.set(m.id, mesh);
    }
    mesh.position.set(m.pos[0], m.pos[1] + 0.35 + Math.sin(t * 4) * 0.08, m.pos[2]);
  }

  for (const sh of state.shades) {
    let mesh = shadeMeshes.get(sh.id);
    if (!mesh) {
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0x120a1a, emissive: 0x7a3cff, emissiveIntensity: 0.5 }),
      );
      scene.add(mesh);
      shadeMeshes.set(sh.id, mesh);
    }
    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.emissive.setHex(sh.state === "stunned" ? 0x3a3450 : 0x7a3cff);
    mesh.position.set(sh.pos[0], sh.pos[1] + 0.5, sh.pos[2]);
  }
  for (const [id, mesh] of shadeMeshes) {
    if (!state.shades.some((s) => s.id === id)) {
      scene.remove(mesh);
      shadeMeshes.delete(id);
    }
  }

  for (const d of state.drifters.filter((x) => x.state !== "removed")) {
    let mesh = drifterMeshes.get(d.id);
    if (!mesh) {
      mesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.2, 1.2, 4, 6),
        new THREE.MeshStandardMaterial({ color: 0x8fa3b8, emissive: 0x445566, emissiveIntensity: 0.4 }),
      );
      scene.add(mesh);
      drifterMeshes.set(d.id, mesh);
    }
    mesh.position.set(d.pos[0], d.pos[1] + 0.8, d.pos[2]);
  }

  for (const lan of state.lanterns) {
    const e = lanternMeshes.get(lan.id);
    if (!e) continue;
    e.group.position.set(lan.pos[0], lan.pos[1], lan.pos[2]);
    e.light.intensity = lan.lit ? 5 : 1.3;
  }
}

function readHeld(): void {
  prevHeld = { ...held, move: [...held.move] as [number, number] };
  let mx = 0;
  let mz = 0;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) mx -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) mx += 1;
  if (keys.has("KeyW") || keys.has("ArrowUp")) mz -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) mz += 1;
  held.move = [mx, mz];
  held.camYawDeg = camYawDeg;
  held.jump = keys.has("Space");
  held.interact = keys.has("KeyE");
  held.pulse = keys.has("KeyF");
  held.dash = keys.has("ShiftLeft") || keys.has("ShiftRight");
  held.pause = keys.has("Escape") || keys.has("KeyP");
}

function updateHud(): void {
  const lit = state.lanterns.filter((l) => l.lit).length;
  $("hud-flames").textContent = "🔥".repeat(state.player.flames) || "—";
  const s = Math.max(0, Math.floor(state.timeLeftS));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  const clock = $("hud-clock");
  clock.textContent = `${mm}:${ss}`;
  clock.classList.toggle("warn", s <= 30);
  $("hud-lanterns").textContent = `${lit}/${state.lanterns.length}`;
  $("hud-score").textContent = String(state.score);
  const bar = $("mote-bar");
  bar.innerHTML = "";
  for (let i = 0; i < 10; i++) {
    const c = document.createElement("div");
    c.className = "mote-cell" + (i < state.player.carried ? " on" : "");
    bar.appendChild(c);
  }
  $("cd-dash").textContent = state.player.dashCdTicks > 0 ? `Lướt ${ (state.player.dashCdTicks / 60).toFixed(1)}` : "Lướt";
  $("cd-pulse").textContent = state.player.pulseCdTicks > 0 ? `Tỏa ${(state.player.pulseCdTicks / 60).toFixed(1)}` : "Tỏa";
  const near = state.lanterns
    .filter((l) => !l.lit)
    .map((l) => ({ l, d: distXZ(state.player.pos, l.pos) }))
    .sort((a, b) => a.d - b.d)[0];
  $("hud-prompt").textContent =
    near && near.d <= INTERACT_R ? `E — Nạp ánh sáng (${near.l.deposited}/10)` : "";
  const arrow = $("lantern-arrow");
  if (near && near.d > 12) {
    arrow.hidden = false;
    const yaw = (camYawDeg * Math.PI) / 180;
    const dx = near.l.pos[0] - state.player.pos[0];
    const dz = near.l.pos[2] - state.player.pos[2];
    const ang = Math.atan2(dx, dz) - yaw;
    arrow.style.transform = `translate(-50%, -50%) rotate(${(-ang * 180) / Math.PI}deg)`;
  } else arrow.hidden = true;
}

function resize(): void {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

function frame(now: number): void {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  if (ui === "play") {
    readHeld();
    if (edgeActivate(prevHeld.pause, held.pause)) {
      setUi("pause");
      document.exitPointerLock();
      return;
    }
    simAccum += dt;
    while (simAccum >= TICK_DT && state.state === "playing") {
      const ev = step(state, tuning, held, prevHeld);
      prevHeld = { ...held, move: [...held.move] as [number, number] };
      for (const e of ev) {
        if (e.type === "mote_picked") audio.playMotePickup();
        if (e.type === "pulse") audio.playPulse();
        if (e.type === "lantern_lit") audio.playLanternLit();
        if (e.type === "dash") audio.playDash();
        if (e.type === "player_hit") audio.playHit();
        if (e.type === "shade_spawned") audio.playSpawn();
        if (e.type === "game_over" && e.data.result === "won") audio.playWin();
        if (e.type === "game_over" && e.data.result === "lost") audio.playLose();
      }
      simAccum -= TICK_DT;
    }
    if (state.timeLeftS <= 10 && state.timeLeftS > 9.98) audio.playWarn();
    syncVisual(now / 1000);
    updateHud();
    const yawRad = (camYawDeg * Math.PI) / 180;
    camera.position.set(
      state.player.pos[0] + Math.sin(yawRad) * 8,
      state.player.pos[1] + 5,
      state.player.pos[2] + Math.cos(yawRad) * 8,
    );
    camera.lookAt(state.player.pos[0], state.player.pos[1] + 1, state.player.pos[2]);
    if (state.state !== "playing") {
      totalScore += state.state === "won" ? state.score : 0;
      $("result-title").textContent = state.state === "won" ? "Thắng đêm này" : "Thua — hết lửa / hết đêm";
      $("result-score").textContent = `Điểm đêm: ${state.score} · Tổng (các đêm thắng): ${totalScore}`;
      $("btn-result").textContent = state.state === "won" ? (night < 3 ? "Đêm kế" : "Bình minh") : "Chơi lại đêm";
      setUi("result");
      document.exitPointerLock();
    }
  } else {
    camera.position.set(0, 14, 22);
    camera.lookAt(0, 1, 0);
  }
  renderer.render(scene, camera);
}

function openIntro(): void {
  const s = STORIES[night];
  $("intro-title").textContent = s.title;
  $("intro-story").textContent = s.story;
  setUi("intro");
}

$("btn-menu-play").onclick = () => {
  night = 1;
  totalScore = 0;
  void audio.ensure();
  openIntro();
};
$("btn-intro").onclick = () => startNight();
$("btn-result").onclick = () => {
  if (ui === "dawn") {
    setUi("menu");
    return;
  }
  if (state.state === "won") {
    if (night < 3) {
      night = (night + 1) as 1 | 2 | 3;
      openIntro();
    } else {
      $("result-title").textContent = "Bình Minh";
      $("result-score").textContent = `Tổng điểm: ${totalScore}`;
      $("btn-result").textContent = "Về menu";
      setUi("dawn");
    }
  } else startNight();
};
$("btn-resume").onclick = () => {
  setUi("play");
  canvas.requestPointerLock();
};
$("btn-restart-night").onclick = () => startNight();
$("btn-to-menu").onclick = () => setUi("menu");
$("btn-menu-settings").onclick = () => {
  settingsBack = "menu";
  setUi("settings");
};
$("btn-pause-settings").onclick = () => {
  settingsBack = "pause";
  setUi("settings");
};
$("btn-settings-close").onclick = () => setUi(settingsBack);
$("set-vol").oninput = (e) => {
  settings.vol = Number((e.target as HTMLInputElement).value);
  audio.volume = settings.vol / 100;
  saveSettings(settings);
};
$("set-sens").oninput = (e) => {
  settings.sens = Number((e.target as HTMLInputElement).value);
  saveSettings(settings);
};

const GAME_KEYS = new Set([
  "KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
  "Space", "KeyE", "KeyF", "KeyR", "ShiftLeft", "ShiftRight", "Escape", "KeyP",
]);
window.addEventListener("keydown", (e) => {
  if (GAME_KEYS.has(e.code)) e.preventDefault();
  keys.add(e.code);
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
canvas.addEventListener("click", () => {
  if (ui === "play") canvas.requestPointerLock();
});
document.addEventListener("mousemove", (e) => {
  if (document.pointerLockElement === canvas) camYawDeg -= e.movementX * (settings.sens / 100);
});
window.addEventListener("resize", resize);

state = createInitialState({ seed: 1, scenario: null, tuning, night: 1 });
buildStage(1, stage);
resize();
setUi("menu");
requestAnimationFrame(frame);
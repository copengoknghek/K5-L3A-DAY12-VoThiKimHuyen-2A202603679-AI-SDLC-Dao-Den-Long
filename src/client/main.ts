import * as THREE from "three";
import contract from "../../game.contract.json";
import { GameAudio } from "./audio.js";
import { buildAvatar, type AvatarId } from "./characters.js";
import { applyLanternLit, buildSilkLantern, createStarMote, type SilkLantern } from "./props.js";
import { driftClouds, visualGroundY } from "./scenery.js";
import { buildStage } from "./stage.js";
import { DEFAULT_HELD, playerCapacity, type HeldInput, type Tuning } from "../sim/types.js";
import type { SimState } from "../sim/types.js";
import { createInitialState } from "../sim/world.js";
import { step } from "../sim/step.js";
import { TICK_DT } from "../sim/constants.js";
import { edgeActivate } from "../sim/input.js";
import { distXZ } from "../sim/math.js";
import { INTERACT_R } from "../sim/constants.js";
import { validateName } from "../leaderboard-core.js";
import { loadLeaderboardBrowser, persistScore } from "./leaderboard-store.js";
import { DEFAULT_KEYS, duplicateKeyMessage, loadKeys, saveKeys, type KeyBindings } from "./keys.js";

const tuning = contract.tuning as Tuning;
const audio = new GameAudio();
const NIGHT_NAMES: Record<1 | 2 | 3, string> = {
  1: "Đêm 1 — Đảo Bến",
  2: "Đêm 2 — Đảo Cau",
  3: "Đêm 3 — Đảo Chuông",
};

const NIGHT_TIPS: Record<1 | 2 | 3, string> = {
  1: "Giữ ≥3/5 đèn sáng tới bình minh · châm dầu (E) khi đèn sáng · thắp lại chỉ 5 đom",
  2: "Dùng bục nhảy · cần ≥4/6 đèn · coi chừng Bóng hút dầu ở đèn yếu",
  3: "Leo tháp · cần ≥5/7 đèn · gió mạnh cuối đêm",
};

const CONTROLS_HINT =
  "WASD di chuyển · Chuột xoay · Space nhảy · Shift lướt · E nạp đèn · F tỏa sáng (3 đom) · Esc/P tạm dừng";

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

type Ui = "menu" | "intro" | "play" | "result" | "dawn" | "settings" | "pause" | "leaderboard";

const $ = (id: string) => document.getElementById(id)!;
const canvas = $("game") as HTMLCanvasElement;
const overlayMenu = $("overlay-menu");
const overlayIntro = $("overlay-intro");
const overlayResult = $("overlay-result");
const overlayPause = $("overlay-pause");
const overlaySettings = $("overlay-settings");
const overlayLeaderboard = $("overlay-leaderboard");
const hud = $("hud");

let ui: Ui = "menu";
let night: 1 | 2 | 3 = 1;
let totalScore = 0;
let nightsWon = 0;
let lastRunSeed = 1;
let sessionActive = false;
let prevShadeCount = 0;
let settingsBack: Ui = "menu";

function loadSettings(): {
  vol: number;
  sens: number;
  colorblind: boolean;
  reduceMotion: boolean;
  largeText: boolean;
} {
  try {
    const raw = JSON.parse(localStorage.getItem("ddl-settings") || "") as {
      vol: number;
      sens: number;
      colorblind?: boolean;
      reduceMotion?: boolean;
      largeText?: boolean;
    };
    return {
      vol: raw.vol ?? 70,
      sens: raw.sens ?? 15,
      colorblind: !!raw.colorblind,
      reduceMotion: !!raw.reduceMotion,
      largeText: !!raw.largeText,
    };
  } catch {
    return { vol: 70, sens: 15, colorblind: false, reduceMotion: false, largeText: false };
  }
}
function saveSettings(s: ReturnType<typeof loadSettings>): void {
  localStorage.setItem("ddl-settings", JSON.stringify(s));
}
function applyA11yClasses(): void {
  document.documentElement.classList.toggle("reduce-motion", settings.reduceMotion);
  document.documentElement.classList.toggle("text-large", settings.largeText);
}
let settings = loadSettings();
let keyBindings: KeyBindings = loadKeys();
audio.volume = settings.vol / 100;
($("set-vol") as HTMLInputElement).value = String(settings.vol);
($("set-sens") as HTMLInputElement).value = String(settings.sens);
($("set-cb") as HTMLInputElement).checked = settings.colorblind;
($("set-reduce-motion") as HTMLInputElement).checked = settings.reduceMotion;
($("set-large-text") as HTMLInputElement).checked = settings.largeText;
applyA11yClasses();

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x24366e, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x4a5d90, 52, 190);
scene.background = new THREE.Color(0x2a3d72);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 420);
const hemi = new THREE.HemisphereLight(0xb7c6ee, 0x2f6a44, 0.62);
scene.add(hemi);
const ambient = new THREE.AmbientLight(0x7d8ebd, 0.22);
scene.add(ambient);
const moon = new THREE.DirectionalLight(0xd5def8, 0.55);
moon.position.set(-18, 50, 22);
scene.add(moon);
const stage = new THREE.Group();
scene.add(stage);
const playerFill = new THREE.PointLight(0xfff0d4, 1.35, 16, 1);
scene.add(playerFill);

function loadAvatar(): AvatarId {
  return localStorage.getItem("ddl-avatar") === "nam" ? "nam" : "nu";
}
let avatar: AvatarId = loadAvatar();
let playerGroup = buildAvatar(avatar);
scene.add(playerGroup);

function paintPicks(): void {
  $("pick-nu").setAttribute("aria-pressed", avatar === "nu" ? "true" : "false");
  $("pick-nam").setAttribute("aria-pressed", avatar === "nam" ? "true" : "false");
}

function paintNightPicks(): void {
  for (const btn of document.querySelectorAll<HTMLButtonElement>(".night-pick")) {
    const n = Number(btn.dataset.night) as 1 | 2 | 3;
    btn.setAttribute("aria-pressed", n === night ? "true" : "false");
  }
}

function setNightChoice(n: 1 | 2 | 3): void {
  night = n;
  paintNightPicks();
}

function pauseGame(): void {
  held.pause = true;
  prevHeld.pause = true;
  state.paused = true;
  setUi("pause");
  void document.exitPointerLock();
}
function setAvatar(next: AvatarId): void {
  avatar = next;
  localStorage.setItem("ddl-avatar", next);
  scene.remove(playerGroup);
  playerGroup = buildAvatar(next);
  scene.add(playerGroup);
  paintPicks();
}

const moteMeshes = new Map<string, THREE.Group>();
const shadeMeshes = new Map<string, THREE.Mesh>();
const lanternMeshes = new Map<string, SilkLantern>();
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
  show(overlayLeaderboard, next === "leaderboard");
  show(hud, next === "play" || next === "pause");
  sessionActive = next === "play";
}

let clouds: THREE.Group;

function showA11y(msg: string, ms = 2500): void {
  const el = $("a11y-banner");
  el.textContent = msg;
  el.hidden = false;
  window.setTimeout(() => {
    el.hidden = true;
  }, ms);
}

function updateCaptions(): void {
  const msgs: string[] = [];
  if (state.timeLeftS <= 10 && state.timeLeftS > 0) msgs.push("10 giây cuối đêm");
  if (state.windTicks >= 0 && state.windActive) msgs.push("Gió sắp thổi / đang thổi");
  const low = state.lanterns.some((l) => l.lit && l.fuelSixtieths / 60 < tuning.low_fuel_threshold);
  if (low) msgs.push("Đèn có dầu < 30");
  $("a11y-banner").hidden = msgs.length === 0;
  if (msgs.length) $("a11y-banner").textContent = msgs.join(" · ");
}

function startNight(): void {
  seed = (Date.now() ^ night) >>> 0;
  lastRunSeed = seed;
  state = createInitialState({ seed, scenario: null, tuning, night });
  held = { ...DEFAULT_HELD };
  prevHeld = { ...DEFAULT_HELD };
  camYawDeg = 0;
  simAccum = 0;
  prevCarried = 0;
  prevLit = 0;
  prevFlames = state.player.flames;
  clouds = buildStage(night, stage);
  rebuildEntities();
  prevShadeCount = state.shades.length;
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
    const view = buildSilkLantern();
    applyLanternLit(view, lan.lit);
    view.group.position.set(lan.pos[0], lan.pos[1], lan.pos[2]);
    scene.add(view.group);
    lanternMeshes.set(lan.id, view);
  }
}

function syncTorch(carried: number, t: number): void {
  const torch = playerGroup.getObjectByName("torch");
  if (!torch) return;
  const k = Math.min(10, Math.max(0, carried)) / 10;
  const punch = Math.sqrt(k);
  const flicker = 0.86 + Math.sin(t * 14) * 0.14;
  const flame = torch.getObjectByName("flame") as THREE.Mesh | null;
  const core = torch.getObjectByName("flameCore") as THREE.Mesh | null;
  const light = torch.getObjectByName("torchLight") as THREE.PointLight | null;
  const scale = (0.55 + punch * 1.55) * flicker;
  if (flame) {
    flame.scale.set(scale, 0.7 + punch * 1.7, scale);
    const mat = flame.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 0.35 + punch * 2.8;
  }
  if (core) core.scale.setScalar((0.55 + punch * 1.35) * flicker);
  if (light) {
    light.intensity = 0.35 + punch * 9;
    light.distance = 5 + punch * 18;
  }
}

function syncVisual(t: number): void {
  const p = state.player;
  const py = p.pos[1] + visualGroundY(p.pos[0], p.pos[2], p.pos[1], night);
  playerGroup.position.set(p.pos[0], py, p.pos[2]);
  playerGroup.rotation.y = Math.atan2(p.facing[0], p.facing[1]);
  playerFill.position.set(p.pos[0], py + 3, p.pos[2]);

  const lit = state.lanterns.filter((l) => l.lit).length;
  const amb = lit / Math.max(1, state.lanterns.length);
  hemi.intensity = 0.62 + 0.28 * amb;
  moon.intensity = 0.55 + 0.2 * amb;
  syncTorch(p.carried, t);

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
      mesh = createStarMote();
      scene.add(mesh);
      moteMeshes.set(m.id, mesh);
    }
    const gy = visualGroundY(m.pos[0], m.pos[2], m.pos[1], night);
    mesh.position.set(m.pos[0], m.pos[1] + gy + 0.7 + Math.sin(t * 3 + m.pos[0]) * 0.12, m.pos[2]);
    mesh.lookAt(camera.position);
    const spin = mesh.getObjectByName("starSpin");
    if (spin) spin.rotation.z = t * 0.7;
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
    const base = settings.colorblind ? 0x00b3ff : 0x7a3cff;
    mat.emissive.setHex(sh.state === "stunned" ? 0x3a3450 : sh.state === "drain" ? 0xaa2244 : base);
    mat.color.setHex(sh.state === "drain" ? 0x0a0812 : 0x120a1a);
    const gy = visualGroundY(sh.pos[0], sh.pos[2], sh.pos[1], night);
    mesh.position.set(sh.pos[0], sh.pos[1] + gy + 0.5, sh.pos[2]);
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
    const gy = visualGroundY(d.pos[0], d.pos[2], d.pos[1], night);
    mesh.position.set(d.pos[0], d.pos[1] + gy + 0.8, d.pos[2]);
  }

  for (const lan of state.lanterns) {
    const e = lanternMeshes.get(lan.id);
    if (!e) continue;
    const gy = visualGroundY(lan.pos[0], lan.pos[2], lan.pos[1], night);
    const bob = Math.sin(t * 1.4 + lan.pos[0] * 0.4) * 0.16;
    e.group.position.set(lan.pos[0], lan.pos[1] + gy + bob, lan.pos[2]);
    e.group.rotation.z = Math.sin(t * 0.8 + lan.pos[2]) * 0.06;
    e.group.rotation.x = Math.cos(t * 0.65 + lan.pos[0]) * 0.04;
    applyLanternLit(e, lan.lit, t, lan.fuelSixtieths);
  }
}

function readHeld(): void {
  prevHeld = { ...held, move: [...held.move] as [number, number] };
  let mx = 0;
  let mz = 0;
  const kb = keyBindings;
  if (keys.has(kb.left) || keys.has("ArrowLeft")) mx -= 1;
  if (keys.has(kb.right) || keys.has("ArrowRight")) mx += 1;
  if (keys.has(kb.up) || keys.has("ArrowUp")) mz -= 1;
  if (keys.has(kb.down) || keys.has("ArrowDown")) mz += 1;
  held.move = [mx, mz];
  held.camYawDeg = camYawDeg;
  held.jump = keys.has(kb.jump);
  held.interact = keys.has(kb.interact);
  held.pulse = keys.has(kb.pulse);
  held.dash = keys.has(kb.dash) || keys.has("ShiftRight");
  held.pause = keys.has(kb.pause) || keys.has("KeyP");
}

function updateHud(): void {
  const lit = state.lanterns.filter((l) => l.lit).length;
  $("hud-night-label").textContent = NIGHT_NAMES[night];
  $("hud-hints").innerHTML = `<strong>Gợi ý đêm này</strong>${NIGHT_TIPS[night]}<br><br><strong>Điều khiển</strong>${CONTROLS_HINT.replace(/ · /g, "<br>")}`;
  $("hud-flames").textContent = "🔥".repeat(state.player.flames) || "—";
  const s = Math.max(0, Math.floor(state.timeLeftS));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  const clock = $("hud-clock");
  clock.textContent = `${mm}:${ss}`;
  const need = Math.ceil(state.lanterns.length * tuning.win_ratio);
  clock.classList.toggle("warn", s <= 30 && !settings.reduceMotion);
  clock.classList.toggle("cb-mode", settings.colorblind);
  $("hud-lanterns").textContent = `${lit}/${state.lanterns.length} (cần ${need})`;
  const cap = playerCapacity(state, tuning);
  $("hud-carry").textContent = `${state.player.carried}/${cap}`;
  $("hud-score").textContent = String(state.score);
  const bar = $("mote-bar");
  bar.innerHTML = "";
  for (let i = 0; i < cap; i++) {
    const c = document.createElement("div");
    c.className = "mote-cell" + (i < state.player.carried ? " on" : "");
    bar.appendChild(c);
  }
  $("cd-dash").textContent = state.player.dashCdTicks > 0 ? `Lướt ${ (state.player.dashCdTicks / 60).toFixed(1)}` : "Lướt";
  $("cd-pulse").textContent = state.player.pulseCdTicks > 0 ? `Tỏa ${(state.player.pulseCdTicks / 60).toFixed(1)}` : "Tỏa";
  const interactable = state.lanterns.filter((l) => {
    if (!l.lit) {
      const cost = l.everLit ? tuning.relight_cost : tuning.lantern_cost;
      return l.deposited < cost;
    }
    return l.fuelSixtieths < tuning.fuel_max * 60;
  });
  const near = interactable
    .map((l) => ({ l, d: distXZ(state.player.pos, l.pos) }))
    .sort((a, b) => a.d - b.d)[0];
  const aimUnlit = state.lanterns
    .filter((l) => !l.lit)
    .map((l) => ({ l, d: distXZ(state.player.pos, l.pos) }))
    .sort((a, b) => a.d - b.d)[0];
  const contextual: string[] = [];
  if (state.player.carried >= 3 && state.player.pulseCdTicks <= 0) {
    contextual.push("F — Tỏa Sáng (cần ≥3 đom đóm mang theo)");
  }
  if (state.player.carried === 0 && state.motes.length > 0) {
    contextual.push("Đi tới đom đóm vàng để nhặt");
  }
  if (near && near.d <= INTERACT_R) {
    if (!near.l.lit) {
      const cost = near.l.everLit ? tuning.relight_cost : tuning.lantern_cost;
      contextual.push(`E — Thắp đèn (${near.l.deposited}/${cost})`);
    } else {
      contextual.push(`E — Châm dầu (≈${Math.ceil(near.l.fuelSixtieths / 60)}/100)`);
    }
  } else if (lit < need) {
    contextual.push("Mũi tên ▲ chỉ hướng đèn cần thắp/châm");
  }
  $("hud-prompt").textContent = contextual.join(" · ");
  const arrow = $("lantern-arrow");
  const arrowTgt = aimUnlit ?? near;
  if (arrowTgt && arrowTgt.d > 12) {
    arrow.hidden = false;
    const yaw = (camYawDeg * Math.PI) / 180;
    const dx = arrowTgt.l.pos[0] - state.player.pos[0];
    const dz = arrowTgt.l.pos[2] - state.player.pos[2];
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
      pauseGame();
    }
    if (ui === "pause") {
      syncVisual(now / 1000);
      camera.position.set(12, 16, 28);
      camera.lookAt(0, 2, 0);
      if (!settings.reduceMotion) driftClouds(clouds, now / 1000);
      renderer.render(scene, camera);
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
        if (e.type === "shade_spawned") {
          audio.playSpawn();
          showA11y("Bóng Mực xuất hiện");
          const sa = $("shade-arrow");
          sa.hidden = false;
          sa.style.top = "40%";
        }
        if (e.type === "game_over" && e.data.result === "won") audio.playWin();
        if (e.type === "game_over" && e.data.result === "lost") audio.playLose();
      }
      simAccum -= TICK_DT;
    }
    if (state.timeLeftS <= 10 && state.timeLeftS > 9.98) audio.playWarn();
    syncVisual(now / 1000);
    updateHud();
    updateCaptions();
    if (state.shades.length > prevShadeCount) {
      const sh = state.shades[state.shades.length - 1];
      const sx = sh.pos[0] - state.player.pos[0];
      $("shade-arrow").style.left = sx < 0 ? "12px" : "auto";
      $("shade-arrow").style.right = sx >= 0 ? "12px" : "auto";
    }
    prevShadeCount = state.shades.length;
    const yawRad = (camYawDeg * Math.PI) / 180;
    const lookY = state.player.pos[1] + visualGroundY(state.player.pos[0], state.player.pos[2], state.player.pos[1], night);
    camera.position.set(
      state.player.pos[0] + Math.sin(yawRad) * 9,
      lookY + 7.5,
      state.player.pos[2] + Math.cos(yawRad) * 9,
    );
    camera.lookAt(state.player.pos[0], lookY + 1.2, state.player.pos[2]);
    if (state.state !== "playing") {
      if (state.state === "won") {
        totalScore += state.score;
        nightsWon += 1;
      }
      const saveBox = $("result-save");
      saveBox.hidden = false;
      ($("result-name") as HTMLInputElement).value = "";
      $("result-name-err").hidden = true;
      $("result-title").textContent =
        state.state === "won"
          ? "Bình minh — giữ được đảo sáng"
          : state.reason === "no_flames"
            ? "Thua — hết Ngọn Lửa"
            : "Thua — không đủ đèn sáng lúc bình minh";
      $("result-score").textContent = `Điểm đêm: ${state.score} · Tổng (các đêm thắng): ${totalScore}`;
      $("btn-result").textContent = state.state === "won" ? (night < 3 ? "Đêm kế" : "Bình minh") : "Chơi lại đêm";
      setUi("result");
      document.exitPointerLock();
    }
  } else if (ui === "pause") {
    readHeld();
    if (edgeActivate(prevHeld.pause, held.pause)) {
      state.paused = false;
      held.pause = false;
      prevHeld.pause = false;
      setUi("play");
      void canvas.requestPointerLock();
    } else {
      prevHeld.pause = held.pause;
    }
    camera.position.set(12, 16, 28);
    camera.lookAt(0, 2, 0);
  } else {
    camera.position.set(12, 16, 28);
    camera.lookAt(0, 2, 0);
  }
  if (!settings.reduceMotion) driftClouds(clouds, now / 1000);
  renderer.render(scene, camera);
}

function openIntro(): void {
  const s = STORIES[night];
  $("intro-title").textContent = s.title;
  $("intro-story").textContent = s.story;
  setUi("intro");
}

$("pick-nu").onclick = () => setAvatar("nu");
$("pick-nam").onclick = () => setAvatar("nam");
for (const btn of document.querySelectorAll<HTMLButtonElement>(".night-pick")) {
  btn.onclick = () => setNightChoice(Number(btn.dataset.night) as 1 | 2 | 3);
}
function paintLeaderboard(): void {
  const list = $("leaderboard-list");
  list.innerHTML = "";
  const entries = loadLeaderboardBrowser();
  if (!entries.length) {
    const li = document.createElement("li");
    li.textContent = "Chưa có điểm — chơi và lưu tên sau khi thắng/thua.";
    list.appendChild(li);
    return;
  }
  for (const e of entries) {
    const li = document.createElement("li");
    li.textContent = `${e.name} — ${e.score} điểm · ${e.nights_won} đêm thắng`;
    list.appendChild(li);
  }
}

const KEY_LABELS: Record<keyof KeyBindings, string> = {
  up: "Lên",
  down: "Xuống",
  left: "Trái",
  right: "Phải",
  jump: "Nhảy",
  dash: "Lướt",
  interact: "Tương tác",
  pulse: "Tỏa sáng",
  pause: "Tạm dừng",
};

let captureAction: keyof KeyBindings | null = null;

function paintKeyBindings(): void {
  const grid = $("key-bindings");
  grid.innerHTML = "";
  const err = $("key-bind-err");
  const dup = duplicateKeyMessage(keyBindings);
  err.hidden = !dup;
  if (dup) err.textContent = dup;
  for (const action of Object.keys(KEY_LABELS) as (keyof KeyBindings)[]) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `${KEY_LABELS[action]}: ${keyBindings[action]}`;
    btn.onclick = () => {
      captureAction = action;
      btn.textContent = `${KEY_LABELS[action]}: …`;
    };
    grid.appendChild(btn);
  }
}

$("btn-menu-play").onclick = () => {
  totalScore = 0;
  nightsWon = 0;
  void audio.ensure();
  openIntro();
};
$("btn-menu-leaderboard").onclick = () => {
  paintLeaderboard();
  setUi("leaderboard");
};
$("btn-leaderboard-close").onclick = () => setUi("menu");
$("btn-hud-pause").onclick = () => pauseGame();
window.addEventListener("blur", () => {
  if (ui === "play" && sessionActive) pauseGame();
});
$("btn-intro").onclick = () => startNight();
$("btn-result-menu").onclick = () => setUi("menu");
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
function resumeGame(): void {
  state.paused = false;
  held.pause = false;
  prevHeld.pause = false;
  setUi("play");
  void canvas.requestPointerLock();
}

$("btn-resume").onclick = () => resumeGame();
$("btn-restart-night").onclick = () => startNight();
$("btn-to-menu").onclick = () => setUi("menu");
$("btn-menu-settings").onclick = () => {
  settingsBack = "menu";
  paintKeyBindings();
  setUi("settings");
};
$("btn-pause-settings").onclick = () => {
  settingsBack = "pause";
  paintKeyBindings();
  setUi("settings");
};
$("btn-keys-reset").onclick = () => {
  keyBindings = { ...DEFAULT_KEYS };
  saveKeys(keyBindings);
  paintKeyBindings();
};
$("btn-save-score").onclick = () => {
  const name = ($("result-name") as HTMLInputElement).value.trim();
  if (!validateName(name)) {
    $("result-name-err").hidden = false;
    $("result-name-err").textContent = "Tên 3–12 ký tự (chữ, số, _).";
    return;
  }
  persistScore({
    name,
    score: totalScore,
    nights_won: nightsWon,
    achieved_at: new Date().toISOString(),
    seed: lastRunSeed,
  });
  $("result-name-err").hidden = true;
  showA11y("Đã lưu bảng xếp hạng");
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
$("set-cb").onchange = (e) => {
  settings.colorblind = (e.target as HTMLInputElement).checked;
  saveSettings(settings);
};
$("set-reduce-motion").onchange = (e) => {
  settings.reduceMotion = (e.target as HTMLInputElement).checked;
  saveSettings(settings);
  applyA11yClasses();
};
$("set-large-text").onchange = (e) => {
  settings.largeText = (e.target as HTMLInputElement).checked;
  saveSettings(settings);
  applyA11yClasses();
};

const GAME_KEYS = new Set([
  "KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
  "Space", "KeyE", "KeyF", "KeyR", "ShiftLeft", "ShiftRight", "Escape", "KeyP",
]);
window.addEventListener("keydown", (e) => {
  if (ui === "settings" && captureAction) {
    keyBindings = { ...keyBindings, [captureAction]: e.code };
    const dup = duplicateKeyMessage(keyBindings);
    if (!dup) saveKeys(keyBindings);
    captureAction = null;
    paintKeyBindings();
    e.preventDefault();
    return;
  }
  if (GAME_KEYS.has(e.code) || Object.values(keyBindings).includes(e.code)) e.preventDefault();
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
clouds = buildStage(1, stage);
paintPicks();
paintNightPicks();
resize();
setUi("menu");
requestAnimationFrame(frame);
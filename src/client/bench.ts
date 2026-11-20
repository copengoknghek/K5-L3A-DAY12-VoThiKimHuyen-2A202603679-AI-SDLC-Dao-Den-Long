import * as THREE from "three";
import contract from "../../game.contract.json";
import { buildBenchJson } from "../bench/metrics.js";
import { buildBenchScenario } from "../sim/bench-scenario.js";
import { TICK_DT } from "../sim/constants.js";
import { step } from "../sim/step.js";
import { DEFAULT_HELD, type SimState, type Tuning } from "../sim/types.js";
import { createInitialState } from "../sim/world.js";
import { buildSilkLantern, applyLanternLit, createStarMote, type SilkLantern } from "./props.js";
import { visualGroundY } from "./scenery.js";
import { buildStage } from "./stage.js";

declare global {
  interface Window {
    __BENCH_RESULT__?: ReturnType<typeof buildBenchJson>;
    __BENCH_READY__?: boolean;
  }
}

const tuning = contract.tuning as Tuning;
const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? "42");
const durationS = Number(params.get("duration") ?? "30");

const tBoot = performance.now();
const canvas = document.getElementById("game") as HTMLCanvasElement;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setSize(1280, 720, false);
renderer.setPixelRatio(1);
renderer.setClearColor(0x24366e, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x4a5d90, 52, 190);
scene.background = new THREE.Color(0x2a3d72);
const camera = new THREE.PerspectiveCamera(55, 1280 / 720, 0.1, 420);
scene.add(new THREE.HemisphereLight(0xb7c6ee, 0x2f6a44, 0.62));
scene.add(new THREE.AmbientLight(0x7d8ebd, 0.22));
const moon = new THREE.DirectionalLight(0xd5def8, 0.55);
moon.position.set(-18, 50, 22);
scene.add(moon);

const stage = new THREE.Group();
scene.add(stage);
const scenario = buildBenchScenario(seed);
let state: SimState = createInitialState({ seed, scenario, tuning, night: 1 });
const held = { ...DEFAULT_HELD };
const prevHeld = { ...DEFAULT_HELD };
buildStage(1, stage);

const moteMeshes = new Map<string, THREE.Group>();
const shadeMeshes = new Map<string, THREE.Mesh>();
const lanternMeshes = new Map<string, SilkLantern>();

for (const lan of state.lanterns) {
  const view = buildSilkLantern();
  applyLanternLit(view, lan.lit);
  view.group.position.set(lan.pos[0], lan.pos[1], lan.pos[2]);
  scene.add(view.group);
  lanternMeshes.set(lan.id, view);
}

function syncVisual(t: number): void {
  for (const sh of state.shades) {
    let mesh = shadeMeshes.get(sh.id);
    if (!mesh) {
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0x120a1a, emissive: 0x7a3cff, emissiveIntensity: 0.5 }),
      );
      scene.add(mesh);
      shadeMeshes.set(sh.id, mesh);
    }
    const gy = visualGroundY(sh.pos[0], sh.pos[2], sh.pos[1], 1);
    mesh.position.set(sh.pos[0], sh.pos[1] + gy + 0.5, sh.pos[2]);
  }
  for (const m of state.motes) {
    let mesh = moteMeshes.get(m.id);
    if (!mesh) {
      mesh = createStarMote();
      scene.add(mesh);
      moteMeshes.set(m.id, mesh);
    }
    const gy = visualGroundY(m.pos[0], m.pos[2], m.pos[1], 1);
    mesh.position.set(m.pos[0], m.pos[1] + gy + 0.7, m.pos[2]);
    mesh.lookAt(camera.position);
  }
  for (const lan of state.lanterns) {
    const e = lanternMeshes.get(lan.id);
    if (!e) continue;
    const gy = visualGroundY(lan.pos[0], lan.pos[2], lan.pos[1], 1);
    e.group.position.set(lan.pos[0], lan.pos[1] + gy, lan.pos[2]);
    applyLanternLit(e, lan.lit, t, lan.fuelSixtieths);
  }
  const lit = state.lanterns.filter((l) => l.lit).length;
  const amb = lit / Math.max(1, state.lanterns.length);
  moon.intensity = 0.55 + 0.2 * amb;
}

let simAccum = 0;
let loadMs = 0;
let firstFrame = true;
const frameMs: number[] = [];
let measureStart = 0;
let measuring = false;
let done = false;
let lastT = performance.now();

function orbitCamera(angleRad: number): void {
  camera.position.set(Math.cos(angleRad) * 30, 15, Math.sin(angleRad) * 30);
  camera.lookAt(0, 0, 0);
}

function frame(now: number): void {
  if (done) return;
  const dt = Math.min(100, now - lastT);
  lastT = now;
  if (firstFrame) {
    loadMs = Math.round(now - tBoot);
    firstFrame = false;
    window.__BENCH_READY__ = true;
  }
  simAccum += dt / 1000;
  while (simAccum >= TICK_DT) {
    step(state, tuning, held, prevHeld);
    simAccum -= TICK_DT;
  }
  const elapsed = (now - measureStart) / 1000;
  orbitCamera((elapsed / 15) * Math.PI * 2);
  syncVisual(now / 1000);
  renderer.render(scene, camera);

  if (!measuring && now - tBoot >= 3000) {
    measuring = true;
    measureStart = now;
    lastT = now;
    frameMs.length = 0;
    requestAnimationFrame(frame);
    return;
  }
  if (measuring) {
    frameMs.push(dt);
    if ((now - measureStart) / 1000 >= durationS) {
      done = true;
      const peakMem =
        (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize != null
          ? Math.round(
              ((performance as Performance & { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize /
                (1024 * 1024)) *
                10,
            ) / 10
          : null;
      window.__BENCH_RESULT__ = buildBenchJson(frameMs, {
        contract_version: "1.3",
        load_ms: loadMs,
        peak_mem_mb: peakMem,
        vsync_off: false,
        renderer: `Three.js WebGLRenderer r${THREE.REVISION}`,
        os: navigator.userAgent,
      });
      return;
    }
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
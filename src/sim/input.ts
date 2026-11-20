import type { HeldInput, InputFrame, InputsFile } from "./types.js";
import { DEFAULT_HELD } from "./types.js";

export class FormatError extends Error {
  readonly exitCode = 2;
}

function validateMove(move: [number, number]): void {
  if (
    move.length !== 2 ||
    typeof move[0] !== "number" ||
    typeof move[1] !== "number" ||
    move[0] < -1 ||
    move[0] > 1 ||
    move[1] < -1 ||
    move[1] > 1
  ) {
    throw new FormatError("Invalid move in inputs: each component must be in [-1, 1]");
  }
}

export function parseInputsFile(json: unknown): InputsFile {
  if (json === null || typeof json !== "object" || !("frames" in json)) {
    throw new FormatError("Invalid inputs: missing frames array");
  }
  const frames = (json as { frames: unknown }).frames;
  if (!Array.isArray(frames)) {
    throw new FormatError("Invalid inputs: frames must be an array");
  }
  let prevTick = -1;
  const parsed: InputFrame[] = [];
  for (const raw of frames) {
    if (raw === null || typeof raw !== "object" || !("tick" in raw)) {
      throw new FormatError("Invalid inputs: frame missing tick");
    }
    const tick = (raw as { tick: unknown }).tick;
    if (typeof tick !== "number" || !Number.isInteger(tick) || tick <= prevTick) {
      throw new FormatError("Invalid inputs: ticks must increase strictly");
    }
    prevTick = tick;
    const frame = raw as InputFrame;
    if (frame.move !== undefined) {
      validateMove(frame.move);
    }
    parsed.push(frame);
  }
  return { frames: parsed };
}

export function heldAtTick(frames: InputFrame[], tick: number): HeldInput {
  const held: HeldInput = {
    move: [0, 0],
    camYawDeg: 0,
    jump: false,
    interact: false,
    pulse: false,
    dash: false,
    pause: false,
  };
  for (const f of frames) {
    if (f.tick > tick) break;
    if (f.move !== undefined) held.move = [f.move[0], f.move[1]];
    if (f.cam_yaw_deg !== undefined) held.camYawDeg = f.cam_yaw_deg;
    if (f.jump !== undefined) held.jump = f.jump;
    if (f.interact !== undefined) held.interact = f.interact;
    if (f.pulse !== undefined) held.pulse = f.pulse;
    if (f.dash !== undefined) held.dash = f.dash;
    if (f.pause !== undefined) held.pause = f.pause;
  }
  return held;
}

export function prevHeldAtTick(frames: InputFrame[], tick: number): HeldInput {
  if (tick <= 0) return { ...DEFAULT_HELD };
  return heldAtTick(frames, tick - 1);
}

export function edgeActivate(prev: boolean, cur: boolean): boolean {
  return !prev && cur;
}
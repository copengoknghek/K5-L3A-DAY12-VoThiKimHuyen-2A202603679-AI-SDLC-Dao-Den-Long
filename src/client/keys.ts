export interface KeyBindings {
  up: string;
  down: string;
  left: string;
  right: string;
  jump: string;
  dash: string;
  interact: string;
  pulse: string;
  pause: string;
}

export const DEFAULT_KEYS: KeyBindings = {
  up: "KeyW",
  down: "KeyS",
  left: "KeyA",
  right: "KeyD",
  jump: "Space",
  dash: "ShiftLeft",
  interact: "KeyE",
  pulse: "KeyF",
  pause: "Escape",
};

const STORAGE = "ddl-keys-v1";

export function loadKeys(): KeyBindings {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE) || "") as KeyBindings;
    return { ...DEFAULT_KEYS, ...raw };
  } catch {
    return { ...DEFAULT_KEYS };
  }
}

export function saveKeys(keys: KeyBindings): void {
  localStorage.setItem(STORAGE, JSON.stringify(keys));
}

/** Trả về thông báo trùng phím, hoặc null nếu hợp lệ. */
export function duplicateKeyMessage(keys: KeyBindings): string | null {
  const entries = Object.entries(keys);
  const seen = new Map<string, string>();
  for (const [action, code] of entries) {
    const prev = seen.get(code);
    if (prev) return `Phím ${code} trùng giữa «${prev}» và «${action}».`;
    seen.set(code, action);
  }
  return null;
}
import type {
  ActiveWorkout,
  AppDocument,
  Session,
  SoundId,
  Unit,
  WorkoutItem,
} from "./types";
import { DEFAULT_DOC, SOUND_OPTIONS } from "./types";
import { clamp } from "./utils";

export const STORAGE_KEY = "daily-workout-planner-v2";

const SOUND_IDS = new Set(SOUND_OPTIONS.map((s) => s.id));

export type StorageStatus = "ok" | "unavailable" | "corrupt";

function isUnit(v: unknown): v is Unit {
  return v === "lb" || v === "kg";
}

function isSound(v: unknown): v is SoundId {
  return typeof v === "string" && SOUND_IDS.has(v as SoundId);
}

function isWorkoutItem(v: unknown): v is WorkoutItem {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (typeof o.name !== "string") return false;
  if (typeof o.sets !== "number" || o.sets < 1 || o.sets > 8) return false;
  if (typeof o.weighted !== "boolean") return false;
  if (!Array.isArray(o.done) || o.done.length !== o.sets) return false;
  if (!Array.isArray(o.weights) || o.weights.length !== o.sets) return false;
  if (!(o.link === null || typeof o.link === "string")) return false;
  return true;
}

function isActive(v: unknown): v is ActiveWorkout {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.date === "string" &&
    typeof o.bodyPart === "string" &&
    Array.isArray(o.items) &&
    o.items.every(isWorkoutItem)
  );
}

function isSession(v: unknown): v is Session {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== "string") return false;
  if (typeof o.date !== "string") return false;
  if (typeof o.bodyPart !== "string") return false;
  if (!Array.isArray(o.exercises)) return false;
  return o.exercises.every((ex) => {
    if (!ex || typeof ex !== "object") return false;
    const e = ex as Record<string, unknown>;
    return (
      typeof e.name === "string" &&
      typeof e.sets === "number" &&
      typeof e.setsDone === "number"
    );
  });
}

/** Migrate v1 (setsDone count) → v2 (per-set arrays). */
function migrateV1(raw: Record<string, unknown>): AppDocument | null {
  const sessions = Array.isArray(raw.sessions)
    ? raw.sessions.filter(isSession)
    : [];
  let active: ActiveWorkout | null = null;
  if (raw.active && typeof raw.active === "object") {
    const a = raw.active as Record<string, unknown>;
    if (
      typeof a.id === "string" &&
      typeof a.date === "string" &&
      typeof a.bodyPart === "string" &&
      Array.isArray(a.items)
    ) {
      const items: WorkoutItem[] = [];
      for (const item of a.items) {
        if (!item || typeof item !== "object") continue;
        const it = item as Record<string, unknown>;
        if (typeof it.name !== "string") continue;
        const sets =
          typeof it.sets === "number" ? clamp(it.sets, 1, 8) : 3;
        const setsDone =
          typeof it.setsDone === "number"
            ? clamp(it.setsDone, 0, sets)
            : 0;
        const weighted = typeof it.weighted === "boolean" ? it.weighted : true;
        const done = Array.from({ length: sets }, (_, i) => i < setsDone);
        let weights: (number | null)[] = Array(sets).fill(null);
        if (Array.isArray(it.weights)) {
          const rawWeights = it.weights as unknown[];
          weights = Array.from({ length: sets }, (_, i) => {
            const w = rawWeights[i];
            return typeof w === "number" ? w : null;
          });
        }
        items.push({
          name: it.name,
          link: typeof it.link === "string" ? it.link : null,
          sets,
          done,
          weights,
          weighted,
        });
      }
      active = {
        id: a.id,
        date: a.date,
        bodyPart: a.bodyPart,
        items,
      };
    }
  }

  return {
    version: 2,
    active,
    sessions,
    unit: isUnit(raw.unit) ? raw.unit : "lb",
    timerSec:
      typeof raw.timerSec === "number"
        ? clamp(Math.round(raw.timerSec), 5, 3600)
        : 60,
    sound: isSound(raw.sound) ? raw.sound : "alarm",
  };
}

export function validateDocument(raw: unknown): AppDocument | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  if (o.version === 1) {
    return migrateV1(o);
  }

  if (o.version !== 2) return null;
  if (!(o.active === null || isActive(o.active))) return null;
  if (!Array.isArray(o.sessions) || !o.sessions.every(isSession)) return null;

  return {
    version: 2,
    active: o.active,
    sessions: o.sessions,
    unit: isUnit(o.unit) ? o.unit : "lb",
    timerSec:
      typeof o.timerSec === "number"
        ? clamp(Math.round(o.timerSec), 5, 3600)
        : 60,
    sound: isSound(o.sound) ? o.sound : "alarm",
  };
}

export function readDocument(): {
  doc: AppDocument;
  status: StorageStatus;
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return { doc: structuredClone(DEFAULT_DOC), status: "ok" };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { doc: structuredClone(DEFAULT_DOC), status: "corrupt" };
    }
    const doc = validateDocument(parsed);
    if (!doc) {
      return { doc: structuredClone(DEFAULT_DOC), status: "corrupt" };
    }
    return { doc, status: "ok" };
  } catch {
    return { doc: structuredClone(DEFAULT_DOC), status: "unavailable" };
  }
}

/**
 * Re-read storage, apply mutator to fresh copy, write back.
 * Leaves corrupt documents untouched.
 */
export function updateDocument(
  mutator: (doc: AppDocument) => AppDocument,
): { doc: AppDocument; status: StorageStatus } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let base: AppDocument;
    if (raw === null) {
      base = structuredClone(DEFAULT_DOC);
    } else {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return { doc: structuredClone(DEFAULT_DOC), status: "corrupt" };
      }
      const validated = validateDocument(parsed);
      if (!validated) {
        return { doc: structuredClone(DEFAULT_DOC), status: "corrupt" };
      }
      base = validated;
    }
    const next = mutator(structuredClone(base));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return { doc: next, status: "ok" };
  } catch {
    return { doc: structuredClone(DEFAULT_DOC), status: "unavailable" };
  }
}

export function writeDocument(doc: AppDocument): StorageStatus {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
    return "ok";
  } catch {
    return "unavailable";
  }
}

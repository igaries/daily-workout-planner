import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type {
  ActiveWorkout,
  AppDocument,
  Session,
  SoundId,
  Unit,
  WorkoutItem,
} from "../lib/types";
import {
  readDocument,
  updateDocument,
  type StorageStatus,
  STORAGE_KEY,
} from "../lib/storage";
import { compactWeights, suggestedWeight, weightForNewSet } from "../lib/weights";
import {
  generateRoutine,
  shuffleAllExercises,
  swapExercise,
} from "../lib/routine";
import { clamp } from "../lib/utils";

type Listener = () => void;
const listeners = new Set<Listener>();
let cache: { doc: AppDocument; status: StorageStatus } = readDocument();

function emit() {
  for (const l of listeners) l();
}

function apply(mutator: (doc: AppDocument) => AppDocument) {
  cache = updateDocument(mutator);
  emit();
  return cache;
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot() {
  return cache;
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY || e.key === null) {
      cache = readDocument();
      emit();
    }
  });
}

export function useAppStore() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const { doc, status } = snap;

  const setUnit = useCallback((unit: Unit) => {
    apply((d) => ({ ...d, unit }));
  }, []);

  const setTimerSec = useCallback((timerSec: number) => {
    apply((d) => ({
      ...d,
      timerSec: clamp(Math.round(timerSec), 5, 3600),
    }));
  }, []);

  const setSound = useCallback((sound: SoundId) => {
    apply((d) => ({ ...d, sound }));
  }, []);

  const startWorkout = useCallback(
    (bodyPart: string, size: 4 | 5 | 6) => {
      apply((d) => ({
        ...d,
        active: generateRoutine(bodyPart, size, d.sessions),
      }));
    },
    [],
  );

  const discardWorkout = useCallback(() => {
    apply((d) => ({ ...d, active: null }));
  }, []);

  const finishWorkout = useCallback((): "saved" | "empty" => {
    const active = cache.doc.active;
    if (!active) return "empty";
    const anyDone = active.items.some((it) => it.done.some(Boolean));
    if (!anyDone) return "empty";

    apply((d) => {
      if (!d.active) return d;
      const session: Session = {
        id: d.active.id,
        date: d.active.date,
        bodyPart: d.active.bodyPart,
        exercises: d.active.items.map((it) => {
          const setsDone = it.done.filter(Boolean).length;
          const base = {
            name: it.name,
            sets: it.sets,
            setsDone,
          };
          if (!it.weighted) return base;
          return {
            ...base,
            weights: compactWeights(it.done, it.weights, setsDone),
          };
        }),
      };
      return {
        ...d,
        active: null,
        sessions: [session, ...d.sessions],
      };
    });
    return "saved";
  }, []);

  const updateActive = useCallback(
    (mutator: (a: ActiveWorkout) => ActiveWorkout) => {
      apply((d) => {
        if (!d.active) return d;
        return { ...d, active: mutator(d.active) };
      });
    },
    [],
  );

  const toggleSet = useCallback(
    (itemIndex: number, setIndex: number) => {
      apply((d) => {
        if (!d.active) return d;
        const items = d.active.items.map((it, i) => {
          if (i !== itemIndex) return it;
          const done = [...it.done];
          const weights = [...it.weights];
          const next = !done[setIndex];
          done[setIndex] = next;
          if (next && it.weighted && weights[setIndex] == null) {
            weights[setIndex] = suggestedWeight(it, setIndex, d.sessions);
          }
          return { ...it, done, weights };
        });
        return { ...d, active: { ...d.active, items } };
      });
    },
    [],
  );

  const setWeight = useCallback(
    (itemIndex: number, setIndex: number, weight: number | null) => {
      updateActive((a) => {
        const items = a.items.map((it, i) => {
          if (i !== itemIndex) return it;
          const weights = [...it.weights];
          weights[setIndex] = weight;
          return { ...it, weights };
        });
        return { ...a, items };
      });
    },
    [updateActive],
  );

  const markExerciseDone = useCallback(
    (itemIndex: number) => {
      apply((d) => {
        if (!d.active) return d;
        const items = d.active.items.map((it, i) => {
          if (i !== itemIndex) return it;
          const done = it.done.map(() => true);
          const weights = [...it.weights];
          if (it.weighted) {
            for (let s = 0; s < weights.length; s++) {
              if (weights[s] == null) {
                weights[s] = suggestedWeight(
                  { ...it, done, weights },
                  s,
                  d.sessions,
                );
              }
            }
          }
          return { ...it, done, weights };
        });
        return { ...d, active: { ...d.active, items } };
      });
    },
    [],
  );

  const changeSets = useCallback(
    (itemIndex: number, delta: number) => {
      updateActive((a) => {
        const items = a.items.map((it, i) => {
          if (i !== itemIndex) return it;
          const sets = clamp(it.sets + delta, 1, 8);
          if (sets === it.sets) return it;
          if (sets > it.sets) {
            const add = sets - it.sets;
            const inherit = it.weighted ? weightForNewSet(it) : null;
            return {
              ...it,
              sets,
              done: [...it.done, ...Array(add).fill(false)],
              weights: [
                ...it.weights,
                ...Array(add).fill(it.weighted ? inherit : null),
              ],
            };
          }
          return {
            ...it,
            sets,
            done: it.done.slice(0, sets),
            weights: it.weights.slice(0, sets),
          };
        });
        return { ...a, items };
      });
    },
    [updateActive],
  );

  const swap = useCallback((itemIndex: number): WorkoutItem | null => {
    const active = cache.doc.active;
    if (!active) return null;
    const next = swapExercise(active, itemIndex, cache.doc.sessions);
    if (!next) return null;
    apply((d) => {
      if (!d.active) return d;
      const items = d.active.items.map((it, i) =>
        i === itemIndex ? next : it,
      );
      return { ...d, active: { ...d.active, items } };
    });
    return next;
  }, []);

  const shuffleAll = useCallback(() => {
    const active = cache.doc.active;
    if (!active) return null;
    const result = shuffleAllExercises(active, cache.doc.sessions);
    apply((d) => {
      if (!d.active) return d;
      return { ...d, active: { ...d.active, items: result.items } };
    });
    return result;
  }, []);

  const deleteSession = useCallback((id: string) => {
    apply((d) => ({
      ...d,
      sessions: d.sessions.filter((s) => s.id !== id),
    }));
  }, []);

  const mergeSessions = useCallback((incoming: Session[]) => {
    apply((d) => {
      const ids = new Set(d.sessions.map((s) => s.id));
      const fresh = incoming.filter((s) => !ids.has(s.id));
      const sessions = [...d.sessions, ...fresh].sort((a, b) =>
        a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
      );
      return { ...d, sessions };
    });
  }, []);

  const replaceActive = useCallback((active: ActiveWorkout | null) => {
    apply((d) => ({ ...d, active }));
  }, []);

  return {
    doc,
    status,
    setUnit,
    setTimerSec,
    setSound,
    startWorkout,
    discardWorkout,
    finishWorkout,
    toggleSet,
    setWeight,
    markExerciseDone,
    changeSets,
    swap,
    shuffleAll,
    deleteSession,
    mergeSessions,
    replaceActive,
  };
}

export function useLiveRegion() {
  const [message, setMessage] = useState("");
  const announce = useCallback((msg: string) => {
    setMessage("");
    requestAnimationFrame(() => setMessage(msg));
  }, []);
  const region = useMemo(
    () => ({
      message,
      announce,
    }),
    [message, announce],
  );
  return region;
}

export function useRoutineSize() {
  const [size, setSize] = useState<4 | 5 | 6>(() => {
    try {
      const v = localStorage.getItem("dwp-routine-size");
      if (v === "4" || v === "5" || v === "6") return Number(v) as 4 | 5 | 6;
    } catch {
      /* ignore */
    }
    return 5;
  });
  useEffect(() => {
    try {
      localStorage.setItem("dwp-routine-size", String(size));
    } catch {
      /* ignore */
    }
  }, [size]);
  return [size, setSize] as const;
}

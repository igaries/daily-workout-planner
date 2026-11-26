import {
  exercisesFor,
  findExercise,
  isLightBodyPart,
} from "../data/catalog";
import type {
  ActiveWorkout,
  CatalogExercise,
  Session,
  WorkoutItem,
} from "./types";
import { todayKey } from "./dates";
import { shuffle, uid } from "./utils";
import { startingWeight } from "./weights";

function toItem(
  ex: CatalogExercise,
  sets: number,
  weight: number | null,
): WorkoutItem {
  return {
    name: ex.name,
    link: ex.link,
    sets,
    done: Array.from({ length: sets }, () => false),
    weights: Array.from({ length: sets }, () =>
      ex.weighted ? weight : null,
    ),
    weighted: ex.weighted,
  };
}

export function lastSessionFor(
  sessions: Session[],
  bodyPart: string,
): Session | undefined {
  return sessions.find((s) => s.bodyPart === bodyPart);
}

export function generateRoutine(
  bodyPart: string,
  size: 4 | 5 | 6,
  sessions: Session[],
): ActiveWorkout {
  const pool = exercisesFor(bodyPart);
  const last = lastSessionFor(sessions, bodyPart);
  const recentNames = new Set(last?.exercises.map((e) => e.name) ?? []);

  const light = isLightBodyPart(bodyPart);
  const n = light ? 1 : size;
  const sets = light ? 1 : 3;

  const nonRecent = shuffle(pool.filter((e) => !recentNames.has(e.name)));
  const recent = shuffle(pool.filter((e) => recentNames.has(e.name)));
  const ordered = [...nonRecent, ...recent];
  const picked = ordered.slice(0, Math.min(n, ordered.length));

  const items = picked.map((ex) =>
    toItem(ex, sets, startingWeight(ex.name, sessions)),
  );

  return {
    id: uid(),
    date: todayKey(),
    bodyPart,
    items,
  };
}

export type ShuffleResult = {
  items: WorkoutItem[];
  repeated: number;
  allNew: boolean;
};

export function shuffleAllExercises(
  active: ActiveWorkout,
  sessions: Session[],
): ShuffleResult {
  const pool = exercisesFor(active.bodyPart);
  const count = active.items.length;
  const setsByIndex = active.items.map((i) => i.sets);
  const currentNames = new Set(active.items.map((i) => i.name));
  const last = lastSessionFor(sessions, active.bodyPart);
  const lastNames = new Set(last?.exercises.map((e) => e.name) ?? []);

  const neither = shuffle(
    pool.filter((e) => !currentNames.has(e.name) && !lastNames.has(e.name)),
  );
  const fromLast = shuffle(
    pool.filter((e) => lastNames.has(e.name) && !currentNames.has(e.name)),
  );
  const current = shuffle(pool.filter((e) => currentNames.has(e.name)));

  const ordered = [...neither, ...fromLast, ...current];
  const picked = ordered.slice(0, Math.min(count, ordered.length));

  const items = picked.map((ex, i) => {
    const sets = setsByIndex[i] ?? (isLightBodyPart(active.bodyPart) ? 1 : 3);
    return toItem(ex, sets, startingWeight(ex.name, sessions));
  });

  const repeated = items.filter((it) => currentNames.has(it.name)).length;
  return {
    items,
    repeated,
    allNew: repeated === 0,
  };
}

export function swapExercise(
  active: ActiveWorkout,
  index: number,
  sessions: Session[],
): WorkoutItem | null {
  const current = active.items[index];
  if (!current) return null;
  const inRoutine = new Set(active.items.map((i) => i.name));
  const candidates = exercisesFor(active.bodyPart).filter(
    (e) => !inRoutine.has(e.name),
  );
  if (candidates.length === 0) return null;
  const pick = candidates[Math.floor(Math.random() * candidates.length)]!;
  return toItem(
    pick,
    current.sets,
    startingWeight(pick.name, sessions),
  );
}

export function catalogOrFallback(
  name: string,
  weighted: boolean,
  link: string | null,
): CatalogExercise {
  return (
    findExercise(name) ?? {
      name,
      bodyParts: [],
      link,
      weighted,
    }
  );
}

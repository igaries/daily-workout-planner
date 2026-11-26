import type { Session, WorkoutItem } from "./types";

/** Heaviest weight logged for this exercise in its most recent session that has any weight. */
export function startingWeight(
  exerciseName: string,
  sessions: Session[],
): number | null {
  for (const session of sessions) {
    const ex = session.exercises.find((e) => e.name === exerciseName);
    if (!ex?.weights) continue;
    const nums = ex.weights.filter((w): w is number => typeof w === "number");
    if (nums.length === 0) continue;
    return Math.max(...nums);
  }
  return null;
}

export function lastSessionHint(
  exerciseName: string,
  sessions: Session[],
): { weight: number; date: string } | null {
  for (const session of sessions) {
    const ex = session.exercises.find((e) => e.name === exerciseName);
    if (!ex?.weights) continue;
    const nums = ex.weights.filter((w): w is number => typeof w === "number");
    if (nums.length === 0) continue;
    return { weight: Math.max(...nums), date: session.date };
  }
  return null;
}

/** Suggested weight when marking an empty set done. */
export function suggestedWeight(
  item: WorkoutItem,
  setIndex: number,
  sessions: Session[],
): number | null {
  for (let i = setIndex - 1; i >= 0; i--) {
    const w = item.weights[i];
    if (typeof w === "number") return w;
  }
  return startingWeight(item.name, sessions);
}

/** New set inherits weight of the last set that has one. */
export function weightForNewSet(item: WorkoutItem): number | null {
  for (let i = item.weights.length - 1; i >= 0; i--) {
    const w = item.weights[i];
    if (typeof w === "number") return w;
  }
  return null;
}

/**
 * Compact weights so completed-set weights come first,
 * remaining entries null — aligned with setsDone.
 */
export function compactWeights(
  done: boolean[],
  weights: (number | null)[],
  setsDone: number,
): (number | null)[] {
  const completed: (number | null)[] = [];
  for (let i = 0; i < done.length; i++) {
    if (done[i]) completed.push(weights[i] ?? null);
  }
  const result: (number | null)[] = Array(weights.length).fill(null);
  for (let i = 0; i < setsDone; i++) {
    result[i] = completed[i] ?? null;
  }
  return result;
}

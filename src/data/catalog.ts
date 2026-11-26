import catalogRaw from "./catalog-raw.json";
import { BODYWEIGHT_EXERCISES } from "./bodyweight";
import type { CatalogExercise } from "../lib/types";

export const BODY_PART_ORDER = [
  "Chest",
  "Back",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Legs",
  "Glutes",
  "Calves",
  "Abs",
  "Forearm Flexors",
  "Forearm Extensor",
  "Cardio",
  "Rest",
] as const;

export type BodyPart = (typeof BODY_PART_ORDER)[number];

export const LIGHT_BODY_PARTS = new Set<string>(["Cardio", "Rest"]);

function normalizeLink(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function isWeighted(name: string, bodyParts: string[]): boolean {
  if (bodyParts.some((p) => LIGHT_BODY_PARTS.has(p))) return false;
  return !BODYWEIGHT_EXERCISES.has(name.toLowerCase().trim());
}

const rows = catalogRaw as {
  Exercise: string;
  "Body Part": string;
  Link: string;
}[];

const byPart = new Map<string, CatalogExercise[]>();

for (const row of rows) {
  const name = row.Exercise.trim();
  const parts = row["Body Part"]
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const link = normalizeLink(row.Link);
  const weighted = isWeighted(name, parts);
  const exercise: CatalogExercise = { name, bodyParts: parts, link, weighted };

  for (const part of parts) {
    const list = byPart.get(part) ?? [];
    if (!list.some((e) => e.name === name)) {
      list.push(exercise);
      byPart.set(part, list);
    }
  }
}

/** Unknown parts appended alphabetically after known order. */
export function orderedBodyParts(): string[] {
  const known = new Set<string>(BODY_PART_ORDER);
  const extras = [...byPart.keys()]
    .filter((p) => !known.has(p))
    .sort((a, b) => a.localeCompare(b));
  return [...BODY_PART_ORDER.filter((p) => byPart.has(p)), ...extras];
}

export function exercisesFor(bodyPart: string): CatalogExercise[] {
  return byPart.get(bodyPart) ?? [];
}

export function findExercise(name: string): CatalogExercise | undefined {
  for (const list of byPart.values()) {
    const hit = list.find((e) => e.name === name);
    if (hit) return hit;
  }
  return undefined;
}

export function isLightBodyPart(bodyPart: string): boolean {
  return LIGHT_BODY_PARTS.has(bodyPart);
}

export const CATALOG_COUNT = rows.length;

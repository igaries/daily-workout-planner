export type Unit = "lb" | "kg";

export type SoundId =
  | "alarm"
  | "airhorn"
  | "siren"
  | "whistle"
  | "bell"
  | "buzzer"
  | "triple";

export interface CatalogExercise {
  name: string;
  bodyParts: string[];
  link: string | null;
  weighted: boolean;
}

export interface WorkoutItem {
  name: string;
  link: string | null;
  sets: number;
  done: boolean[];
  weights: (number | null)[];
  weighted: boolean;
}

export interface ActiveWorkout {
  id: string;
  date: string;
  bodyPart: string;
  items: WorkoutItem[];
}

export interface SessionExercise {
  name: string;
  sets: number;
  setsDone: number;
  weights?: (number | null)[];
}

export interface Session {
  id: string;
  date: string;
  bodyPart: string;
  exercises: SessionExercise[];
}

export interface AppDocument {
  version: 2;
  active: ActiveWorkout | null;
  sessions: Session[];
  unit: Unit;
  timerSec: number;
  sound: SoundId;
}

export type TabId = "workout" | "timer" | "progress";

export const SOUND_OPTIONS: { id: SoundId; label: string }[] = [
  { id: "alarm", label: "Alarm clock" },
  { id: "airhorn", label: "Air horn" },
  { id: "siren", label: "Siren" },
  { id: "whistle", label: "Coach whistle" },
  { id: "bell", label: "Boxing bell" },
  { id: "buzzer", label: "Gym buzzer" },
  { id: "triple", label: "Triple beep" },
];

export const DEFAULT_DOC: AppDocument = {
  version: 2,
  active: null,
  sessions: [],
  unit: "lb",
  timerSec: 60,
  sound: "alarm",
};

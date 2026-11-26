import type { Session, SessionExercise, Unit } from "./types";
import { uid } from "./utils";

async function xlsx() {
  return import("xlsx");
}

const SHEET_NAME = "Workout Log";
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 50_000;
const LB_TO_KG = 0.45359237;

const HEADERS = [
  "Workout ID",
  "Date",
  "Body Part",
  "Exercise",
  "Set",
  "Weight",
  "Unit",
  "Done",
] as const;

function excelSerialFromDateKey(dateKey: string): number {
  // Interpret yyyy-MM-dd as UTC midnight to avoid timezone shift
  const [y, m, d] = dateKey.split("-").map(Number);
  const utc = Date.UTC(y!, m! - 1, d!);
  // Excel serial: days since 1899-12-30
  return utc / 86_400_000 + 25569;
}

function parseExcelDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const utc = (value - 25569) * 86_400_000;
    const d = new Date(utc);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  const s = String(value).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (us) {
    const m = us[1]!.padStart(2, "0");
    const d = us[2]!.padStart(2, "0");
    return `${us[3]}-${m}-${d}`;
  }
  return null;
}

function isDone(value: unknown): boolean {
  if (value == null || value === "") return false;
  const s = String(value).trim().toLowerCase();
  return ["yes", "y", "true", "1", "done", "x"].includes(s);
}

function parseWeight(
  value: unknown,
  unitCell: unknown,
  appUnit: Unit,
): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n) || n < 0 || n > 2000) return null;
  const u = String(unitCell ?? "")
    .trim()
    .toLowerCase();
  let converted = n;
  if (u === "kg" || u === "lb") {
    if (u !== appUnit) {
      converted =
        appUnit === "lb" ? n / LB_TO_KG : n * LB_TO_KG;
    }
  }
  return Math.round(converted * 10) / 10;
}

/** Export with unit column filled for weighted rows. */
export async function exportSessionsWithUnit(
  sessions: Session[],
  unit: Unit,
): Promise<Blob> {
  const XLSX = await xlsx();
  const rows: (string | number | null)[][] = [];
  rows.push(["Daily Workout Planner — Workout Log"]);
  rows.push([...HEADERS]);

  const oldestFirst = [...sessions].reverse();
  for (const session of oldestFirst) {
    for (const ex of session.exercises) {
      for (let set = 1; set <= ex.sets; set++) {
        const done = set <= ex.setsDone;
        const w =
          ex.weights && typeof ex.weights[set - 1] === "number"
            ? (ex.weights[set - 1] as number)
            : null;
        rows.push([
          session.id,
          excelSerialFromDateKey(session.date),
          session.bodyPart,
          ex.name,
          set,
          w,
          w != null ? unit : null,
          done ? "Yes" : "No",
        ]);
      }
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  for (let r = 2; r <= range.e.r; r++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: 1 })];
    if (cell && typeof cell.v === "number") {
      cell.t = "n";
      cell.z = "yyyy-mm-dd";
    }
    const weightCell = ws[XLSX.utils.encode_cell({ r, c: 5 })];
    if (weightCell && typeof weightCell.v === "number") {
      weightCell.z = "0.0";
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME);
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export async function shareOrDownload(
  blob: Blob,
  filename: string,
): Promise<"shared" | "downloaded"> {
  const file = new File([blob], filename, {
    type: blob.type,
  });
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[]; title?: string }) => Promise<void>;
  };
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: filename });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "shared";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return "downloaded";
}

export type ImportResult = {
  added: Session[];
  skippedExisting: number;
  skippedRows: number;
};

function normalizeHeader(h: unknown): string {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export async function importWorkbook(
  file: File,
  existing: Session[],
  appUnit: Unit,
): Promise<ImportResult> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("File is larger than 5 MB.");
  }
  const XLSX = await xlsx();
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const sheetName =
    wb.SheetNames.includes(SHEET_NAME) ? SHEET_NAME : wb.SheetNames[0];
  if (!sheetName) throw new Error("Workbook has no sheets.");
  const sheet = wb.Sheets[sheetName]!;
  const aoa = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  let headerIdx = -1;
  for (let i = 0; i < Math.min(10, aoa.length); i++) {
    const row = aoa[i] ?? [];
    const norms = row.map(normalizeHeader);
    if (norms.includes("workout id")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) throw new Error('Could not find a "Workout ID" header row.');

  const headerRow = aoa[headerIdx] ?? [];
  const col: Record<string, number> = {};
  headerRow.forEach((h, i) => {
    const n = normalizeHeader(h);
    if (n) col[n] = i;
  });

  const need = ["workout id", "date", "body part", "exercise"];
  for (const k of need) {
    if (col[k] == null) throw new Error(`Missing required column: ${k}`);
  }

  const hasDone = col["done"] != null;
  const existingIds = new Set(existing.map((s) => s.id));
  let skippedRows = 0;
  let skippedExisting = 0;

  type SetRow = {
    set: number;
    weight: number | null;
    done: boolean;
  };
  type ExGroup = { name: string; sets: Map<number, SetRow> };
  type WGroup = {
    id: string;
    date: string;
    bodyPart: string;
    exercises: Map<string, ExGroup>;
  };

  const workouts = new Map<string, WGroup>();
  const dataRows = aoa.slice(headerIdx + 1, headerIdx + 1 + MAX_ROWS);

  for (const row of dataRows) {
    if (!row || row.every((c) => c == null || c === "")) continue;
    const get = (key: string) =>
      col[key] != null ? row[col[key]!] : undefined;

    const id = String(get("workout id") ?? "").trim();
    const date = parseExcelDate(get("date"));
    const bodyPart = String(get("body part") ?? "").trim();
    const exercise = String(get("exercise") ?? "").trim();
    if (!id || !date || !bodyPart || !exercise) {
      skippedRows++;
      continue;
    }

    const setRaw = get("set");
    const setNum =
      typeof setRaw === "number"
        ? Math.round(setRaw)
        : Number(String(setRaw ?? "1").trim()) || 1;

    const weight = parseWeight(get("weight"), get("unit"), appUnit);
    const done = hasDone ? isDone(get("done")) : true;

    let w = workouts.get(id);
    if (!w) {
      w = { id, date, bodyPart, exercises: new Map() };
      workouts.set(id, w);
    }
    let ex = w.exercises.get(exercise);
    if (!ex) {
      ex = { name: exercise, sets: new Map() };
      w.exercises.set(exercise, ex);
    }
    ex.sets.set(setNum, { set: setNum, weight, done });
  }

  const added: Session[] = [];
  for (const w of workouts.values()) {
    if (existingIds.has(w.id)) {
      skippedExisting++;
      continue;
    }
    const exercises: SessionExercise[] = [];
    for (const ex of w.exercises.values()) {
      const setNums = [...ex.sets.keys()].sort((a, b) => a - b);
      const maxSet = setNums.length ? Math.max(...setNums) : 1;
      const sets = Math.min(8, Math.max(1, maxSet));
      let setsDone = 0;
      const weights: (number | null)[] = Array(sets).fill(null);
      const doneFlags: boolean[] = Array(sets).fill(false);
      for (let i = 1; i <= sets; i++) {
        const sr = ex.sets.get(i);
        if (sr?.done) {
          doneFlags[i - 1] = true;
          weights[i - 1] = sr.weight;
        }
      }
      setsDone = doneFlags.filter(Boolean).length;
      // Compact: completed weights first
      const completedWeights = weights.filter((_, i) => doneFlags[i]);
      const compacted: (number | null)[] = Array(sets).fill(null);
      for (let i = 0; i < setsDone; i++) {
        compacted[i] = completedWeights[i] ?? null;
      }
      const hasAnyWeight = compacted.some((w) => typeof w === "number");
      exercises.push({
        name: ex.name,
        sets,
        setsDone,
        ...(hasAnyWeight ? { weights: compacted } : {}),
      });
    }
    added.push({
      id: w.id || uid(),
      date: w.date,
      bodyPart: w.bodyPart,
      exercises,
    });
  }

  return { added, skippedExisting, skippedRows };
}

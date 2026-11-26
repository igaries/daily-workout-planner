import { differenceInCalendarDays, isToday, parseISO } from "date-fns";
import { Trash2, Download, Upload } from "lucide-react";
import { useMemo, useRef } from "react";
import type { Session, Unit } from "../../lib/types";
import {
  formatDateKey,
  formatDisplayDate,
  formatLongDate,
  last12WeeksDays,
  todayKey,
} from "../../lib/dates";
import { cn } from "../../lib/utils";
import { Button } from "../ui/Button";

type Props = {
  sessions: Session[];
  unit: Unit;
  onDelete: (id: string) => void;
  onExport: () => void;
  onImport: (file: File) => void;
};

function computeStreak(dates: Set<string>): number {
  if (dates.size === 0) return 0;
  const today = todayKey();
  let cursor = today;
  if (!dates.has(today)) {
    const y = parseISO(today);
    y.setDate(y.getDate() - 1);
    cursor = formatDateKey(y);
    if (!dates.has(cursor)) return 0;
  }
  let streak = 0;
  while (dates.has(cursor)) {
    streak++;
    const d = parseISO(cursor);
    d.setDate(d.getDate() - 1);
    cursor = formatDateKey(d);
  }
  return streak;
}

export function ProgressView({
  sessions,
  unit,
  onDelete,
  onExport,
  onImport,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const workoutDates = useMemo(
    () => new Set(sessions.map((s) => s.date)),
    [sessions],
  );

  const streak = computeStreak(workoutDates);

  const last30 = useMemo(() => {
    const now = new Date();
    return sessions.filter((s) => {
      const days = differenceInCalendarDays(now, parseISO(s.date));
      return days >= 0 && days < 30;
    }).length;
  }, [sessions]);

  const byPart = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sessions) {
      map.set(s.bodyPart, (map.get(s.bodyPart) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [sessions]);

  const maxPart = byPart[0]?.[1] ?? 1;
  const calendarDays = last12WeeksDays();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Progress
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Streaks, history, and Excel sync across devices.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Day streak", value: streak },
          { label: "Last 30 days", value: last30 },
          { label: "All workouts", value: sessions.length },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-[var(--radius)] border border-border bg-card px-2 py-3 text-center"
          >
            <p className="font-display text-2xl font-bold tabular-nums">
              {stat.value}
            </p>
            <p className="mt-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      <section aria-labelledby="cal-heading">
        <h2 id="cal-heading" className="text-sm font-semibold">
          Last 12 weeks
        </h2>
        <p className="sr-only">
          Calendar of workout days for the last twelve weeks, Monday first.
          Filled cells are days with a workout.
        </p>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <div
              key={`${d}-${i}`}
              className="text-center text-[0.65rem] font-medium text-muted-foreground"
              aria-hidden
            >
              {d}
            </div>
          ))}
          {calendarDays.map((d) => {
            const key = formatDateKey(d);
            const has = workoutDates.has(key);
            const today = isToday(d);
            return (
              <div
                key={key}
                title={key}
                className={cn(
                  "aspect-square rounded-sm",
                  has
                    ? "bg-primary"
                    : today
                      ? "bg-primary/25"
                      : "bg-muted",
                )}
                aria-label={`${key}${has ? ", workout" : ""}`}
              />
            );
          })}
        </div>
      </section>

      <section aria-labelledby="parts-heading">
        <h2 id="parts-heading" className="text-sm font-semibold">
          By body part
        </h2>
        {byPart.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No workouts yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {byPart.map(([part, count]) => (
              <li key={part}>
                <div className="mb-0.5 flex justify-between text-sm">
                  <span className="font-medium">{part}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {count}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(count / maxPart) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="sync-heading">
        <h2 id="sync-heading" className="text-sm font-semibold">
          Sync with Excel
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Export to OneDrive, then import on another device. Duplicate workout
          IDs are skipped.
        </p>
        <div className="mt-3 flex gap-2">
          <Button variant="outline" className="flex-1 gap-1.5" onClick={onExport}>
            <Download className="h-4 w-4" aria-hidden />
            Export
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-1.5"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4" aria-hidden />
            Import
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = "";
            }}
          />
        </div>
      </section>

      <section aria-labelledby="hist-heading">
        <h2 id="hist-heading" className="text-sm font-semibold">
          Workout history
        </h2>
        {sessions.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Finished workouts will show up here.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {sessions.map((s) => {
              const setsDone = s.exercises.reduce(
                (n, e) => n + e.setsDone,
                0,
              );
              return (
                <li
                  key={s.id}
                  className="flex items-start gap-2 rounded-[var(--radius)] border border-border bg-card p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {s.bodyPart}{" "}
                      <span className="font-normal text-muted-foreground">
                        · {formatLongDate(s.date)}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {s.exercises.length} exercise
                      {s.exercises.length === 1 ? "" : "s"} · {setsDone} set
                      {setsDone === 1 ? "" : "s"} done
                      {s.exercises.some((e) => e.weights?.some((w) => w != null))
                        ? ` · ${unit}`
                        : ""}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {s.exercises.map((e) => e.name).join(", ")}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    className="shrink-0 text-destructive"
                    aria-label={`Delete ${s.bodyPart} workout from ${formatDisplayDate(s.date)}`}
                    onClick={() => onDelete(s.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

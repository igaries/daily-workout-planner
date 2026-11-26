import { ExternalLink, Minus, Plus, Shuffle, Repeat } from "lucide-react";
import type { ActiveWorkout as Active, Session, Unit } from "../../lib/types";
import { formatDisplayDate, formatLongDate } from "../../lib/dates";
import { lastSessionHint } from "../../lib/weights";
import { cn } from "../../lib/utils";
import { Button } from "../ui/Button";

type Props = {
  active: Active;
  sessions: Session[];
  unit: Unit;
  onUnit: (u: Unit) => void;
  onToggleSet: (itemIndex: number, setIndex: number) => void;
  onWeight: (itemIndex: number, setIndex: number, w: number | null) => void;
  onMarkExercise: (itemIndex: number) => void;
  onChangeSets: (itemIndex: number, delta: number) => void;
  onSwap: (itemIndex: number) => void;
  onShuffle: () => void;
  onDiscard: () => void;
};

export function ActiveWorkoutView({
  active,
  sessions,
  unit,
  onUnit,
  onToggleSet,
  onWeight,
  onMarkExercise,
  onChangeSets,
  onSwap,
  onShuffle,
  onDiscard,
}: Props) {
  const totalSets = active.items.reduce((n, it) => n + it.sets, 0);
  const doneSets = active.items.reduce(
    (n, it) => n + it.done.filter(Boolean).length,
    0,
  );
  const exercisesDone = active.items.filter((it) =>
    it.done.every(Boolean),
  ).length;
  const pct = totalSets === 0 ? 0 : Math.round((doneSets / totalSets) * 100);
  const hasWeighted = active.items.some((it) => it.weighted);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          {active.bodyPart}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatLongDate(active.date)} · {exercisesDone}/
          {active.items.length} exercises
        </p>
      </div>

      <div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label={`Workout progress ${pct} percent`}
          className="h-2.5 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {doneSets}/{totalSets} sets · {pct}%
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {hasWeighted && (
          <div
            className="flex rounded-[var(--radius)] border border-border"
            role="group"
            aria-label="Weight unit"
          >
            {(["lb", "kg"] as const).map((u) => (
              <button
                key={u}
                type="button"
                aria-pressed={unit === u}
                onClick={() => onUnit(u)}
                className={cn(
                  "min-h-11 min-w-14 px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  unit === u
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {u}
              </button>
            ))}
          </div>
        )}
        <Button variant="outline" onClick={onShuffle} className="gap-1.5">
          <Shuffle className="h-4 w-4" aria-hidden />
          Shuffle all
        </Button>
        <Button variant="ghost" onClick={onDiscard} className="text-destructive">
          Discard
        </Button>
      </div>

      <ul className="space-y-4">
        {active.items.map((item, itemIndex) => {
          const hint = item.weighted
            ? lastSessionHint(item.name, sessions)
            : null;
          const allDone = item.done.every(Boolean);
          return (
            <li
              key={`${item.name}-${itemIndex}`}
              className="rounded-[var(--radius)] border border-border bg-card p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {item.link ? (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {item.name}
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                    </a>
                  ) : (
                    <p className="font-semibold">{item.name}</p>
                  )}
                  {hint && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Last time: {hint.weight} {unit} ·{" "}
                      {formatDisplayDate(hint.date)}
                    </p>
                  )}
                </div>
              </div>

              <ul className="mt-3 space-y-2">
                {item.done.map((done, setIndex) => (
                  <li
                    key={setIndex}
                    className="flex items-center gap-2"
                  >
                    <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">
                      Set {setIndex + 1}
                    </span>
                    {item.weighted && (
                      <label className="sr-only" htmlFor={`w-${itemIndex}-${setIndex}`}>
                        Weight for set {setIndex + 1}
                      </label>
                    )}
                    {item.weighted && (
                      <div className="relative flex-1">
                        <input
                          id={`w-${itemIndex}-${setIndex}`}
                          type="text"
                          inputMode="decimal"
                          enterKeyHint="done"
                          placeholder="—"
                          value={
                            item.weights[setIndex] == null
                              ? ""
                              : String(item.weights[setIndex])
                          }
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            if (raw === "") {
                              onWeight(itemIndex, setIndex, null);
                              return;
                            }
                            const n = Number(raw);
                            if (Number.isFinite(n) && n >= 0 && n <= 2000) {
                              onWeight(itemIndex, setIndex, n);
                            }
                          }}
                          onBlur={(e) => {
                            const raw = e.target.value.trim();
                            if (raw === "") {
                              onWeight(itemIndex, setIndex, null);
                              return;
                            }
                            const n = Number(raw);
                            if (Number.isFinite(n) && n >= 0 && n <= 2000) {
                              onWeight(
                                itemIndex,
                                setIndex,
                                Math.round(n * 10) / 10,
                              );
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className="h-11 w-full rounded-[var(--radius)] border border-border bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          {unit}
                        </span>
                      </div>
                    )}
                    {!item.weighted && <div className="flex-1" />}
                    <button
                      type="button"
                      aria-pressed={done}
                      aria-label={
                        done
                          ? `Deselect set ${setIndex + 1}`
                          : `Select set ${setIndex + 1} as done`
                      }
                      onClick={() => onToggleSet(itemIndex, setIndex)}
                      className={cn(
                        "min-h-12 min-w-[5.5rem] rounded-[var(--radius)] px-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                        done
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-background hover:bg-muted",
                      )}
                    >
                      {done ? "Done" : "Mark"}
                    </button>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  variant={allDone ? "primary" : "outline"}
                  className="text-xs"
                  aria-pressed={allDone}
                  onClick={() => onMarkExercise(itemIndex)}
                >
                  {allDone ? "All done" : "Mark exercise done"}
                </Button>
                <div
                  className="flex items-center gap-1"
                  role="group"
                  aria-label="Set count"
                >
                  <Button
                    variant="outline"
                    className="min-w-11 px-0"
                    aria-label="Decrease sets"
                    disabled={item.sets <= 1}
                    onClick={() => onChangeSets(itemIndex, -1)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="min-w-10 text-center text-sm font-semibold">
                    {item.sets}
                  </span>
                  <Button
                    variant="outline"
                    className="min-w-11 px-0"
                    aria-label="Increase sets"
                    disabled={item.sets >= 8}
                    onClick={() => onChangeSets(itemIndex, 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  className="gap-1 text-xs"
                  onClick={() => onSwap(itemIndex)}
                >
                  <Repeat className="h-4 w-4" aria-hidden />
                  Swap
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function FinishWorkoutBar({ onFinish }: { onFinish: () => void }) {
  return (
    <Button className="h-12 w-full text-base" onClick={onFinish}>
      Finish workout
    </Button>
  );
}

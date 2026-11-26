import { orderedBodyParts, isLightBodyPart } from "../../data/catalog";
import { relativeTrainedLabel } from "../../lib/dates";
import { cn } from "../../lib/utils";
import { Button } from "../ui/Button";

type Props = {
  selected: string | null;
  onSelect: (part: string) => void;
  lastByPart: Map<string, string>;
  routineSize: 4 | 5 | 6;
  onRoutineSize: (n: 4 | 5 | 6) => void;
  onStart: () => void;
};

export function BodyPartPicker({
  selected,
  onSelect,
  lastByPart,
  routineSize,
  onRoutineSize,
  onStart,
}: Props) {
  const parts = orderedBodyParts();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Choose a body part
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a focus, then start a randomized routine.
        </p>
      </div>

      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
        role="group"
        aria-label="Body parts"
      >
        {parts.map((part) => {
          const pressed = selected === part;
          const last = relativeTrainedLabel(lastByPart.get(part) ?? null);
          return (
            <button
              key={part}
              type="button"
              aria-pressed={pressed}
              onClick={() => onSelect(part)}
              className={cn(
                "flex min-h-14 flex-col items-start justify-center rounded-[var(--radius)] border px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                pressed
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border bg-card hover:bg-muted/60",
              )}
            >
              <span className="text-sm font-semibold leading-tight">{part}</span>
              {last && (
                <span className="mt-0.5 text-xs text-muted-foreground">
                  {last}
                </span>
              )}
              {isLightBodyPart(part) && (
                <span className="mt-0.5 text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                  Light · 1 exercise
                </span>
              )}
            </button>
          );
        })}
      </div>

      {!selected || !isLightBodyPart(selected) ? (
        <div>
          <p className="mb-2 text-sm font-medium" id="routine-size-label">
            Routine size
          </p>
          <div
            className="flex gap-2"
            role="group"
            aria-labelledby="routine-size-label"
          >
            {([4, 5, 6] as const).map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={routineSize === n}
                onClick={() => onRoutineSize(n)}
                className={cn(
                  "min-h-11 flex-1 rounded-[var(--radius)] border text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  routineSize === n
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-muted/60",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <Button
        className="hidden"
        disabled={!selected}
        onClick={onStart}
        aria-hidden
      />
    </div>
  );
}

export function StartWorkoutBar({
  selected,
  onStart,
}: {
  selected: string | null;
  onStart: () => void;
}) {
  return (
    <Button
      className="h-12 w-full text-base"
      disabled={!selected}
      onClick={onStart}
    >
      {selected ? `Start ${selected} workout` : "Select a body part"}
    </Button>
  );
}

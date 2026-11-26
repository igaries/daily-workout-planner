import { isToday } from "date-fns";
import { dayLetter, dayNumber, formatDateKey, weekDays } from "../../lib/dates";
import { cn } from "../../lib/utils";

type Props = {
  workoutDates: Set<string>;
};

export function WeekStrip({ workoutDates }: Props) {
  const days = weekDays();
  return (
    <div
      className="grid grid-cols-7 gap-1"
      role="list"
      aria-label="This week's workouts"
    >
      {days.map((d) => {
        const key = formatDateKey(d);
        const has = workoutDates.has(key);
        const today = isToday(d);
        return (
          <div
            key={key}
            role="listitem"
            className={cn(
              "flex flex-col items-center rounded-[var(--radius)] py-2 text-center",
              today && "bg-primary/10",
            )}
            aria-label={`${dayLetter(d)} ${dayNumber(d)}${has ? ", workout logged" : ""}`}
          >
            <span className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
              {dayLetter(d)}
            </span>
            <span
              className={cn(
                "mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                has
                  ? "bg-primary text-primary-foreground"
                  : today
                    ? "text-primary"
                    : "text-foreground",
              )}
            >
              {dayNumber(d)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

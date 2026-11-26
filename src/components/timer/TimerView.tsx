import { Pause, Play, RotateCcw, Volume2 } from "lucide-react";
import { SOUND_OPTIONS, type SoundId } from "../../lib/types";
import { cn } from "../../lib/utils";
import { Button } from "../ui/Button";

type Props = {
  intervalSec: number;
  onInterval: (sec: number) => void;
  sound: SoundId;
  onSound: (id: SoundId) => void;
  running: boolean;
  remainingMs: number;
  elapsedMs: number;
  round: number;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onTestBeep: () => void;
};

function fmt(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const PRESETS = [
  { label: "30 s", sec: 30 },
  { label: "1 min", sec: 60 },
  { label: "90 s", sec: 90 },
  { label: "2 min", sec: 120 },
];

export function TimerView({
  intervalSec,
  onInterval,
  sound,
  onSound,
  running,
  remainingMs,
  elapsedMs,
  round,
  onStart,
  onPause,
  onReset,
  onTestBeep,
}: Props) {
  const progress =
    intervalSec > 0 ? 1 - remainingMs / (intervalSec * 1000) : 0;
  const r = 54;
  const c = 2 * Math.PI * r;
  const dash = c * Math.min(1, Math.max(0, progress));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Interval timer
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Beeps on each interval. Keep the screen on for reliable alerts.
        </p>
      </div>

      <div className="flex flex-col items-center">
        <div
          className="relative h-48 w-48"
          role="timer"
          aria-live="off"
          aria-label={`Time to next beep ${fmt(remainingMs)}, round ${round}, elapsed ${fmtElapsed(elapsedMs)}`}
        >
          <svg className="-rotate-90" viewBox="0 0 120 120" aria-hidden>
            <circle
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke="currentColor"
              className="text-muted"
              strokeWidth="8"
            />
            <circle
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke="currentColor"
              className="text-primary transition-[stroke-dasharray] duration-200"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${c}`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-4xl font-bold tabular-nums">
              {fmt(remainingMs)}
            </span>
            <span className="text-xs text-muted-foreground">
              Round {round} · {fmtElapsed(elapsedMs)}
            </span>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button
            className="min-w-28"
            onClick={() => (running ? onPause() : void onStart())}
          >
            {running ? (
              <>
                <Pause className="h-4 w-4" aria-hidden /> Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4" aria-hidden /> Start
              </>
            )}
          </Button>
          <Button variant="outline" onClick={onReset} aria-label="Reset timer">
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={onTestBeep}>
            <Volume2 className="h-4 w-4" aria-hidden />
            Test
          </Button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium" id="preset-label">
          Interval presets
        </p>
        <div className="grid grid-cols-4 gap-2" role="group" aria-labelledby="preset-label">
          {PRESETS.map((p) => (
            <button
              key={p.sec}
              type="button"
              aria-pressed={intervalSec === p.sec}
              onClick={() => onInterval(p.sec)}
              className={cn(
                "min-h-11 rounded-[var(--radius)] border text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                intervalSec === p.sec
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-muted/60",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Custom interval</p>
        <div className="flex items-center justify-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-muted-foreground">Minutes</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="min-w-11 px-0"
                aria-label="Decrease minutes"
                onClick={() => onInterval(Math.max(5, intervalSec - 60))}
              >
                −
              </Button>
              <span className="min-w-8 text-center font-semibold tabular-nums">
                {Math.floor(intervalSec / 60)}
              </span>
              <Button
                variant="outline"
                className="min-w-11 px-0"
                aria-label="Increase minutes"
                onClick={() => onInterval(Math.min(3600, intervalSec + 60))}
              >
                +
              </Button>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-muted-foreground">Seconds</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="min-w-11 px-0"
                aria-label="Decrease seconds"
                onClick={() => onInterval(Math.max(5, intervalSec - 5))}
              >
                −
              </Button>
              <span className="min-w-8 text-center font-semibold tabular-nums">
                {intervalSec % 60}
              </span>
              <Button
                variant="outline"
                className="min-w-11 px-0"
                aria-label="Increase seconds"
                onClick={() => onInterval(Math.min(3600, intervalSec + 5))}
              >
                +
              </Button>
            </div>
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {intervalSec}s total · changing the interval stops and resets the timer
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium" id="sound-label">
          Beep sound
        </p>
        <div
          className="grid grid-cols-2 gap-2"
          role="group"
          aria-labelledby="sound-label"
        >
          {SOUND_OPTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={sound === s.id}
              onClick={() => onSound(s.id)}
              className={cn(
                "min-h-11 rounded-[var(--radius)] border px-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                sound === s.id
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border bg-card hover:bg-muted/60",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="space-y-1 text-xs text-muted-foreground">
        <li>iPhone silent mode mutes the sound.</li>
        <li>The phone may pause the timer when the screen locks.</li>
      </ul>
    </div>
  );
}

export function CompactTimerBar({
  remainingMs,
  onPause,
}: {
  remainingMs: number;
  onPause: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-lg items-center justify-between gap-3 border-b border-border/50 px-4 py-2">
      <p className="text-sm font-semibold tabular-nums">
        Timer · {fmt(remainingMs)}
      </p>
      <Button
        variant="outline"
        className="min-h-9 h-9"
        onClick={onPause}
        aria-label="Pause timer"
      >
        <Pause className="h-4 w-4" />
      </Button>
    </div>
  );
}

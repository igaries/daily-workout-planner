import { useMemo, useState } from "react";
import { Toaster, toast } from "sonner";
import { AppShell } from "./components/layout/AppShell";
import { Dialog } from "./components/ui/Dialog";
import { WeekStrip } from "./components/workout/WeekStrip";
import {
  BodyPartPicker,
  StartWorkoutBar,
} from "./components/workout/BodyPartPicker";
import {
  ActiveWorkoutView,
  FinishWorkoutBar,
} from "./components/workout/ActiveWorkout";
import {
  CompactTimerBar,
  TimerView,
} from "./components/timer/TimerView";
import { ProgressView } from "./components/progress/ProgressView";
import {
  useAppStore,
  useLiveRegion,
  useRoutineSize,
} from "./hooks/useAppStore";
import { useIntervalTimer } from "./hooks/useIntervalTimer";
import { playSound } from "./lib/audio";
import {
  exportSessionsWithUnit,
  importWorkbook,
  shareOrDownload,
} from "./lib/excel";
import type { TabId } from "./lib/types";
import { formatDateKey } from "./lib/dates";

export default function App() {
  const store = useAppStore();
  const { doc, status } = store;
  const [tab, setTab] = useState<TabId>("workout");
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [routineSize, setRoutineSize] = useRoutineSize();
  const live = useLiveRegion();

  const [confirm, setConfirm] = useState<
    | null
    | { kind: "discard" }
    | { kind: "shuffle" }
    | { kind: "finish-empty" }
    | { kind: "delete"; id: string }
  >(null);

  const timer = useIntervalTimer(doc.timerSec, doc.sound);

  const workoutDates = useMemo(
    () => new Set(doc.sessions.map((s) => s.date)),
    [doc.sessions],
  );

  const lastByPart = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of doc.sessions) {
      if (!map.has(s.bodyPart)) map.set(s.bodyPart, s.date);
    }
    return map;
  }, [doc.sessions]);

  function handleStart() {
    if (!selectedPart) return;
    store.startWorkout(selectedPart, routineSize);
    live.announce(`Started ${selectedPart} workout`);
    toast.success(`${selectedPart} workout started`);
  }

  function handleFinish() {
    const result = store.finishWorkout();
    if (result === "empty") {
      setConfirm({ kind: "finish-empty" });
      return;
    }
    live.announce("Workout saved");
    toast.success("Workout saved");
    setTab("progress");
  }

  function handleInterval(sec: number) {
    if (sec === doc.timerSec) return;
    store.setTimerSec(sec);
    timer.hardReset();
    live.announce(`Interval set to ${sec} seconds`);
  }

  async function handleSound(id: typeof doc.sound) {
    store.setSound(id);
    await playSound(id);
    live.announce(`Sound set to ${id}`);
  }

  async function handleExport() {
    try {
      const blob = await exportSessionsWithUnit(doc.sessions, doc.unit);
      const name = `workout-log-${formatDateKey(new Date())}.xlsx`;
      const mode = await shareOrDownload(blob, name);
      toast.success(mode === "shared" ? "Shared workbook" : "Downloaded workbook");
      live.announce("Workout log exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  }

  async function handleImport(file: File) {
    try {
      const result = await importWorkbook(file, doc.sessions, doc.unit);
      if (result.added.length) {
        store.mergeSessions(result.added);
      }
      toast.success(
        `Imported ${result.added.length} workout${result.added.length === 1 ? "" : "s"}` +
          (result.skippedExisting
            ? ` · ${result.skippedExisting} already present`
            : "") +
          (result.skippedRows ? ` · ${result.skippedRows} rows skipped` : ""),
      );
      live.announce(`Imported ${result.added.length} workouts`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    }
  }

  const bottomAction =
    tab === "workout" ? (
      doc.active ? (
        <FinishWorkoutBar onFinish={handleFinish} />
      ) : (
        <StartWorkoutBar selected={selectedPart} onStart={handleStart} />
      )
    ) : undefined;

  const timerBar =
    timer.running && tab !== "timer" ? (
      <CompactTimerBar
        remainingMs={timer.remainingMs}
        onPause={timer.pause}
      />
    ) : null;

  return (
    <>
      <AppShell
        tab={tab}
        onTab={setTab}
        bottomAction={bottomAction}
        timerBar={timerBar}
        storageWarning={status !== "ok"}
      >
        {tab === "workout" && !doc.active && (
          <div className="space-y-5">
            <WeekStrip workoutDates={workoutDates} />
            <BodyPartPicker
              selected={selectedPart}
              onSelect={setSelectedPart}
              lastByPart={lastByPart}
              routineSize={routineSize}
              onRoutineSize={setRoutineSize}
              onStart={handleStart}
            />
          </div>
        )}

        {tab === "workout" && doc.active && (
          <ActiveWorkoutView
            active={doc.active}
            sessions={doc.sessions}
            unit={doc.unit}
            onUnit={store.setUnit}
            onToggleSet={(i, s) => {
              store.toggleSet(i, s);
              live.announce("Set updated");
            }}
            onWeight={store.setWeight}
            onMarkExercise={(i) => {
              store.markExerciseDone(i);
              live.announce("Exercise marked done");
            }}
            onChangeSets={store.changeSets}
            onSwap={(i) => {
              const next = store.swap(i);
              if (!next) {
                toast.message("No other exercises for this body part.");
                live.announce("No other exercises for this body part");
                return;
              }
              toast.success(`Swapped to ${next.name}`);
              live.announce(`Swapped to ${next.name}`);
            }}
            onShuffle={() => {
              const anyDone = doc.active!.items.some((it) =>
                it.done.some(Boolean),
              );
              if (anyDone) {
                setConfirm({ kind: "shuffle" });
                return;
              }
              const result = store.shuffleAll();
              if (!result) return;
              toast.success(
                result.allNew
                  ? "Shuffled — all new exercises"
                  : `Shuffled — ${result.repeated} repeated because the body part has too few others`,
              );
              live.announce("Exercises shuffled");
            }}
            onDiscard={() => setConfirm({ kind: "discard" })}
          />
        )}

        {tab === "timer" && (
          <TimerView
            intervalSec={doc.timerSec}
            onInterval={handleInterval}
            sound={doc.sound}
            onSound={(id) => void handleSound(id)}
            running={timer.running}
            remainingMs={timer.remainingMs}
            elapsedMs={timer.elapsedMs}
            round={timer.round}
            onStart={() => void timer.start()}
            onPause={timer.pause}
            onReset={timer.reset}
            onTestBeep={() => void playSound(doc.sound)}
          />
        )}

        {tab === "progress" && (
          <ProgressView
            sessions={doc.sessions}
            unit={doc.unit}
            onDelete={(id) => setConfirm({ kind: "delete", id })}
            onExport={() => void handleExport()}
            onImport={(f) => void handleImport(f)}
          />
        )}
      </AppShell>

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {live.message}
      </div>

      <Toaster position="top-center" richColors closeButton />

      <Dialog
        open={confirm?.kind === "discard"}
        title="Discard workout?"
        confirmLabel="Discard"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          store.discardWorkout();
          setConfirm(null);
          toast.message("Workout discarded");
          live.announce("Workout discarded");
        }}
      >
        This removes the active workout without saving.
      </Dialog>

      <Dialog
        open={confirm?.kind === "shuffle"}
        title="Shuffle all exercises?"
        confirmLabel="Shuffle"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const result = store.shuffleAll();
          setConfirm(null);
          if (!result) return;
          toast.success(
            result.allNew
              ? "Shuffled — all new exercises"
              : `Shuffled — ${result.repeated} repeated because the body part has too few others`,
          );
          live.announce("Exercises shuffled");
        }}
      >
        Sets you already marked done in this workout will be cleared.
      </Dialog>

      <Dialog
        open={confirm?.kind === "finish-empty"}
        title="No sets marked done"
        confirmLabel="Discard"
        cancelLabel="Keep workout"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          store.discardWorkout();
          setConfirm(null);
          toast.message("Workout discarded");
          live.announce("Workout discarded");
        }}
      >
        Nothing was logged. Discard this workout instead of saving?
      </Dialog>

      <Dialog
        open={confirm?.kind === "delete"}
        title="Delete workout?"
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm?.kind === "delete") {
            store.deleteSession(confirm.id);
            toast.message("Workout deleted");
            live.announce("Workout deleted");
          }
          setConfirm(null);
        }}
      >
        This removes the session from history on this device.
      </Dialog>
    </>
  );
}

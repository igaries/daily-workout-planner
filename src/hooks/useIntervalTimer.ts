import { useCallback, useEffect, useRef, useState } from "react";
import type { SoundId } from "../lib/types";
import { playSound, unlockAudio } from "../lib/audio";
import { useWakeLock } from "./useWakeLock";

export function useIntervalTimer(
  intervalSec: number,
  sound: SoundId,
) {
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAt = useRef<number | null>(null);
  const accumulated = useRef(0);
  const lastBeepRound = useRef(0);

  useWakeLock(running);

  const recompute = useCallback(() => {
    let elapsed = accumulated.current;
    if (running && startedAt.current != null) {
      elapsed = accumulated.current + (Date.now() - startedAt.current);
    }
    setElapsedMs(elapsed);

    const intervalMs = intervalSec * 1000;
    if (intervalMs <= 0) return;
    const round = Math.floor(elapsed / intervalMs);
    if (round > lastBeepRound.current) {
      lastBeepRound.current = round;
      void playSound(sound);
    }
  }, [running, intervalSec, sound]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(recompute, 200);
    return () => window.clearInterval(id);
  }, [running, recompute]);

  // Reset beep tracking when interval changes (caller also resets timer)
  useEffect(() => {
    lastBeepRound.current = Math.floor(elapsedMs / (intervalSec * 1000));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when interval changes
  }, [intervalSec]);

  const start = useCallback(async () => {
    await unlockAudio();
    startedAt.current = Date.now();
    setRunning(true);
  }, []);

  const pause = useCallback(() => {
    if (startedAt.current != null) {
      accumulated.current += Date.now() - startedAt.current;
      startedAt.current = null;
    }
    setRunning(false);
    setElapsedMs(accumulated.current);
  }, []);

  const reset = useCallback(() => {
    accumulated.current = 0;
    lastBeepRound.current = 0;
    setElapsedMs(0);
    if (running) {
      startedAt.current = Date.now();
    } else {
      startedAt.current = null;
    }
  }, [running]);

  const hardReset = useCallback(() => {
    accumulated.current = 0;
    startedAt.current = null;
    lastBeepRound.current = 0;
    setElapsedMs(0);
    setRunning(false);
  }, []);

  const intervalMs = intervalSec * 1000;
  const round =
    intervalMs > 0 ? Math.floor(elapsedMs / intervalMs) + 1 : 1;
  const intoInterval = intervalMs > 0 ? elapsedMs % intervalMs : 0;
  const remainingMs = intervalMs > 0 ? intervalMs - intoInterval : 0;

  return {
    running,
    elapsedMs,
    remainingMs,
    round,
    start,
    pause,
    reset,
    hardReset,
  };
}

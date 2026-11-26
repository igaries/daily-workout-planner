import { useEffect, useRef } from "react";

export function useWakeLock(active: boolean) {
  const sentinel = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function request() {
      try {
        if (!("wakeLock" in navigator)) return;
        if (!active) {
          await sentinel.current?.release();
          sentinel.current = null;
          return;
        }
        sentinel.current = await navigator.wakeLock.request("screen");
        sentinel.current.addEventListener("release", () => {
          sentinel.current = null;
        });
      } catch {
        /* unsupported or denied */
      }
    }

    void request();

    function onVisibility() {
      if (document.visibilityState === "visible" && active && !cancelled) {
        void request();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel.current?.release();
      sentinel.current = null;
    };
  }, [active]);
}

import { Dumbbell, Timer, ChartColumn } from "lucide-react";
import type { ReactNode } from "react";
import type { TabId } from "../../lib/types";
import { cn } from "../../lib/utils";

type Props = {
  tab: TabId;
  onTab: (t: TabId) => void;
  children: ReactNode;
  bottomAction?: ReactNode;
  timerBar?: ReactNode;
  storageWarning?: boolean;
};

const tabs: { id: TabId; label: string; icon: typeof Dumbbell }[] = [
  { id: "workout", label: "Workout", icon: Dumbbell },
  { id: "timer", label: "Timer", icon: Timer },
  { id: "progress", label: "Progress", icon: ChartColumn },
];

export function AppShell({
  tab,
  onTab,
  children,
  bottomAction,
  timerBar,
  storageWarning,
}: Props) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[200] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-md pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius)] bg-primary text-primary-foreground">
            <Dumbbell className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold leading-tight tracking-tight">
              Daily Workout Planner
            </p>
            <p className="truncate text-xs text-muted-foreground">
              Data stored on this device
            </p>
          </div>
        </div>
        {storageWarning && (
          <div
            role="alert"
            className="border-t border-amber-500/40 bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-950 dark:text-amber-100"
          >
            Storage is unavailable or unreadable. Changes may not be saved.
          </div>
        )}
      </header>

      <main
        id="main"
        className="mx-auto w-full max-w-lg flex-1 px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-4"
      >
        {children}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border/60 bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
        {timerBar}
        {bottomAction && (
          <div className="mx-auto max-w-lg px-4 pt-2">{bottomAction}</div>
        )}
        <nav
          className="mx-auto flex max-w-lg justify-around px-2 pt-1 pb-2"
          aria-label="Primary"
        >
          {tabs.map(({ id, label, icon: Icon }) => {
            const selected = tab === id;
            return (
              <button
                key={id}
                type="button"
                aria-current={selected ? "page" : undefined}
                aria-pressed={selected}
                onClick={() => onTab(id)}
                className={cn(
                  "flex min-h-11 min-w-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-[var(--radius)] px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  selected
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {label}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export const MIN_POLL_INTERVAL_MS = 60_000;

/**
 * Polls `task` no more often than once a minute, never while the tab is hidden, and
 * catches up once when the tab becomes visible again if a poll is due. Returns a
 * cleanup function that clears the interval and the visibility listener.
 */
export function startVisiblePolling(task: () => void | Promise<void>, intervalMs: number = MIN_POLL_INTERVAL_MS): () => void {
  const interval = Math.max(intervalMs, MIN_POLL_INTERVAL_MS);
  let lastRun = Date.now();

  const run = () => {
    lastRun = Date.now();
    void task();
  };

  const timer = window.setInterval(() => {
    if (document.hidden) return;
    run();
  }, interval);

  const onVisibilityChange = () => {
    if (document.hidden) return;
    if (Date.now() - lastRun >= interval) run();
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}

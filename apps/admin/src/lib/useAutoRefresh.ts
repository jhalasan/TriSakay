import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Polls `task` every `intervalMs`. A tick that fires while the previous
 * one is still in flight is skipped, not queued. `task` receives `isStale`
 * so it can bail before calling a setter after the component unmounted or
 * a newer run has started — safe under StrictMode's double-mount.
 */
export function useAutoRefresh(task: (isStale: () => boolean) => Promise<void>, intervalMs: number) {
  const taskRef = useRef(task);
  taskRef.current = task;

  const runningRef = useRef(false);
  const mountedRef = useRef(true);
  const runIdRef = useRef(0);
  const [refreshing, setRefreshing] = useState(false);

  const run = useCallback(async () => {
    if (runningRef.current || document.hidden) return;
    runningRef.current = true;
    const runId = ++runIdRef.current;
    setRefreshing(true);
    try {
      await taskRef.current(() => !mountedRef.current || runIdRef.current !== runId);
    } finally {
      runningRef.current = false;
      if (mountedRef.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    run();
    const id = setInterval(run, intervalMs);

    function onVisible() {
      if (!document.hidden) run();
    }
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      mountedRef.current = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [run, intervalMs]);

  return { refresh: run, refreshing };
}

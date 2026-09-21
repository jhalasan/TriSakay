import { useEffect, useRef } from 'react';

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'wheel'] as const;

export interface UseIdleTimeoutOptions {
  timeoutMs: number;
  warningBeforeMs: number;
  onWarning: () => void;
  onTimeout: () => void;
}

/**
 * UAT A1: signs an idle admin session out automatically — an unattended,
 * unlocked device must not stay signed into PSO operations tools
 * indefinitely. Resets on any real user activity; onWarning fires
 * `warningBeforeMs` before onTimeout so the operator gets a chance to stay
 * signed in just by moving the mouse.
 */
export function useIdleTimeout({ timeoutMs, warningBeforeMs, onWarning, onTimeout }: UseIdleTimeoutOptions) {
  const warningTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const timeoutTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Refs so a fresh onWarning/onTimeout closure (new every render, since
  // AppShell's are plain inline functions) never forces this effect to
  // re-subscribe every render and reset the countdown on its own.
  const onWarningRef = useRef(onWarning);
  const onTimeoutRef = useRef(onTimeout);
  onWarningRef.current = onWarning;
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    function reset() {
      clearTimeout(warningTimer.current);
      clearTimeout(timeoutTimer.current);
      warningTimer.current = setTimeout(() => onWarningRef.current(), Math.max(0, timeoutMs - warningBeforeMs));
      timeoutTimer.current = setTimeout(() => onTimeoutRef.current(), timeoutMs);
    }

    reset();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, reset, { passive: true }));

    return () => {
      clearTimeout(warningTimer.current);
      clearTimeout(timeoutTimer.current);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, reset));
    };
  }, [timeoutMs, warningBeforeMs]);
}

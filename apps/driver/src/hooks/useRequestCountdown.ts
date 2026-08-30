import { useEffect, useState } from 'react';

/** Whole seconds remaining before `expiresAt`, clamped to 0 — never negative, never fractional. */
export function secondsUntil(expiresAt: string, now: number): number {
  const remainingMs = Date.parse(expiresAt) - now;
  return Math.max(0, Math.floor(remainingMs / 1000));
}

/** Ticks every second toward 0. Returns null when there's no request to count down (matches the "no expiresAt yet" degrade path in RequestCard/PendingRequest). */
export function useRequestCountdown(expiresAt: string | null): number | null {
  const [seconds, setSeconds] = useState<number | null>(expiresAt ? secondsUntil(expiresAt, Date.now()) : null);

  useEffect(() => {
    if (!expiresAt) {
      setSeconds(null);
      return;
    }
    setSeconds(secondsUntil(expiresAt, Date.now()));
    const interval = setInterval(() => {
      setSeconds(secondsUntil(expiresAt, Date.now()));
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return seconds;
}

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { TutorialContextValue, TutorialRect, TutorialStep } from './types';

/** How long the finished toast (step total+1) stays up before auto-closing, absent a Restart tap. */
const FINISHED_TOAST_MS = 3200;

/**
 * step 0 = welcome sheet, 1…total = coach marks, total + 1 = finished toast.
 * Exported as a pure function (no React) so it can be unit-tested under this
 * package's Node test runner, which cannot load react-native.
 */
export function clampStep(step: number, total: number): number {
  return Math.min(Math.max(step, 0), total + 1);
}

export function nextStepIndex(step: number, total: number): number {
  return clampStep(step + 1, total);
}

export function backStepIndex(step: number, total: number): number {
  return clampStep(step - 1, total);
}

/** The step table entry for a coach-mark step (1…total), or null on the welcome/finished steps. */
export function stepAt(steps: readonly TutorialStep[], step: number): TutorialStep | null {
  const index = step - 1;
  return index >= 0 && index < steps.length ? steps[index] : null;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function useTutorial(): TutorialContextValue {
  const value = useContext(TutorialContext);
  if (!value) throw new Error('useTutorial must be used within a TutorialProvider');
  return value;
}

export interface TutorialProviderProps {
  /** The app's step table (steps.driver.ts or steps.passenger.ts). */
  steps: TutorialStep[];
  /** Called once, synchronously, when the tour is skipped from any step — the app writes its own *TutorialSeenAt key here. */
  onSkip?: () => void;
  /** Called once, synchronously, when the tour reaches the finished toast — the app writes its own *TutorialSeenAt key here. */
  onFinish?: () => void;
  children: ReactNode;
}

export function TutorialProvider({ steps, onSkip, onFinish, children }: TutorialProviderProps) {
  const total = steps.length;
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const rectsRef = useRef<Map<string, TutorialRect>>(new Map());
  // registerTarget writes into the ref above, which by itself never triggers
  // a re-render — a coach mark that already painted (using the design-frame
  // fallback, or a stale rect) would then never pick up a measurement that
  // lands after that paint. Bumping this on every registration forces
  // TutorialOverlay to re-render and re-read the ref.
  const [rectVersion, setRectVersion] = useState(0);

  const start = useCallback(() => {
    setStep(0);
    setActive(true);
  }, []);

  const goTo = useCallback(
    (nextStep: number) => {
      setStep(clampStep(nextStep, total));
    },
    [total]
  );

  const next = useCallback(() => {
    setStep((current) => nextStepIndex(current, total));
  }, [total]);

  const back = useCallback(() => {
    setStep((current) => backStepIndex(current, total));
  }, [total]);

  const skip = useCallback(() => {
    setActive(false);
    onSkip?.();
  }, [onSkip]);

  const finish = useCallback(() => {
    setActive(false);
    onFinish?.();
  }, [onFinish]);

  // Reaching the finished toast (step total+1) auto-closes the tour after a
  // beat, writing the seen-at key via onFinish — unless Restart (start())
  // moves `step` back to 0 first, which cancels this via the cleanup.
  useEffect(() => {
    if (!active || step !== total + 1) return;
    const timer = setTimeout(finish, FINISHED_TOAST_MS);
    return () => clearTimeout(timer);
  }, [active, step, total, finish]);

  const registerTarget = useCallback((id: string, rect: TutorialRect) => {
    const prev = rectsRef.current.get(id);
    if (prev && prev.x === rect.x && prev.y === rect.y && prev.width === rect.width && prev.height === rect.height) return;
    rectsRef.current.set(id, rect);
    setRectVersion((v) => v + 1);
  }, []);

  const getTargetRect = useCallback((id: string) => rectsRef.current.get(id) ?? null, []);

  const currentStep = stepAt(steps, step);

  const value = useMemo<TutorialContextValue>(
    () => ({
      active,
      step,
      total,
      currentStep,
      start,
      next,
      back,
      skip,
      goTo,
      finish,
      registerTarget,
      getTargetRect,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rectVersion is intentionally unused inside
    // the object itself; it's here purely to force a fresh `value` (and thus a TutorialOverlay re-render)
    // whenever a target's measured rect changes, since getTargetRect reads a ref that isn't reactive on its own.
    [active, step, total, currentStep, start, next, back, skip, goTo, finish, registerTarget, getTargetRect, rectVersion]
  );

  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
}

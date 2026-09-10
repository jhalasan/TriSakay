import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import styles from './Toast.module.css';

export type ToastTone = 'success' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastInput {
  message: string;
  tone?: ToastTone;
  /** e.g. an export toast's "Open" link. */
  action?: ToastAction;
  /** ms before auto-dismiss; README §12 "Success toast" specifies 4s. */
  durationMs?: number;
}

interface ToastItem extends Required<Pick<ToastInput, 'message' | 'tone'>> {
  id: number;
  action?: ToastAction;
}

interface ToastContextValue {
  showToast: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** README §12 "Success toast" — every store success (Name updated., export ready, …) lands here instead of a page-top banner (§4a). */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast() must be used inside a <ToastProvider>');
  return ctx;
}

const DEFAULT_DURATION_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ message, tone = 'success', action, durationMs = DEFAULT_DURATION_MS }: ToastInput) => {
      // Deferred a tick: callers almost always call this right after a
      // Zustand store action resolves (itself calling set() outside any
      // React event handler), and adding the toast in that exact same tick
      // has been observed to silently lose the update — pushing it to a
      // fresh macrotask sidesteps that interaction reliably.
      setTimeout(() => {
        const id = nextId.current++;
        setToasts((prev) => [...prev, { id, message, tone, action }]);
        const timer = setTimeout(() => dismiss(id), durationMs);
        timers.current.set(id, timer);
      }, 0);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.stack} role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={styles.toast}>
            <span className={`${styles.statusCircle} ${styles[t.tone]}`} aria-hidden="true" />
            <span className={styles.message}>{t.message}</span>
            {t.action && (
              <button
                type="button"
                className={styles.actionLink}
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" className={styles.close} aria-label="Dismiss" onClick={() => dismiss(t.id)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M5 5l14 14M19 5 5 19" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

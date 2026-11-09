import { useEffect, useSyncExternalStore } from 'react';

export interface Toast {
  id: number;
  text: string;
  /** "Deshacer" and the like. */
  action?: { label: string; run: () => void };
}

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** A short note at the bottom, gone after a few seconds. With `action`, a button (e.g. Deshacer). */
export function toast(text: string, action?: Toast['action']) {
  // One at a time: a new note replaces the old one.
  toasts = [{ id: nextId++, text, action }];
  emit();
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

/** Tests start clean. */
export function resetToastsForTests() {
  toasts = [];
}

export function Toaster() {
  const list = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => toasts,
  );
  const current = list[0];
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => dismiss(current.id), current.action ? 6000 : 3500);
    return () => clearTimeout(t);
  }, [current]);
  return (
    <div className="toaster" role="status" aria-live="polite">
      {current && (
        <div key={current.id} className="toast">
          <span className="toast__text">{current.text}</span>
          {current.action && (
            <button
              type="button"
              className="toast__action"
              onClick={() => {
                dismiss(current.id);
                current.action!.run();
              }}
            >
              {current.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

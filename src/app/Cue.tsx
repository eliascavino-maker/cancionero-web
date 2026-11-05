import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Cue } from '../live/room';
import { type Signal, inkOn } from '../live/signals';

/** How long a signal stays on screen. */
export const SIGNAL_MS = 3500;

const beatMs = (bpm: number) => 60_000 / bpm;
const lasts = (cue: Cue) => (cue.kind === 'count' ? cue.beats * beatMs(cue.bpm) : SIGNAL_MS);

/**
 * The leader's count-in or signal, big, over everything (the lock too). It
 * doesn't take touches. `me`: whoever sent it doesn't get the vibration.
 */
export function CueOverlay({ cue, me }: { cue: Cue | null; me?: string }) {
  const [view, setView] = useState<{ cue: Cue; beat: number } | null>(null);
  const cueRef = useRef(cue);
  cueRef.current = cue;

  useEffect(() => {
    const c = cueRef.current;
    if (!c) return;
    // Opened after it ended (another screen, coming back): not again.
    const age = Date.now() - c.at;
    if (age >= lasts(c)) return;
    const timers: number[] = [];
    const later = (ms: number, f: () => void) => timers.push(window.setTimeout(f, Math.max(0, ms - age)));
    if (c.kind === 'count') {
      for (let b = 0; b < c.beats; b++) later(b * beatMs(c.bpm), () => setView({ cue: c, beat: b }));
    } else {
      setView({ cue: c, beat: 0 });
      if (c.vibrate && c.from !== me) navigator.vibrate?.([200, 100, 200]);
    }
    later(lasts(c), () => setView(null));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [cue?.id, me]);

  if (!view) return null;
  const c = view.cue;
  return createPortal(
    c.kind === 'count' ? (
      <div className="cue cue--count" role="status" aria-live="assertive">
        <span key={view.beat} className="cue__beat">
          {c.beats - view.beat}
        </span>
      </div>
    ) : (
      <div className="cue cue--signal" role="alert">
        <strong className="cue__sign" style={{ '--cue': c.color, color: inkOn(c.color) } as CSSProperties}>
          {c.text}
        </strong>
      </div>
    ),
    document.body,
  );
}

/** The leader's signals, as big colored buttons. Tapping one sends it. */
export function SignalsDialog({
  signals,
  onPick,
  onClose,
}: {
  signals: Signal[];
  onPick: (s: Signal) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (typeof d.showModal === 'function') d.showModal();
    else d.setAttribute('open', '');
  }, []);

  return (
    <dialog
      ref={dialog}
      className="dialog signals"
      aria-label="Señales"
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && onClose()}
    >
      <header className="page__header">
        <h2>Señales</h2>
        <button className="btn" onClick={onClose}>
          Cerrar
        </button>
      </header>
      <div className="signals__grid">
        {signals.map((s, i) => (
          <button
            key={i}
            className="signals__btn"
            style={{ '--cue': s.color, color: inkOn(s.color) } as CSSProperties}
            onClick={() => {
              onPick(s);
              onClose();
            }}
          >
            {s.text}
          </button>
        ))}
      </div>
    </dialog>
  );
}

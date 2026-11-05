import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../components/Icon';

/** How long to hold to unlock. */
export const UNLOCK_MS = 2000;

/** The padlock button: locks the screen against stray touches. */
export function LockButton({ onLock }: { onLock: () => void }) {
  return (
    <button className="icon-btn" aria-label="Bloquear la pantalla" title="Bloquear la pantalla" onClick={onLock}>
      <Icon name="lock" />
    </button>
  );
}

/**
 * Locked screen: every touch is ignored, the song keeps showing and the live
 * room keeps arriving. Keys and Bluetooth pedals still work. Holding anywhere
 * for 2 s unlocks (on a keyboard, holding Enter).
 */
export function LockOverlay({ onUnlock }: { onUnlock: () => void }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const box = useRef<HTMLDivElement>(null);

  const start = () => {
    window.clearTimeout(timer.current);
    setHolding(true);
    timer.current = window.setTimeout(onUnlock, UNLOCK_MS);
  };
  const stop = () => {
    window.clearTimeout(timer.current);
    setHolding(false);
  };

  useEffect(() => {
    const el = box.current;
    // Whatever had focus (a part button) won't take Enter or Space now.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    el?.focus({ preventScroll: true });
    // The wheel would scroll the page behind; React's wheel listener can't stop it.
    const noWheel = (e: WheelEvent) => e.preventDefault();
    el?.addEventListener('wheel', noWheel, { passive: false });
    return () => {
      el?.removeEventListener('wheel', noWheel);
      window.clearTimeout(timer.current);
    };
  }, []);

  return createPortal(
    <div
      ref={box}
      className={`lock${holding ? ' lock--holding' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Pantalla bloqueada"
      tabIndex={-1}
      onPointerDown={(e) => {
        e.preventDefault();
        start();
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.repeat) start();
      }}
      onKeyUp={(e) => e.key === 'Enter' && stop()}
    >
      <div className="lock__hint">
        <span className="lock__ring">
          <svg className="lock__progress" viewBox="0 0 40 40" aria-hidden="true">
            <circle className="lock__track" cx="20" cy="20" r="17" />
            <circle
              className="lock__fill"
              cx="20"
              cy="20"
              r="17"
              pathLength={1}
              style={{ animationDuration: `${UNLOCK_MS}ms` }}
            />
          </svg>
          <Icon name="lock" size={18} />
        </span>
        <span>{holding ? 'Seguí apretando…' : 'Bloqueada · mantené apretado 2 s para desbloquear'}</span>
      </div>
    </div>,
    document.body,
  );
}

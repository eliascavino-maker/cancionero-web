import { type ReactNode, useRef, useState } from 'react';
import { Icon, type IconName } from './Icon';

export interface SwipeAction {
  label: string;
  icon: IconName;
  onSelect: () => void;
  danger?: boolean;
}

const ACTION_W = 76;

/**
 * A list row that slides left with a finger to show quick actions behind it.
 * A tap on the row still opens it; a tap elsewhere or a swipe back closes it.
 * Mouse and keyboard users get the same actions from the row's ⋯ menu.
 */
export function SwipeRow({ actions, children }: { actions: SwipeAction[]; children: ReactNode }) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; from: number; horizontal: boolean | null } | null>(null);
  const moved = useRef(false);
  const max = actions.length * ACTION_W;

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch' || !actions.length) return;
    start.current = { x: e.clientX, y: e.clientY, from: offset, horizontal: null };
    moved.current = false;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (s.horizontal === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      s.horizontal = Math.abs(dx) > Math.abs(dy);
      if (!s.horizontal) {
        start.current = null;
        return;
      }
      setDragging(true);
    }
    moved.current = true;
    setOffset(Math.max(-max, Math.min(0, s.from + dx)));
  };
  const onPointerUp = () => {
    const s = start.current;
    start.current = null;
    if (!s?.horizontal) return;
    setDragging(false);
    setOffset((o) => (o < -max / 2 ? -max : 0));
  };

  return (
    <div className={`swipe${offset ? ' swipe--open' : ''}`}>
      {offset !== 0 && (
        <div className="swipe__actions" style={{ width: max }}>
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              className={a.danger ? 'swipe__action swipe__action--danger' : 'swipe__action'}
              tabIndex={-1}
              onClick={() => {
                setOffset(0);
                a.onSelect();
              }}
            >
              <Icon name={a.icon} size={20} />
              {a.label}
            </button>
          ))}
        </div>
      )}
      <div
        className="swipe__row"
        style={{ transform: offset ? `translateX(${offset}px)` : undefined, transition: dragging ? 'none' : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(e) => {
          // The tap that ends a swipe, or closes an open row, doesn't open the song.
          if (moved.current || offset) {
            e.preventDefault();
            e.stopPropagation();
            moved.current = false;
            if (offset && !dragging) setOffset(0);
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}

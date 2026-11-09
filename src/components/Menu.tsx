import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Icon, type IconName } from './Icon';

export interface MenuItem {
  label: string;
  icon?: IconName;
  onSelect: () => void;
  danger?: boolean;
  /** Left out when false: lets callers write `{ ..., hidden: !canDelete }`. */
  hidden?: boolean;
}

/**
 * The ⋯ button and its options. On phones the options come up from the bottom
 * (a sheet, reachable with one hand); on wider screens they drop down under the
 * button. Escape, a tap outside or picking an option closes it.
 */
export function Menu({
  label,
  items,
  title,
  icon = 'more',
  className,
}: {
  label: string;
  items: MenuItem[];
  /** Shown at the top of the sheet on phones. */
  title?: ReactNode;
  icon?: IconName;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        button.current?.focus();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const all = [...(panel.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
        const i = all.indexOf(document.activeElement as HTMLButtonElement);
        const next = all[(i + (e.key === 'ArrowDown' ? 1 : all.length - 1)) % all.length];
        next?.focus();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const shown = items.filter((i) => !i.hidden);
  return (
    <div className={`menu${open ? ' menu--open' : ''}${className ? ` ${className}` : ''}`}>
      <button
        ref={button}
        type="button"
        className="icon-btn"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(!open)}
      >
        <Icon name={icon} />
      </button>
      {open && (
        <>
          <div className="menu__scrim" onClick={() => setOpen(false)} />
          <div ref={panel} id={id} className="menu__panel" role="menu" aria-label={label}>
            {title && <div className="menu__title">{title}</div>}
            {shown.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className={item.danger ? 'menu__item menu__item--danger' : 'menu__item'}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.icon && <Icon name={item.icon} />}
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { transposeKey } from '../../music/transposer';
import type { SetlistEntry } from '../../data/library';
import { navigate, useLibrary, useLive } from '../hooks';

/** Songs of one setlist: reorder, add, remove, play. */
export function SetlistPage({ id }: { id: number }) {
  const lib = useLibrary();
  const data = useLive(
    async (l) => {
      const setlist = await l.getSetlist(id);
      return setlist ? { setlist, entries: await l.getSetlistEntries(id) } : null;
    },
    [id],
  );
  const dialog = useRef<HTMLDialogElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);

  if (data === undefined) return null;
  if (data === null) return <p className="empty">El setlist no existe.</p>;
  const { setlist, entries } = data;

  const rename = async () => {
    menu.current?.removeAttribute('open');
    const name = prompt('Nuevo nombre', setlist.name)?.trim();
    if (name) await lib.renameSetlist(id, name);
  };

  const remove = async () => {
    menu.current?.removeAttribute('open');
    if (!confirm(`¿Borrar "${setlist.name}"? Las canciones quedan en la biblioteca.`)) return;
    await lib.deleteSetlist(id);
    navigate('/setlists');
  };

  return (
    <div className="page">
      <header className="page__header">
        <a className="icon-btn" href="#/setlists" aria-label="Volver a setlists">
          <Icon name="back" />
        </a>
        <h1>{setlist.name}</h1>
        <div className="page__actions">
          <details className="menu" ref={menu}>
            <summary className="icon-btn" aria-label="Más opciones">
              <Icon name="more" />
            </summary>
            <div className="menu__panel">
              <button onClick={rename}>
                <Icon name="edit" /> Renombrar
              </button>
              <button onClick={remove} style={{ color: 'var(--danger)' }}>
                <Icon name="trash" /> Borrar setlist
              </button>
            </div>
          </details>
        </div>
      </header>

      <div className="page__actions" style={{ marginBottom: 16 }}>
        <button
          className="btn btn--primary"
          disabled={entries.length === 0}
          onClick={() => navigate(`/play/${id}/0`)}
        >
          <Icon name="play" size={18} /> Tocar en vivo
        </button>
        <button className="btn" onClick={() => dialog.current?.showModal()}>
          <Icon name="plus" size={18} /> Canciones
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="empty">Agregá canciones con "Canciones".</p>
      ) : (
        <SortableList setlistId={id} entries={entries} />
      )}

      <dialog ref={dialog} className="dialog" onClick={(e) => e.target === dialog.current && dialog.current.close()}>
        <SongPicker onPick={(songId) => lib.addSongToSetlist(id, songId)} onClose={() => dialog.current?.close()} />
      </dialog>
    </div>
  );
}

function SongPicker({ onPick, onClose }: { onPick: (songId: number) => Promise<unknown>; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [added, setAdded] = useState<string | null>(null);
  const songs = useLive((l) => l.listSongs(query), [query]);

  return (
    <div className="picker">
      <header className="page__header">
        <h2>Agregar canciones</h2>
        <button className="btn" onClick={onClose}>
          Listo
        </button>
      </header>
      <label className="search">
        <Icon name="search" size={20} />
        <input
          type="search"
          placeholder="Buscar"
          aria-label="Buscar canción"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <p className="picker__status" aria-live="polite">
        {added && `✓ Agregada: ${added}`}
      </p>
      <ul className="list">
        {songs?.map((s) => (
          <li key={s.id}>
            <button
              className="card"
              onClick={async () => {
                await onPick(s.id);
                setAdded(s.title);
              }}
            >
              <span className="card__main">
                <span className="card__title">{s.title}</span>
                {s.artist && <span className="card__sub">{s.artist}</span>}
              </span>
              <span className="key-badge">
                <Icon name="plus" size={18} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface Drag {
  from: number;
  to: number;
  /** Pointer position, in page coordinates. */
  y: number;
}

/** Row sizes measured when the drag starts (page coordinates). */
interface Geometry {
  tops: number[];
  heights: number[];
  gap: number;
  /** Where in the row the finger grabbed it. */
  grab: number;
}

function moved<T>(list: T[], from: number, to: number): T[] {
  const out = [...list];
  const [x] = out.splice(from, 1);
  out.splice(to, 0, x);
  return out;
}

/** The songs of a setlist. Drag the ⠿ handle (finger or mouse) to change the order. */
function SortableList({ setlistId, entries }: { setlistId: number; entries: SetlistEntry[] }) {
  const lib = useLibrary();
  const list = useRef<HTMLOListElement>(null);
  const geo = useRef<Geometry | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  // Order shown until the saved one comes back, so the list doesn't jump.
  const [pending, setPending] = useState<SetlistEntry[] | null>(null);
  useEffect(() => setPending(null), [entries]);

  const base = pending ?? entries;

  const move = (from: number, to: number) => {
    if (to < 0 || to >= base.length || to === from) return;
    setPending(moved(base, from, to));
    lib.moveSetlistItem(setlistId, from, to);
  };

  const start = (e: React.PointerEvent, i: number) => {
    if (e.button > 0 || !list.current) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const rows = Array.from(list.current.children) as HTMLElement[];
    const rects = rows.map((r) => r.getBoundingClientRect());
    const y = e.clientY + window.scrollY;
    geo.current = {
      tops: rects.map((r) => r.top + window.scrollY),
      heights: rects.map((r) => r.height),
      gap: rects.length > 1 ? rects[1].top - rects[0].bottom : 8,
      grab: y - (rects[i].top + window.scrollY),
    };
    setDrag({ from: i, to: i, y });
  };

  const track = (e: React.PointerEvent) => {
    const g = geo.current;
    if (!drag || !g) return;
    // Near the edges of the screen: scroll so long setlists can be reordered.
    if (e.clientY < 70) window.scrollBy(0, -12);
    else if (e.clientY > window.innerHeight - 70) window.scrollBy(0, 12);
    const y = e.clientY + window.scrollY;
    const center = y - g.grab + g.heights[drag.from] / 2;
    let to = 0;
    g.tops.forEach((top, k) => {
      if (k !== drag.from && center > top + g.heights[k] / 2) to++;
    });
    setDrag({ ...drag, to, y });
  };

  const end = () => {
    if (drag) move(drag.from, drag.to);
    setDrag(null);
    geo.current = null;
  };

  /** While dragging the rows stay in place in the page; they only slide (moving them would drop the drag). */
  const place = (k: number): { n: number; shift?: number } => {
    const g = geo.current;
    if (!drag || !g) return { n: k };
    const { from, to } = drag;
    if (k === from) return { n: to, shift: drag.y - g.grab - g.tops[from] };
    const room = g.heights[from] + g.gap;
    if (from < to && k > from && k <= to) return { n: k - 1, shift: -room };
    if (to < from && k >= to && k < from) return { n: k + 1, shift: room };
    return { n: k };
  };

  return (
    <ol className={`list${drag ? ' list--dragging' : ''}`} ref={list}>
      {base.map(({ item, song }, i) => {
        const key = song.songKey && transposeKey(song.songKey, item.transpose);
        const dragged = drag?.from === i;
        const { n, shift } = place(i);
        return (
          <li
            key={item.id}
            className={`card${dragged ? ' card--dragged' : ''}`}
            style={shift ? { transform: `translateY(${shift}px)` } : undefined}
          >
            <a className="card__link" href={`#/play/${setlistId}/${i}`}>
              <span className="num-badge">{n + 1}</span>
              <span className="card__main">
                <span className="card__title">{song.title}</span>
                <span className="card__sub">
                  {[song.artist, item.transpose ? `${item.transpose > 0 ? '+' : ''}${item.transpose} semitonos` : null]
                    .filter(Boolean)
                    .join(' · ') || ' '}
                </span>
              </span>
              {key && <span className="key-badge">{key}</span>}
            </a>
            <span className="card__tools">
              <button
                className="icon-btn icon-btn--small"
                aria-label={`Quitar ${song.title}`}
                onClick={() => lib.removeSetlistItem(item.id)}
              >
                <Icon name="close" size={18} />
              </button>
              <button
                className="icon-btn grip"
                aria-label={`Mover ${song.title} (arrastrá, o usá las flechas)`}
                onPointerDown={(e) => start(e, i)}
                onPointerMove={track}
                onPointerUp={end}
                onPointerCancel={end}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp') move(i, i - 1);
                  else if (e.key === 'ArrowDown') move(i, i + 1);
                  else return;
                  e.preventDefault();
                }}
              >
                <Icon name="grip" size={22} />
              </button>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

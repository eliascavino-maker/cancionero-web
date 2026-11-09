import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ChordName } from '../components/ChordName';
import { Icon } from '../components/Icon';
import { searchSongs } from '../data/search';
import { fold } from '../importer/chart';
import { navigate, useLive } from './hooks';

let isOpen = false;
const listeners = new Set<() => void>();
/** Opens the global search (also Ctrl+K / ⌘K). */
export function openSearch() {
  isOpen = true;
  listeners.forEach((l) => l());
}
function closeSearch() {
  isOpen = false;
  listeners.forEach((l) => l());
}

/** Ctrl+K or ⌘K anywhere; "/" when not typing. */
export function useSearchShortcut(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        openSearch();
      } else if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        openSearch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}

export function SearchPalette() {
  const open = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => isOpen,
  );
  return open ? <Palette /> : null;
}

function Palette() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const songs = useLive((l) => l.allSongs(), []);
  const setlists = useLive((l) => l.listSetlists(), []);

  useEffect(() => {
    const d = dialog.current;
    if (d && typeof d.showModal === 'function') d.showModal();
    else d?.setAttribute('open', '');
  }, []);

  const results = useMemo(() => {
    const q = fold(query);
    const lists = q
      ? (setlists ?? [])
          .filter((s) => fold(s.setlist.name).includes(q))
          .slice(0, 5)
          .map((s) => ({ kind: 'setlist' as const, id: s.setlist.id, title: s.setlist.name, sub: `${s.songCount} canciones` }))
      : [];
    const hits = searchSongs(songs ?? [], query).map((h) => ({
      kind: 'song' as const,
      id: h.song.id,
      title: h.song.arrangementName ? `${h.song.title} · ${h.song.arrangementName}` : h.song.title,
      sub: h.where === 'letra' ? `«${h.line}»` : h.song.artist,
      songKey: h.song.songKey,
    }));
    return [...hits, ...lists];
  }, [query, songs, setlists]);

  const go = (i: number) => {
    const r = results[i];
    if (!r) return;
    closeSearch();
    navigate(r.kind === 'song' ? `/song/${r.id}` : `/setlist/${r.id}`);
  };

  return (
    <dialog
      ref={dialog}
      className="dialog palette"
      aria-label="Buscar"
      onClose={closeSearch}
      onClick={(e) => e.target === dialog.current && dialog.current?.close()}
    >
      <label className="palette__field">
        <Icon name="search" size={20} />
        <input
          autoFocus
          type="search"
          placeholder="Título, artista o una frase de la letra"
          aria-label="Buscar canciones y setlists"
          aria-controls="palette-results"
          aria-activedescendant={results[active] ? `palette-${active}` : undefined}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, results.length - 1));
            else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
            else if (e.key === 'Enter') go(active);
            else return;
            e.preventDefault();
          }}
        />
        <kbd className="palette__esc">Esc</kbd>
      </label>
      <ul id="palette-results" className="palette__list" role="listbox" aria-label="Resultados">
        {results.map((r, i) => (
          <li
            key={`${r.kind}-${r.id}`}
            id={`palette-${i}`}
            role="option"
            aria-selected={i === active}
            className="palette__item"
            onMouseMove={() => setActive(i)}
            onClick={() => go(i)}
          >
            <Icon name={r.kind === 'song' ? 'music' : 'list'} size={18} />
            <span className="palette__main">
              <span className="palette__title">{r.title}</span>
              {r.sub && <span className="palette__sub">{r.sub}</span>}
            </span>
            {r.kind === 'song' && r.songKey && (
              <span className="key-badge key-badge--small">
                <ChordName chord={r.songKey} />
              </span>
            )}
          </li>
        ))}
      </ul>
      {query.trim() && !results.length && <p className="palette__empty">Nada con «{query.trim()}».</p>}
      {!query.trim() && <p className="palette__empty">Buscá en los títulos, los artistas y la letra de todas las canciones.</p>}
    </dialog>
  );
}

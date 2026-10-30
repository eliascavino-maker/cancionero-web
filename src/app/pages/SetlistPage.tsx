import { useRef, useState } from 'react';
import { transposeKey } from '../../music/transposer';
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

  if (data === undefined) return null;
  if (data === null) return <p className="empty">El setlist no existe.</p>;
  const { setlist, entries } = data;

  const rename = async () => {
    const name = prompt('Nuevo nombre', setlist.name)?.trim();
    if (name) await lib.renameSetlist(id, name);
  };

  const remove = async () => {
    if (!confirm(`¿Borrar "${setlist.name}"? Las canciones quedan en la biblioteca.`)) return;
    await lib.deleteSetlist(id);
    navigate('/setlists');
  };

  return (
    <div className="page">
      <header className="page__header">
        <a className="back" href="#/setlists" aria-label="Volver a setlists">
          ←
        </a>
        <h1>{setlist.name}</h1>
        <div className="page__actions">
          {entries.length > 0 && (
            <button className="btn btn--primary" onClick={() => navigate(`/play/${id}/0`)}>
              ▶ Tocar
            </button>
          )}
          <button className="btn" onClick={() => dialog.current?.showModal()}>
            + Canciones
          </button>
          <button className="btn" onClick={rename}>
            Renombrar
          </button>
          <button className="btn btn--danger" onClick={remove}>
            Borrar
          </button>
        </div>
      </header>

      {entries.length === 0 ? (
        <p className="empty">Agregá canciones con "+ Canciones".</p>
      ) : (
        <ol className="list">
          {entries.map(({ item, song }, i) => {
            const key = song.songKey && transposeKey(song.songKey, item.transpose);
            const shift = item.transpose ? ` (${item.transpose > 0 ? '+' : ''}${item.transpose})` : '';
            return (
              <li key={item.id} className="list__row">
                <a className="list__item" href={`#/play/${id}/${i}`}>
                  <span className="list__num">{i + 1}</span>
                  <span className="list__main">
                    <span className="list__title">{song.title}</span>
                    <span className="list__sub">
                      {[song.artist, key && `Tono ${key}${shift}`].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </a>
                <span className="list__tools">
                  <button
                    className="icon-btn"
                    aria-label={`Subir ${song.title}`}
                    disabled={i === 0}
                    onClick={() => lib.moveSetlistItem(id, i, i - 1)}
                  >
                    ↑
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={`Bajar ${song.title}`}
                    disabled={i === entries.length - 1}
                    onClick={() => lib.moveSetlistItem(id, i, i + 1)}
                  >
                    ↓
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={`Quitar ${song.title}`}
                    onClick={() => lib.removeSetlistItem(item.id)}
                  >
                    ✕
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
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
      <input
        className="search"
        type="search"
        placeholder="Buscar"
        aria-label="Buscar canción"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <p className="picker__status" aria-live="polite">
        {added && `Agregada: ${added}`}
      </p>
      <ul className="list">
        {songs?.map((s) => (
          <li key={s.id}>
            <button
              className="list__item"
              onClick={async () => {
                await onPick(s.id);
                setAdded(s.title);
              }}
            >
              <span className="list__main">
                <span className="list__title">{s.title}</span>
                {s.artist && <span className="list__sub">{s.artist}</span>}
              </span>
              <span className="list__key">+</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

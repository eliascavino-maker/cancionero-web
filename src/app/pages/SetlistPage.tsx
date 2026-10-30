import { useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
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
        <ol className="list">
          {entries.map(({ item, song }, i) => {
            const key = song.songKey && transposeKey(song.songKey, item.transpose);
            return (
              <li key={item.id} className="card">
                <a className="card__link" href={`#/play/${id}/${i}`}>
                  <span className="num-badge">{i + 1}</span>
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
                  <span className="reorder">
                    <button
                      className="icon-btn"
                      aria-label={`Subir ${song.title}`}
                      disabled={i === 0}
                      onClick={() => lib.moveSetlistItem(id, i, i - 1)}
                    >
                      <Icon name="up" size={16} />
                    </button>
                    <button
                      className="icon-btn"
                      aria-label={`Bajar ${song.title}`}
                      disabled={i === entries.length - 1}
                      onClick={() => lib.moveSetlistItem(id, i, i + 1)}
                    >
                      <Icon name="down" size={16} />
                    </button>
                  </span>
                  <button
                    className="icon-btn icon-btn--small"
                    aria-label={`Quitar ${song.title}`}
                    onClick={() => lib.removeSetlistItem(item.id)}
                  >
                    <Icon name="close" size={18} />
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

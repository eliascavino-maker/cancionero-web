import { useEffect, useMemo, useRef, useState } from 'react';
import { type BandSong, bandSongs } from '../data/bandSongs';
import type { SongRecord } from '../data/library';
import { fold } from '../importer/chart';
import { useLibrary } from './hooks';

interface Row {
  song: BandSong;
  /** Same song already in this browser: it gets replaced (setlists keep it). */
  existing?: SongRecord;
  include: boolean;
  done?: boolean;
}

/** Loads the band's songs (lyrics + chords + voices) into this browser. */
export function BandSongsDialog({ onClose }: { onClose: () => void }) {
  const lib = useLibrary();
  const songs = useMemo(bandSongs, []);
  const dialog = useRef<HTMLDialogElement>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const finished = rows?.some((r) => r.done);

  useEffect(() => {
    const d = dialog.current;
    if (d && typeof d.showModal === 'function') d.showModal();
    else d?.setAttribute('open', '');
    lib.listSongs().then((all) =>
      setRows(
        songs.map((song) => {
          const names = [song.title, ...song.aliases].map(fold);
          const existing = all.find((s) => names.includes(fold(s.title.replace(/\(acordes\)/i, ''))));
          return { song, existing, include: true };
        }),
      ),
    );
  }, [lib, songs]);

  const run = async () => {
    if (!rows) return;
    setBusy(true);
    const out: Row[] = [];
    for (const r of rows) {
      if (r.include) await lib.saveSong(r.song.content, r.existing?.id);
      out.push({ ...r, done: r.include });
    }
    setRows(out);
    setBusy(false);
  };

  const count = rows?.filter((r) => r.include).length ?? 0;

  return (
    <dialog
      ref={dialog}
      className="dialog import"
      aria-label="Canciones de la banda"
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && dialog.current.close()}
    >
      <header className="page__header">
        <h2>{finished ? 'Listo' : 'Canciones de la banda'}</h2>
      </header>
      <ul className="import__list">
        {rows?.map((r, i) => (
          <li key={r.song.title} className="import__row">
            <label>
              <input
                type="checkbox"
                checked={r.include}
                disabled={finished || busy}
                onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, include: e.target.checked } : x)))}
              />
              <span className="import__title">{r.song.title}</span>
            </label>
            <span className={`import__status${r.done ? ' import__status--done' : ''}`}>
              {r.done
                ? r.existing
                  ? 'Actualizada'
                  : 'Agregada'
                : r.existing
                  ? `Reemplaza «${r.existing.title}»`
                  : 'Nueva'}
            </span>
          </li>
        ))}
      </ul>
      <div className="import__actions">
        {finished ? (
          <button className="btn btn--primary" onClick={() => dialog.current?.close()}>
            Cerrar
          </button>
        ) : (
          <>
            <button className="btn" onClick={() => dialog.current?.close()}>
              Cancelar
            </button>
            <button className="btn btn--primary" disabled={!count || busy} onClick={run}>
              {busy ? 'Cargando…' : `Cargar ${count}`}
            </button>
          </>
        )}
      </div>
    </dialog>
  );
}

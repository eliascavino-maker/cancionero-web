import { useEffect, useMemo, useRef, useState } from 'react';
import { parseChordPro } from '../chordpro/parser';
import { type BandSong, REPERTORIO, bandSongs } from '../data/bandSongs';
import type { SongRecord } from '../data/library';
import { fold, mergeChart } from '../importer/chart';
import { useLibrary } from './hooks';

interface Row {
  song: BandSong;
  /** Same song already in this browser: it gets replaced (setlists keep it). */
  existing?: SongRecord;
  /** The existing song has lyrics and the band song is chords only: chords are added to those lyrics. */
  merge: boolean;
  include: boolean;
  done?: boolean;
}

const SETLIST = 'Repertorio';

/** True when the song has sung words (not just chords). */
function hasLyrics(content: string): boolean {
  return parseChordPro(content).sections.some((s) =>
    s.lines.some((l) => l.type === 'lyric' && l.segments.some((g) => g.lyric.trim())),
  );
}

/** Loads the band's songs (lyrics + chords + voices) into this browser. */
export function BandSongsDialog({ onClose }: { onClose: () => void }) {
  const lib = useLibrary();
  const songs = useMemo(bandSongs, []);
  const dialog = useRef<HTMLDialogElement>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [hasSetlist, setHasSetlist] = useState(true);
  const [makeSetlist, setMakeSetlist] = useState(true);
  const [setlistDone, setSetlistDone] = useState(false);
  const finished = rows?.some((r) => r.done);

  useEffect(() => {
    const d = dialog.current;
    if (d && typeof d.showModal === 'function') d.showModal();
    else d?.setAttribute('open', '');
    lib.listSetlists().then((all) => setHasSetlist(all.some((s) => fold(s.setlist.name) === fold(SETLIST))));
    lib.listSongs().then((all) =>
      setRows(
        songs.map((song) => {
          const names = [song.title, ...song.aliases].map(fold);
          const existing = all.find((s) => names.includes(fold(s.title.replace(/\(acordes\)/i, ''))));
          const merge = !!(existing && song.chart && hasLyrics(existing.content));
          return { song, existing, merge, include: true };
        }),
      ),
    );
  }, [lib, songs]);

  const run = async () => {
    if (!rows) return;
    setBusy(true);
    const out: Row[] = [];
    const ids = new Map<string, number>();
    for (const r of rows) {
      let id = r.existing?.id;
      if (r.include) {
        const content =
          r.merge && r.existing && r.song.chart
            ? mergeChart(r.existing.content, r.song.chart.song, r.song.chart.all).content
            : r.song.content;
        id = await lib.saveSong(content, r.existing?.id);
      }
      if (id !== undefined) ids.set(fold(r.song.title), id);
      out.push({ ...r, done: r.include });
    }
    if (makeSetlist && !hasSetlist) {
      const setlist = await lib.createSetlist(SETLIST);
      for (const title of REPERTORIO) {
        const id = ids.get(fold(title));
        if (id !== undefined) await lib.addSongToSetlist(setlist, id);
      }
      setSetlistDone(true);
    }
    setRows(out);
    setBusy(false);
  };

  const count = rows?.filter((r) => r.include).length ?? 0;
  const status = (r: Row) => {
    if (r.done) return r.merge ? 'Acordes agregados' : r.existing ? 'Actualizada' : 'Agregada';
    if (r.merge) return 'Se agregan los acordes a tu letra';
    return r.existing ? `Reemplaza «${r.existing.title}»` : 'Nueva';
  };

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
            <span className={`import__status${r.done ? ' import__status--done' : ''}`}>{status(r)}</span>
          </li>
        ))}
      </ul>
      {!hasSetlist && (
        <label className="import__row import__setlist">
          <span>
            <input
              type="checkbox"
              checked={makeSetlist}
              disabled={finished || busy}
              onChange={(e) => setMakeSetlist(e.target.checked)}
            />{' '}
            Armar el setlist «{SETLIST}» en orden
          </span>
          {setlistDone && <span className="import__status import__status--done">Creado</span>}
        </label>
      )}
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

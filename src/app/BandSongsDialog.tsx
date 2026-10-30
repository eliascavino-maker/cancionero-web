import { useEffect, useMemo, useRef, useState } from 'react';
import { parseChordPro } from '../chordpro/parser';
import { BAND_SETLISTS, type BandSong, bandSongs } from '../data/bandSongs';
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
  // Band setlists not in this browser yet: name → build it?
  const [newSetlists, setNewSetlists] = useState<Map<string, boolean>>(new Map());
  const [setlistsDone, setSetlistsDone] = useState(false);
  const finished = rows?.some((r) => r.done);

  useEffect(() => {
    const d = dialog.current;
    if (d && typeof d.showModal === 'function') d.showModal();
    else d?.setAttribute('open', '');
    lib.listSetlists().then((all) => {
      const have = new Set(all.map((s) => fold(s.setlist.name)));
      setNewSetlists(new Map(BAND_SETLISTS.filter((b) => !have.has(fold(b.name))).map((b) => [b.name, true])));
    });
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
    for (const band of BAND_SETLISTS) {
      if (!newSetlists.get(band.name)) continue;
      const setlist = await lib.createSetlist(band.name);
      for (const { title, transpose } of band.songs) {
        const id = ids.get(fold(title));
        if (id !== undefined) await lib.addSongToSetlist(setlist, id, transpose);
      }
    }
    setSetlistsDone(true);
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
      {[...newSetlists].map(([name, on]) => (
        <label key={name} className="import__row import__setlist">
          <span>
            <input
              type="checkbox"
              checked={on}
              disabled={finished || busy}
              onChange={(e) => setNewSetlists(new Map(newSetlists).set(name, e.target.checked))}
            />{' '}
            Armar el setlist «{name}» en orden
          </span>
          {setlistsDone && on && <span className="import__status import__status--done">Creado</span>}
        </label>
      ))}
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

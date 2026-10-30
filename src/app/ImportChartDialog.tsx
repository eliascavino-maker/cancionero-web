import { useEffect, useRef, useState } from 'react';
import type { SongRecord } from '../data/library';
import { type ChartSong, chartToChordPro, fold, mergeChart } from '../importer/chart';
import { useLibrary } from './hooks';

interface Row {
  song: ChartSong;
  /** Song in the library with the same title: chords get added to its lyrics. */
  existing?: SongRecord;
  include: boolean;
  result?: string;
}

const sameTitle = (a: string, b: string) => fold(a.replace(/\(acordes\)/i, '')) === fold(b.replace(/\(acordes\)/i, ''));

/**
 * Songs found in an uploaded chord document. New titles become new songs;
 * titles already in the library get the chords added to their lyrics.
 */
export function ImportChartDialog({ songs, onClose }: { songs: ChartSong[]; onClose: () => void }) {
  const lib = useLibrary();
  const dialog = useRef<HTMLDialogElement>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const done = rows?.some((r) => r.result);

  useEffect(() => {
    const d = dialog.current;
    if (d && typeof d.showModal === 'function') d.showModal();
    else d?.setAttribute('open', '');
    lib.listSongs().then((all) =>
      setRows(songs.map((song) => ({ song, existing: all.find((s) => sameTitle(s.title, song.title)), include: true }))),
    );
  }, [lib, songs]);

  const run = async () => {
    if (!rows) return;
    setBusy(true);
    const out: Row[] = [];
    for (const r of rows) {
      if (!r.include) {
        out.push(r);
        continue;
      }
      if (!r.existing) {
        await lib.saveSong(chartToChordPro(r.song, songs));
        out.push({ ...r, result: 'Creada' });
        continue;
      }
      const m = mergeChart(r.existing.content, r.song, songs);
      if (m.content !== r.existing.content) await lib.saveSong(m.content, r.existing.id);
      const parts = [
        m.added && `acordes en ${m.added} ${m.added === 1 ? 'parte' : 'partes'}`,
        m.inserted && `${m.inserted} ${m.inserted === 1 ? 'parte nueva' : 'partes nuevas'}`,
        m.skipped && `${m.skipped} ya ${m.skipped === 1 ? 'tenía' : 'tenían'} acordes`,
      ].filter(Boolean);
      out.push({ ...r, result: parts.length ? `Letra: ${parts.join(', ')}` : 'Sin cambios' });
    }
    setRows(out);
    setBusy(false);
  };

  const count = rows?.filter((r) => r.include).length ?? 0;

  return (
    <dialog
      ref={dialog}
      className="dialog import"
      aria-label="Importar acordes"
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && dialog.current.close()}
    >
      <header className="page__header">
        <h2>{done ? 'Listo' : `${songs.length} ${songs.length === 1 ? 'canción' : 'canciones'} en el documento`}</h2>
      </header>
      {songs.length === 0 && (
        <p className="empty">No encontré canciones. Los títulos tienen que estar en MAYÚSCULAS y las partes como "estrofa:", "estribillo:".</p>
      )}
      <ul className="import__list">
        {rows?.map((r, i) => (
          <li key={i} className="import__row">
            <label>
              <input
                type="checkbox"
                checked={r.include}
                disabled={done || busy}
                onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, include: e.target.checked } : x)))}
              />
              <span className="import__title">{r.song.title}</span>
            </label>
            <span className={`import__status${r.result ? ' import__status--done' : ''}`}>
              {r.result ?? (r.existing ? 'Se agregan los acordes a la letra' : 'Nueva')}
            </span>
          </li>
        ))}
      </ul>
      <div className="import__actions">
        {done ? (
          <button className="btn btn--primary" onClick={() => dialog.current?.close()}>
            Cerrar
          </button>
        ) : (
          <>
            <button className="btn" onClick={() => dialog.current?.close()}>
              Cancelar
            </button>
            <button className="btn btn--primary" disabled={!count || busy} onClick={run}>
              {busy ? 'Importando…' : `Importar ${count}`}
            </button>
          </>
        )}
      </div>
    </dialog>
  );
}

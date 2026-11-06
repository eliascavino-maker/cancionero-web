import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { parseChordPro } from '../chordpro/parser';
import { ChordName } from '../components/ChordName';
import { SongView } from '../components/SongView';
import { cleanCapo, withCapo } from '../music/capo';
import { effectiveKey, transposeSong } from '../music/transposer';
import { getPrefs } from './hooks';
import './print.css';

export interface PrintOptions {
  chords: boolean;
  cues: boolean;
  /** Draw my capo shapes (only when chords are shown). */
  capo: boolean;
}

export interface PrintSong {
  id: string;
  content: string;
  /** Shift from the song's key: the setlist's, or the one on screen. */
  transpose: number;
}

export interface PrintCover {
  /** Setlist name. */
  title: string;
  band?: string;
  /** Data URL or address of the band's logo. */
  logo?: string;
}

function prepared(song: PrintSong, opts: PrintOptions) {
  const transposed = transposeSong(parseChordPro(song.content), song.transpose);
  const fret = opts.chords && opts.capo ? cleanCapo(getPrefs().capo?.[song.id]) : 0;
  const shown = withCapo(transposed, fret);
  const key = effectiveKey(transposed);
  return {
    shown,
    key,
    capo: fret ? { fret, key: transposed.metadata.key, shapes: effectiveKey(shown) } : undefined,
  };
}

/** What goes on paper: the cover (for a setlist), then one song per page. */
export function PrintSheet({ songs, opts, cover }: { songs: PrintSong[]; opts: PrintOptions; cover?: PrintCover }) {
  const list = songs.map((s) => ({ id: s.id, ...prepared(s, opts) }));
  return (
    <div className="print-sheet">
      {cover && (
        <section className="print-cover">
          {cover.logo && <img className="print-cover__logo" src={cover.logo} alt="" />}
          {cover.band && <p className="print-cover__band">{cover.band}</p>}
          <h1 className="print-cover__title">{cover.title}</h1>
          <ol className="print-cover__list">
            {list.map((s, i) => (
              <li key={i}>
                <span>{s.shown.metadata.title ?? 'Sin título'}</span>
                {s.key && (
                  <span className="print-cover__key">
                    <ChordName chord={s.key} />
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
      {list.map((s, i) => (
        <section className="print-song" key={i}>
          <SongView song={s.shown} capo={s.capo} showChords={opts.chords} showCues={opts.cues} fontSize={17} />
        </section>
      ))}
    </div>
  );
}

/**
 * Opens the system's print dialog with only `sheet` on the page: there, «Guardar
 * como PDF». Works on computers, Android and iPhone, with no extra libraries.
 */
/** Cleans up the last sheet; set while one is on the page. */
let lastSheet: (() => void) | null = null;

export function printSheet(sheet: React.ReactNode, name: string): void {
  lastSheet?.();
  const host = document.createElement('div');
  host.className = 'print-root';
  document.body.appendChild(host);
  const root = createRoot(host);
  flushSync(() => root.render(sheet));
  const html = document.documentElement;
  const before = document.title;
  // The PDF's file name comes from the page title.
  document.title = name;
  html.classList.add('printing');
  const finish = () => {
    if (lastSheet !== finish) return;
    lastSheet = null;
    window.removeEventListener('afterprint', finish);
    html.classList.remove('printing');
    document.title = before;
    root.unmount();
    host.remove();
  };
  lastSheet = finish;
  // On iPhone print() returns at once: the sheet stays until the dialog is done.
  window.addEventListener('afterprint', finish);
  try {
    window.print();
  } catch {
    finish();
  }
}

/** «Exportar PDF»: Letra or Acordes, indications, my capo. Then the print dialog. */
export function ExportPdfDialog({
  songs,
  cover,
  name,
  onClose,
}: {
  songs: PrintSong[];
  cover?: PrintCover;
  /** File name, without .pdf. */
  name: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const prefs = getPrefs();
  const [opts, setOpts] = useState<PrintOptions>({ chords: prefs.showChords, cues: prefs.showCues, capo: true });
  const hasCapo = songs.some((s) => cleanCapo(prefs.capo?.[s.id]));

  useEffect(() => {
    const d = dialog.current;
    if (d && typeof d.showModal === 'function') d.showModal();
    else d?.setAttribute('open', '');
  }, []);

  const close = () => {
    const d = dialog.current;
    if (d && typeof d.close === 'function') d.close();
    else onClose();
  };
  const go = () => {
    close();
    printSheet(<PrintSheet songs={songs} opts={opts} cover={cover} />, name);
  };

  return (
    <dialog
      ref={dialog}
      className="dialog ask"
      aria-label="Exportar PDF"
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && close()}
    >
      <h2 className="ask__title">Exportar PDF</h2>
      <p className="pdf__hint">
        {songs.length === 1 ? 'La canción' : `${songs.length} canciones, una por página`}, en el tono{' '}
        {cover ? 'del setlist' : 'que tenés en pantalla'}. En la ventana de imprimir elegí «Guardar como PDF».
      </p>
      <div className="segmented pdf__view" role="group" aria-label="Qué se ve">
        <button aria-pressed={!opts.chords} onClick={() => setOpts({ ...opts, chords: false })}>
          Letra
        </button>
        <button aria-pressed={opts.chords} onClick={() => setOpts({ ...opts, chords: true })}>
          Acordes
        </button>
      </div>
      <label className="pdf__check">
        <input type="checkbox" checked={opts.cues} onChange={(e) => setOpts({ ...opts, cues: e.target.checked })} />
        Indicaciones
      </label>
      {hasCapo && opts.chords && (
        <label className="pdf__check">
          <input type="checkbox" checked={opts.capo} onChange={(e) => setOpts({ ...opts, capo: e.target.checked })} />
          Con mi capo
        </label>
      )}
      <div className="ask__actions">
        <button className="btn" onClick={close}>
          Cancelar
        </button>
        <button className="btn btn--primary" onClick={go} disabled={songs.length === 0}>
          Exportar
        </button>
      </div>
    </dialog>
  );
}

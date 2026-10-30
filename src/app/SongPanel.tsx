import { useMemo } from 'react';
import { parseChordPro } from '../chordpro/parser';
import { SongView } from '../components/SongView';
import { effectiveKey, normalize, transposeSong } from '../music/transposer';
import { type Prefs, usePrefs } from './hooks';

/** Song sheet plus a bottom bar: transpose −/+, font size, chords on/off. */
export function SongPanel({
  content,
  transpose,
  onTransposeChange,
}: {
  content: string;
  transpose: number;
  onTransposeChange: (n: number) => void;
}) {
  const [prefs, setPrefs] = usePrefs();
  const parsed = useMemo(() => parseChordPro(content), [content]);
  const shown = useMemo(() => transposeSong(parsed, transpose), [parsed, transpose]);
  const key = effectiveKey(shown);
  const set = (p: Partial<Prefs>) => setPrefs({ ...prefs, ...p });

  return (
    <div className="song-panel">
      <div className="song-panel__sheet">
        <SongView song={shown} fontSize={prefs.fontSize} showChords={prefs.showChords} />
      </div>
      <div className="toolbar" role="toolbar" aria-label="Controles de la canción">
        <button className="icon-btn" aria-label="Bajar medio tono" onClick={() => onTransposeChange(normalize(transpose - 1))}>
          −
        </button>
        <button
          className="key-display"
          title={transpose ? 'Volver al tono original' : undefined}
          disabled={transpose === 0}
          onClick={() => onTransposeChange(0)}
        >
          <strong>{key ?? '—'}</strong>
          <small>{transpose === 0 ? 'original' : transpose > 0 ? `+${transpose}` : transpose}</small>
        </button>
        <button className="icon-btn" aria-label="Subir medio tono" onClick={() => onTransposeChange(normalize(transpose + 1))}>
          +
        </button>
        <span className="toolbar__spacer" />
        <button
          className="icon-btn"
          aria-label="Letra más chica"
          disabled={prefs.fontSize <= 12}
          onClick={() => set({ fontSize: prefs.fontSize - 2 })}
        >
          A−
        </button>
        <button
          className="icon-btn"
          aria-label="Letra más grande"
          disabled={prefs.fontSize >= 40}
          onClick={() => set({ fontSize: prefs.fontSize + 2 })}
        >
          A+
        </button>
        <button
          className="icon-btn"
          aria-pressed={prefs.showChords}
          aria-label="Mostrar acordes"
          onClick={() => set({ showChords: !prefs.showChords })}
        >
          ♪
        </button>
      </div>
    </div>
  );
}

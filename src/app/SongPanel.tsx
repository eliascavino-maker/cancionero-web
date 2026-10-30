import { useEffect, useMemo, useState } from 'react';
import { parseChordPro } from '../chordpro/parser';
import { Icon } from '../components/Icon';
import { SongView } from '../components/SongView';
import { effectiveKey, normalize, transposeSong } from '../music/transposer';
import {
  DEFAULT_LEVEL,
  SPEED_LEVELS,
  nearestLevel,
  parseDuration,
  speedForDuration,
  useAutoScroll,
  useSavedLevel,
  useWakeLock,
} from './autoscroll';
import { type Prefs, usePrefs } from './hooks';

/**
 * Song sheet plus a bottom bar: Letra/Acordes mode, transpose, font size and
 * auto-scroll.
 *
 * `songKey` identifies the song to remember its scroll speed.
 */
export function SongPanel({
  content,
  transpose,
  onTransposeChange,
  songKey,
}: {
  content: string;
  transpose: number;
  onTransposeChange: (n: number) => void;
  songKey?: string;
}) {
  const [prefs, setPrefs] = usePrefs();
  const parsed = useMemo(() => parseChordPro(content), [content]);
  const shown = useMemo(() => transposeSong(parsed, transpose), [parsed, transpose]);
  const key = effectiveKey(shown);
  const set = (p: Partial<Prefs>) => setPrefs({ ...prefs, ...p });

  // ----- auto-scroll
  const [playing, setPlaying] = useState(false);
  const [savedLevel, saveLevel] = useSavedLevel(songKey);
  const duration = parseDuration(shown.metadata.duration);
  // Duration-based speed is measured when playback starts (page height is known then).
  const [durationSpeed, setDurationSpeed] = useState<number | null>(null);
  const auto = savedLevel === null && duration !== null;
  const speed = auto ? (durationSpeed ?? SPEED_LEVELS[DEFAULT_LEVEL]) : SPEED_LEVELS[savedLevel ?? DEFAULT_LEVEL];
  const level = savedLevel ?? (auto ? nearestLevel(speed) : DEFAULT_LEVEL);

  const togglePlay = () => {
    if (!playing && duration !== null && savedLevel === null) setDurationSpeed(speedForDuration(duration));
    setPlaying(!playing);
  };
  const changeSpeed = (delta: number) => saveLevel(Math.max(0, Math.min(SPEED_LEVELS.length - 1, level + delta)));

  useAutoScroll(playing, speed, () => setPlaying(false));
  useWakeLock(playing);

  // Immersive while scrolling: CSS hides menus and shrinks the toolbar.
  useEffect(() => {
    document.documentElement.classList.toggle('is-scrolling', playing);
    return () => document.documentElement.classList.remove('is-scrolling');
  }, [playing]);

  // Touching the sheet or scrolling by hand pauses; Space toggles.
  useEffect(() => {
    const pause = () => setPlaying(false);
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLButtonElement) return;
      if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    if (playing) window.addEventListener('wheel', pause, { passive: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', pause);
    };
  }, [playing]);

  return (
    <div className="song-panel">
      <div className="song-panel__sheet" data-testid="sheet" onPointerDown={() => playing && setPlaying(false)}>
        <SongView song={shown} fontSize={prefs.fontSize} showChords={prefs.showChords} />
      </div>
      <div className="toolbar" role="toolbar" aria-label="Controles de la canción">
        <div className="toolbar__row">
          <div className="segmented" role="group" aria-label="Vista">
            <button aria-pressed={!prefs.showChords} onClick={() => set({ showChords: false })}>
              Letra
            </button>
            <button aria-pressed={prefs.showChords} onClick={() => set({ showChords: true })}>
              Acordes
            </button>
          </div>
          <span className="toolbar__spacer" />
          {prefs.showChords && (
            <div className="toolbar__group" role="group" aria-label="Tono">
              <button className="icon-btn" aria-label="Bajar medio tono" onClick={() => onTransposeChange(normalize(transpose - 1))}>
                <Icon name="minus" />
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
                <Icon name="plus" />
              </button>
            </div>
          )}
        </div>
        <div className="toolbar__row toolbar__row--play">
          <button
            className="play-btn"
            aria-pressed={playing}
            aria-label={playing ? 'Pausar desplazamiento' : 'Desplazar automáticamente'}
            onClick={togglePlay}
          >
            <Icon name={playing ? 'pause' : 'play'} size={26} />
          </button>
          <div className="toolbar__group" role="group" aria-label="Velocidad">
            <button
              className="icon-btn icon-btn--small"
              aria-label="Más lento"
              disabled={!auto && level === 0}
              onClick={() => changeSpeed(-1)}
            >
              <Icon name="minus" size={18} />
            </button>
            <span className="speed" aria-live="polite">
              <strong>{auto ? 'auto' : level + 1}</strong>
              <small>velocidad</small>
            </span>
            <button
              className="icon-btn icon-btn--small"
              aria-label="Más rápido"
              disabled={!auto && level === SPEED_LEVELS.length - 1}
              onClick={() => changeSpeed(1)}
            >
              <Icon name="plus" size={18} />
            </button>
          </div>
          <span className="toolbar__spacer" />
          <div className="toolbar__group" role="group" aria-label="Tamaño de letra">
            <button
              className="icon-btn"
              aria-label="Letra más chica"
              disabled={prefs.fontSize <= 14}
              onClick={() => set({ fontSize: prefs.fontSize - 2 })}
            >
              <Icon name="textSmaller" />
            </button>
            <button
              className="icon-btn"
              aria-label="Letra más grande"
              disabled={prefs.fontSize >= 44}
              onClick={() => set({ fontSize: prefs.fontSize + 2 })}
            >
              <Icon name="textLarger" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

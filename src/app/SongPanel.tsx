import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { type ChordRef, type MoveDirection, addAnnotation, moveChord, setAnnotation } from '../chordpro/moveChord';
import { parseChordPro } from '../chordpro/parser';
import { emptyParts, setLineVoices, setSectionParts } from '../chordpro/parts';
import type { SongSection } from '../chordpro/song';
import { MAX_BPM, MIN_BPM, bpmFromTaps, clampBpm, parseBpm, setTempo } from '../chordpro/tempo';
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
import { PartsDialog } from './PartsDialog';
import type { VoiceSelection } from '../components/SongView';
import { BAND, SINGERS } from '../data/band';

const SECTION_NAMES: Partial<Record<SongSection['kind'], string>> = {
  verse: 'Estrofa',
  chorus: 'Estribillo',
  bridge: 'Puente',
};

function sectionTitle(s: SongSection): string {
  if (s.label) return s.label;
  if (s.name) return s.name[0].toUpperCase() + s.name.slice(1).replace(/_/g, ' ');
  return SECTION_NAMES[s.kind] ?? 'Parte sin nombre';
}

/**
 * Song sheet plus a bottom bar: Letra/Acordes mode, transpose, font size and
 * auto-scroll.
 *
 * `songKey` identifies the song to remember its scroll speed.
 * With `onContentChange`, chords can be moved by hand ("Mover acordes").
 */
export function SongPanel({
  content: savedContent,
  transpose,
  onTransposeChange,
  songKey,
  onContentChange,
}: {
  content: string;
  transpose: number;
  onTransposeChange: (n: number) => void;
  songKey?: string;
  onContentChange?: (content: string) => void;
}) {
  const [prefs, setPrefs] = usePrefs();

  // ----- editing the text (moving chords, BPM). Edits show at once; saves
  // arrive later and are ignored if they are our own, so quick taps never jump back.
  const [content, setContent] = useState(savedContent);
  const sent = useRef(new Set<string>());
  useEffect(() => {
    if (!sent.current.has(savedContent)) setContent(savedContent);
  }, [savedContent]);
  const edit = (next: string) => {
    if (next === content) return;
    setContent(next);
    sent.current.add(next);
    onContentChange?.(next);
  };

  // Bottom bar: normal controls, the edit menu, or one of the editors.
  const [mode, setMode] = useState<'play' | 'tools' | 'move' | 'tempo' | 'parts' | 'notes' | 'voices'>('play');
  const moving = mode === 'move';
  const editingTempo = mode === 'tempo';
  const [selected, setSelected] = useState<ChordRef | null>(null);
  const [partsIndex, setPartsIndex] = useState<number | null>(null);
  const [voiceSel, setVoiceSel] = useState<VoiceSelection | null>(null);
  const tryMove = (dir: MoveDirection) => (selected ? moveChord(content, selected, dir) : null);
  const move = (dir: MoveDirection) => {
    const r = tryMove(dir);
    if (!r) return;
    edit(r.content);
    setSelected(r.ref);
  };

  const taps = useRef<number[]>([]);

  const stopMoving = () => {
    setMode('play');
    setSelected(null);
    setPartsIndex(null);
    setVoiceSel(null);
  };
  const startTempo = () => {
    taps.current = [];
    setSelected(null);
    setMode('tempo');
  };

  const parsed = useMemo(() => parseChordPro(content), [content]);
  const partsSection = partsIndex === null ? undefined : parsed.sections[partsIndex];

  // ----- voices: who sings the selected lines (the line's own, else the section's).
  const voiceSection = voiceSel ? parsed.sections[voiceSel.section] : undefined;
  const voiceLyrics = voiceSection?.lines.filter((l) => l.type === 'lyric') ?? [];
  const voiceLyricCount = voiceLyrics.length;
  const firstVoiced = voiceSel ? voiceLyrics[voiceSel.from] : undefined;
  const selectedVoices =
    (firstVoiced?.type === 'lyric' ? firstVoiced.singers : undefined) ?? voiceSection?.parts?.lead ?? [];
  const setVoices = (names: string[] | undefined) => {
    if (!voiceSection || !voiceSel) return;
    const ordered = names && SINGERS.filter((n) => names.includes(n)).concat(names.filter((n) => !SINGERS.includes(n)));
    edit(setLineVoices(content, voiceSection, voiceSel.from, voiceSel.to, ordered));
  };
  const bpm = parseBpm(parsed.metadata.tempo);
  const setBpm = (n: number) => edit(setTempo(content, clampBpm(n)));
  const tap = () => {
    const now = performance.now();
    taps.current = [...taps.current.slice(-7), now];
    const tapped = bpmFromTaps(taps.current);
    if (tapped !== null) setBpm(tapped);
  };
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

  useEffect(() => {
    if (playing) stopMoving();
  }, [playing]);

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
        <SongView
          song={shown}
          fontSize={prefs.fontSize}
          showChords={prefs.showChords || moving}
          chordEdit={moving ? { selected, onSelect: setSelected } : undefined}
          noteEdit={
            mode === 'notes'
              ? {
                  onWord: (line, col) => {
                    const text = window.prompt('Nota sobre esta palabra (ej: Silencio largo, Queda solo Leo)');
                    if (text?.trim()) edit(addAnnotation(content, line, col, text));
                  },
                  onNote: (ref, text) => {
                    const next = window.prompt('Cambiar la nota (vacía para borrarla)', text);
                    if (next !== null) edit(setAnnotation(content, ref, next));
                  },
                }
              : undefined
          }
          onTempoClick={
            onContentChange
              ? () => {
                  setPlaying(false);
                  startTempo();
                }
              : undefined
          }
          onEditParts={mode === 'parts' ? setPartsIndex : undefined}
          voiceEdit={
            mode === 'voices'
              ? {
                  selected: voiceSel,
                  // First tap picks a line, a second tap in the same part extends to a range.
                  onLine: (section, i) =>
                    setVoiceSel((sel) =>
                      sel && sel.section === section && sel.from === sel.to && sel.from !== i
                        ? { section, from: Math.min(sel.from, i), to: Math.max(sel.from, i) }
                        : { section, from: i, to: i },
                    ),
                }
              : undefined
          }
        />
      </div>
      {partsSection && (
        <PartsDialog
          key={partsIndex}
          title={sectionTitle(partsSection)}
          parts={partsSection.parts ?? emptyParts()}
          onChange={(p) => edit(setSectionParts(content, partsSection, p))}
          onClose={() => setPartsIndex(null)}
        />
      )}
      {mode === 'tools' ? (
        <div className="toolbar" role="toolbar" aria-label="Editar canción">
          <div className="toolbar__row toolbar__row--wrap">
            <button className="btn" onClick={() => setMode('move')}>
              <Icon name="move" size={18} /> Mover acordes
            </button>
            <button className="btn" onClick={() => setMode('voices')}>
              Voces
            </button>
            <button className="btn" onClick={() => setMode('notes')}>
              Notas
            </button>
            <button className="btn" onClick={() => setMode('parts')}>
              <Icon name="band" size={18} /> Partes
            </button>
            <button className="btn" onClick={startTempo}>
              BPM
            </button>
            <span className="toolbar__spacer" />
            <button className="btn btn--primary" onClick={stopMoving}>
              Listo
            </button>
          </div>
        </div>
      ) : mode === 'voices' ? (
        <div className="toolbar" role="toolbar" aria-label="Voces">
          <div className="toolbar__row toolbar__row--wrap">
            {voiceSection && voiceSel ? (
              <>
                <div className="toolbar__group voice-pick" role="group" aria-label="Quién canta">
                  {SINGERS.map((name) => (
                    <button
                      key={name}
                      className="voice-pick__btn"
                      style={{ '--m': BAND.find((m) => m.name === name)!.color } as CSSProperties}
                      aria-pressed={selectedVoices.includes(name)}
                      onClick={() => setVoices(selectedVoices.includes(name) ? selectedVoices.filter((n) => n !== name) : [...selectedVoices, name])}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <button className="btn" onClick={() => setVoiceSel({ ...voiceSel, from: 0, to: voiceLyricCount - 1 })}>
                  Toda la parte
                </button>
                <button className="btn" onClick={() => setVoices(undefined)}>
                  Quitar
                </button>
              </>
            ) : (
              <span className="toolbar__hint">Tocá la primera y la última línea que canta alguien</span>
            )}
            <span className="toolbar__spacer" />
            <button className="btn btn--primary" onClick={stopMoving}>
              Listo
            </button>
          </div>
        </div>
      ) : mode === 'notes' ? (
        <div className="toolbar" role="toolbar" aria-label="Notas">
          <div className="toolbar__row">
            <span className="toolbar__hint">Tocá una palabra para ponerle una nota arriba, o una nota para cambiarla</span>
            <span className="toolbar__spacer" />
            <button className="btn btn--primary" onClick={stopMoving}>
              Listo
            </button>
          </div>
        </div>
      ) : mode === 'parts' ? (
        <div className="toolbar" role="toolbar" aria-label="Partes de la banda">
          <div className="toolbar__row">
            <span className="toolbar__hint">Tocá «Asignar partes» en cada parte de la canción</span>
            <span className="toolbar__spacer" />
            <button className="btn btn--primary" onClick={stopMoving}>
              Listo
            </button>
          </div>
        </div>
      ) : editingTempo ? (
        <div className="toolbar" role="toolbar" aria-label="Cambiar BPM">
          <div className="toolbar__row">
            <div className="toolbar__group" role="group" aria-label="BPM">
              <button
                className="icon-btn"
                aria-label="Menos BPM"
                disabled={bpm !== null && bpm <= MIN_BPM}
                onClick={() => setBpm((bpm ?? 101) - 1)}
              >
                <Icon name="minus" />
              </button>
              <label className="speed bpm-field">
                <input
                  key={bpm ?? 'none'}
                  type="number"
                  inputMode="numeric"
                  min={MIN_BPM}
                  max={MAX_BPM}
                  aria-label="BPM"
                  placeholder="—"
                  defaultValue={bpm ?? ''}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  onBlur={(e) => {
                    const n = Number.parseInt(e.target.value, 10);
                    if (n > 0) setBpm(n);
                    else e.target.value = bpm === null ? '' : String(bpm);
                  }}
                />
                <small>bpm</small>
              </label>
              <button
                className="icon-btn"
                aria-label="Más BPM"
                disabled={bpm !== null && bpm >= MAX_BPM}
                onClick={() => setBpm((bpm ?? 99) + 1)}
              >
                <Icon name="plus" />
              </button>
            </div>
            <button className="btn tap-btn" onClick={tap}>
              Tap
            </button>
            <span className="toolbar__spacer" />
            <button className="btn btn--primary" onClick={stopMoving}>
              Listo
            </button>
          </div>
        </div>
      ) : moving ? (
        <div className="toolbar" role="toolbar" aria-label="Mover acordes">
          <div className="toolbar__row">
            {selected ? (
              <div className="toolbar__group" role="group" aria-label="Mover el acorde">
                <button className="icon-btn" aria-label="Antes" title="Antes" disabled={!tryMove('left')} onClick={() => move('left')}>
                  <Icon name="left" />
                </button>
                <button className="icon-btn" aria-label="Después" title="Después" disabled={!tryMove('right')} onClick={() => move('right')}>
                  <Icon name="right" />
                </button>
                <button className="icon-btn" aria-label="Línea de arriba" title="Línea de arriba" disabled={!tryMove('up')} onClick={() => move('up')}>
                  <Icon name="up" />
                </button>
                <button className="icon-btn" aria-label="Línea de abajo" title="Línea de abajo" disabled={!tryMove('down')} onClick={() => move('down')}>
                  <Icon name="down" />
                </button>
              </div>
            ) : (
              <span className="toolbar__hint">Tocá un acorde para moverlo</span>
            )}
            <span className="toolbar__spacer" />
            <button className="btn btn--primary" onClick={stopMoving}>
              Listo
            </button>
          </div>
        </div>
      ) : (
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
          {onContentChange && (
            <button className="icon-btn" aria-label="Editar canción" title="Mover acordes, notas, partes, BPM" onClick={() => setMode('tools')}>
              <Icon name="edit" />
            </button>
          )}
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
      )}
    </div>
  );
}

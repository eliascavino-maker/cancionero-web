import { useEffect, useMemo, useRef, useState } from 'react';
import { parseChordPro } from '../chordpro/parser';
import type { SongSection } from '../chordpro/song';
import type { SetlistEntry } from '../data/library';
import { LockButton } from './Lock';
import { sectionTitle, stageSlides } from './StageView';

/** Where we are in the song: its parts (`stageSlides`) and the current one. */
export interface StripPart {
  index: number;
  slides: SongSection[];
}

/**
 * The strip on top of the live room and ▶ Tocar: part of the song
 * («Estribillo · 3/6 partes») and song of the setlist («Canción 4 de 12»).
 * Tapping it opens the map to jump. Stays up in modo escenario, with the padlock.
 */
export function LiveStrip({
  entries,
  index,
  part,
  onJump,
  onLock,
}: {
  entries: SetlistEntry[];
  index: number;
  /** Without it (▶ Tocar), only the songs. */
  part?: StripPart;
  onJump: (index: number, part: number) => void;
  onLock: () => void;
}) {
  const [map, setMap] = useState(false);
  const n = part?.slides.length ?? 0;
  const current = part && n ? part.slides[Math.min(part.index, n - 1)] : undefined;
  const songLabel = `Canción ${index + 1} de ${entries.length}`;
  const partLabel = current ? `${sectionTitle(current)} · ${part!.index + 1}/${n} partes` : entries[index]?.song.title;

  return (
    <div className="live-strip stage-keep">
      <button
        className="progress"
        aria-haspopup="dialog"
        aria-label={`${partLabel ? `${partLabel}. ` : ''}${songLabel}. Abrir el mapa`}
        onClick={() => setMap(true)}
      >
        <span className="progress__text">
          <strong className="progress__part">{partLabel}</strong>
          <span className="progress__song">{songLabel}</span>
        </span>
        <span className="progress__bars" aria-hidden="true">
          {part && n > 0 && (
            <span className="progress__parts">
              {part.slides.map((_, i) => (
                <span key={i} className={i <= part.index ? 'is-done' : undefined} />
              ))}
            </span>
          )}
          <span className="progress__setlist">
            <span style={{ width: `${((index + (n ? (part!.index + 1) / n : 1)) / Math.max(1, entries.length)) * 100}%` }} />
          </span>
        </span>
      </button>
      <LockButton onLock={onLock} />
      {map && (
        <SetlistMap
          entries={entries}
          index={index}
          part={part?.index}
          withParts={!!part}
          onJump={(i, p) => {
            setMap(false);
            onJump(i, p);
          }}
          onClose={() => setMap(false)}
        />
      )}
    </div>
  );
}

/** Every song of the setlist, with its parts when the room goes by parts. */
function SetlistMap({
  entries,
  index,
  part,
  withParts,
  onJump,
  onClose,
}: {
  entries: SetlistEntry[];
  index: number;
  part?: number;
  withParts: boolean;
  onJump: (index: number, part: number) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (typeof d.showModal === 'function') d.showModal();
    else d.setAttribute('open', '');
    d.querySelector<HTMLElement>('[aria-current]')?.scrollIntoView?.({ block: 'center' });
  }, []);
  const slides = useMemo(
    () => (withParts ? entries.map((e) => stageSlides(parseChordPro(e.song.content))) : []),
    [entries, withParts],
  );

  return (
    <dialog
      ref={dialog}
      className="dialog live-map"
      aria-label="Mapa del setlist"
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && onClose()}
    >
      <header className="page__header">
        <h2>Mapa</h2>
        <button className="btn" onClick={onClose}>
          Cerrar
        </button>
      </header>
      <ol className="live-map__list">
        {entries.map((e, i) => (
          <li key={e.item.id} className={i === index ? 'live-map__song is-here' : 'live-map__song'}>
            <button
              className="live-map__title"
              aria-current={i === index && !withParts ? 'step' : undefined}
              onClick={() => onJump(i, 0)}
            >
              <span className="live-map__num">{i + 1}</span>
              {e.song.title}
            </button>
            {withParts && slides[i].length > 1 && (
              <div className="live-map__parts" role="group" aria-label={`Partes de ${e.song.title}`}>
                {slides[i].map((s, p) => (
                  <button
                    key={p}
                    className="live-map__part"
                    aria-current={i === index && p === part ? 'step' : undefined}
                    onClick={() => onJump(i, p)}
                  >
                    {sectionTitle(s)}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
    </dialog>
  );
}


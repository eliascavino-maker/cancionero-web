import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Song, SongLine, SongSection } from '../chordpro/song';
import { Icon } from '../components/Icon';
import { SongView } from '../components/SongView';

const SECTION_NAMES: Partial<Record<SongSection['kind'], string>> = {
  verse: 'Estrofa',
  chorus: 'Estribillo',
  bridge: 'Puente',
};

export function sectionTitle(s: SongSection): string {
  if (s.label) return s.label;
  if (s.name) return s.name[0].toUpperCase() + s.name.slice(1).replace(/_/g, ' ');
  return SECTION_NAMES[s.kind] ?? 'Parte sin nombre';
}

const lyricText = (l: SongLine) => (l.type === 'lyric' ? l.segments.map((s) => s.lyric).join('').trim() : '');
const sungLines = (s: SongSection) => s.lines.filter((l) => lyricText(l));
const chordLines = (s: SongSection) =>
  s.lines.filter((l) => l.type === 'lyric' && !lyricText(l) && l.segments.some((g) => g.chord && !g.chord.startsWith('*')));

/**
 * The song as parts to show one at a time. `{chorus}` repeats become a copy of
 * the last chorus; parts with nothing at all are skipped.
 */
export function stageSlides(song: Song): SongSection[] {
  const out: SongSection[] = [];
  let lastChorus: SongSection | undefined;
  for (const s of song.sections) {
    let buf: SongLine[] = [];
    const flush = () => {
      if (buf.some((l) => l.type !== 'empty')) {
        const part = { ...s, lines: buf };
        out.push(part);
        if (s.kind === 'chorus') lastChorus = part;
      }
      buf = [];
    };
    for (const l of s.lines) {
      if (l.type !== 'chorusRef') {
        buf.push(l);
        continue;
      }
      flush();
      if (lastChorus) out.push({ ...lastChorus, label: l.label ?? lastChorus.label });
    }
    flush();
  }
  return out;
}

/**
 * How long a part lasts, in seconds. With BPM: 2 bars (8 beats) per sung line,
 * 1 bar per chord of an instrumental part. Without BPM: from the scroll speed.
 */
export function slideSeconds(s: SongSection, bpm: number | null, pxPerSecond: number, fontSize: number): number {
  const sung = sungLines(s).length;
  if (bpm) {
    const chords = chordLines(s).reduce((n, l) => n + (l.type === 'lyric' ? l.segments.filter((g) => g.chord && !g.chord.startsWith('*')).length : 0), 0);
    const beats = sung ? sung * 8 : Math.max(8, chords * 4);
    return (beats * 60) / bpm;
  }
  const lines = sung || Math.max(2, chordLines(s).length * 2);
  return (lines * fontSize * 1.9) / pxPerSecond;
}

/** First lines of a part, for "Sigue: …". */
function preview(s: SongSection): string[] {
  return sungLines(s)
    .slice(0, 2)
    .map(lyricText);
}

/**
 * Letra on stage: one part at a time, as big as fits, with the start of the
 * next one below so nobody gets lost. Advances by itself while playing; tap
 * the right side (or →, ↓, PageDown) for the next part, the left side for the
 * one before.
 */
export function StageView({
  song,
  playing,
  onPlayingChange,
  onClose,
  bpm,
  pxPerSecond,
  fontSize,
}: {
  song: Song;
  playing: boolean;
  onPlayingChange: (playing: boolean) => void;
  onClose: () => void;
  bpm: number | null;
  pxPerSecond: number;
  fontSize: number;
}) {
  const slides = useMemo(() => stageSlides(song), [song]);
  const [index, setIndex] = useState(0);
  const current = slides[Math.min(index, slides.length - 1)];
  const next = slides[index + 1];
  const seconds = current ? slideSeconds(current, bpm, pxPerSecond, fontSize) : 0;

  const go = (i: number) => {
    if (i < 0 || i >= slides.length) return false;
    elapsed.current = 0;
    setIndex(i);
    return true;
  };

  // ----- advancing by time. Pausing keeps the time already spent on the part.
  const elapsed = useRef(0);
  useEffect(() => {
    if (!playing || !current) return;
    const started = performance.now();
    const t = window.setTimeout(
      () => {
        if (!go(index + 1)) onPlayingChange(false);
      },
      Math.max(0, seconds * 1000 - elapsed.current),
    );
    return () => {
      window.clearTimeout(t);
      elapsed.current += performance.now() - started;
    };
  }, [playing, index, seconds]);

  // ----- keys (also Bluetooth page-turner pedals). At the ends they're left
  // alone, so in a setlist → still goes to the next song.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const forward = ['ArrowRight', 'ArrowDown', 'PageDown'].includes(e.key);
      const back = ['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key);
      if (e.key === 'Escape') onClose();
      else if (!(forward ? go(index + 1) : back ? go(index - 1) : false)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  // The page behind doesn't scroll (nor show its scrollbar).
  useEffect(() => {
    document.documentElement.classList.add('stage-open');
    return () => document.documentElement.classList.remove('stage-open');
  }, []);

  // ----- the part fills the screen: biggest letter size that fits.
  const sheet = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(0);
  useEffect(() => {
    const refit = () => setFit((n) => n + 1);
    window.addEventListener('resize', refit);
    return () => window.removeEventListener('resize', refit);
  }, []);
  useLayoutEffect(() => {
    const box = sheet.current;
    const article = box?.querySelector<HTMLElement>('.cp-song');
    if (!box || !article) return;
    let size = Math.min(120, Math.max(20, box.clientWidth / 10));
    article.style.fontSize = `${size}px`;
    while (size > 14 && box.scrollHeight > box.clientHeight + 1) {
      size -= 2;
      article.style.fontSize = `${size}px`;
    }
  }, [current, fit]);

  if (!current) return null;
  const instrumental = sungLines(current).length === 0;

  return (
    <div className="stage" role="dialog" aria-label="Letra por partes">
      <div className="stage__bar">
        <button className="icon-btn" aria-label="Salir de la vista por partes" onClick={onClose}>
          <Icon name="close" />
        </button>
        <span className="stage__where">
          {index + 1}/{slides.length}
        </span>
        <span className="toolbar__spacer" />
        <button className="icon-btn" aria-label="Parte anterior" disabled={index === 0} onClick={() => go(index - 1)}>
          <Icon name="up" />
        </button>
        <button
          className="icon-btn icon-btn--filled"
          aria-label={playing ? 'Pausar' : 'Seguir'}
          aria-pressed={playing}
          onClick={() => onPlayingChange(!playing)}
        >
          <Icon name={playing ? 'pause' : 'play'} size={20} />
        </button>
        <button className="icon-btn" aria-label="Parte siguiente" disabled={!next} onClick={() => go(index + 1)}>
          <Icon name="down" />
        </button>
      </div>

      <div
        className="stage__sheet"
        ref={sheet}
        data-testid="stage-sheet"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          go(e.clientX - r.left < r.width / 3 ? index - 1 : index + 1);
        }}
      >
        {instrumental ? (
          <article className="cp-song stage__instrumental">
            {current.kind !== 'none' && <div className="cp-label">{sectionTitle(current)}</div>}
            <p>Instrumental</p>
          </article>
        ) : (
          <SongView song={{ metadata: song.metadata, sections: [current] }} showHeader={false} showChords={false} />
        )}
      </div>

      <div className="stage__next" aria-live="polite">
        <div
          key={`${index}-${seconds}`}
          className="stage__progress"
          style={{ animationDuration: `${seconds}s`, animationPlayState: playing ? 'running' : 'paused' }}
        />
        {next ? (
          <>
            <strong>{next.kind === 'none' && !next.label ? (sungLines(next).length ? 'Sigue' : 'Sigue: Instrumental') : `Sigue: ${sectionTitle(next)}`}</strong>
            {sungLines(next).length ? (
              preview(next).map((t, i) => <span key={i}>{t}</span>)
            ) : (
              next.kind !== 'none' && <span>Instrumental</span>
            )}
          </>
        ) : (
          <strong>Fin de la canción</strong>
        )}
      </div>
    </div>
  );
}

import {
  type LyricLine,
  type Song,
  type SongLine,
  type SongMetadata,
  type SongSection,
  artistOf,
  hasChords,
  isPreformatted,
  lyricsOf,
} from '../chordpro/song';
import type { ChordRef } from '../chordpro/moveChord';
import { splitIntoWords } from './words';
import './SongView.css';

export interface SongViewOptions {
  /** Font size in px. */
  fontSize?: number;
  showChords?: boolean;
  /** `{chorus}` repeats the previous chorus in full instead of only its label. */
  expandChorusReferences?: boolean;
  /** Makes chords tappable to pick one (for moving it). */
  chordEdit?: ChordEdit;
}

export interface ChordEdit {
  selected?: ChordRef | null;
  onSelect: (ref: ChordRef) => void;
}

// Keeps an empty cell one line tall so rows stay aligned.
const ZWSP = '​';

export function ChordLyricLine({
  line,
  showChords = true,
  chordEdit,
}: {
  line: LyricLine;
  showChords?: boolean;
  chordEdit?: ChordEdit;
}) {
  if (!showChords || !hasChords(line)) {
    return <div className="cp-line">{lyricsOf(line) || ZWSP}</div>;
  }
  const chordsOnly = lyricsOf(line).trim() === '';
  const source = chordEdit ? line.source : undefined;
  // Chords appear in the same order as in the source line.
  let chordIndex = 0;
  return (
    <div className="cp-line cp-line--chords">
      {splitIntoWords(line.segments).map((word, w) => (
        <span className="cp-word" key={w}>
          {word.map((atom, a) => (
            <span className="cp-atom" key={a}>
              {atom.chord === undefined ? (
                <span className="cp-chord cp-chord--empty">{ZWSP}</span>
              ) : source !== undefined ? (
                <EditableChord chord={atom.chord} at={{ line: source, index: chordIndex++ }} edit={chordEdit!} />
              ) : (
                <span className="cp-chord">{atom.chord}</span>
              )}
              {!chordsOnly && <span className="cp-lyric">{atom.text || ZWSP}</span>}
            </span>
          ))}
        </span>
      ))}
    </div>
  );
}

function EditableChord({ chord, at, edit }: { chord: string; at: ChordRef; edit: ChordEdit }) {
  const selected = edit.selected?.line === at.line && edit.selected.index === at.index;
  return (
    <button
      type="button"
      className={selected ? 'cp-chord cp-chord--movable cp-chord--selected' : 'cp-chord cp-chord--movable'}
      aria-pressed={selected}
      aria-label={`Acorde ${chord}`}
      onClick={() => edit.onSelect(at)}
    >
      {chord}
    </button>
  );
}

function SongHeader({ metadata, onTempoClick }: { metadata: SongMetadata; onTempoClick?: () => void }) {
  const subtitle = [...metadata.subtitles, artistOf(metadata)].filter(Boolean).join(' · ');
  const tempo = metadata.tempo ? `♩ ${metadata.tempo}` : onTempoClick ? '♩ BPM' : undefined;
  const before = [metadata.key && `Tono: ${metadata.key}`, metadata.capo ? `Capo ${metadata.capo}` : undefined];
  const after = [metadata.time];
  const info = [...before, tempo, ...after].filter(Boolean) as string[];

  return (
    <header className="cp-header">
      {metadata.title && <h1 className="cp-title">{metadata.title}</h1>}
      {subtitle && <p className="cp-subtitle">{subtitle}</p>}
      {info.length > 0 && (
        <ul className="cp-info">
          {info.map((i) =>
            i === tempo && onTempoClick ? (
              <li key={i} className="cp-info__tempo">
                <button type="button" aria-label="Cambiar BPM" onClick={onTempoClick}>
                  {i}
                </button>
              </li>
            ) : (
              <li key={i}>{i}</li>
            ),
          )}
        </ul>
      )}
    </header>
  );
}

function defaultLabel(s: SongSection): string | undefined {
  switch (s.kind) {
    case 'chorus':
      return 'Estribillo';
    case 'bridge':
      return 'Puente';
    case 'custom':
      return s.name ? s.name[0].toUpperCase() + s.name.slice(1).replace(/_/g, ' ') : undefined;
    default:
      return undefined;
  }
}

function Line({ line, opts, lastChorus }: { line: SongLine; opts: SongViewOptions; lastChorus?: SongSection }) {
  switch (line.type) {
    case 'lyric':
      return <ChordLyricLine line={line} showChords={opts.showChords} chordEdit={opts.chordEdit} />;
    case 'comment':
      return <div className={`cp-comment cp-comment--${line.style}`}>{line.text}</div>;
    case 'tab':
      return <pre className="cp-tab">{line.text}</pre>;
    case 'empty':
      return <div className="cp-empty" />;
    case 'chorusRef':
      if ((opts.expandChorusReferences ?? true) && lastChorus) {
        return (
          <Section
            section={{ ...lastChorus, label: line.label ?? lastChorus.label }}
            opts={opts}
            lastChorus={undefined}
          />
        );
      }
      return <div className="cp-label">{line.label ?? 'Estribillo'}</div>;
  }
}

/** Lyrics mode: a line with no words (only chords) has nothing to show. */
function hasWords(line: SongLine): boolean {
  return line.type !== 'lyric' || lyricsOf(line).trim() !== '';
}

/** Lines to draw. In lyrics mode, chord-only lines and tabs are dropped. */
function visibleSection(section: SongSection, showChords: boolean): SongSection | null {
  if (showChords) return section;
  if (isPreformatted(section)) return null;
  const lines = section.lines.filter(hasWords);
  return lines.some((l) => l.type !== 'empty') ? { ...section, lines } : null;
}

function Section(props: { section: SongSection; opts: SongViewOptions; lastChorus?: SongSection }) {
  const { opts, lastChorus } = props;
  const section = visibleSection(props.section, opts.showChords ?? true);
  if (!section) return null;
  const label = section.label ?? defaultLabel(section);
  return (
    <section className={`cp-section cp-section--${section.kind}`}>
      {label && <div className="cp-label">{label}</div>}
      {isPreformatted(section) ? (
        <pre className="cp-tab">{section.lines.map((l) => (l.type === 'tab' ? l.text : '')).join('\n')}</pre>
      ) : (
        section.lines.map((line, i) => <Line key={i} line={line} opts={opts} lastChorus={lastChorus} />)
      )}
    </section>
  );
}

/** Song sheet: header, sections, chords drawn above the lyrics. */
export function SongView({
  song,
  showHeader = true,
  onTempoClick,
  ...opts
}: { song: Song; showHeader?: boolean; onTempoClick?: () => void } & SongViewOptions) {
  let lastChorus: SongSection | undefined;
  const sections = song.sections.map((section, i) => {
    if (section.kind === 'chorus') lastChorus = section;
    return <Section key={i} section={section} opts={opts} lastChorus={lastChorus} />;
  });
  return (
    <article className="cp-song" style={{ fontSize: opts.fontSize ? `${opts.fontSize}px` : undefined }}>
      {showHeader && <SongHeader metadata={song.metadata} onTempoClick={onTempoClick} />}
      {sections}
    </article>
  );
}

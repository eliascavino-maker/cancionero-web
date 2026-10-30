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
import { splitIntoWords } from './words';
import './SongView.css';

export interface SongViewOptions {
  /** Font size in px. */
  fontSize?: number;
  showChords?: boolean;
  /** `{chorus}` repeats the previous chorus in full instead of only its label. */
  expandChorusReferences?: boolean;
}

// Keeps an empty cell one line tall so rows stay aligned.
const ZWSP = '​';

export function ChordLyricLine({ line, showChords = true }: { line: LyricLine; showChords?: boolean }) {
  if (!showChords || !hasChords(line)) {
    return <div className="cp-line">{lyricsOf(line) || ZWSP}</div>;
  }
  const chordsOnly = lyricsOf(line).trim() === '';
  return (
    <div className="cp-line cp-line--chords">
      {splitIntoWords(line.segments).map((word, w) => (
        <span className="cp-word" key={w}>
          {word.map((atom, a) => (
            <span className="cp-atom" key={a}>
              <span className={atom.chord === undefined ? 'cp-chord cp-chord--empty' : 'cp-chord'}>
                {atom.chord ?? ZWSP}
              </span>
              {!chordsOnly && <span className="cp-lyric">{atom.text || ZWSP}</span>}
            </span>
          ))}
        </span>
      ))}
    </div>
  );
}

function SongHeader({ metadata }: { metadata: SongMetadata }) {
  const subtitle = [...metadata.subtitles, artistOf(metadata)].filter(Boolean).join(' · ');
  const info = [
    metadata.key && `Tono: ${metadata.key}`,
    metadata.capo ? `Capo ${metadata.capo}` : undefined,
    metadata.tempo && `♩ ${metadata.tempo}`,
    metadata.time,
  ].filter(Boolean) as string[];

  return (
    <header className="cp-header">
      {metadata.title && <h1 className="cp-title">{metadata.title}</h1>}
      {subtitle && <p className="cp-subtitle">{subtitle}</p>}
      {info.length > 0 && (
        <ul className="cp-info">
          {info.map((i) => (
            <li key={i}>{i}</li>
          ))}
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
      return <ChordLyricLine line={line} showChords={opts.showChords} />;
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

function Section({ section, opts, lastChorus }: { section: SongSection; opts: SongViewOptions; lastChorus?: SongSection }) {
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
export function SongView({ song, showHeader = true, ...opts }: { song: Song; showHeader?: boolean } & SongViewOptions) {
  let lastChorus: SongSection | undefined;
  const sections = song.sections.map((section, i) => {
    if (section.kind === 'chorus') lastChorus = section;
    return <Section key={i} section={section} opts={opts} lastChorus={lastChorus} />;
  });
  return (
    <article className="cp-song" style={{ fontSize: opts.fontSize ? `${opts.fontSize}px` : undefined }}>
      {showHeader && <SongHeader metadata={song.metadata} />}
      {sections}
    </article>
  );
}

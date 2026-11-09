import { type CSSProperties, Fragment, type ReactNode } from 'react';
import {
  type LyricLine,
  type Song,
  type SongLine,
  type SongMetadata,
  type SectionParts,
  type SongSection,
  artistOf,
  hasHarmony,
  isAnnotation,
  isPreformatted,
  lyricsOf,
} from '../chordpro/song';
import type { ChordRef } from '../chordpro/moveChord';
import { PLAYERS, colorOf, singsIn, splitByMembers } from '../data/band';
import { ChordName } from './ChordName';
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
  /** Makes words and notes tappable to add or change notes. */
  noteEdit?: NoteEdit;
  /** Shows an "assign parts" button on each section; gets the index in `song.sections`. */
  onEditParts?: (sectionIndex: number) => void;
  /** Hides the band parts under section labels. */
  hideParts?: boolean;
  /** Makes lyric lines tappable to pick who sings them. */
  voiceEdit?: VoiceEdit;
  /** Lights the lines this singer sings (theirs and "Todos"), in Letra and in Acordes. */
  mine?: string;
  /**
   * Live room: every section is a part (`data-part` = its index) and this one
   * is marked as where the band is.
   */
  currentPart?: number;
  /** Live room, leading: tapping a part makes it the current one. */
  onPartTap?: (sectionIndex: number) => void;
  /** Indications (`{x_cue}`) on their own row. Default: shown. */
  showCues?: boolean;
  /** Makes lines tappable to add indications, and indications to change them. */
  cueEdit?: CueEdit;
}

/** The player's own capo: chords are drawn as shapes, the header keeps the real key. */
export interface MyCapo {
  fret: number;
  /** The key the band plays in. */
  key?: string;
  /** The key of the shapes (the real one minus the capo). */
  shapes?: string;
}

export interface CueEdit {
  /** A lyric line was tapped (its source line): add an indication above it. */
  onLine: (line: number) => void;
  /** An indication was tapped: change or delete it. */
  onCue: (line: number, text: string) => void;
  /** "Al final" of a section was tapped. */
  onEnd: (section: SongSection) => void;
}

/** Lyric lines `from`..`to` (counted among the lyric lines) of section `section`. */
export interface VoiceSelection {
  section: number;
  from: number;
  to: number;
}

export interface VoiceEdit {
  selected?: VoiceSelection | null;
  onLine: (section: number, lyricIndex: number) => void;
}

export interface ChordEdit {
  selected?: ChordRef | null;
  onSelect: (ref: ChordRef) => void;
}

export interface NoteEdit {
  /** A word was tapped: add a note at that lyric column. */
  onWord: (line: number, col: number) => void;
  /** A note was tapped: change or delete it. */
  onNote: (ref: ChordRef, text: string) => void;
}

// Keeps an empty cell one line tall so rows stay aligned.
const ZWSP = '​';

const memberStyle = (color: string | undefined) => ({ '--m': color ?? 'var(--grafito)' }) as CSSProperties;

/** A band member's name in their color. */
export function MemberName({ name }: { name: string }) {
  return (
    <span className="member" style={memberStyle(colorOf(name))}>
      {name}
    </span>
  );
}

/** Note text with member names colored. */
function NoteText({ text }: { text: string }) {
  return (
    <>
      {splitByMembers(text).map((p, i) =>
        typeof p === 'string' ? (
          p
        ) : (
          <span key={i} className="cp-note__member" style={memberStyle(p.color)}>
            {p.name}
          </span>
        ),
      )}
    </>
  );
}

export function ChordLyricLine({
  line,
  showChords = true,
  chordEdit,
  noteEdit,
}: {
  line: LyricLine;
  showChords?: boolean;
  chordEdit?: ChordEdit;
  noteEdit?: NoteEdit;
}) {
  const chordsOnly = lyricsOf(line).trim() === '';
  // Notes on the lyrics ("Queda solo Leo") belong to the Letra view; notes on a
  // chord-only line ("Sin piano", "x2") belong to the chords.
  const showNotes = showChords ? chordsOnly : true;
  const hasNotes = showNotes && line.segments.some(isAnnotation);
  const drawChords = showChords && line.segments.some((s) => s.chord !== undefined && !isAnnotation(s));
  const source = line.source;
  const tappable = noteEdit && source !== undefined;
  if (!drawChords && !hasNotes && !tappable) {
    return (
      <div className="cp-line">
        {line.segments.some((s) => s.harmony)
          ? line.segments.map((s, i) =>
              s.harmony ? (
                <span key={i} className="cp-harmony">
                  {s.lyric}
                </span>
              ) : (
                <Fragment key={i}>{s.lyric}</Fragment>
              ),
            )
          : lyricsOf(line) || ZWSP}
      </div>
    );
  }
  // Chords and notes are counted in the same order as in the source line.
  let chordIndex = 0;

  return (
    <div className={`cp-line cp-line--chords${hasNotes ? ' cp-line--noted' : ''}`}>
      {splitIntoWords(line.segments).map((word, w) => {
        const atoms = word.map((atom, a) => {
          const ref = atom.chord !== undefined && source !== undefined ? { line: source, index: chordIndex++ } : undefined;
          return (
            <span className="cp-atom" key={a}>
              {atom.annotation && hasNotes && <Note text={atom.chord!} at={ref} chordEdit={chordEdit} noteEdit={noteEdit} />}
              {drawChords &&
                (atom.chord === undefined || atom.annotation ? (
                  <span className="cp-chord cp-chord--empty">{ZWSP}</span>
                ) : chordEdit && ref ? (
                  <EditableChord chord={atom.chord} at={ref} edit={chordEdit} />
                ) : (
                  <span className="cp-chord"><ChordName chord={atom.chord} /></span>
                ))}
              {!chordsOnly && (
                <span className={atom.harmony && atom.text ? 'cp-lyric cp-harmony' : 'cp-lyric'}>{atom.text || ZWSP}</span>
              )}
            </span>
          );
        });
        const text = word.map((a) => a.text).join('');
        if (tappable && text) {
          return (
            <span
              className="cp-word cp-word--tappable"
              key={w}
              role="button"
              tabIndex={0}
              aria-label={`Nota en «${text}»`}
              onClick={() => noteEdit.onWord(source, word[0].col)}
              onKeyDown={(e) => e.key === 'Enter' && noteEdit.onWord(source, word[0].col)}
            >
              {atoms}
            </span>
          );
        }
        return (
          <span className="cp-word" key={w}>
            {atoms}
          </span>
        );
      })}
    </div>
  );
}

function Note({
  text,
  at,
  chordEdit,
  noteEdit,
}: {
  text: string;
  at?: ChordRef;
  chordEdit?: ChordEdit;
  noteEdit?: NoteEdit;
}) {
  if (at && (chordEdit || noteEdit)) {
    const selected = chordEdit?.selected?.line === at.line && chordEdit.selected.index === at.index;
    return (
      <button
        type="button"
        className={`cp-note cp-note--editable${selected ? ' cp-note--selected' : ''}`}
        aria-pressed={chordEdit ? selected : undefined}
        aria-label={`Nota: ${text}`}
        onClick={(e) => {
          e.stopPropagation();
          if (chordEdit) chordEdit.onSelect(at);
          else noteEdit!.onNote(at, text);
        }}
      >
        <NoteText text={text} />
      </button>
    );
  }
  return (
    <span className="cp-note">
      <NoteText text={text} />
    </span>
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
      <ChordName chord={chord} />
    </button>
  );
}

function SongHeader({
  metadata,
  onTempoClick,
  capo,
}: {
  metadata: SongMetadata;
  onTempoClick?: () => void;
  capo?: MyCapo;
}) {
  const subtitle = [...metadata.subtitles, artistOf(metadata)].filter(Boolean).join(' · ');
  // With my capo the chords are shapes: the key shown is still the band's.
  const key = capo ? capo.key : metadata.key;
  const fret = capo ? capo.fret : metadata.capo;
  const showTempo = !!metadata.tempo || !!onTempoClick;
  const any = key || fret || showTempo || metadata.time;

  return (
    <header className="cp-header">
      {metadata.title && <h1 className="cp-title">{metadata.title}</h1>}
      {subtitle && <p className="cp-subtitle">{subtitle}</p>}
      {any && (
        <ul className="cp-info">
          {key && (
            <li className="cp-info__key">
              <span className="cp-info__label">Tono</span> <ChordName chord={key} />
            </li>
          )}
          {fret && (
            <li className="cp-info__capo">
              <span className="cp-info__label">{capo ? 'Mi capo' : 'Capo'}</span> {fret}
              {capo?.shapes && (
                <>
                  {' · formas de '}
                  <ChordName chord={capo.shapes} />
                </>
              )}
            </li>
          )}
          {showTempo && (
            <li className="cp-info__tempo">
              <span className="cp-info__label">BPM</span>{' '}
              {onTempoClick ? (
                <button type="button" aria-label="Cambiar BPM" onClick={onTempoClick}>
                  {metadata.tempo ?? '—'}
                </button>
              ) : (
                metadata.tempo
              )}
            </li>
          )}
          {metadata.time && (
            <li>
              <span className="cp-info__label">Compás</span> {metadata.time}
            </li>
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

interface LastChorus {
  section: SongSection;
  index: number;
}

function Line({ line, opts, lastChorus }: { line: SongLine; opts: SongViewOptions; lastChorus?: LastChorus }) {
  switch (line.type) {
    case 'lyric':
      return (
        <ChordLyricLine line={line} showChords={opts.showChords} chordEdit={opts.chordEdit} noteEdit={opts.noteEdit} />
      );
    case 'comment':
      return <div className={`cp-comment cp-comment--${line.style}`}>{line.text}</div>;
    case 'cue':
      return opts.cueEdit && line.source !== undefined ? (
        <button
          type="button"
          className="cp-cue cp-cue--editable"
          aria-label={`Indicación: ${line.text}`}
          onClick={() => opts.cueEdit!.onCue(line.source!, line.text)}
        >
          <NoteText text={line.text} />
        </button>
      ) : (
        <div className="cp-cue">
          <NoteText text={line.text} />
        </div>
      );
    case 'tab':
      return <pre className="cp-tab">{line.text}</pre>;
    case 'empty':
      return <div className="cp-empty" />;
    case 'chorusRef':
      if ((opts.expandChorusReferences ?? true) && lastChorus) {
        return (
          <Section
            section={{ ...lastChorus.section, label: line.label ?? lastChorus.section.label }}
            index={lastChorus.index}
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

/**
 * Lines to draw. In lyrics mode, chord-only lines and tabs are dropped;
 * indications, when hidden.
 */
function visibleSection(section: SongSection, showChords: boolean, showCues: boolean): SongSection | null {
  if (showChords && showCues) return section;
  if (!showChords && isPreformatted(section)) return null;
  const lines = section.lines.filter((l) => (showChords || hasWords(l)) && (showCues || l.type !== 'cue'));
  return lines.some((l) => l.type !== 'empty') ? { ...section, lines } : null;
}

const isEmpty = (p: SectionParts) => !p.lead.length && !p.backing.length && !p.play.length;

/** "Tocan todos" / "Tocan Elias", names in their colors. Voices are drawn as brackets. */
function PartsList({ parts }: { parts: SectionParts }) {
  const allPlay = PLAYERS.length > 0 && PLAYERS.every((n) => parts.play.includes(n));
  const rows: [string, string[] | 'todos'][] = [['Tocan', allPlay ? 'todos' : parts.play]];
  return (
    <ul className="cp-parts" aria-label="Partes de la banda">
      {rows
        .filter(([, names]) => names.length > 0)
        .map(([role, names]) => (
          <li key={role} aria-label={`${role}: ${names === 'todos' ? 'todos' : names.join(', ')}`}>
            <span className="cp-parts__role">{role}</span>
            {names === 'todos' ? <span className="cp-parts__all">todos</span> : names.map((n) => <MemberName key={n} name={n} />)}
          </li>
        ))}
    </ul>
  );
}

interface Bracket {
  name: string;
  backing: boolean;
  slot: number;
  start: number;
  end: number;
}

/**
 * Who sings each row: the line's own `{x_voz}` singers, else the section's
 * lead voices; backing vocals cover every lyric line of the section.
 * Consecutive rows with the same singer become one bracket.
 */
function bracketsFor(section: SongSection, hide: boolean | undefined): { brackets: Bracket[]; slots: number } {
  if (hide) return { brackets: [], slots: 0 };
  const lead = section.parts?.lead ?? [];
  const backing = (section.parts?.backing ?? []).filter((n) => !lead.includes(n));
  const keys: string[] = [];
  const rows = section.lines.map((l) => {
    // Chord-only lines (a progression on top of a part) are not sung.
    if (l.type !== 'lyric' || !lyricsOf(l).trim()) return [];
    const own = l.singers ?? lead;
    const row = [...own.map((n) => `v:${n}`), ...backing.filter((n) => !own.includes(n)).map((n) => `c:${n}`)];
    row.forEach((k) => keys.includes(k) || keys.push(k));
    return row;
  });
  // Lead voices first, then backing.
  keys.sort((a, b) => (a[0] === b[0] ? 0 : a[0] === 'v' ? -1 : 1));
  const brackets: Bracket[] = [];
  keys.forEach((key, slot) => {
    let start = -1;
    rows.forEach((row, i) => {
      const has = row.includes(key);
      if (has && start === -1) start = i;
      const last = i === rows.length - 1;
      if (start !== -1 && (!has || last)) {
        brackets.push({ name: key.slice(2), backing: key[0] === 'c', slot, start, end: has && last ? i : i - 1 });
        start = -1;
      }
    });
  });
  return { brackets, slots: keys.length };
}

function VoicedLines({
  section,
  original,
  index,
  opts,
  lastChorus,
}: {
  section: SongSection;
  original: SongSection;
  index: number;
  opts: SongViewOptions;
  lastChorus?: LastChorus;
}) {
  // Who sings is part of the Letra view only.
  const { brackets, slots } = bracketsFor(section, opts.hideParts || (opts.showChords ?? true));
  const lead = section.parts?.lead ?? [];
  const backing = section.parts?.backing ?? [];
  /** How `opts.mine` sings this line: lead, backing (coro), or not at all. */
  const mineIn = (line: SongLine): 'lead' | 'backing' | null => {
    if (!opts.mine || line.type !== 'lyric' || !lyricsOf(line).trim()) return null;
    if (singsIn(opts.mine, line.singers ?? lead)) return 'lead';
    if (hasHarmony(line) && singsIn(opts.mine, line.harmony ?? [])) return 'lead';
    return singsIn(opts.mine, backing) ? 'backing' : null;
  };
  // The names go above the line where a voice starts (lead voices, then coros).
  const starts = new Map<number, Bracket[]>();
  for (const b of brackets) starts.set(b.start, [...(starts.get(b.start) ?? []), b]);
  const lyricSources = original.lines.flatMap((l) => (l.type === 'lyric' && l.source !== undefined ? [l.source] : []));
  const sel = opts.voiceEdit?.selected;

  const row = (line: SongLine, i: number) => {
    let content = <Line line={line} opts={opts} lastChorus={lastChorus} />;
    if (line.type === 'lyric' && hasHarmony(line)) {
      const who = line.harmony ?? [];
      // The name goes on the first line of each stretch with the same second voice.
      const before = section.lines.slice(0, i).findLast((l) => l.type === 'lyric' && lyricsOf(l).trim());
      const first = !before || before.type !== 'lyric' || !hasHarmony(before) || (before.harmony ?? []).join() !== who.join();
      content = (
        <div className="cp-harmonized" style={{ '--h': colorOf(who[0] ?? '') } as CSSProperties}>
          {content}
          {first && (
            <span className="cp-harmony-tag" title={`Segunda voz${who.length ? `: ${who.join(', ')}` : ''}`}>
              2ª voz{who.length ? ` · ${who.join(', ')}` : ''}
            </span>
          )}
        </div>
      );
    }
    const ord = line.type === 'lyric' && line.source !== undefined ? lyricSources.indexOf(line.source) : -1;
    if (opts.cueEdit && line.type === 'lyric' && line.source !== undefined) {
      const source = line.source;
      content = (
        <div
          className="cp-pick"
          role="button"
          tabIndex={0}
          aria-label={`Indicación arriba de: ${lyricsOf(line).trim() || 'acordes'}`}
          onClick={() => opts.cueEdit!.onLine(source)}
          onKeyDown={(e) => e.key === 'Enter' && opts.cueEdit!.onLine(source)}
        >
          {content}
        </div>
      );
    }
    if (opts.voiceEdit && ord !== -1) {
      const selected = sel?.section === index && ord >= sel.from && ord <= sel.to;
      content = (
        <div
          className={`cp-pick${selected ? ' cp-pick--selected' : ''}`}
          role="button"
          tabIndex={0}
          aria-pressed={selected}
          aria-label={`Línea: ${lyricsOf(line as LyricLine).trim() || 'acordes'}`}
          onClick={() => opts.voiceEdit!.onLine(index, ord)}
          onKeyDown={(e) => e.key === 'Enter' && opts.voiceEdit!.onLine(index, ord)}
        >
          {content}
        </div>
      );
    }
    const lit = mineIn(line);
    if (lit) {
      content = (
        <div className={`cp-mine${lit === 'backing' ? ' cp-mine--backing' : ''}`} style={memberStyle(colorOf(opts.mine!))}>
          {content}
        </div>
      );
    } else if (opts.mine && line.type === 'lyric' && lyricsOf(line).trim() && (line.singers ?? lead).length) {
      // Someone else's line (we know who sings it): a step back, so mine stand out.
      content = <div className="cp-other">{content}</div>;
    }
    const tags = starts.get(i);
    if (tags) {
      content = (
        <>
          <div className="cp-voice-tag" aria-hidden="true">
            {tags.map((b) => (
              <span key={`${b.slot}`} className={b.backing ? 'cp-voice-tag__name cp-voice-tag__name--backing' : 'cp-voice-tag__name'} style={memberStyle(colorOf(b.name))}>
                {b.backing ? `coro ${b.name}` : b.name}
              </span>
            ))}
          </div>
          {content}
        </>
      );
    }
    return slots ? (
      <div key={i} className="cp-voiced__line" style={{ gridRow: i + 1, gridColumn: slots + 1 }}>
        {content}
      </div>
    ) : (
      <Fragment key={i}>{content}</Fragment>
    );
  };

  if (!slots) return <>{section.lines.map(row)}</>;
  return (
    <div className="cp-voiced" style={{ gridTemplateColumns: `repeat(${slots}, var(--bracket-w)) minmax(0, 1fr)` }}>
      {section.lines.map(row)}
      {brackets.map((b) => (
        <span
          key={`${b.slot}-${b.start}`}
          className={`cp-bracket${b.backing ? ' cp-bracket--backing' : ''}`}
          style={{ gridRow: `${b.start + 1} / ${b.end + 2}`, gridColumn: b.slot + 1, ...memberStyle(colorOf(b.name)) }}
          role="img"
          aria-label={`${b.backing ? 'Coro' : 'Canta'}: ${b.name}`}
          title={`${b.backing ? 'Coro' : 'Canta'}: ${b.name}`}
        />
      ))}
    </div>
  );
}

function Section(props: { section: SongSection; index: number; opts: SongViewOptions; lastChorus?: LastChorus }) {
  const { opts, lastChorus, index } = props;
  const section = visibleSection(props.section, opts.showChords ?? true, opts.showCues ?? true);
  if (!section) return null;
  const label = section.label ?? defaultLabel(section);
  const parts = !opts.hideParts && section.parts && !isEmpty(section.parts) ? section.parts : undefined;
  // Who plays is part of the Acordes view only.
  const showPlay = parts && parts.play.length > 0 && (opts.showChords ?? true);
  const editable = opts.onEditParts && !isPreformatted(section) && section.lines.some((l) => l.type === 'lyric');
  const live = opts.currentPart !== undefined;
  const now = live && opts.currentPart === index;
  return (
    <section
      className={`cp-section cp-section--${section.kind}${now ? ' cp-section--now' : ''}${opts.onPartTap ? ' cp-section--tappable' : ''}`}
      data-part={live ? index : undefined}
      data-section={index}
      aria-current={now ? 'step' : undefined}
      onClick={opts.onPartTap ? () => opts.onPartTap!(index) : undefined}
    >
      {(label || editable) && (
        <div className="cp-section__head">
          {label && <div className="cp-label">{label}</div>}
          {editable && (
            <button
              type="button"
              className="cp-parts-btn"
              aria-label={`Asignar partes: ${label ?? 'sin nombre'}`}
              onClick={() => opts.onEditParts!(index)}
            >
              {parts ? 'Cambiar' : 'Asignar'} partes
            </button>
          )}
        </div>
      )}
      {showPlay && <PartsList parts={parts} />}
      {isPreformatted(section) ? (
        <pre className="cp-tab">{section.lines.map((l) => (l.type === 'tab' ? l.text : '')).join('\n')}</pre>
      ) : (
        <VoicedLines section={section} original={props.section} index={index} opts={opts} lastChorus={lastChorus} />
      )}
      {opts.cueEdit && !isPreformatted(section) && section.endLine !== undefined && (
        <button
          type="button"
          className="cp-parts-btn cp-cue-add"
          aria-label={`Indicación al final: ${label ?? 'sin nombre'}`}
          onClick={() => opts.cueEdit!.onEnd(props.section)}
        >
          + Indicación al final
        </button>
      )}
    </section>
  );
}

/** Song sheet: header, sections, chords drawn above the lyrics. */
export function SongView({
  song,
  showHeader = true,
  onTempoClick,
  capo,
  afterHeader,
  ...opts
}: {
  song: Song;
  showHeader?: boolean;
  onTempoClick?: () => void;
  capo?: MyCapo;
  /** Drawn right under the header (the song's map). */
  afterHeader?: ReactNode;
} & SongViewOptions) {
  let lastChorus: LastChorus | undefined;
  const sections = song.sections.map((section, i) => {
    if (section.kind === 'chorus') lastChorus = { section, index: i };
    return <Section key={i} section={section} index={i} opts={opts} lastChorus={lastChorus} />;
  });
  return (
    <article className="cp-song" style={{ fontSize: opts.fontSize ? `${opts.fontSize}px` : undefined }}>
      {showHeader && <SongHeader metadata={song.metadata} onTempoClick={onTempoClick} capo={capo} />}
      {afterHeader}
      {sections}
    </article>
  );
}

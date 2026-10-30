import {
  type ChordSegment,
  type LyricLine,
  type SectionKind,
  type Song,
  type SongLine,
  type SongMetadata,
  type SectionParts,
  type SongSection,
  emptyMetadata,
} from './song';
import { parseNames, parseParts } from './parts';

const DIRECTIVE = /^\{\s*([A-Za-z_][\w-]*)\s*(?:[:\s]\s*(.*?))?\s*\}$/;
const LABEL_ATTR = /^label\s*=\s*["'](.*)["']$/;

interface Directive {
  name: string;
  value: string;
}

function parseDirective(line: string): Directive | null {
  const m = DIRECTIVE.exec(line);
  if (!m) return null;
  return { name: m[1].toLowerCase(), value: (m[2] ?? '').trim() };
}

/**
 * Splits `[C]Hello [G]world` into chord/lyric segments.
 * `\[` and `\]` are literal brackets.
 */
export function parseLyricLine(line: string): LyricLine {
  const segments: ChordSegment[] = [];
  let buf = '';
  let chord: string | undefined;

  const flush = () => {
    if (chord !== undefined || buf) {
      segments.push(chord === undefined ? { lyric: buf } : { chord, lyric: buf });
    }
    buf = '';
  };

  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '\\' && i + 1 < line.length && '[]\\'.includes(line[i + 1])) {
      buf += line[i + 1];
      i += 2;
      continue;
    }
    if (ch === '[') {
      const close = line.indexOf(']', i + 1);
      if (close !== -1) {
        flush();
        const text = line.slice(i + 1, close).trim();
        chord = text || undefined;
        i = close + 1;
        continue;
      }
    }
    buf += ch;
    i++;
  }
  flush();
  return { type: 'lyric', segments };
}

class SongBuilder {
  meta: SongMetadata = emptyMetadata();
  private sections: SongSection[] = [];
  private kind: SectionKind = 'none';
  private label?: string;
  private name?: string;
  private lines: SongLine[] = [];
  private parts?: SectionParts;
  private startLine?: number;
  private partsLine?: number;
  private endLine?: number;
  /** Lead singers set by `{x_voz}` for the next lyric lines. */
  private voice?: string[];
  /** Source line being read. */
  line = 0;

  get inPreformatted(): boolean {
    return this.kind === 'tab' || this.kind === 'grid';
  }

  add(line: SongLine) {
    this.startLine ??= this.line;
    this.endLine = this.line;
    if (line.type === 'lyric' && this.voice) line.singers = this.voice;
    this.lines.push(line);
  }

  /** `{x_voz: Leo, Angel}`: who sings the next lines; `{x_voz}` goes back to the section's voice. */
  setVoice(names: string[]) {
    this.startLine ??= this.line;
    this.endLine = this.line;
    this.voice = names.length ? names : undefined;
  }

  setParts(parts: SectionParts) {
    this.startLine ??= this.line;
    this.endLine = this.line;
    this.parts = parts;
    this.partsLine = this.line;
  }

  open(kind: SectionKind, label?: string, name?: string) {
    this.finish();
    this.kind = kind;
    this.label = label;
    this.name = name;
    this.startLine = this.line;
  }

  close() {
    this.endLine = this.line;
    this.finish();
    this.kind = 'none';
    this.label = undefined;
    this.name = undefined;
  }

  private finish() {
    const lines = this.inPreformatted ? this.lines : trimEmpty(this.lines);
    if (lines.length) {
      const section: SongSection = { kind: this.kind, lines };
      if (this.label !== undefined) section.label = this.label;
      if (this.name !== undefined) section.name = this.name;
      if (this.parts) section.parts = this.parts;
      if (this.startLine !== undefined) section.startLine = this.startLine;
      if (this.partsLine !== undefined) section.partsLine = this.partsLine;
      if (this.endLine !== undefined) section.endLine = this.endLine;
      this.sections.push(section);
    }
    this.lines = [];
    this.parts = undefined;
    this.startLine = undefined;
    this.partsLine = undefined;
    this.endLine = undefined;
    this.voice = undefined;
  }

  build(): Song {
    this.finish();
    return { metadata: this.meta, sections: this.sections };
  }
}

/** Drops leading/trailing blank lines and collapses runs of them. */
function trimEmpty(lines: SongLine[]): SongLine[] {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].type === 'empty') start++;
  while (end > start && lines[end - 1].type === 'empty') end--;
  const out: SongLine[] = [];
  for (const l of lines.slice(start, end)) {
    if (l.type === 'empty' && out.length && out[out.length - 1].type === 'empty') continue;
    out.push(l);
  }
  return out;
}

function kindFor(name: string): SectionKind {
  switch (name) {
    case 'chorus':
    case 'verse':
    case 'bridge':
    case 'tab':
    case 'grid':
      return name;
    default:
      return 'custom';
  }
}

function labelOf(v: string): string | undefined {
  if (!v) return undefined;
  const m = LABEL_ATTR.exec(v);
  return m ? m[1] : v;
}

function setMeta(b: SongBuilder, name: string, v: string) {
  // Empty values ("{key: }" in a template) mean "not set".
  if (!v) return;
  const m = b.meta;
  switch (name) {
    case 'title':
      m.title = v;
      break;
    case 'subtitle':
      m.subtitles.push(v);
      break;
    case 'artist':
      m.artists.push(v);
      break;
    case 'composer':
    case 'lyricist':
      m.composers.push(v);
      break;
    case 'album':
      m.album = v;
      break;
    case 'year':
      m.year = v;
      break;
    case 'key':
      m.key = v;
      break;
    case 'capo': {
      const n = Number.parseInt(v, 10);
      if (!Number.isNaN(n)) m.capo = n;
      break;
    }
    case 'tempo':
      m.tempo = v;
      break;
    case 'time':
      m.time = v;
      break;
    case 'duration':
      m.duration = v;
      break;
    case 'copyright':
    case 'sorttitle':
    case 'sortartist':
    case 'arranger':
    case 'tag':
      (m.extra[name] ??= []).push(v);
      break;
    // Formatting and layout directives (textfont, new_page, columns...)
    // do not apply to a screen: ignored.
  }
}

function apply(d: Directive, b: SongBuilder) {
  // Selectors such as {title-guitar: x}: not supported, skip.
  if (d.name.includes('-')) return;
  const v = d.value;
  switch (d.name) {
    case 't':
      return setMeta(b, 'title', v);
    case 'st':
      return setMeta(b, 'subtitle', v);
    case 'meta': {
      const m = /^(\S+)\s+(.*)$/.exec(v);
      if (m) setMeta(b, m[1].toLowerCase(), m[2].trim());
      return;
    }
    case 'comment':
    case 'c':
    case 'highlight':
      return b.add({ type: 'comment', text: v, style: 'normal' });
    case 'comment_italic':
    case 'ci':
      return b.add({ type: 'comment', text: v, style: 'italic' });
    case 'comment_box':
    case 'cb':
      return b.add({ type: 'comment', text: v, style: 'boxed' });
    case 'x_voz':
      return b.setVoice(parseNames(v));
    case 'x_band':
      return b.setParts(parseParts(v));
    case 'chorus':
      return b.add(v ?{ type: 'chorusRef', label: labelOf(v) } : { type: 'chorusRef' });
    case 'soc':
      return b.open('chorus', labelOf(v));
    case 'sov':
      return b.open('verse', labelOf(v));
    case 'sob':
      return b.open('bridge', labelOf(v));
    case 'sot':
      return b.open('tab', labelOf(v));
    case 'sog':
      return b.open('grid', labelOf(v));
    case 'eoc':
    case 'eov':
    case 'eob':
    case 'eot':
    case 'eog':
      return b.close();
  }
  if (d.name.startsWith('start_of_')) {
    const name = d.name.slice('start_of_'.length);
    b.open(kindFor(name), labelOf(v), kindFor(name) === 'custom' ? name : undefined);
  } else if (d.name.startsWith('end_of_')) {
    b.close();
  } else {
    setMeta(b, d.name, v);
  }
}

/**
 * Parses ChordPro text into a {@link Song}.
 *
 * Lenient: unknown directives are ignored, an unclosed `[` stays as lyrics,
 * and a section that is never closed ends at the next section or at the end.
 * Directives with a selector (`{title-guitar: ...}`) are skipped.
 */
export function parseChordPro(source: string): Song {
  const b = new SongBuilder();
  const lines = source.split(/\r\n|\r|\n/);
  if (lines.length && lines[lines.length - 1] === '') lines.pop();

  for (const [index, raw] of lines.entries()) {
    b.line = index;
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (b.inPreformatted) {
      const d = parseDirective(trimmed);
      if (d && (d.name.startsWith('end_of_') || d.name === 'eot' || d.name === 'eog')) {
        b.close();
      } else {
        b.add({ type: 'tab', text: line });
      }
      continue;
    }

    if (trimmed.startsWith('#')) continue;
    if (!trimmed) {
      b.add({ type: 'empty' });
      continue;
    }
    const d = parseDirective(trimmed);
    if (d) {
      apply(d, b);
      continue;
    }
    b.add({ ...parseLyricLine(line), source: index });
  }
  return b.build();
}

// Immutable model of a song parsed from ChordPro.

export interface SongMetadata {
  title?: string;
  subtitles: string[];
  artists: string[];
  composers: string[];
  album?: string;
  year?: string;
  /** Key as written in the file, e.g. `G`, `Am`, `Sol`. */
  key?: string;
  capo?: number;
  tempo?: string;
  time?: string;
  duration?: string;
  /** Known `{meta}` names without a field of their own (copyright, tag...). */
  extra: Record<string, string[]>;
}

/** An optional chord and the lyrics that follow it until the next chord. */
export interface ChordSegment {
  /** Raw text between `[` and `]`. Missing when the segment has no chord. */
  chord?: string;
  lyric: string;
}

export type CommentStyle = 'normal' | 'italic' | 'boxed';

export type SongLine =
  | { type: 'lyric'; segments: ChordSegment[] }
  | { type: 'comment'; text: string; style: CommentStyle }
  /** Raw line inside a tab or grid section. */
  | { type: 'tab'; text: string }
  | { type: 'empty' }
  /** `{chorus}`: repeat the last chorus here. */
  | { type: 'chorusRef'; label?: string };

export type LyricLine = Extract<SongLine, { type: 'lyric' }>;

export type SectionKind = 'none' | 'verse' | 'chorus' | 'bridge' | 'tab' | 'grid' | 'custom';

export interface SongSection {
  kind: SectionKind;
  lines: SongLine[];
  /** Label given in the file, e.g. `{start_of_verse: Verso 1}`. */
  label?: string;
  /** Raw name of a custom section, e.g. `intro` from `{start_of_intro}`. */
  name?: string;
}

export interface Song {
  metadata: SongMetadata;
  sections: SongSection[];
}

export function emptyMetadata(): SongMetadata {
  return { subtitles: [], artists: [], composers: [], extra: {} };
}

/** ChordPro annotations are written `[*text]`: shown like a chord, never transposed. */
export function isAnnotation(s: ChordSegment): boolean {
  return s.chord !== undefined && s.chord.startsWith('*');
}

/** Text to draw above the lyrics (annotation without its `*`). */
export function displayChord(s: ChordSegment): string | undefined {
  return isAnnotation(s) ? s.chord!.slice(1) : s.chord;
}

export function hasChords(line: LyricLine): boolean {
  return line.segments.some((s) => s.chord !== undefined);
}

export function lyricsOf(line: LyricLine): string {
  return line.segments.map((s) => s.lyric).join('');
}

export function artistOf(m: SongMetadata): string | undefined {
  return m.artists.length ? m.artists.join(', ') : undefined;
}

export function isPreformatted(s: SongSection): boolean {
  return s.kind === 'tab' || s.kind === 'grid';
}

/** Every chord in order of appearance (annotations excluded). */
export function chordsOf(song: Song): string[] {
  const out: string[] = [];
  for (const section of song.sections) {
    for (const line of section.lines) {
      if (line.type !== 'lyric') continue;
      for (const s of line.segments) {
        if (s.chord && !isAnnotation(s)) out.push(s.chord);
      }
    }
  }
  return out;
}

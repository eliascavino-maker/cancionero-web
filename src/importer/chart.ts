import { parseChordPro } from '../chordpro/parser';
import type { SongSection } from '../chordpro/song';
import { parseChord } from '../music/chord';
import type { DocLine } from './docx';

/**
 * Reads the band's chord sheets (a Google Doc downloaded as .docx or .txt):
 *
 *   CUSCO                          ← title in capitals: a new song
 *   intro: Bb                      ← part name + chords
 *   1 estrofa: G - D - Bm - F#7    ← the number is kept ("Estrofa 1")
 *            G - D - Bm - F#7      ← more lines of the same part
 *   estribillo                     ← part name alone, chords below
 *   Bm G D A x2                    ← "x2": repeat
 *   G (SOL SILENCIO) - D           ← text in parentheses: a note
 *   estribillo.                    ← no chords: repeat that part
 *   Estrofa y Pre                  ← repeat both
 *   Estribillo vida en abundancia  ← the chorus of another song of the doc
 *
 * Colored chords: red = piano doesn't play, blue = piano comes in.
 */

export type PartKind = 'none' | 'intro' | 'verse' | 'prechorus' | 'chorus' | 'inter' | 'bridge' | 'solo' | 'outro';

export interface ChartToken {
  type: 'chord' | 'note';
  text: string;
  /** A note stuck to the next chord: drawn right above it. */
  glue?: true;
}

export interface ChartPart {
  kind: PartKind;
  number?: number;
  lines: ChartToken[][];
  /** Written only as a name ("estribillo."): repeats the last part of that kind. */
  repeat?: boolean;
  /** Repeats the chorus of another song in the document. */
  fromSong?: string;
}

export interface ChartSong {
  title: string;
  parts: ChartPart[];
}

// --------------------------------------------------------------- reading

const PART_WORDS: [string, PartKind][] = [
  ['pre estribillo', 'prechorus'],
  ['pre-estribillo', 'prechorus'],
  ['pre coro', 'prechorus'],
  ['pre-coro', 'prechorus'],
  ['precoro', 'prechorus'],
  ['pre', 'prechorus'],
  ['introduccion', 'intro'],
  ['intro', 'intro'],
  ['estrofa', 'verse'],
  ['verso', 'verse'],
  ['estribillo', 'chorus'],
  ['coro', 'chorus'],
  ['interludio', 'inter'],
  ['instrumental', 'inter'],
  ['inter', 'inter'],
  ['puente', 'bridge'],
  ['solo', 'solo'],
  ['final', 'outro'],
  ['outro', 'outro'],
  ['cierre', 'outro'],
];
const PART_RE = PART_WORDS.map(([w]) => w.replace('-', '\\-')).join('|');
const HEADER = new RegExp(
  `^\\s*(?:(\\d+)\\s*(?:º|°|ra|da|ta)?\\s+)?(${PART_RE})(?![a-zñ])(?:\\s+(\\d+))?(?:\\s+y\\s+(${PART_RE})(?![a-zñ]))?\\s*(:+|\\.)?\\s*`,
);

/** Lowercase without accents, keeping the same length (so positions still match). */
function foldSameLength(s: string): string {
  return [...s].map((c) => (c.normalize('NFD')[0] ?? c).toLowerCase()).join('');
}

export function fold(s: string): string {
  return foldSameLength(s).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

const kindOf = (word: string) => PART_WORDS.find(([w]) => w === word)![1];

function asChord(word: string): string | null {
  const w = word.replace(/º/g, '°');
  return parseChord(w) ? w : null;
}

interface Tok {
  type: 'chord' | 'note' | 'repeat' | 'word';
  text: string;
  color: 'red' | 'blue' | null;
  /** Written in parentheses. */
  paren?: true;
}

function colorClass(hex: string | null): 'red' | 'blue' | null {
  if (!hex) return null;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if (r > 150 && g < 140 && b < 140) return 'red';
  if (b > 150 && r < 120) return 'blue';
  return null;
}

/** Splits "G (SOL SILENCIO) - D - Fx2 …" into chords, notes and repeats. */
function tokenize(line: DocLine, from = 0): Tok[] {
  const out: Tok[] = [];
  const re = /\(([^)]*)\)?|…|\.{3}|[^\s\-–—,()…]+/g;
  re.lastIndex = from;
  for (let m = re.exec(line.text); m; m = re.exec(line.text)) {
    const color = colorClass(line.colors[m.index] ?? null);
    const text = m[0];
    if (text.startsWith('(')) {
      const note = (m[1] ?? text.slice(1)).trim();
      if (note) out.push({ type: 'note', text: note, color: null, paren: true });
      continue;
    }
    if (text === '…' || text === '...') {
      out.push({ type: 'note', text: '…', color: null });
      continue;
    }
    const rep = /^x(\d+)$/i.exec(text);
    if (rep) {
      out.push({ type: 'repeat', text: `x${rep[1]}`, color: null });
      continue;
    }
    const chord = asChord(text);
    if (chord) {
      out.push({ type: 'chord', text: chord, color });
      continue;
    }
    // "Fx2": a chord glued to its repeat.
    const glued = /^(.+?)x(\d+)$/i.exec(text);
    if (glued && asChord(glued[1])) {
      out.push({ type: 'chord', text: asChord(glued[1])!, color });
      out.push({ type: 'repeat', text: `x${glued[2]}`, color: null });
      continue;
    }
    out.push({ type: 'word', text, color });
  }
  return out;
}

const chordCount = (toks: Tok[]) => toks.filter((t) => t.type === 'chord').length;
const isChordLine = (toks: Tok[]) => {
  const chords = chordCount(toks);
  return chords > 0 && chords >= toks.filter((t) => t.type === 'word').length;
};

function isTitle(line: DocLine): boolean {
  const t = line.text.trim();
  const letters = t.replace(/[^\p{L}]/gu, '');
  return letters.length >= 2 && letters === letters.toUpperCase() && !isChordLine(tokenize(line));
}

const titleCase = (t: string) => {
  const s = t.trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export function parseChart(lines: DocLine[]): ChartSong[] {
  const songs: ChartSong[] = [];
  let song: ChartSong | null = null;
  let part: ChartPart | null = null;
  // Piano state inside the current part, from chord colors.
  let piano: 'red' | 'blue' | null = null;

  const startPart = (p: ChartPart) => {
    song ??= { title: 'Sin título', parts: [] };
    song.parts.push(p);
    part = p;
    piano = null;
  };

  const addLine = (toks: Tok[]) => {
    const line: ChartToken[] = [];
    for (const t of toks) {
      if (t.type === 'chord') {
        if (t.color && t.color !== piano)
          line.push({ type: 'note', text: t.color === 'red' ? 'Sin piano' : 'Entra piano', glue: true });
        if (t.color) piano = t.color;
        line.push({ type: 'chord', text: t.text });
      } else {
        const prev = line[line.length - 1];
        if (t.paren && prev?.type === 'chord') {
          // "G (SOL SILENCIO)": the note goes right above that G.
          line.splice(line.length - 1, 0, { type: 'note', text: t.text, glue: true });
        } else {
          line.push({ type: 'note', text: t.text });
        }
      }
    }
    if (!line.length) return;
    if (!part) startPart({ kind: 'none', lines: [] });
    part!.lines.push(line);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = line.text.trim();
    if (!text) continue;

    const folded = foldSameLength(line.text);
    const h = HEADER.exec(folded);
    // "Coro de ángeles" is not a header: the name must end there or be followed by ":", "." or chords.
    const after = h ? folded.slice(h[0].length) : '';
    const headerOk = h && (h[5] || !after.trim() || isChordLine(tokenize(line, h[0].length)) || /^[\p{L}\s]+$/u.test(after));
    if (h && headerOk && !(isTitle(line) && !h[5] && after.trim())) {
      const number = h[1] ? Number(h[1]) : h[3] ? Number(h[3]) : undefined;
      const kinds = [kindOf(h[2]), ...(h[4] ? [kindOf(h[4])] : [])];
      const rest = tokenize(line, h[0].length);
      const nextToks = lines.slice(i + 1).find((l) => l.text.trim());
      const chordsBelow = nextToks ? isChordLine(tokenize(nextToks)) && !HEADER.exec(foldSameLength(nextToks.text)) : false;

      if (rest.length && !isChordLine(rest)) {
        // "Estribillo vida en abundancia": that song's chorus.
        startPart({ kind: kinds[0], lines: [], fromSong: line.text.slice(h[0].length).trim() });
      } else if (!rest.length && !chordsBelow) {
        kinds.forEach((kind) => startPart({ kind, lines: [], repeat: true }));
      } else {
        kinds.forEach((kind, k) => {
          startPart({ kind, ...(number !== undefined && k === 0 ? { number } : {}), lines: [] });
          if (rest.length) addLine(rest);
        });
      }
      continue;
    }

    if (isTitle(line)) {
      song = { title: titleCase(text), parts: [] };
      songs.push(song);
      part = null;
      continue;
    }

    const toks = tokenize(line);
    if (isChordLine(toks)) addLine(toks);
    else if (part) (part as ChartPart).lines.push([{ type: 'note', text }]);
  }
  return songs.filter((s) => s.parts.length);
}

// --------------------------------------------------------------- ChordPro

const SECTION: Record<PartKind, { name?: string; label: string }> = {
  none: { label: '' },
  intro: { name: 'intro', label: 'Intro' },
  verse: { name: 'verse', label: 'Estrofa' },
  prechorus: { name: 'prechorus', label: 'Pre-coro' },
  chorus: { name: 'chorus', label: 'Estribillo' },
  inter: { name: 'interlude', label: 'Interludio' },
  bridge: { name: 'bridge', label: 'Puente' },
  solo: { name: 'solo', label: 'Solo' },
  outro: { name: 'outro', label: 'Final' },
};

function lineText(line: ChartToken[]): string {
  return line
    .map((t, i) => {
      const text = t.type === 'chord' ? `[${t.text}]` : `[*${t.text.replace(/[[\]]/g, '')}]`;
      return i === 0 || line[i - 1].glue ? text : ` ${text}`;
    })
    .join('');
}

/** "x2" alone at the end of a one-line part goes into its name: "Estrofa x2". */
function partLabel(p: ChartPart): { label: string; lines: string[] } {
  let lines = p.lines.map((l) => [...l]);
  let label = SECTION[p.kind].label + (p.number !== undefined && p.kind !== 'none' ? ` ${p.number}` : '');
  const last = lines.length === 1 ? lines[0][lines[0].length - 1] : undefined;
  if (last?.type === 'note' && /^x\d+$/.test(last.text) && p.kind !== 'none') {
    label += ` ${last.text}`;
    lines = [lines[0].slice(0, -1)];
  }
  return { label, lines: lines.filter((l) => l.length).map(lineText) };
}

/** Repeats ("estribillo.", "Estrofa y Pre") and references to other songs become real parts. */
export function resolveParts(song: ChartSong, all: ChartSong[]): ChartPart[] {
  const out: ChartPart[] = [];
  for (const p of song.parts) {
    if (p.fromSong !== undefined) {
      const other = all.find((s) => s !== song && fold(s.title) === fold(p.fromSong!));
      const source = other?.parts.find((q) => q.kind === p.kind && q.lines.length);
      if (source) {
        const [first, ...rest] = source.lines;
        const from: ChartToken = { type: 'note', text: `Como en «${other!.title}»`, glue: true };
        out.push({ kind: p.kind, lines: [[from, ...first], ...rest] });
      } else {
        out.push({ kind: p.kind, lines: [[{ type: 'note', text: `${SECTION[p.kind].label} de «${p.fromSong}»` }]] });
      }
      continue;
    }
    if (p.repeat) {
      const previous = [...out].reverse().find((q) => q.kind === p.kind && q.lines.length);
      out.push(previous ? { ...previous, repeat: true } : { kind: p.kind, lines: [] });
      continue;
    }
    out.push(p);
  }
  return out;
}

export function chartToChordPro(song: ChartSong, all: ChartSong[] = [song]): string {
  const out = [`{title: ${song.title}}`];
  let chorusWritten = false;
  for (const p of resolveParts(song, all)) {
    out.push('');
    if (p.kind === 'chorus' && p.repeat && chorusWritten) {
      out.push('{chorus}');
      continue;
    }
    out.push(...sectionText(p));
    if (p.kind === 'chorus') chorusWritten = true;
  }
  return out.join('\n') + '\n';
}

function sectionText(p: ChartPart): string[] {
  const { name } = SECTION[p.kind];
  const { label, lines } = partLabel(p);
  if (!name) return lines;
  return [`{start_of_${name}: ${label}}`, ...lines, `{end_of_${name}}`];
}

// --------------------------------------------------------------- merge

/** Part kind of an existing section, to pair it with the sheet. */
function keyOf(s: SongSection): PartKind | null {
  if (s.kind === 'verse' || s.kind === 'chorus' || s.kind === 'bridge') return s.kind;
  if (s.kind !== 'custom' || !s.name) return null;
  const n = fold(s.name).replace(/\s/g, '');
  if (/^pre/.test(n)) return 'prechorus';
  if (/^intro/.test(n)) return 'intro';
  if (/^(outro|final|cierre|coda)/.test(n)) return 'outro';
  if (/^(inter|instrumental)/.test(n)) return 'inter';
  if (/^solo/.test(n)) return 'solo';
  return null;
}

const hasRealChords = (s: SongSection) =>
  s.lines.some((l) => l.type === 'lyric' && l.segments.some((g) => g.chord && !g.chord.startsWith('*')));

export interface MergeResult {
  content: string;
  /** Parts that got their chords. */
  added: number;
  /** Parts that already had chords (left alone). */
  skipped: number;
  /** Parts of the sheet that the lyrics didn't have (added as new parts). */
  inserted: number;
}

/**
 * Adds the sheet's chords to a song that already has lyrics: each part gets
 * its progression as a first line (1st estrofa ↔ 1st verse, etc.). Parts the
 * lyrics don't have (intro, interludio, final...) are added where they go.
 * Parts that already have chords are left alone.
 */
export function mergeChart(content: string, song: ChartSong, all: ChartSong[] = [song]): MergeResult {
  const result: MergeResult = { content, added: 0, skipped: 0, inserted: 0 };
  const seen = new Map<PartKind, number>();
  // Section index (in the current text) after which new parts go; -1 = before the first one.
  let cursor = -1;
  let lastChorusLines: string | undefined;

  for (const p of resolveParts(song, all)) {
    if (p.kind === 'none' || !p.lines.length) continue;
    const n = seen.get(p.kind) ?? 0;
    seen.set(p.kind, n + 1);
    const lines = p.lines.map(lineText);
    const sections = parseChordPro(result.content).sections;
    const matches = sections.map((s, i) => [s, i] as const).filter(([s]) => keyOf(s) === p.kind);
    const match = matches[n];

    if (match) {
      const [section, index] = match;
      cursor = index;
      if (p.kind === 'chorus') lastChorusLines = lines.join('\n');
      if (hasRealChords(section)) {
        result.skipped++;
        continue;
      }
      const at =
        section.startLine === undefined
          ? 0
          : section.kind === 'none'
            ? section.startLine
            : Math.max(section.startLine, section.partsLine ?? -1) + 1;
      result.content = insertLines(result.content, at, lines);
      result.added++;
      continue;
    }
    // The lyrics repeat the chorus with {chorus}: same chords, nothing to add.
    if (p.kind === 'chorus' && lastChorusLines === lines.join('\n')) continue;

    // A blank line between parts: after the new part when it goes first, before it otherwise.
    const block = sectionText(p);
    result.content =
      cursor === -1
        ? insertLines(result.content, sections[0]?.startLine ?? result.content.split(/\r\n|\r|\n/).length, [...block, ''])
        : insertLines(result.content, (sections[cursor].endLine ?? 0) + 1, ['', ...block]);
    result.inserted++;
    cursor++;
  }
  return result;
}

function insertLines(content: string, at: number, add: string[]): string {
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r\n|\r|\n/);
  lines.splice(at, 0, ...add);
  return lines.join(newline);
}

import { parseChord } from '../music/chord';

/**
 * Turns pasted lyrics (plain, or with chords on the line above, as on most
 * chord sites) into ChordPro, guessing the structure:
 *
 * - Blocks are separated by blank lines or by label lines ("Coro:", "[Verso 2]").
 * - Labels written in the text always win.
 * - Chorus: the block whose lyrics repeat the most.
 * - Pre-chorus: another repeated block that comes right before the chorus.
 * - Bridge: a one-off block after the second chorus that leads into a chorus.
 * - Chord-only blocks: intro at the start, final at the end, instrumental otherwise.
 * - The rest are verses ("Estrofa 1", "Estrofa 2"...).
 */

export type BlockKind = 'verse' | 'chorus' | 'prechorus' | 'bridge' | 'intro' | 'outro' | 'instrumental';

export interface Block {
  kind: BlockKind;
  /** ChordPro lines (chords inline). */
  lines: string[];
  /** Written as `{chorus}`: repeats the chorus above. */
  chorusRepeat?: boolean;
  /** "x2" written next to a label. */
  times?: number;
  /** Verse number, for "Estrofa N". */
  number?: number;
  /** Kind came from a label in the text. */
  labeled?: boolean;
}

export interface PastedSong {
  title?: string;
  artist?: string;
  key?: string;
  /** BPM, written as `{tempo}`. */
  tempo?: string;
  text: string;
}

// ------------------------------------------------------------- labels

const LABEL_WORDS: [RegExp, BlockKind][] = [
  [/^(pre ?(coro|estribillo|chorus)|precoro|prechorus)$/, 'prechorus'],
  [/^(coro|estribillo|chorus|refran|refrain|estrib)$/, 'chorus'],
  [/^(verso|estrofa|verse|strophe|est)$/, 'verse'],
  [/^(puente|bridge)$/, 'bridge'],
  [/^(intro|introduccion)$/, 'intro'],
  [/^(outro|final|coda|cierre|fin)$/, 'outro'],
  [/^(solo|instrumental|interludio|interlude|riff|interludio instrumental)$/, 'instrumental'],
];

const LABEL_LINE =
  /^[[(*]*\s*([\p{L}][\p{L} \-]*?)\s*(\d+)?\s*[\])*]*\s*(?:[([]?\s*x\s*(\d+)\s*[)\]]?)?\s*(?::\s*(.*))?$/iu;

function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

interface Label {
  kind: BlockKind;
  number?: number;
  times?: number;
  /** Text after "Coro:" on the same line. */
  rest?: string;
}

export function readLabel(line: string): Label | null {
  const m = LABEL_LINE.exec(line.trim());
  if (!m) return null;
  const word = fold(m[1]).replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  const found = LABEL_WORDS.find(([re]) => re.test(word));
  if (!found) return null;
  const label: Label = { kind: found[1] };
  if (m[2]) label.number = Number(m[2]);
  if (m[3]) label.times = Number(m[3]);
  if (m[4]?.trim()) label.rest = m[4].trim();
  return label;
}

// ------------------------------------------------------------- chords

/** Tokens allowed on a chord line besides chords: bars, "x2", "%", "-". */
const FILLER = /^(\||\|\||%|-+|\/|x\d+|\(?x\d+\)?|\d+x|\.+|:\|\|?|\|\|?:)$/i;

function isChordToken(t: string): boolean {
  return parseChord(t.replace(/^\(|\)$/g, '')) !== null;
}

export function isChordLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  let chords = 0;
  for (const t of tokens) {
    if (isChordToken(t)) chords++;
    else if (!FILLER.test(t)) return false;
  }
  return chords > 0;
}

/** Puts the chords of `chordLine` into `lyric` at the same columns. */
export function mergeChords(chordLine: string, lyric: string): string {
  let out = lyric;
  const tokens = [...chordLine.matchAll(/\S+/g)].filter((m) => isChordToken(m[0]));
  for (const m of tokens.reverse()) {
    const pos = m.index!;
    if (out.length < pos) out = out.padEnd(pos);
    out = out.slice(0, pos) + `[${m[0].replace(/^\(|\)$/g, '')}]` + out.slice(pos);
  }
  return out.trimEnd();
}

/** A chord line with no lyrics under it: `G   D` → `[G]   [D]`. */
function chordsOnly(line: string): string {
  return line.trimEnd().replace(/\S+/g, (t) => (isChordToken(t) ? `[${t.replace(/^\(|\)$/g, '')}]` : t));
}

function expandTabs(line: string): string {
  let out = '';
  for (const ch of line) out += ch === '\t' ? ' '.repeat(8 - (out.length % 8)) : ch;
  return out;
}

function convertLines(raw: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const line = raw[i];
    if (isChordLine(line)) {
      const next = raw[i + 1];
      if (next !== undefined && next.trim() && !isChordLine(next)) {
        out.push(mergeChords(line, next));
        i++;
      } else {
        out.push(chordsOnly(line));
      }
    } else {
      out.push(line.trimEnd());
    }
  }
  return out;
}

// ------------------------------------------------------------- blocks

interface RawBlock {
  label?: Label;
  lines: string[];
}

function splitBlocks(text: string): RawBlock[] {
  const lines = text.split(/\r\n|\r|\n/).map((l) => expandTabs(l).trimEnd());
  const blocks: RawBlock[] = [];
  let current: RawBlock | null = null;
  const end = () => {
    if (current && (current.lines.length || current.label)) blocks.push(current);
    current = null;
  };
  for (const line of lines) {
    if (!line.trim()) {
      end();
      continue;
    }
    const label = readLabel(line);
    if (label) {
      end();
      current = { label, lines: label.rest ? [label.rest] : [] };
      continue;
    }
    current ??= { lines: [] };
    current.lines.push(line);
  }
  end();
  return blocks;
}

/** Lyrics only, folded: used to spot repeated blocks. */
function lyricKey(lines: string[]): string[] {
  return lines
    .map((l) =>
      fold(l.replace(/\[[^\]]*\]/g, ''))
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim(),
    )
    .filter(Boolean);
}

function similar(a: string[], b: string[]): boolean {
  if (!a.length || !b.length) return false;
  if (a.join('\n') === b.join('\n')) return true;
  if (Math.abs(a.length - b.length) > 2) return false;
  const setB = new Set(b);
  const shared = a.filter((l) => setB.has(l)).length;
  return (2 * shared) / (a.length + b.length) >= 0.75;
}

const hasChord = (lines: string[]) => lines.some((l) => /\[[^\]]+\]/.test(l));

export function detectBlocks(text: string): Block[] {
  const raw = splitBlocks(text);

  // A label alone ("Coro", "(Estribillo x2)"): repeats the chorus if one was
  // already written, otherwise it is the title of the block below it.
  const merged: RawBlock[] = [];
  let chorusSeen = false;
  for (let i = 0; i < raw.length; i++) {
    const b = raw[i];
    const next = raw[i + 1];
    if (b.label && !b.lines.length) {
      if (b.label.kind === 'chorus' && chorusSeen) {
        merged.push(b);
        continue;
      }
      if (next && !next.label) {
        merged.push({ label: b.label, lines: next.lines });
        i++;
        if (b.label.kind === 'chorus') chorusSeen = true;
        continue;
      }
      continue; // a stray label with nothing to name
    }
    if (b.label?.kind === 'chorus') chorusSeen = true;
    merged.push(b);
  }

  const blocks: (Block & { key: string[] })[] = merged.map((b) => {
    const lines = convertLines(b.lines);
    const block: Block & { key: string[] } = { kind: 'verse', lines, key: lyricKey(lines) };
    if (b.label) {
      block.kind = b.label.kind;
      block.labeled = true;
      if (b.label.number !== undefined) block.number = b.label.number;
      if (b.label.times !== undefined) block.times = b.label.times;
      if (!lines.length) block.chorusRepeat = true;
    }
    return block;
  });

  // Group blocks with the same (or nearly the same) lyrics.
  const group: number[] = blocks.map(() => -1);
  blocks.forEach((b, i) => {
    if (!b.key.length) return;
    const j = blocks.findIndex((o, k) => k < i && group[k] === k && similar(o.key, b.key));
    group[i] = j === -1 ? i : j;
  });
  const members = (g: number) => blocks.map((_, i) => i).filter((i) => group[i] === g);
  const groups = [...new Set(group.filter((g) => g !== -1))];

  // Chorus: labeled, or the most repeated group.
  const labeledChorus = blocks.findIndex((b) => b.labeled && b.kind === 'chorus' && b.key.length);
  let chorusGroup = labeledChorus === -1 ? -1 : group[labeledChorus];
  const repeated = groups.filter((g) => members(g).length >= 2 && !blocks[g].labeled);
  const nextLyric = (i: number) => i + 1 < blocks.length ? i + 1 : -1;

  if (chorusGroup === -1 && repeated.length) {
    const top = Math.max(...repeated.map((g) => members(g).length));
    const best = repeated.filter((g) => members(g).length === top);
    // Between equally repeated groups, the one that comes *after* another
    // repeated group is the chorus (the other is a pre-chorus); else the later one.
    const after = best.find((g) => members(g).every((i) => i > 0 && group[i - 1] !== -1 && group[i - 1] !== g && best.includes(group[i - 1])));
    chorusGroup = after ?? best.reduce((a, b) => (members(b)[0] > members(a)[0] ? b : a));
  }
  const isChorus = (i: number) =>
    i >= 0 && i < blocks.length && (blocks[i].kind === 'chorus' || (chorusGroup !== -1 && group[i] === chorusGroup));

  blocks.forEach((b, i) => {
    if (!b.labeled && isChorus(i)) b.kind = 'chorus';
  });

  // Pre-chorus: a repeated group right before the chorus at least twice.
  if (!blocks.some((b) => b.labeled && b.kind === 'prechorus')) {
    for (const g of groups) {
      if (g === chorusGroup || blocks[g].labeled) continue;
      const m = members(g);
      const beforeChorus = m.filter((i) => isChorus(nextLyric(i))).length;
      if (m.length >= 2 && beforeChorus >= 2) m.forEach((i) => !blocks[i].labeled && (blocks[i].kind = 'prechorus'));
    }
  }

  // Bridge: a one-off block after the second chorus that leads into a chorus.
  const chorusIdx = blocks.map((_, i) => i).filter((i) => blocks[i].kind === 'chorus');
  if (chorusIdx.length >= 2 && !blocks.some((b) => b.labeled && b.kind === 'bridge')) {
    for (let i = chorusIdx[1] + 1; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.labeled || b.kind !== 'verse' || !b.key.length || members(group[i]).length > 1) continue;
      const n = nextLyric(i);
      if (n !== -1 && (blocks[n].kind === 'chorus' || blocks[n].kind === 'prechorus')) b.kind = 'bridge';
    }
  }

  // Chord-only blocks.
  const lastLyric = blocks.map((b) => b.key.length > 0).lastIndexOf(true);
  blocks.forEach((b, i) => {
    if (b.labeled || b.key.length) return;
    b.kind = i === 0 ? 'intro' : i > lastLyric ? 'outro' : 'instrumental';
  });

  // A later chorus with the same lyrics (and no different chords) becomes `{chorus}`.
  let firstChorus: (Block & { key: string[] }) | undefined;
  for (const b of blocks) {
    if (b.kind !== 'chorus' || b.chorusRepeat) continue;
    if (!firstChorus) {
      firstChorus = b;
      continue;
    }
    const sameLyrics = b.key.join('\n') === firstChorus.key.join('\n');
    if (sameLyrics && (!hasChord(b.lines) || b.lines.join('\n') === firstChorus.lines.join('\n'))) {
      b.chorusRepeat = true;
      b.lines = [];
    }
  }

  // Verse numbers: a repeated verse keeps the number of its first appearance.
  let verse = 0;
  const numberOf = new Map<number, number>();
  blocks.forEach((b, i) => {
    if (b.kind !== 'verse') return;
    if (b.number !== undefined) {
      verse = Math.max(verse, b.number);
      return;
    }
    const g = group[i];
    if (g !== -1 && numberOf.has(g)) b.number = numberOf.get(g);
    else {
      b.number = ++verse;
      if (g !== -1) numberOf.set(g, b.number);
    }
  });

  return blocks.map(({ key: _key, ...b }) => b);
}

// ------------------------------------------------------------- output

const SECTION: Record<BlockKind, { name: string; label: (b: Block) => string | undefined }> = {
  verse: { name: 'verse', label: (b) => `Estrofa ${b.number ?? ''}`.trim() },
  chorus: { name: 'chorus', label: () => undefined },
  prechorus: { name: 'prechorus', label: () => 'Pre-coro' },
  bridge: { name: 'bridge', label: () => undefined },
  intro: { name: 'intro', label: () => 'Intro' },
  outro: { name: 'outro', label: () => 'Final' },
  instrumental: { name: 'instrumental', label: () => 'Instrumental' },
};

const LABEL_NAME: Record<BlockKind, string> = {
  verse: 'Estrofa',
  chorus: 'Estribillo',
  prechorus: 'Pre-coro',
  bridge: 'Puente',
  intro: 'Intro',
  outro: 'Final',
  instrumental: 'Instrumental',
};

/** Short name for a block, e.g. "Estrofa 2", "Estribillo". */
export function blockName(b: Block): string {
  return b.kind === 'verse' && b.number ? `Estrofa ${b.number}` : LABEL_NAME[b.kind];
}

export function blocksToChordPro(blocks: Block[], meta: Omit<PastedSong, 'text'> = {}): string {
  const out: string[] = [];
  if (meta.title?.trim()) out.push(`{title: ${meta.title.trim()}}`);
  if (meta.artist?.trim()) out.push(`{artist: ${meta.artist.trim()}}`);
  if (meta.key?.trim()) out.push(`{key: ${meta.key.trim()}}`);
  if (meta.tempo?.trim()) out.push(`{tempo: ${meta.tempo.trim()}}`);

  for (const b of blocks) {
    if (out.length) out.push('');
    const times = b.times && b.times > 1 ? ` x${b.times}` : '';
    if (b.chorusRepeat) {
      out.push(times ? `{chorus: Estribillo${times}}` : '{chorus}');
      continue;
    }
    const { name, label } = SECTION[b.kind];
    const text = label(b);
    const fullLabel = text ? text + times : times ? LABEL_NAME[b.kind] + times : undefined;
    out.push(fullLabel ? `{start_of_${name}: ${fullLabel}}` : `{start_of_${name}}`);
    out.push(...b.lines);
    out.push(`{end_of_${name}}`);
  }
  return out.join('\n') + '\n';
}

/** Pasted text already in ChordPro (has directives): used as it is. */
export function looksLikeChordPro(text: string): boolean {
  return /^\s*\{\s*(title|t|start_of_\w+|so[cvbtg]|eo[cvbtg]|end_of_\w+|chorus|artist|key)\s*[:}]/im.test(text);
}

export function textToChordPro(song: PastedSong): string {
  if (looksLikeChordPro(song.text)) return song.text;
  return blocksToChordPro(detectBlocks(song.text), song);
}

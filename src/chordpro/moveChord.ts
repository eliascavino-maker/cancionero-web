import { parseChordPro } from './parser';

/** A chord in the source: its line (0-based) and its order among the chords of that line. */
export interface ChordRef {
  line: number;
  index: number;
}

export type MoveDirection = 'left' | 'right' | 'up' | 'down';

interface ChordToken {
  start: number;
  end: number;
  /** Lyric characters before the chord. */
  col: number;
}

interface ScannedLine {
  chords: ChordToken[];
  /** Raw index where each lyric character starts, plus the line length at the end. */
  colStart: number[];
}

/** Same rules as `parseLyricLine`: `\[` escapes, `[x]` chords, `[]` is not a chord. */
function scan(line: string): ScannedLine {
  const chords: ChordToken[] = [];
  const colStart: number[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '\\' && i + 1 < line.length && '[]\\'.includes(line[i + 1])) {
      colStart.push(i);
      i += 2;
      continue;
    }
    if (line[i] === '[') {
      const close = line.indexOf(']', i + 1);
      if (close !== -1) {
        if (line.slice(i + 1, close).trim()) chords.push({ start: i, end: close + 1, col: colStart.length });
        i = close + 1;
        continue;
      }
    }
    colStart.push(i);
    i++;
  }
  colStart.push(line.length);
  return { chords, colStart };
}

/**
 * Where to put a chord at lyric column `col`. With other chords already
 * there, `before` puts it first, otherwise last.
 */
function insertAt(line: string, col: number, before: boolean): number {
  const { chords, colStart } = scan(line);
  const len = colStart.length - 1;
  const c = Math.max(0, Math.min(len, col));
  const there = chords.filter((t) => t.col === c);
  if (before && there.length) return there[0].start;
  if (c < len) return colStart[c];
  return line.length;
}

function chordIndexAt(line: string, pos: number): number {
  return scan(line).chords.filter((t) => t.start < pos).length;
}

/**
 * Moves one chord inside the ChordPro text: left/right by one letter, or
 * up/down to the nearest lyric line keeping the same column.
 * Returns the new text and where the chord ended up, or null if it can't move.
 * The rest of the file (comments, directives, spacing) is left as it was.
 */
export function moveChord(
  content: string,
  ref: ChordRef,
  dir: MoveDirection,
): { content: string; ref: ChordRef } | null {
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r\n|\r|\n/);
  const raw = lines[ref.line];
  if (raw === undefined) return null;
  const line = raw.trimEnd();
  const token = scan(line).chords[ref.index];
  if (!token) return null;
  const chordText = line.slice(token.start, token.end);
  const without = line.slice(0, token.start) + line.slice(token.end);

  if (dir === 'left' || dir === 'right') {
    const len = scan(without).colStart.length - 1;
    const col = token.col + (dir === 'right' ? 1 : -1);
    if (col < 0 || col > len) return null;
    const pos = insertAt(without, col, dir === 'right');
    lines[ref.line] = without.slice(0, pos) + chordText + without.slice(pos);
    return { content: lines.join(newline), ref: { line: ref.line, index: chordIndexAt(lines[ref.line], pos) } };
  }

  // Lyric lines in the order they appear (skips directives, comments, tabs, blanks).
  const lyricLines: number[] = [];
  for (const section of parseChordPro(content).sections) {
    for (const l of section.lines) if (l.type === 'lyric' && l.source !== undefined) lyricLines.push(l.source);
  }
  const unique = [...new Set(lyricLines)].sort((a, b) => a - b);
  const at = unique.indexOf(ref.line);
  let target = unique[at + (dir === 'down' ? 1 : -1)];
  if (at === -1 || target === undefined) return null;

  const targetLine = lines[target].trimEnd();
  const pos = insertAt(targetLine, token.col, false);
  lines[target] = targetLine.slice(0, pos) + chordText + targetLine.slice(pos);
  // A line that only held this chord would turn into a blank line: drop it.
  if (without.trim() === '') {
    lines.splice(ref.line, 1);
    if (target > ref.line) target--;
  } else {
    lines[ref.line] = without;
  }
  return { content: lines.join(newline), ref: { line: target, index: chordIndexAt(lines[target], pos) } };
}

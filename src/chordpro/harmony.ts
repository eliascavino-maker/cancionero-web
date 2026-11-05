// Editing the ChordPro text by hand: mark words as second voice with
// `((…))`, or add an indication line `{x_cue: }`.

export interface TextEdit {
  text: string;
  /** Selection to set afterwards. */
  start: number;
  end: number;
}

const isDirective = (line: string) => /^\s*[{#]/.test(line);

/**
 * Marks the selected words as second voice: `((…))` around the selected
 * part of each lyric line. If the selection is already marked, unmarks it.
 * Nothing selected (or only directives): null.
 */
export function toggleHarmony(text: string, start: number, end: number): TextEdit | null {
  if (end < start) [start, end] = [end, start];
  // Already marked: the selection is the inside or the whole of `((…))`.
  const inside = text.slice(start - 2, start) === '((' && text.slice(end, end + 2) === '))';
  const whole = text.slice(start, start + 2) === '((' && text.slice(end - 2, end) === '))';
  if (inside || whole) {
    const [from, to] = inside ? [start - 2, end + 2] : [start, end];
    const middle = text.slice(from + 2, to - 2);
    return { text: text.slice(0, from) + middle + text.slice(to), start: from, end: from + middle.length };
  }

  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const nextBreak = text.indexOf('\n', end);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  let pos = lineStart;
  let changed = false;
  const lines = text.slice(lineStart, lineEnd).split('\n').map((line) => {
    const lineFrom = pos;
    pos += line.length + 1;
    const raw = line.endsWith('\r') ? line.slice(0, -1) : line;
    if (isDirective(raw)) return line;
    // The selected part of this line, without the spaces at its ends.
    let a = Math.max(start, lineFrom) - lineFrom;
    let b = Math.min(end, lineFrom + raw.length) - lineFrom;
    while (a < b && /\s/.test(raw[a])) a++;
    while (b > a && /\s/.test(raw[b - 1])) b--;
    if (a >= b) return line;
    changed = true;
    return raw.slice(0, a) + '((' + raw.slice(a, b) + '))' + line.slice(b);
  });
  if (!changed) return null;
  const middle = lines.join('\n');
  return { text: text.slice(0, lineStart) + middle + text.slice(lineEnd), start: lineStart, end: lineStart + middle.length };
}

/** Adds `{x_cue: }` on its own line above the cursor's line, with the cursor inside. */
export function insertCueLine(text: string, at: number): TextEdit {
  const lineStart = text.lastIndexOf('\n', at - 1) + 1;
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  const cue = '{x_cue: }';
  const cursor = lineStart + cue.length - 1;
  return { text: text.slice(0, lineStart) + cue + newline + text.slice(lineStart), start: cursor, end: cursor };
}

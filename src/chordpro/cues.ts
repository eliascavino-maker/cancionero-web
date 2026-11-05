import type { SongSection } from './song';

// Indications ("4 compases de intro", "x2", "Corte") live in the text as
//   {x_cue: 4 compases de intro}
// on their own line. Other apps ignore `x_` directives.

const CUE_LINE = /^\s*\{\s*x_cue\b/i;
const END_LINE = /^\s*\{\s*(end_of_\w+|eo[cvbtg])\s*\}\s*$/i;

/** Text safe inside `{x_cue: …}`. */
function cleanCue(text: string): string {
  return text.replace(/[{}\r\n]/g, ' ').replace(/\s+/g, ' ').trim();
}

function edit(content: string, change: (lines: string[]) => void): string {
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r\n|\r|\n/);
  change(lines);
  return lines.join(newline);
}

/** Adds an indication on its own line, above line `line` (0-based). */
export function addCue(content: string, line: number, text: string): string {
  const cue = cleanCue(text);
  if (!cue) return content;
  return edit(content, (lines) => {
    if (line < 0 || line > lines.length) return;
    // Same indentation as the line below, so the text keeps its look.
    const indent = /^\s*/.exec(lines[line] ?? '')![0];
    lines.splice(line, 0, `${indent}{x_cue: ${cue}}`);
  });
}

/** Adds an indication as the last line of a section (before its `{end_of_…}`). */
export function addCueAtEnd(content: string, section: Pick<SongSection, 'endLine'>, text: string): string {
  if (section.endLine === undefined) return content;
  const lines = content.split(/\r\n|\r|\n/);
  const end = section.endLine;
  return addCue(content, END_LINE.test(lines[end] ?? '') ? end : end + 1, text);
}

/** Changes the indication on line `line`; empty text removes it. */
export function setCue(content: string, line: number, text: string): string {
  return edit(content, (lines) => {
    if (!CUE_LINE.test(lines[line] ?? '')) return;
    const cue = cleanCue(text);
    if (cue) lines[line] = lines[line].replace(/\{.*\}/, `{x_cue: ${cue}}`);
    else lines.splice(line, 1);
  });
}

export const MIN_BPM = 20;
export const MAX_BPM = 300;

const TEMPO_LINE = /^\s*\{\s*tempo\s*[:\s]/i;
const DIRECTIVE_LINE = /^\s*\{.*\}\s*$/;
const SECTION_START = /^\s*\{\s*(start_of_|so[cvbtg]\b)/i;

/** BPM from a `{tempo}` value such as `120`, `120 bpm` or `92.5`; null if none. */
export function parseBpm(tempo: string | undefined): number | null {
  const m = tempo?.match(/\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = Math.round(Number(m[0].replace(',', '.')));
  return n > 0 ? n : null;
}

export function clampBpm(n: number): number {
  return Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(n)));
}

/**
 * Writes `{tempo: bpm}` into the ChordPro text: replaces the existing line,
 * or adds one after the header directives (title, artist, key...).
 * The rest of the file stays as it was.
 */
export function setTempo(content: string, bpm: number): string {
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r\n|\r|\n/);
  const directive = `{tempo: ${bpm}}`;

  const existing = lines.findIndex((l) => TEMPO_LINE.test(l));
  if (existing !== -1) {
    lines[existing] = directive;
    return lines.join(newline);
  }

  // After the last directive of the header, before lyrics or sections.
  let insertAt = 0;
  for (const [i, l] of lines.entries()) {
    const t = l.trim();
    if (t === '' || t.startsWith('#')) continue;
    if (!DIRECTIVE_LINE.test(l) || SECTION_START.test(l)) break;
    insertAt = i + 1;
  }
  lines.splice(insertAt, 0, directive);
  return lines.join(newline);
}

/**
 * Tap tempo: BPM from the times (ms) of the last taps. Taps after a pause
 * of more than 2 s start over. Needs at least two taps.
 */
export function bpmFromTaps(taps: number[]): number | null {
  let start = taps.length - 1;
  while (start > 0 && taps[start] - taps[start - 1] <= 2000) start--;
  const recent = taps.slice(Math.max(start, taps.length - 6));
  if (recent.length < 2) return null;
  const avg = (recent[recent.length - 1] - recent[0]) / (recent.length - 1);
  return clampBpm(60000 / avg);
}

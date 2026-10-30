// Notes and chord symbols, in English (C D E) or Latin (Do Re Mi) notation.

export type Notation = 'english' | 'latin';

/** How to spell black keys. `mixed` = C C# D Eb E F F# G Ab A Bb B. */
export type AccidentalStyle = 'sharps' | 'flats' | 'mixed';

export interface Note {
  /** 0..6 for C D E F G A B. */
  letter: number;
  /** -1 flat, 0 natural, 1 sharp. */
  accidental: -1 | 0 | 1;
}

export interface Chord {
  root: Note;
  /** Everything between root and bass: m7, sus4, maj7(#11)... */
  suffix: string;
  bass?: Note;
  notation: Notation;
}

const NATURAL_PITCH = [0, 2, 4, 5, 7, 9, 11];
const ENGLISH = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LATIN = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'];

type Spelling = [letter: number, accidental: -1 | 0 | 1];
// prettier-ignore
const SHARP_SPELLING: Spelling[] = [[0,0],[0,1],[1,0],[1,1],[2,0],[3,0],[3,1],[4,0],[4,1],[5,0],[5,1],[6,0]];
// prettier-ignore
const FLAT_SPELLING: Spelling[] = [[0,0],[1,-1],[1,0],[2,-1],[2,0],[3,0],[4,-1],[4,0],[5,-1],[5,0],[6,-1],[6,0]];
// prettier-ignore
const MIXED_SPELLING: Spelling[] = [[0,0],[0,1],[1,0],[2,-1],[2,0],[3,0],[3,1],[4,0],[5,-1],[5,0],[6,-1],[6,0]];

/** Always 0..11, also for negative input. */
export const mod12 = (n: number) => ((n % 12) + 12) % 12;

/** 0 = C .. 11 = B. */
export function pitchClass(n: Note): number {
  return mod12(NATURAL_PITCH[n.letter] + n.accidental);
}

export function noteFromPitchClass(pc: number, style: AccidentalStyle): Note {
  const table = style === 'sharps' ? SHARP_SPELLING : style === 'flats' ? FLAT_SPELLING : MIXED_SPELLING;
  const [letter, accidental] = table[mod12(pc)];
  return { letter, accidental };
}

export function noteName(n: Note, notation: Notation = 'english'): string {
  const base = notation === 'english' ? ENGLISH[n.letter] : LATIN[n.letter];
  return base + (n.accidental === 1 ? '#' : n.accidental === -1 ? 'b' : '');
}

/** Reads a note at the start of `s`: note, characters used, notation. */
export function matchNote(s: string): [Note, number, Notation] | null {
  if (!s) return null;
  let letter = LATIN.findIndex((name) => s.startsWith(name));
  let len: number;
  let notation: Notation;
  // Latin first: "Do" must not be read as D + "o".
  if (letter !== -1) {
    len = LATIN[letter].length;
    notation = 'latin';
  } else {
    letter = ENGLISH.indexOf(s[0]);
    if (letter === -1) return null;
    len = 1;
    notation = 'english';
  }
  let accidental: -1 | 0 | 1 = 0;
  const c = s[len];
  if (c === '#' || c === '♯') {
    accidental = 1;
    len++;
  } else if (c === 'b' || c === '♭') {
    accidental = -1;
    len++;
  }
  return [{ letter, accidental }, len, notation];
}

// Tokens accepted after the root. Anything else ("Chorus", "N.C.") means the
// text is not a chord and must not be transposed.
const SUFFIX = /^(?:maj|min|dim|aug|sus|add|alt|omit|no|mi|ma|m|M|o|[0-9#b♯♭+\-°øΔ^()/,.])*$/;

export function parseChord(input: string): Chord | null {
  const s = input.trim();
  const root = matchNote(s);
  if (!root) return null;
  const [rootNote, rootLen, notation] = root;

  let rest = s.slice(rootLen);
  let bass: Note | undefined;
  const slash = rest.lastIndexOf('/');
  if (slash !== -1) {
    const bassText = rest.slice(slash + 1);
    const b = matchNote(bassText);
    if (b && b[1] === bassText.length) {
      bass = b[0];
      rest = rest.slice(0, slash);
    }
  }
  if (!SUFFIX.test(rest)) return null;
  // "[Solo]" is a label, not G diminished. Latin charts write dim as ° or dim.
  if (notation === 'latin' && rest.startsWith('o')) return null;
  return bass ? { root: rootNote, suffix: rest, bass, notation } : { root: rootNote, suffix: rest, notation };
}

/** True for m, m7, min, -7... but not maj7. */
export function isMinor(c: Chord): boolean {
  if (c.suffix.startsWith('ma')) return false;
  return c.suffix.startsWith('m') || c.suffix.startsWith('-');
}

export function chordToString(c: Chord): string {
  return noteName(c.root, c.notation) + c.suffix + (c.bass ? '/' + noteName(c.bass, c.notation) : '');
}

export function shiftChord(c: Chord, semitones: number, style: AccidentalStyle): Chord {
  const move = (n: Note) => noteFromPitchClass(pitchClass(n) + semitones, style);
  return c.bass
    ? { ...c, root: move(c.root), bass: move(c.bass) }
    : { ...c, root: move(c.root) };
}

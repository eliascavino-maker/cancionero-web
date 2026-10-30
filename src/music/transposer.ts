import { type Song, chordsOf, isAnnotation } from '../chordpro/song';
import {
  type AccidentalStyle,
  type Chord,
  type Note,
  chordToString,
  isMinor,
  mod12,
  noteFromPitchClass,
  parseChord,
  pitchClass,
  shiftChord,
} from './chord';

/** What the user wants for black keys. `auto` picks from the target key. */
export type SpellingPreference = 'auto' | 'sharps' | 'flats';

type Spelling = [letter: number, accidental: -1 | 0 | 1];
// Conventional key names per pitch class (fewest accidentals).
// prettier-ignore
const MAJOR_KEYS: Spelling[] = [[0,0],[1,-1],[1,0],[2,-1],[2,0],[3,0],[3,1],[4,0],[5,-1],[5,0],[6,-1],[6,0]]; // C Db D Eb E F F# G Ab A Bb B
// prettier-ignore
const MINOR_KEYS: Spelling[] = [[0,0],[0,1],[1,0],[2,-1],[2,0],[3,0],[3,1],[4,0],[4,1],[5,0],[6,-1],[6,0]]; // Cm C#m Dm Ebm Em Fm F#m Gm G#m Am Bbm Bm

/** Keeps a shift in -5..6 so the UI shows the shortest move. */
export function normalize(semitones: number): number {
  const n = mod12(semitones);
  return n > 6 ? n - 12 : n;
}

function shiftKeyChord(key: Chord, semitones: number): Chord {
  const pc = mod12(pitchClass(key.root) + semitones);
  const minor = isMinor(key);
  const [letter, accidental] = (minor ? MINOR_KEYS : MAJOR_KEYS)[pc];
  let root: Note = { letter, accidental };
  // F#/Gb major and D#m/Ebm are equally common: keep the original style.
  const tie = minor ? pc === 3 : pc === 6;
  if (tie && key.root.accidental !== 0) {
    root = noteFromPitchClass(pc, key.root.accidental === 1 ? 'sharps' : 'flats');
  }
  return { root, suffix: key.suffix, notation: key.notation };
}

/**
 * Transposes a key such as `G`, `Am`, `Sib` and spells the result the
 * conventional way (Bb, not A#). Unreadable keys come back unchanged.
 */
export function transposeKey(key: string, semitones: number): string {
  const chord = parseChord(key);
  return chord ? chordToString(shiftKeyChord(chord, semitones)) : key;
}

/** Spelling for chords in `key`. */
export function styleForKey(key: string | undefined): AccidentalStyle {
  const chord = key ? parseChord(key) : null;
  if (!chord) return 'mixed';
  if (chord.root.accidental === -1) return 'flats';
  if (chord.root.accidental === 1) return 'sharps';
  // Natural roots: F major and Dm, Gm, Cm, Fm use flats; C and Am neither.
  const pc = pitchClass(chord.root);
  if (isMinor(chord)) {
    if ([2, 7, 0, 5].includes(pc)) return 'flats';
    return pc === 9 ? 'mixed' : 'sharps';
  }
  if (pc === 5) return 'flats';
  return pc === 0 ? 'mixed' : 'sharps';
}

function resolveStyle(pref: SpellingPreference, targetKey: string | undefined): AccidentalStyle {
  return pref === 'auto' ? styleForKey(targetKey) : pref;
}

export interface TransposeOptions {
  spelling?: SpellingPreference;
  /** Key after transposing; decides sharps vs flats when spelling is auto. */
  targetKey?: string;
}

/** Transposes one chord symbol. Text that is not a chord comes back unchanged. */
export function transposeChord(chord: string, semitones: number, opts: TransposeOptions = {}): string {
  const spelling = opts.spelling ?? 'auto';
  const parsed = parseChord(chord);
  if (!parsed) return chord;
  if (mod12(semitones) === 0 && spelling === 'auto') return chord;
  return chordToString(shiftChord(parsed, semitones, resolveStyle(spelling, opts.targetKey)));
}

/** Semitones from one key to another, in -5..6. Null if a key is unreadable. */
export function semitonesBetween(fromKey: string, toKey: string): number | null {
  const a = parseChord(fromKey);
  const b = parseChord(toKey);
  if (!a || !b) return null;
  return normalize(pitchClass(b.root) - pitchClass(a.root));
}

/** The song's key, or its first chord when there is no `{key}`. */
export function effectiveKey(song: Song): string | undefined {
  const key = song.metadata.key;
  if (key && parseChord(key)) return key;
  return chordsOf(song).find((c) => parseChord(c) !== null);
}

/** New song with every chord moved by `semitones` and `{key}` updated. */
export function transposeSong(song: Song, semitones: number, spelling: SpellingPreference = 'auto'): Song {
  if (mod12(semitones) === 0 && spelling === 'auto') return song;
  const oldKey = effectiveKey(song);
  const newKey = oldKey === undefined ? undefined : transposeKey(oldKey, semitones);
  const style = resolveStyle(spelling, newKey);

  const move = (c: string) => {
    const parsed = parseChord(c);
    return parsed ? chordToString(shiftChord(parsed, semitones, style)) : c;
  };

  return {
    metadata:
      song.metadata.key === undefined
        ? song.metadata
        : { ...song.metadata, key: transposeKey(song.metadata.key, semitones) },
    sections: song.sections.map((section) => ({
      ...section,
      lines: section.lines.map((line) =>
        line.type !== 'lyric'
          ? line
          : {
              ...line,
              segments: line.segments.map((s) =>
                s.chord === undefined || isAnnotation(s) ? s : { ...s, chord: move(s.chord) },
              ),
            },
      ),
    })),
  };
}

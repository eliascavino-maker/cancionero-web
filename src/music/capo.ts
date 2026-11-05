import { type Song, chordsOf } from '../chordpro/song';
import { isMinor, mod12, parseChord, pitchClass } from './chord';
import { transposeSong } from './transposer';

/** Highest fret offered for a capo. */
export const MAX_CAPO = 11;
/** "Sugerir" only looks this high: past it the guitar sounds thin. */
const SUGGEST_UP_TO = 7;

/** A fret 1..11, or 0 for none. */
export function cleanCapo(n: unknown): number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= MAX_CAPO ? n : 0;
}

/**
 * What a player with a capo on `fret` plays: every chord `fret` semitones
 * lower, `{key}` included. The band still sounds in the song's key.
 */
export function withCapo(song: Song, fret: number): Song {
  return fret ? transposeSong(song, -fret) : song;
}

// Open shapes, by pitch class: C D E G A for major chords, D E A for minor ones.
const OPEN_MAJOR = new Set([0, 2, 4, 7, 9]);
const OPEN_MINOR = new Set([2, 4, 9]);
const F = 5;
const B = 11;

/** How hard a chord is to play on guitar: 0 open, 1 easy barre, 2 barre. */
function difficulty(symbol: string): number {
  const c = parseChord(symbol);
  if (!c) return 0;
  const pc = pitchClass(c.root);
  if (/dim|aug|°|ø|\+/.test(c.suffix)) return 1;
  if (isMinor(c)) return OPEN_MINOR.has(pc) ? 0 : pc === B ? 1 : 2;
  // B7 is an open chord; F is the first barre everyone learns.
  if (pc === B && c.suffix === '7') return 0;
  return OPEN_MAJOR.has(pc) ? 0 : pc === F ? 1 : 2;
}

/** Total difficulty of the song's chords with a capo on `fret` (each time a chord is played). */
export function capoScore(song: Song, fret: number): number {
  return chordsOf(song).reduce((sum, chord) => {
    const c = parseChord(chord);
    return c ? sum + difficulty(SHARP_NAMES[mod12(pitchClass(c.root) - fret)] + c.suffix) : sum;
  }, 0);
}

/** Only for scoring: the spelling doesn't matter. */
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** The capo (0..7) that leaves the easiest shapes; the lowest one when several tie. */
export function suggestCapo(song: Song): number {
  let best = 0;
  let bestScore = capoScore(song, 0);
  for (let fret = 1; fret <= SUGGEST_UP_TO; fret++) {
    const score = capoScore(song, fret);
    if (score < bestScore) {
      best = fret;
      bestScore = score;
    }
  }
  return best;
}

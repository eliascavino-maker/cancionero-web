import { type ChordSegment, displayChord, isAnnotation } from '../chordpro/song';

/** A chord (maybe none) and the text under it. */
export interface ChordAtom {
  chord?: string;
  /** The chord is a note like `[*Silencio largo]`, not a chord. */
  annotation?: true;
  text: string;
  /** Lyric characters before this atom in the line. */
  col: number;
}

/**
 * Groups segments into words. Each word is a list of atoms (chord + text);
 * a line break may only happen between words, so a chord never gets
 * separated from its syllable.
 *
 * Trailing spaces are removed: the gap between words draws the space.
 */
export function splitIntoWords(segments: ChordSegment[]): ChordAtom[][] {
  const words: ChordAtom[][] = [];
  let current: ChordAtom[] = [];
  let col = 0;
  const endWord = () => {
    if (current.length) words.push(current);
    current = [];
  };

  for (const seg of segments) {
    const chord = displayChord(seg);
    const parts = seg.lyric.match(/\S*\s*/g)?.filter((p) => p !== '') ?? [];
    if (!parts.length) parts.push('');

    parts.forEach((part, i) => {
      const text = part.trimEnd();
      const atom: ChordAtom = { text, col };
      if (i === 0 && chord !== undefined) {
        atom.chord = chord;
        if (isAnnotation(seg)) atom.annotation = true;
      }
      current.push(atom);
      col += part.length;
      if (text !== part) endWord();
    });
  }
  endWord();
  return words;
}

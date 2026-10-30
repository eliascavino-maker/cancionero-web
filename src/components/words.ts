import { type ChordSegment, displayChord } from '../chordpro/song';

/** A chord (maybe none) and the text under it. */
export interface ChordAtom {
  chord?: string;
  text: string;
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
      const atomChord = i === 0 ? chord : undefined;
      current.push(atomChord === undefined ? { text } : { chord: atomChord, text });
      if (text !== part) endWord();
    });
  }
  endWord();
  return words;
}

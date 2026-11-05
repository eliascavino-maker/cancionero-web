import { parseChordPro } from '../chordpro/parser';
import { chordsOf } from '../chordpro/song';
import { cleanCapo, suggestCapo, withCapo } from './capo';
import { effectiveKey, transposeSong } from './transposer';

const song = (body: string, key?: string) => parseChordPro(`{title: X}\n${key ? `{key: ${key}}\n` : ''}${body}`);

describe('withCapo', () => {
  it('shows the shapes: every chord and the key go down by the fret', () => {
    const shapes = withCapo(song('[A]Hola [D]mundo [E7]ya [F#m]no', 'A'), 2);
    expect(chordsOf(shapes)).toEqual(['G', 'C', 'D7', 'Em']);
    expect(shapes.metadata.key).toBe('G');
  });

  it('on top of the setlist key: Bb with capo 3 is played as G', () => {
    const inBb = transposeSong(song('[A]la [D]la', 'A'), 1);
    expect(effectiveKey(withCapo(inBb, 3))).toBe('G');
    expect(chordsOf(withCapo(inBb, 3))).toEqual(['G', 'C']);
  });

  it('Latin notation stays Latin', () => {
    expect(chordsOf(withCapo(song('[La]la [Re]la', 'La'), 2))).toEqual(['Sol', 'Do']);
  });

  it('no capo leaves the song as it is', () => {
    const s = song('[A]la');
    expect(withCapo(s, 0)).toBe(s);
  });
});

describe('suggestCapo', () => {
  it('finds the fret with open shapes', () => {
    // A B C#m F#m D E: with capo 2, G A Bm Em C D. Capo 4 gives F G Am Dm Bb C.
    expect(suggestCapo(song('[A]a [B]b [C#m]c [F#m]d [D]e [E]f'))).toBe(2);
    // Eb Ab Bb Cm: capo 3 gives C F G Am; capo 1 gives D G A Bm.
    expect(suggestCapo(song('[Eb]a [Ab]b [Bb]c [Cm]d'))).toBe(1);
    // Bb Eb F Gm: capo 3 gives G C D Em, all open.
    expect(suggestCapo(song('[Bb]a [Eb]b [F]c [Gm]d [Bb]e'))).toBe(3);
  });

  it('none when the shapes are already easy (or there are no chords)', () => {
    expect(suggestCapo(song('[G]a [C]b [D]c [Em]d'))).toBe(0);
    expect(suggestCapo(song('solo letra'))).toBe(0);
  });
});

it('cleanCapo keeps frets 1..11 only', () => {
  expect([3, 11, 0, 12, -1, 2.5, '3', null].map(cleanCapo)).toEqual([3, 11, 0, 0, 0, 0, 0, 0]);
});

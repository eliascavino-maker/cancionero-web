import { parseChordPro } from '../chordpro/parser';
import { type LyricLine, chordsOf, lyricsOf } from '../chordpro/song';
import { chordToString, isMinor, parseChord, pitchClass } from './chord';
import {
  type SpellingPreference,
  normalize,
  semitonesBetween,
  transposeChord,
  transposeKey,
  transposeSong,
} from './transposer';

describe('parseChord', () => {
  it('root, suffix and bass', () => {
    const c = parseChord('F#m7b5/C')!;
    expect(c.root).toEqual({ letter: 3, accidental: 1 });
    expect(c.suffix).toBe('m7b5');
    expect(c.bass).toEqual({ letter: 0, accidental: 0 });
    expect(chordToString(c)).toBe('F#m7b5/C');
  });

  it('6/9 is a suffix, not a bass note', () => {
    const c = parseChord('C6/9')!;
    expect(c.suffix).toBe('6/9');
    expect(c.bass).toBeUndefined();
  });

  it('Latin notation', () => {
    const c = parseChord('Fa#m/La')!;
    expect(c.notation).toBe('latin');
    expect(pitchClass(c.root)).toBe(6);
    expect(c.suffix).toBe('m');
    expect(pitchClass(c.bass!)).toBe(9);
    expect(pitchClass(parseChord('Sol7')!.root)).toBe(7);
    expect(pitchClass(parseChord('Sib')!.root)).toBe(10);
  });

  it('unicode accidentals', () => {
    expect(pitchClass(parseChord('B♭maj7')!.root)).toBe(10);
    expect(pitchClass(parseChord('C♯')!.root)).toBe(1);
  });

  it.each(['N.C.', 'Intro', 'Chorus', 'Bridge', 'Solo', 'x2', '', 'Fin', 'C riff'])(
    '"%s" is not a chord',
    (text) => expect(parseChord(text)).toBeNull(),
  );

  it('minor detection', () => {
    expect(isMinor(parseChord('Am')!)).toBe(true);
    expect(isMinor(parseChord('Am7')!)).toBe(true);
    expect(isMinor(parseChord('A-7')!)).toBe(true);
    expect(isMinor(parseChord('Amaj7')!)).toBe(false);
    expect(isMinor(parseChord('AM7')!)).toBe(false);
    expect(isMinor(parseChord('A')!)).toBe(false);
  });
});

describe('transposeChord', () => {
  const t = (c: string, n: number, targetKey?: string, spelling?: SpellingPreference) =>
    transposeChord(c, n, { targetKey, spelling });

  it('moves up and down', () => {
    expect(t('C', 2)).toBe('D');
    expect(t('G', 5)).toBe('C');
    expect(t('A', -2)).toBe('G');
    expect(t('B', 1)).toBe('C');
    expect(t('C', -1)).toBe('B');
  });

  it('wraps around the octave', () => {
    expect(t('G', 12)).toBe('G');
    expect(t('G', 14)).toBe('A');
    expect(t('G', -14)).toBe('F');
  });

  it('keeps suffix', () => {
    expect(t('Am7', 3)).toBe('Cm7');
    expect(t('Dsus4', 2)).toBe('Esus4');
    expect(t('Cmaj7(#11)', 7)).toBe('Gmaj7(#11)');
  });

  it('transposes the bass note', () => {
    expect(t('D/F#', 2, 'E')).toBe('E/G#');
    expect(t('C/E', -2, 'Bb')).toBe('Bb/D');
  });

  it('flat keys spell with flats', () => {
    expect(t('C', 3, 'Eb')).toBe('Eb');
    expect(t('A', 1, 'F')).toBe('Bb');
    expect(t('G', 1, 'Dm')).toBe('Ab');
  });

  it('sharp keys spell with sharps', () => {
    expect(t('C', 1, 'E')).toBe('C#');
    expect(t('G', 1, 'A')).toBe('G#');
    expect(t('A', 1, 'Bm')).toBe('A#');
  });

  it('no key: mixed spelling', () => {
    expect(t('A', 1)).toBe('Bb');
    expect(t('C', 1)).toBe('C#');
    expect(t('C', 3)).toBe('Eb');
    expect(t('F', 1)).toBe('F#');
    expect(t('G', 1)).toBe('Ab');
  });

  it('forced spelling', () => {
    expect(t('A', 1, undefined, 'sharps')).toBe('A#');
    expect(t('C', 1, undefined, 'flats')).toBe('Db');
  });

  it('zero shift leaves text untouched', () => {
    expect(t('A#', 0)).toBe('A#');
    expect(t('Bb7', 12)).toBe('Bb7');
  });

  it('non-chords are untouched', () => {
    expect(t('N.C.', 2)).toBe('N.C.');
    expect(t('Intro', 2)).toBe('Intro');
  });

  it('Latin stays Latin', () => {
    expect(t('Do', 2)).toBe('Re');
    expect(t('Lam', 3)).toBe('Dom');
    expect(t('Sol/Si', 2, 'La')).toBe('La/Do#');
    expect(t('Mi7', 1, 'Fa')).toBe('Fa7');
  });

  it('every shift comes back to the start', () => {
    for (const chord of ['C', 'Ebm7', 'F#sus4', 'Ab/C', 'Sol7']) {
      for (let n = -12; n <= 12; n++) {
        const back = t(t(chord, n, undefined, 'sharps'), -n, undefined, 'sharps');
        expect(pitchClass(parseChord(back)!.root), `${chord} ${n}`).toBe(pitchClass(parseChord(chord)!.root));
      }
    }
  });
});

describe('keys', () => {
  it('conventional key names', () => {
    expect(transposeKey('C', 1)).toBe('Db');
    expect(transposeKey('C', 3)).toBe('Eb');
    expect(transposeKey('G', 3)).toBe('Bb');
    expect(transposeKey('E', 2)).toBe('F#');
    expect(transposeKey('Am', 1)).toBe('Bbm');
    expect(transposeKey('Am', -1)).toBe('G#m');
    expect(transposeKey('Em', -3)).toBe('C#m');
  });

  it('F#/Gb tie keeps the original style', () => {
    expect(transposeKey('Db', 5)).toBe('Gb');
    expect(transposeKey('C#', 5)).toBe('F#');
    expect(transposeKey('F', 1)).toBe('F#');
  });

  it('Latin keys', () => {
    expect(transposeKey('Sol', 2)).toBe('La');
    expect(transposeKey('Rem', 1)).toBe('Mibm');
  });

  it('unreadable key returns as-is', () => {
    expect(transposeKey('???', 2)).toBe('???');
  });

  it('semitonesBetween takes the short way', () => {
    expect(semitonesBetween('G', 'A')).toBe(2);
    expect(semitonesBetween('G', 'F')).toBe(-2);
    expect(semitonesBetween('C', 'F#')).toBe(6);
    expect(semitonesBetween('Am', 'Em')).toBe(-5);
    expect(semitonesBetween('x', 'A')).toBeNull();
  });

  it('normalize', () => {
    expect(normalize(7)).toBe(-5);
    expect(normalize(-7)).toBe(5);
    expect(normalize(6)).toBe(6);
    expect(normalize(12)).toBe(0);
  });
});

describe('transposeSong', () => {
  it('moves chords, updates key, spells by the new key', () => {
    const song = parseChordPro(`{title: X}
{key: G}
[G]Uno [D/F#]dos [Em]tres [*Rit.]fin
{c: [no es acorde]}
`);
    const up = transposeSong(song, 3); // G -> Bb
    expect(up.metadata.key).toBe('Bb');
    const line = up.sections[0].lines[0] as LyricLine;
    expect(line.segments.map((s) => s.chord)).toEqual(['Bb', 'F/A', 'Gm', '*Rit.']);
    expect(lyricsOf(line)).toBe('Uno dos tres fin');
    expect(up.sections[0].lines[1]).toEqual({ type: 'comment', text: '[no es acorde]', style: 'normal' });
  });

  it('without {key} the first chord decides spelling', () => {
    const down = transposeSong(parseChordPro('[E]a [B]b'), -1); // E -> Eb
    expect(chordsOf(down)).toEqual(['Eb', 'Bb']);
    expect(down.metadata.key).toBeUndefined();
  });

  it('zero shift returns the same song', () => {
    const song = parseChordPro('[C]a');
    expect(transposeSong(song, 0)).toBe(song);
  });

  it('does not mutate the original', () => {
    const song = parseChordPro('{key: C}\n[C]a');
    transposeSong(song, 2);
    expect(chordsOf(song)).toEqual(['C']);
    expect(song.metadata.key).toBe('C');
  });
});

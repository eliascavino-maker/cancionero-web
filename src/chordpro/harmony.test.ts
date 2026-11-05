import { insertCueLine, toggleHarmony } from './harmony';
import { moveChord } from './moveChord';
import { setLineVoices } from './parts';
import { parseChordPro, parseLyricLine } from './parser';
import { hasHarmony, isHarmonyLine } from './song';
import { writeChordPro } from './writer';

describe('second voice', () => {
  it('((…)) marks words, chords inside or around keep their place', () => {
    expect(parseLyricLine('[G]Te ((quie[D]ro)) mucho').segments).toEqual([
      { chord: 'G', lyric: 'Te ' },
      { lyric: 'quie', harmony: true },
      { chord: 'D', lyric: 'ro', harmony: true },
      { lyric: ' mucho' },
    ]);
    // A chord right before the mark goes inside with its syllable.
    expect(parseLyricLine('[G]((Oh)) no').segments).toEqual([
      { chord: 'G', lyric: 'Oh', harmony: true },
      { lyric: ' no' },
    ]);
  });

  it('{x_voz2} marks whole lines, unless they have ((…)) marks', () => {
    const song = parseChordPro('{sov}\n{x_voz2: Leo}\nHola\nChau ((amor))\n{x_voz2}\nNada\n{eov}');
    const [a, b, c] = song.sections[0].lines;
    expect(a).toMatchObject({ harmony: ['Leo'], segments: [{ lyric: 'Hola', harmony: true }] });
    expect(b.type === 'lyric' && isHarmonyLine(b)).toBe(false);
    expect(b).toMatchObject({ harmony: ['Leo'], segments: [{ lyric: 'Chau ' }, { lyric: 'amor', harmony: true }] });
    expect(c.type === 'lyric' && (c.harmony || hasHarmony(c))).toBe(false);
  });

  it('is written back the same way', () => {
    const text = '{start_of_verse}\n{x_voz2: Leo}\nHola\nChau ((amor))\n{x_voz2}\n[G]Te ((quie[D]ro))\n{end_of_verse}\n';
    expect(writeChordPro(parseChordPro(text))).toBe(text);
  });

  it('marks are not lyrics when moving chords', () => {
    expect(moveChord('((Ho[G]la))', { line: 0, index: 0 }, 'right')?.content).toBe('((Hol[G]a))');
    expect(moveChord('[G]((Hola))', { line: 0, index: 0 }, 'right')?.content).toBe('((H[G]ola))');
  });

  it('setLineVoices sets {x_voz2} without touching {x_voz}', () => {
    const text = '{sov}\n{x_voz: Leo}\nUno\nDos\n{eov}';
    const section = parseChordPro(text).sections[0];
    const out = setLineVoices(text, section, 1, 1, ['Angel'], 'harmony');
    expect(out).toBe('{sov}\n{x_voz: Leo}\nUno\n{x_voz2: Angel}\nDos\n{eov}');
    const back = setLineVoices(out, parseChordPro(out).sections[0], 1, 1, undefined, 'harmony');
    expect(back).toBe(text);
  });
});

describe('toggleHarmony (editor)', () => {
  it('wraps the selected words, without the spaces at the ends', () => {
    const text = 'Te quiero mucho';
    expect(toggleHarmony(text, 2, 10)).toEqual({ text: 'Te ((quiero)) mucho', start: 0, end: 19 });
  });

  it('each line of a selection gets its own marks; directives are skipped', () => {
    const text = 'Uno dos\r\n{c: x}\r\nTres';
    expect(toggleHarmony(text, 4, text.length)?.text).toBe('Uno ((dos))\r\n{c: x}\r\n((Tres))');
  });

  it('a marked selection is unmarked', () => {
    expect(toggleHarmony('Te ((quiero))', 5, 11)).toEqual({ text: 'Te quiero', start: 3, end: 9 });
    expect(toggleHarmony('Te ((quiero))', 3, 13)).toEqual({ text: 'Te quiero', start: 3, end: 9 });
  });

  it('nothing selected: null', () => {
    expect(toggleHarmony('Hola', 2, 2)).toBeNull();
    expect(toggleHarmony('{title: X}', 0, 10)).toBeNull();
  });

  it('insertCueLine adds {x_cue: } above, cursor inside', () => {
    expect(insertCueLine('Uno\nDos', 5)).toEqual({ text: 'Uno\n{x_cue: }\nDos', start: 12, end: 12 });
  });
});

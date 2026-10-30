import { blockName, detectBlocks, isChordLine, mergeChords, readLabel, textToChordPro } from './fromText';
import { parseChordPro } from './parser';

const names = (text: string) => detectBlocks(text).map((b) => (b.chorusRepeat ? 'Estribillo (repite)' : blockName(b)));

describe('chord lines', () => {
  it.each(['G  D  Em  C', 'Am7   G/B  C', '| G | D x2', 'Sol  Re  Mim'])('%s is chords', (l) => expect(isChordLine(l)).toBe(true));
  it.each(['A mi me gusta', 'Hola mundo', 'La la la', ''])('%s is lyrics', (l) => expect(isChordLine(l)).toBe(false));

  it('merges chords into the lyric by column', () => {
    expect(mergeChords('G       D', 'Hola mundo')).toBe('[G]Hola mun[D]do');
    expect(mergeChords('C          G', 'Corto')).toBe('[C]Corto      [G]');
  });
});

describe('labels', () => {
  it.each([
    ['Coro:', 'chorus'],
    ['[Estribillo]', 'chorus'],
    ['CORO X2', 'chorus'],
    ['Pre-coro', 'prechorus'],
    ['Precoro:', 'prechorus'],
    ['Verso 2', 'verse'],
    ['(Puente)', 'bridge'],
    ['Intro: G D', 'intro'],
  ])('%s', (line, kind) => expect(readLabel(line)?.kind).toBe(kind));

  it('lyrics are not labels', () => {
    expect(readLabel('Coro de ángeles cantando')).toBeNull();
    expect(readLabel('Final del camino')).toBeNull();
  });
});

describe('detectBlocks', () => {
  const V1 = 'Camino solo por la calle\nbuscando lo que perdí';
  const V2 = 'La noche cae sobre el puerto\ny nadie sabe de mí';
  const V3 = 'Ya no queda nada\nsolo el ruido del mar';
  const PRE = 'Y ahora sé\nque no hay vuelta atrás';
  const CH = 'Vuelve, vuelve a casa\nque te espero aquí\nvuelve, vuelve a casa\nno te olvides de mí';
  const BR = 'Si el tiempo pudiera\ngirar al revés';

  it('chorus is the repeated block, verses get numbers', () => {
    expect(names([V1, CH, V2, CH, CH].join('\n\n'))).toEqual([
      'Estrofa 1',
      'Estribillo',
      'Estrofa 2',
      'Estribillo (repite)',
      'Estribillo (repite)',
    ]);
  });

  it('finds the pre-chorus and the bridge', () => {
    expect(names([V1, PRE, CH, V2, PRE, CH, BR, CH].join('\n\n'))).toEqual([
      'Estrofa 1',
      'Pre-coro',
      'Estribillo',
      'Estrofa 2',
      'Pre-coro',
      'Estribillo (repite)',
      'Puente',
      'Estribillo (repite)',
    ]);
  });

  it('no repeats: all verses', () => {
    expect(names([V1, V2, V3].join('\n\n'))).toEqual(['Estrofa 1', 'Estrofa 2', 'Estrofa 3']);
  });

  it('a chorus with a small change still counts', () => {
    const CH2 = CH.replace('aquí', 'aquí, amor');
    expect(names([V1, CH, V2, CH2].join('\n\n'))[3]).toBe('Estribillo');
  });

  it('labels in the text win, and "Coro" alone repeats it', () => {
    const text = `Verso 1:\n${V1}\n\nCoro:\n${V2}\n\n${V3}\n\nCoro x2`;
    expect(names(text)).toEqual(['Estrofa 1', 'Estribillo', 'Estrofa 2', 'Estribillo (repite)']);
    expect(detectBlocks(text)[3].times).toBe(2);
  });

  it('a label on its own line names the block below', () => {
    expect(names(`Estribillo\n\n${V1}\n\n${V2}`)).toEqual(['Estribillo', 'Estrofa 1']);
  });

  it('chord-only blocks are intro, instrumental and final', () => {
    expect(names(['G  D  Em  C', V1, 'Am  F', V2, 'G  D  G'].join('\n\n'))).toEqual([
      'Intro',
      'Estrofa 1',
      'Instrumental',
      'Estrofa 2',
      'Final',
    ]);
  });

  it('a later chorus with different chords is written in full', () => {
    const a = 'G         D\nVuelve, vuelve a casa\nC          G\nque te espero aquí';
    const b = 'A         E\nVuelve, vuelve a casa\nD          A\nque te espero aquí';
    const blocks = detectBlocks([V1, a, V2, b].join('\n\n'));
    expect(blocks[3].kind).toBe('chorus');
    expect(blocks[3].chorusRepeat).toBeFalsy();
  });
});

describe('textToChordPro', () => {
  it('builds a ChordPro song with chords and sections', () => {
    const text = `G           D
Camino solo por la calle
Em          C
buscando lo que perdí

C       G
Vuelve, vuelve a casa
D             G
que te espero aquí

Am           D
La noche cae sobre el puerto
y nadie sabe de mí

C       G
Vuelve, vuelve a casa
D             G
que te espero aquí`;
    const cho = textToChordPro({ title: 'Vuelve', artist: 'Yo', tempo: '96', text });
    expect(cho).toBe(`{title: Vuelve}
{artist: Yo}
{tempo: 96}

{start_of_verse: Estrofa 1}
[G]Camino solo [D]por la calle
[Em]buscando lo [C]que perdí
{end_of_verse}

{start_of_chorus}
[C]Vuelve, [G]vuelve a casa
[D]que te espero [G]aquí
{end_of_chorus}

{start_of_verse: Estrofa 2}
[Am]La noche cae [D]sobre el puerto
y nadie sabe de mí
{end_of_verse}

{chorus}
`);
    const song = parseChordPro(cho);
    expect(song.sections.map((s) => s.kind)).toEqual(['verse', 'chorus', 'verse', 'none']);
  });

  it('ChordPro text is kept as it is', () => {
    const cho = '{title: X}\n[C]la';
    expect(textToChordPro({ title: 'Otro', text: cho })).toBe(cho);
  });
});

import { parseChordPro, parseLyricLine } from './parser';
import { type LyricLine, chordsOf, displayChord, hasChords, isAnnotation, lyricsOf } from './song';
import { writeChordPro } from './writer';

describe('parseLyricLine', () => {
  it('splits chords and lyrics', () => {
    const line = parseLyricLine('[C]Hello [G]world');
    expect(line.segments).toEqual([
      { chord: 'C', lyric: 'Hello ' },
      { chord: 'G', lyric: 'world' },
    ]);
    expect(lyricsOf(line)).toBe('Hello world');
    expect(hasChords(line)).toBe(true);
  });

  it('keeps lyrics before the first chord', () => {
    expect(parseLyricLine('Ya [Am]no').segments).toEqual([
      { lyric: 'Ya ' },
      { chord: 'Am', lyric: 'no' },
    ]);
  });

  it('chord in the middle of a word', () => {
    expect(parseLyricLine('Can[G]ción').segments).toEqual([
      { lyric: 'Can' },
      { chord: 'G', lyric: 'ción' },
    ]);
  });

  it('consecutive chords and trailing chord', () => {
    expect(parseLyricLine('[C][G]la la[D7]').segments).toEqual([
      { chord: 'C', lyric: '' },
      { chord: 'G', lyric: 'la la' },
      { chord: 'D7', lyric: '' },
    ]);
  });

  it('unclosed bracket stays as lyrics', () => {
    expect(parseLyricLine('[C]hola [mundo').segments).toEqual([{ chord: 'C', lyric: 'hola [mundo' }]);
  });

  it('escaped brackets are literal', () => {
    expect(parseLyricLine('\\[x\\] [C]y').segments).toEqual([
      { lyric: '[x] ' },
      { chord: 'C', lyric: 'y' },
    ]);
  });

  it('line without chords', () => {
    const line = parseLyricLine('solo letra');
    expect(hasChords(line)).toBe(false);
    expect(line.segments).toEqual([{ lyric: 'solo letra' }]);
  });

  it('detects annotations', () => {
    const s = parseLyricLine('[*Rit.]fin').segments[0];
    expect(isAnnotation(s)).toBe(true);
    expect(displayChord(s)).toBe('Rit.');
  });
});

describe('metadata', () => {
  it('reads long and short directives', () => {
    const m = parseChordPro(`{title: De música ligera}
{st: Soda Stereo}
{artist: Gustavo Cerati}
{key: Bm}
{capo: 2}
{tempo: 126}
{time: 4/4}
{meta: album Canción animal}
{meta: year 1990}
`);
    expect(m.metadata).toMatchObject({
      title: 'De música ligera',
      subtitles: ['Soda Stereo'],
      artists: ['Gustavo Cerati'],
      key: 'Bm',
      capo: 2,
      tempo: '126',
      time: '4/4',
      album: 'Canción animal',
      year: '1990',
    });
    expect(m.sections).toEqual([]);
  });

  it('names are case-insensitive, colon optional', () => {
    expect(parseChordPro('{T: Hola}\n{KEY: G}').metadata).toMatchObject({ title: 'Hola', key: 'G' });
    expect(parseChordPro('{title Hola}').metadata.title).toBe('Hola');
  });

  it('skips directives with selectors', () => {
    expect(parseChordPro('{title: A}\n{title-piano: B}').metadata.title).toBe('A');
  });

  it('empty values are not set', () => {
    const m = parseChordPro('{title: }\n{key: }').metadata;
    expect(m.title).toBeUndefined();
    expect(m.key).toBeUndefined();
  });

  it('several artists', () => {
    expect(parseChordPro('{artist: A}\n{artist: B}').metadata.artists).toEqual(['A', 'B']);
  });
});

describe('sections', () => {
  const source = `{title: Test}
# esto es un comentario del archivo

{start_of_verse: Verso 1}
[G]Uno
[C]Dos
{end_of_verse}

{soc}
[D]Estribillo
{eoc}

{start_of_bridge label="Puente"}
[Em]Puente
{end_of_bridge}

{chorus}
`;

  it('builds verse, chorus, bridge and chorus reference', () => {
    const song = parseChordPro(source);
    expect(song.sections.map((s) => s.kind)).toEqual(['verse', 'chorus', 'bridge', 'none']);
    expect(song.sections[0].label).toBe('Verso 1');
    expect(song.sections[0].lines).toHaveLength(2);
    expect(song.sections[1].label).toBeUndefined();
    expect(song.sections[2].label).toBe('Puente');
    expect(song.sections[3].lines).toEqual([{ type: 'chorusRef' }]);
  });

  it('ignores # comments', () => {
    expect(JSON.stringify(parseChordPro(source))).not.toContain('comentario');
  });

  it('lists chords in order', () => {
    expect(chordsOf(parseChordPro(source))).toEqual(['G', 'C', 'D', 'Em']);
  });

  it('lines outside sections go to an implicit section, blank runs collapse', () => {
    const song = parseChordPro('[C]suelta\n\n\n[G]otra');
    expect(song.sections).toHaveLength(1);
    expect(song.sections[0].kind).toBe('none');
    expect(song.sections[0].lines.map((l) => l.type)).toEqual(['lyric', 'empty', 'lyric']);
  });

  it('unclosed section ends when the next one starts', () => {
    const song = parseChordPro('{sov}\n[C]a\n{soc}\n[G]b\n{eoc}');
    expect(song.sections.map((s) => s.kind)).toEqual(['verse', 'chorus']);
  });

  it('custom sections keep their name', () => {
    const s = parseChordPro('{start_of_intro}\n[C] [G]\n{end_of_intro}').sections[0];
    expect(s.kind).toBe('custom');
    expect(s.name).toBe('intro');
  });

  it('tab section keeps lines raw, brackets included', () => {
    const tab = parseChordPro('{sot}\ne|--[3]--|\n  B|-----|\n{eot}').sections[0];
    expect(tab.kind).toBe('tab');
    expect(tab.lines).toEqual([
      { type: 'tab', text: 'e|--[3]--|' },
      { type: 'tab', text: '  B|-----|' },
    ]);
  });

  it('comments with style', () => {
    const lines = parseChordPro('{c: Normal}\n{ci: Itálica}\n{cb: Caja}').sections[0].lines;
    expect(lines).toEqual([
      { type: 'comment', text: 'Normal', style: 'normal' },
      { type: 'comment', text: 'Itálica', style: 'italic' },
      { type: 'comment', text: 'Caja', style: 'boxed' },
    ]);
  });

  it('handles CRLF', () => {
    const song = parseChordPro('{title: X}\r\n[C]a\r\n');
    expect(song.metadata.title).toBe('X');
    expect(lyricsOf(song.sections[0].lines[0] as LyricLine)).toBe('a');
  });
});

describe('writeChordPro', () => {
  it('round-trips through the parser', () => {
    const first = parseChordPro(`{title: Ida y vuelta}
{artist: Alguien}
{key: G}
{capo: 1}

{start_of_verse: Verso 1}
[G]Hola [D/F#]mun[Em]do \\[x\\]
{c: Suave}
{end_of_verse}

{start_of_chorus}
[C]Estri[G]billo
{end_of_chorus}

{chorus}
`);
    const second = parseChordPro(writeChordPro(first));
    expect(second).toEqual(first);
    expect(lyricsOf(second.sections[0].lines[0] as LyricLine)).toBe('Hola mundo [x]');
  });
});

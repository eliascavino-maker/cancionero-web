import { render, screen } from '@testing-library/react';
import { parseChordPro, parseLyricLine } from '../chordpro/parser';
import { SongView } from './SongView';
import { splitIntoWords } from './words';

describe('splitIntoWords', () => {
  const split = (line: string) => splitIntoWords(parseLyricLine(line).segments);

  it('one word per chord', () => {
    expect(split('[C]Hola [G]mundo')).toEqual([[{ chord: 'C', text: 'Hola' }], [{ chord: 'G', text: 'mundo' }]]);
  });

  it('chord inside a word keeps the word together', () => {
    expect(split('Can[G]ción de [D]mar')).toEqual([
      [{ text: 'Can' }, { chord: 'G', text: 'ción' }],
      [{ text: 'de' }],
      [{ chord: 'D', text: 'mar' }],
    ]);
  });

  it('several words under one chord', () => {
    expect(split('[Am]la noche')).toEqual([[{ chord: 'Am', text: 'la' }], [{ text: 'noche' }]]);
  });

  it('chords with no lyrics', () => {
    expect(split('[C] [G] [Am]')).toEqual([
      [{ chord: 'C', text: '' }],
      [{ chord: 'G', text: '' }],
      [{ chord: 'Am', text: '' }],
    ]);
  });

  it('annotation shows without the asterisk', () => {
    expect(split('[*Rit.]fin')).toEqual([[{ chord: 'Rit.', text: 'fin' }]]);
  });
});

describe('SongView', () => {
  const show = (source: string, props = {}) => render(<SongView song={parseChordPro(source)} {...props} />);

  it('puts each chord in the same cell as its syllable', () => {
    show('[C]Hola [G]mun[Em]do');
    const g = screen.getByText('G').closest('.cp-atom')!;
    expect(g).toHaveTextContent('Gmun');
    const em = screen.getByText('Em').closest('.cp-atom')!;
    expect(em).toHaveTextContent('Emdo');
    // "mun" and "do" share a word so they never wrap apart.
    expect(g.parentElement).toBe(em.parentElement);
    expect(g.parentElement).toHaveClass('cp-word');
  });

  it('line without chords is plain text', () => {
    show('[C]uno\nsolo letra');
    expect(screen.getByText('solo letra')).toHaveClass('cp-line');
  });

  it('showChords: false hides chords', () => {
    show('[C]Hola [G]mundo', { showChords: false });
    expect(screen.queryByText('C')).toBeNull();
    expect(screen.getByText('Hola mundo')).toBeInTheDocument();
  });

  it('header, labels and comments', () => {
    show(`{title: Mi canción}
{artist: Yo}
{key: G}
{capo: 3}
{start_of_verse: Verso 1}
[G]a
{end_of_verse}
{soc}
[C]b
{eoc}
{c: Lento}`);
    expect(screen.getByRole('heading', { name: 'Mi canción' })).toBeInTheDocument();
    for (const text of ['Yo', 'Tono: G', 'Capo 3', 'Verso 1', 'Estribillo', 'Lento']) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it('{chorus} repeats the last chorus', () => {
    show('{soc}\n[D]coro\n{eoc}\n{chorus}');
    expect(screen.getAllByText('coro')).toHaveLength(2);
  });

  it('{chorus} shows only a label when expansion is off', () => {
    show('{soc}\n[D]coro\n{eoc}\n{chorus}', { expandChorusReferences: false });
    expect(screen.getAllByText('coro')).toHaveLength(1);
    expect(screen.getAllByText('Estribillo')).toHaveLength(2);
  });

  it('tab section renders monospace', () => {
    show('{sot}\ne|--3--|\n{eot}');
    expect(screen.getByText('e|--3--|').tagName).toBe('PRE');
  });
});

import { render, screen } from '@testing-library/react';
import { parseChordPro, parseLyricLine } from '../chordpro/parser';
import { SongView } from './SongView';
import { splitIntoWords } from './words';

describe('splitIntoWords', () => {
  const split = (line: string) => splitIntoWords(parseLyricLine(line).segments);

  it('one word per chord', () => {
    expect(split('[C]Hola [G]mundo')).toMatchObject([[{ chord: 'C', text: 'Hola' }], [{ chord: 'G', text: 'mundo' }]]);
  });

  it('chord inside a word keeps the word together', () => {
    expect(split('Can[G]ción de [D]mar')).toMatchObject([
      [{ text: 'Can' }, { chord: 'G', text: 'ción' }],
      [{ text: 'de' }],
      [{ chord: 'D', text: 'mar' }],
    ]);
  });

  it('several words under one chord', () => {
    expect(split('[Am]la noche')).toMatchObject([[{ chord: 'Am', text: 'la' }], [{ text: 'noche' }]]);
  });

  it('chords with no lyrics', () => {
    expect(split('[C] [G] [Am]')).toMatchObject([
      [{ chord: 'C', text: '' }],
      [{ chord: 'G', text: '' }],
      [{ chord: 'Am', text: '' }],
    ]);
  });

  it('annotation shows without the asterisk', () => {
    expect(split('[*Rit.]fin')).toMatchObject([[{ chord: 'Rit.', text: 'fin' }]]);
  });
});

describe('SongView', () => {
  const show = (source: string, props = {}) => render(<SongView song={parseChordPro(source)} {...props} />);

  it('puts each chord in the same cell as its syllable', () => {
    show('[C]Hola [G]mun[Em]do');
    const g = screen.getByText('G').closest('.cp-atom')!;
    expect(g).toHaveTextContent('Gmun');
    const em = [...document.querySelectorAll('.cp-chord')].find((c) => c.textContent === 'Em')!.closest('.cp-atom')!;
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

describe('ChordName', () => {
  const chord = (c: string) => render(<SongView song={parseChordPro(`[${c}]la`)} />).container.querySelector('.cp-chord')!;

  it('raises the quality and extensions', () => {
    const c = chord('C#m7');
    expect(c).toHaveTextContent('C#m7');
    expect(c.querySelector('.chord__ext')).toHaveTextContent('m7');
  });

  it('keeps the bass after the slash at full size', () => {
    const c = chord('Dsus2/F#');
    expect(c.querySelector('.chord__ext')).toHaveTextContent('sus2');
    expect(c.querySelector('.chord__bass')).toHaveTextContent('/F#');
  });

  it('reads Latin roots whole', () => {
    const c = chord('Solm');
    expect(c.firstChild?.textContent).toBe('Sol');
    expect(c.querySelector('.chord__ext')).toHaveTextContent('m');
  });

  it('leaves a plain major chord alone', () => {
    expect(chord('Bb').innerHTML).toBe('Bb');
  });
});

describe('SongView: my lines lit', () => {
  const song = parseChordPro(
    [
      '{start_of_verse}',
      '{x_band: voz=Sergio; coros=Leo}',
      '[G]Canta Sergio',
      '{x_voz: Leo}',
      '[C]Canta Leo',
      '{x_voz: Todos}',
      '[D]Cantan todos',
      '{x_voz}',
      '[G] [C]',
      '{end_of_verse}',
    ].join('\n'),
  );
  const lit = (container: HTMLElement) =>
    [...container.querySelectorAll('.cp-mine')].map((el) => [
      el.textContent?.match(/Sergio|Leo|todos/)?.[0],
      el.classList.contains('cp-mine--backing') ? 'coro' : 'voz',
    ]);

  it.each([true, false])('Leo, showChords=%s: his line, "Todos" and the coros', (showChords) => {
    const { container } = render(<SongView song={song} showChords={showChords} mine="Leo" />);
    expect(lit(container)).toEqual([
      ['Sergio', 'coro'],
      ['Leo', 'voz'],
      ['todos', 'voz'],
    ]);
  });

  it('Sergio: the lines of the section voice; chord-only lines are not sung', () => {
    const { container } = render(<SongView song={song} mine="Sergio" />);
    expect(lit(container)).toEqual([
      ['Sergio', 'voz'],
      ['todos', 'voz'],
    ]);
  });

  it('nothing lit without a singer', () => {
    const { container } = render(<SongView song={song} />);
    expect(container.querySelector('.cp-mine')).toBeNull();
  });
});

describe('SongView: second voice', () => {
  const song = parseChordPro(
    ['{sov}', '{x_voz2: Angel}', 'Uno', '[G]Dos', '{x_voz2}', 'Te ((quiero))', '{eov}'].join('\n'),
  );
  const marked = (container: HTMLElement) => [...container.querySelectorAll('.cp-harmony')].map((el) => el.textContent);

  it.each([true, false])('showChords=%s: whole lines and marked words, the name once per stretch', (showChords) => {
    const { container } = render(<SongView song={song} showChords={showChords} />);
    expect(marked(container)).toEqual(['Uno', 'Dos', 'quiero']);
    expect([...container.querySelectorAll('.cp-harmony-tag')].map((el) => el.textContent)).toEqual([
      '2ª voz · Angel',
      '2ª voz',
    ]);
  });

  it('lights the lines of whoever sings the second voice', () => {
    const { container } = render(<SongView song={song} mine="Angel" />);
    expect([...container.querySelectorAll('.cp-mine')].map((el) => el.textContent?.replace(/2ª.*/, ''))).toEqual([
      'Uno',
      'GDos',
    ]);
  });
});

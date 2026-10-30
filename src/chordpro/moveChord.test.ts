import { moveChord } from './moveChord';

describe('moveChord', () => {
  it('moves a chord one letter later and earlier', () => {
    expect(moveChord('[G]Hola mundo', { line: 0, index: 0 }, 'right')).toEqual({
      content: 'H[G]ola mundo',
      ref: { line: 0, index: 0 },
    });
    expect(moveChord('Ho[G]la', { line: 0, index: 0 }, 'left')?.content).toBe('H[G]ola');
  });

  it('stops at the ends of the line', () => {
    expect(moveChord('[G]Hola', { line: 0, index: 0 }, 'left')).toBeNull();
    expect(moveChord('Hola[G]', { line: 0, index: 0 }, 'right')).toBeNull();
  });

  it('passing another chord keeps their order sensible', () => {
    // C moves right onto G's spot: it goes first, still index 0.
    expect(moveChord('[C]a[G]b', { line: 0, index: 0 }, 'right')).toEqual({
      content: 'a[C][G]b',
      ref: { line: 0, index: 0 },
    });
    // G moves left onto C's spot: it goes after C.
    expect(moveChord('[C]a[G]b', { line: 0, index: 1 }, 'left')).toEqual({
      content: '[C][G]ab',
      ref: { line: 0, index: 1 },
    });
  });

  it('skips escaped brackets and empty []', () => {
    expect(moveChord('\\[x[]y[D]z', { line: 0, index: 0 }, 'left')?.content).toBe('\\[x[][D]yz');
  });

  it('moves to the next lyric line keeping the column, skipping directives and comments', () => {
    const src = 'Hola [G]mundo\n{c: Coro}\n# nota\n\nUna linea';
    expect(moveChord(src, { line: 0, index: 0 }, 'down')).toEqual({
      content: 'Hola mundo\n{c: Coro}\n# nota\n\nUna l[G]inea',
      ref: { line: 4, index: 0 },
    });
  });

  it('moving up clamps to the end of a shorter line', () => {
    expect(moveChord('Ya\nHola mun[D]do', { line: 1, index: 0 }, 'up')?.content).toBe('Ya[D]\nHola mundo');
  });

  it('a chord-only line that empties is removed', () => {
    expect(moveChord('[Am]\nHola', { line: 0, index: 0 }, 'down')).toEqual({
      content: '[Am]Hola',
      ref: { line: 0, index: 0 },
    });
  });

  it('does not move into tabs and keeps CRLF', () => {
    const src = 'a[C]b\r\n{sot}\r\nx|--|\r\n{eot}';
    expect(moveChord(src, { line: 0, index: 0 }, 'down')).toBeNull();
    expect(moveChord(src, { line: 0, index: 0 }, 'right')?.content).toBe('ab[C]\r\n{sot}\r\nx|--|\r\n{eot}');
  });

  it('no line above the first one', () => {
    expect(moveChord('{title: X}\n[C]la', { line: 1, index: 0 }, 'up')).toBeNull();
  });
});

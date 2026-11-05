import { addCue, addCueAtEnd, setCue } from './cues';
import { parseChordPro } from './parser';
import { writeChordPro } from './writer';

describe('indications ({x_cue})', () => {
  it('parse as their own line, keeping the source line', () => {
    const song = parseChordPro('{sov}\n{x_cue: 4 compases de intro}\n[G]Hola\n{x_cue}\n{eov}');
    expect(song.sections[0].lines).toEqual([
      { type: 'cue', text: '4 compases de intro', source: 1 },
      { type: 'lyric', segments: [{ chord: 'G', lyric: 'Hola' }], source: 2 },
    ]);
  });

  it('are written back', () => {
    const text = writeChordPro(parseChordPro('{sov}\n[G]Hola\n{x_cue: x2}\n{eov}'));
    expect(text).toContain('[G]Hola\n{x_cue: x2}\n{end_of_verse}');
  });

  it('addCue goes above the line, with its indentation', () => {
    expect(addCue('{sov}\n  [G]Hola\n{eov}', 1, ' Corte ')).toBe('{sov}\n  {x_cue: Corte}\n  [G]Hola\n{eov}');
    expect(addCue('Hola', 0, '  ')).toBe('Hola');
    // Braces would end the directive.
    expect(addCue('Hola', 0, 'x2 {fuerte}')).toBe('{x_cue: x2 fuerte}\nHola');
  });

  it('addCueAtEnd goes before {end_of_…}, or after the last line', () => {
    const closed = '{soc}\r\nHola\r\n{eoc}\r\nChau';
    expect(addCueAtEnd(closed, parseChordPro(closed).sections[0], 'x2')).toBe('{soc}\r\nHola\r\n{x_cue: x2}\r\n{eoc}\r\nChau');
    const open = 'Hola\nChau';
    expect(addCueAtEnd(open, parseChordPro(open).sections[0], 'x2')).toBe('Hola\nChau\n{x_cue: x2}');
  });

  it('setCue changes or removes it, and leaves other lines alone', () => {
    const text = 'Hola\n{x_cue: x2}\nChau';
    expect(setCue(text, 1, 'x4')).toBe('Hola\n{x_cue: x4}\nChau');
    expect(setCue(text, 1, '')).toBe('Hola\nChau');
    expect(setCue(text, 0, 'x4')).toBe(text);
  });
});

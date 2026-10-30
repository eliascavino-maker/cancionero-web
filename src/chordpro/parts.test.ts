import { shortName } from '../data/band';
import { parseChordPro } from './parser';
import { formatParts, parseParts, setLineVoices, setSectionParts } from './parts';
import { writeChordPro } from './writer';

describe('parts', () => {
  it('reads and writes the directive', () => {
    const p = parseParts('voz=Sergio; coros=Leo, Leandro; tocan=Elias');
    expect(p).toEqual({ lead: ['Sergio'], backing: ['Leo', 'Leandro'], play: ['Elias'] });
    expect(formatParts(p)).toBe('voz=Sergio; coros=Leo, Leandro; tocan=Elias');
    expect(parseParts('Coros: Angel ; nada=x')).toEqual({ lead: [], backing: ['Angel'], play: [] });
  });

  it('the parser attaches parts and source lines to sections', () => {
    const song = parseChordPro('{title: X}\n\n{start_of_chorus}\n{x_band: voz=Angel}\n[C]la\n{end_of_chorus}\nsuelto');
    expect(song.sections[0]).toMatchObject({ kind: 'chorus', startLine: 2, partsLine: 3, parts: { lead: ['Angel'] } });
    expect(song.sections[1]).toMatchObject({ kind: 'none', startLine: 6 });
  });

  it('adds, replaces and removes the line', () => {
    const src = '{start_of_verse}\n[C]la\n{end_of_verse}\nsuelto';
    const [verse, loose] = parseChordPro(src).sections;
    const added = setSectionParts(src, verse, { lead: ['Leo'], backing: [], play: [] });
    expect(added).toBe('{start_of_verse}\n{x_band: voz=Leo}\n[C]la\n{end_of_verse}\nsuelto');
    // A section without {start_of}: the line goes before its first line.
    expect(setSectionParts(src, loose, { lead: [], backing: [], play: ['Elias'] })).toBe(
      '{start_of_verse}\n[C]la\n{end_of_verse}\n{x_band: tocan=Elias}\nsuelto',
    );
    const again = parseChordPro(added).sections[0];
    expect(setSectionParts(added, again, { lead: ['Angel'], backing: [], play: [] })).toContain('{x_band: voz=Angel}');
    expect(setSectionParts(added, again, { lead: [], backing: [], play: [] })).toBe(src);
  });

  it('parts survive saving a transposed copy', () => {
    const out = writeChordPro(parseChordPro('{start_of_verse}\n{x_band: voz=Leo}\n[C]la\n{end_of_verse}'));
    expect(out).toContain('{start_of_verse}\n{x_band: voz=Leo}\n[C]la');
  });
});

describe('voices per line', () => {
  const src = '{start_of_verse}\n{x_band: voz=Sergio}\nUno\n{x_voz: Leo, Angel}\nDos\n{x_voz}\nTres\n{end_of_verse}\n[C]fuera';

  it('the parser gives each line its singers until {x_voz} resets', () => {
    const [verse, after] = parseChordPro(src).sections;
    const singers = verse.lines.map((l) => (l.type === 'lyric' ? l.singers : 'x'));
    expect(singers).toEqual([undefined, ['Leo', 'Angel'], undefined]);
    expect(verse).toMatchObject({ startLine: 0, endLine: 7 });
    // A new section starts without them.
    expect(after.lines[0]).not.toHaveProperty('singers');
  });

  it('rewrites the {x_voz} lines of the section', () => {
    const verse = parseChordPro(src).sections[0];
    expect(setLineVoices(src, verse, 0, 2, ['Leandro'])).toBe(
      '{start_of_verse}\n{x_band: voz=Sergio}\n{x_voz: Leandro}\nUno\nDos\nTres\n{end_of_verse}\n[C]fuera',
    );
    expect(setLineVoices(src, verse, 1, 1, undefined)).toBe(
      '{start_of_verse}\n{x_band: voz=Sergio}\nUno\nDos\nTres\n{end_of_verse}\n[C]fuera',
    );
  });

  it('voices survive saving a transposed copy', () => {
    expect(writeChordPro(parseChordPro(src))).toContain('Uno\n{x_voz: Leo, Angel}\nDos\n{x_voz}\nTres');
  });
});

describe('shortName', () => {
  it.each([
    ['Sergio', 'Se'],
    ['Leo', 'Leo'],
    ['Leandro', 'Lea'],
    ['Angel', 'An'],
    ['Elias', 'El'],
  ])('%s → %s', (name, short) => expect(shortName(name)).toBe(short));
});

import { parseChordPro } from '../chordpro/parser';
import { fold } from '../importer/chart';
import { REPERTORIO, bandSongs } from './bandSongs';

describe('band songs', () => {
  const songs = bandSongs();
  const parsed = (title: string) => parseChordPro(songs.find((s) => s.title === title)!.content);

  it('lyrics + chords, lyrics only and chords only, no repeats', () => {
    expect(songs.map((s) => s.title)).toEqual([
      'Cusco',
      'Amor como fuego',
      'Faro',
      'Bendeciré al Señor',
      'Soplo de Dios',
      'Reflejo de Dios',
      'Dios de la vida',
      'Encontrarte',
      'Fuego de noviembre',
      'Esto que soy',
      'Vida en abundancia',
      'Mar adentro',
      'Rendid a Yahvé',
      'Un montón de estrellas',
      'Caraluna',
      'Entra en mi vida',
      'La de la mala suerte',
      'Dale vieja dale',
      'Está pasando por aquí',
      'Ella multimillonaria',
      'El león',
      'Granito de mostaza',
      'Ya no más',
      'Zaqueo',
      'Sal y luz',
      'Reciban la paz',
      'Sopla',
      'Luz de la ciudad',
    ]);
    for (const s of songs) expect(parseChordPro(s.content).metadata.title).toBe(s.title);
  });

  it('each part of the lyrics starts with its progression', () => {
    const cusco = parsed('Cusco');
    expect(cusco.sections.map((s) => s.label)).toEqual([
      'Intro',
      'Estrofa 1',
      'Estrofa 2',
      'Pre-coro',
      'Estribillo',
      'Interludio',
      'Estrofa 3',
      'Estrofa 4',
      'Pre-coro',
      'Estribillo x2',
    ]);
    const first = cusco.sections[1].lines[0];
    expect(first.type === 'lyric' && first.segments.map((s) => s.chord)).toEqual(['Bb', 'Gm']);
  });

  it('Faro has the highlighted voices', () => {
    const verse = parsed('Faro').sections[1];
    const voices = verse.lines.flatMap((l) => (l.type === 'lyric' ? [l.singers?.join('+') ?? '-'] : []));
    // progression, 6 × Todos, 3 partial lines, Todos, 4 × Leo
    expect(voices).toEqual(['-', ...Array(6).fill('Todos'), '-', '-', '-', 'Todos', ...Array(4).fill('Leo')]);
    const chorus = parsed('Faro').sections[2];
    const sergio = chorus.lines.filter((l) => l.type === 'lyric' && l.singers?.includes('Sergio'));
    expect(sergio).toHaveLength(2);
  });

  it('every song of the repertorio is there', () => {
    const titles = songs.map((s) => fold(s.title));
    for (const t of REPERTORIO) expect(titles).toContain(fold(t));
  });

  it('chord-only songs can be added to lyrics typed by hand', () => {
    const mar = songs.find((s) => s.title === 'Mar adentro')!;
    expect(mar.chart).toBeDefined();
    expect(songs.find((s) => s.title === 'Cusco')!.chart).toBeUndefined();
  });
});

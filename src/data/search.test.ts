import { searchSongs, sungLines } from './search';
import type { SongRecord } from './library';

const song = (id: string, content: string, extra: Partial<SongRecord> = {}): SongRecord => ({
  id,
  title: /\{title:\s*([^}]*)\}/.exec(content)?.[1].trim() ?? id,
  content,
  createdAt: 0,
  updatedAt: 0,
  dirty: 0,
  rev: 1,
  ...extra,
});

const FARO = `{title: Faro}
{key: A}
{start_of_chorus: Estribillo}
[*Todos]Para [*Angel]alum[D]brarnos la salida,
{x_voz: Todos}
Voy a tu lado y sé que es[E]tarás
{end_of_chorus}`;

test('sung lines leave out directives, chords and notes', () => {
  expect(sungLines(FARO)).toEqual(['Para alumbrarnos la salida,', 'Voy a tu lado y sé que estarás']);
});

test('finds by title, artist and a sung line, titles first', () => {
  const songs = [
    song('1', FARO),
    song('2', '{title: Salida}\nNada'),
    song('3', '{title: Otra}\nHola', { artist: 'Los de la salida' }),
  ];
  const hits = searchSongs(songs, 'salida');
  expect(hits.map((h) => [h.song.id, h.where])).toEqual([
    ['2', 'title'],
    ['3', 'artist'],
    ['1', 'letra'],
  ]);
  expect(hits[2].line).toBe('Para alumbrarnos la salida,');
});

test('accents and case do not matter; empty finds nothing', () => {
  const songs = [song('1', FARO)];
  expect(searchSongs(songs, 'ESTARAS')).toHaveLength(1);
  expect(searchSongs(songs, '  ')).toEqual([]);
});

test('an arrangement is found by its name', () => {
  const songs = [song('a', '{title: Faro}\nx', { arrangementOf: '1', arrangementName: 'Acústica' })];
  expect(searchSongs(songs, 'acustica')[0].where).toBe('title');
});

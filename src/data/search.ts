import { fold } from '../importer/chart';
import type { SongRecord } from './library';

export interface SongHit {
  song: SongRecord;
  /** Where it matched, best first: title, artist, then a sung line. */
  where: 'title' | 'artist' | 'letra';
  /** The sung line that matched (only for `letra`). */
  line?: string;
}

/** The sung lines of a ChordPro text: no directives, no chords, no notes. */
export function sungLines(content: string): string[] {
  return content
    .split(/\r?\n/)
    .filter((l) => !/^\s*\{.*\}\s*$/.test(l) && !/^\s*#/.test(l))
    .map((l) =>
      l
        .replace(/\[\*[^\]]*\]/g, '')
        .replace(/\[[^\]]*\]/g, '')
        .replace(/\(\(|\)\)/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean);
}

/**
 * Songs for the global search: titles and artists first, then songs with a
 * line that has the words. Accents and punctuation don't matter.
 */
export function searchSongs(songs: SongRecord[], query: string, limit = 30): SongHit[] {
  const q = fold(query);
  if (!q) return [];
  const byTitle: SongHit[] = [];
  const byArtist: SongHit[] = [];
  const byLyric: SongHit[] = [];
  for (const song of songs) {
    const name = song.arrangementName ? `${song.title} ${song.arrangementName}` : song.title;
    if (fold(name).includes(q)) byTitle.push({ song, where: 'title' });
    else if (song.artist && fold(song.artist).includes(q)) byArtist.push({ song, where: 'artist' });
    else {
      const line = sungLines(song.content).find((l) => fold(l).includes(q));
      if (line) byLyric.push({ song, where: 'letra', line });
    }
  }
  // Titles that start with the words go first.
  byTitle.sort((a, b) => Number(!fold(a.song.title).startsWith(q)) - Number(!fold(b.song.title).startsWith(q)));
  return [...byTitle, ...byArtist, ...byLyric].slice(0, limit);
}

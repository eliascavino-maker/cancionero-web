import { formatParts, isEmptyParts } from './parts';
import type { Song, SongLine, SongSection } from './song';

function sectionName(s: SongSection): string | null {
  switch (s.kind) {
    case 'none':
      return null;
    case 'custom':
      return s.name ?? 'section';
    default:
      return s.kind;
  }
}

function escapeLyric(lyric: string): string {
  return lyric.replace(/\\/g, '\\\\').replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}

function lineText(line: SongLine): string {
  switch (line.type) {
    case 'lyric':
      return line.segments
        .map((s) => (s.chord === undefined ? '' : `[${s.chord}]`) + escapeLyric(s.lyric))
        .join('');
    case 'comment':
      return `{${line.style === 'italic' ? 'ci' : line.style === 'boxed' ? 'cb' : 'c'}: ${line.text}}`;
    case 'tab':
      return line.text;
    case 'empty':
      return '';
    case 'chorusRef':
      return line.label ? `{chorus: ${line.label}}` : '{chorus}';
  }
}

/**
 * Turns a {@link Song} back into ChordPro text. Used to save a transposed
 * copy. `#` comments and formatting directives of the original are not kept.
 */
export function writeChordPro(song: Song): string {
  const out: string[] = [];
  const m = song.metadata;
  const directive = (name: string, value: string | number | undefined) => {
    if (value !== undefined && value !== '') out.push(`{${name}: ${value}}`);
  };

  directive('title', m.title);
  m.subtitles.forEach((s) => directive('subtitle', s));
  m.artists.forEach((a) => directive('artist', a));
  m.composers.forEach((c) => directive('composer', c));
  directive('album', m.album);
  directive('year', m.year);
  directive('key', m.key);
  directive('capo', m.capo);
  directive('tempo', m.tempo);
  directive('time', m.time);
  directive('duration', m.duration);
  for (const [name, values] of Object.entries(m.extra)) {
    values.forEach((v) => directive('meta', `${name} ${v}`));
  }

  for (const section of song.sections) {
    if (out.length) out.push('');
    const name = sectionName(section);
    if (name) out.push(section.label ? `{start_of_${name}: ${section.label}}` : `{start_of_${name}}`);
    if (section.parts && !isEmptyParts(section.parts)) out.push(`{x_band: ${formatParts(section.parts)}}`);
    let voice: string | undefined;
    for (const l of section.lines) {
      if (l.type === 'lyric') {
        const want = l.singers?.join(', ');
        if (want !== voice) out.push(want ? `{x_voz: ${want}}` : '{x_voz}');
        voice = want;
      }
      out.push(lineText(l));
    }
    if (name) out.push(`{end_of_${name}}`);
  }
  return out.join('\n') + '\n';
}

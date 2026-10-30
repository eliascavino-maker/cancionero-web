import type { SectionParts, SongSection } from './song';

// Stored in the song as a custom ChordPro directive (other apps ignore `x_`):
//   {x_band: voz=Sergio; coros=Leo, Leandro; tocan=Sergio, Leo, Leandro, Elias}

const KEYS: Record<string, keyof SectionParts> = {
  voz: 'lead',
  voces: 'lead',
  lead: 'lead',
  coros: 'backing',
  coro: 'backing',
  backing: 'backing',
  tocan: 'play',
  toca: 'play',
  play: 'play',
};

export function emptyParts(): SectionParts {
  return { lead: [], backing: [], play: [] };
}

export function isEmptyParts(p: SectionParts | undefined): boolean {
  return !p || (!p.lead.length && !p.backing.length && !p.play.length);
}

export function parseParts(value: string): SectionParts {
  const parts = emptyParts();
  for (const chunk of value.split(';')) {
    const m = /^\s*([\p{L}]+)\s*[=:]\s*(.*)$/u.exec(chunk);
    const key = m && KEYS[m[1].toLowerCase()];
    if (!key) continue;
    for (const name of m[2].split(',')) {
      const n = name.trim();
      if (n && !parts[key].includes(n)) parts[key].push(n);
    }
  }
  return parts;
}

export function formatParts(p: SectionParts): string {
  return [
    p.lead.length ? `voz=${p.lead.join(', ')}` : '',
    p.backing.length ? `coros=${p.backing.join(', ')}` : '',
    p.play.length ? `tocan=${p.play.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('; ');
}

/**
 * Writes the parts of one section into the ChordPro text: replaces its
 * `{x_band}` line, adds one right after `{start_of_...}`, or removes it when
 * nobody is assigned. Everything else stays as it was.
 */
export function setSectionParts(
  content: string,
  section: Pick<SongSection, 'kind' | 'startLine' | 'partsLine'>,
  parts: SectionParts,
): string {
  if (section.startLine === undefined) return content;
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r\n|\r|\n/);
  const directive = isEmptyParts(parts) ? null : `{x_band: ${formatParts(parts)}}`;

  if (section.partsLine !== undefined) {
    if (directive) lines[section.partsLine] = directive;
    else lines.splice(section.partsLine, 1);
  } else if (directive) {
    lines.splice(section.kind === 'none' ? section.startLine : section.startLine + 1, 0, directive);
  }
  return lines.join(newline);
}

/** "Leo, Angel" → ["Leo", "Angel"]. */
export function parseNames(value: string): string[] {
  return [...new Set(value.split(',').map((n) => n.trim()).filter(Boolean))];
}

const VOICE_LINE = /^\s*\{\s*x_voz\b/i;

/**
 * Sets who sings lyric lines `from`..`to` (counted among the lyric lines of
 * the section). `undefined` = back to the section's voice. Rewrites the
 * `{x_voz}` lines of that section; nothing else changes.
 */
export function setLineVoices(
  content: string,
  section: SongSection,
  from: number,
  to: number,
  singers: string[] | undefined,
): string {
  if (section.startLine === undefined || section.endLine === undefined) return content;
  const lyric = section.lines.filter((l) => l.type === 'lyric' && l.source !== undefined) as {
    source: number;
    singers?: string[];
  }[];
  const wanted = new Map<number, string | undefined>();
  lyric.forEach((l, i) => {
    const names = i >= from && i <= to ? singers : l.singers;
    wanted.set(l.source, names?.length ? names.join(', ') : undefined);
  });

  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r\n|\r|\n/);
  const out: string[] = [];
  let current: string | undefined;
  lines.forEach((line, i) => {
    const inside = i >= section.startLine! && i <= section.endLine!;
    if (inside && VOICE_LINE.test(line)) return;
    if (inside && wanted.has(i)) {
      const want = wanted.get(i);
      if (want !== current) {
        out.push(want ? `{x_voz: ${want}}` : '{x_voz}');
        current = want;
      }
    }
    out.push(line);
  });
  return out.join(newline);
}

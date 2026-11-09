import type { CSSProperties } from 'react';
import { BAND, colorOf } from '../data/band';

/** "Sergio" → "S"; two band names with the same letter get two: "Leo" → "Lo", "Leandro" → "Ld". */
export function initials(name: string): string {
  const clean = name.trim();
  if (!clean) return '?';
  const first = clean[0].toUpperCase();
  const clash = BAND.filter((m) => m.name[0].toUpperCase() === first).length > 1;
  if (!clash) return first;
  // First letter plus the first consonant that tells them apart from the others.
  const others = BAND.filter((m) => m.name.toLowerCase() !== clean.toLowerCase() && m.name[0].toUpperCase() === first);
  for (const ch of clean.slice(1)) {
    if (!/[a-zñ]/i.test(ch) || /[aeiou]/i.test(ch)) continue;
    if (others.every((o) => !o.name.slice(1).toLowerCase().startsWith(ch.toLowerCase()))) return first + ch.toLowerCase();
  }
  return first + clean[clean.length - 1].toLowerCase();
}

/**
 * A member's circle: initials on their color. Members who don't sing get only a
 * ring in their color, so a filled circle always means a voice.
 */
export function Avatar({
  name,
  size = 32,
  ring,
  title,
}: {
  name: string;
  size?: number;
  /** A white ring around it (who leads). */
  ring?: boolean;
  title?: string;
}) {
  const color = colorOf(name);
  const sings = BAND.find((m) => m.name.toLowerCase() === name.toLowerCase())?.sings ?? true;
  const style = { '--m': color ?? 'var(--grafito)', '--size': `${size}px` } as CSSProperties;
  return (
    <span
      className={`avatar${sings ? '' : ' avatar--ring'}${ring ? ' avatar--lead' : ''}`}
      style={style}
      title={title ?? name}
      role="img"
      aria-label={title ?? name}
    >
      {initials(name)}
    </span>
  );
}

/** A band member: whether they sing and what they play. */
export interface Member {
  name: string;
  sings: boolean;
  instrument?: string;
  /** Used for their name chips and notes. */
  color: string;
}

// Same colors as the band's highlighter legend: Todos violeta, Angel amarillo,
// Sergio celeste, Leo verde.
export const BAND: Member[] = [
  { name: 'Sergio', sings: true, instrument: 'Guitarra', color: '#38bdf8' },
  { name: 'Leo', sings: true, instrument: 'Guitarra', color: '#4ade80' },
  { name: 'Angel', sings: true, color: '#facc15' },
  { name: 'Leandro', sings: true, instrument: 'Bajo', color: '#f472b6' },
  { name: 'Elias', sings: false, instrument: 'Piano', color: '#fb923c' },
];

/** Everybody who sings, as one voice: `{x_voz: Todos}`. */
export const ALL = 'Todos';
const ALL_COLOR = '#c084fc';

export function colorOf(name: string): string | undefined {
  if (name.toLowerCase() === ALL.toLowerCase()) return ALL_COLOR;
  return BAND.find((m) => m.name.toLowerCase() === name.toLowerCase())?.color;
}

/** Splits text so member names can be colored: "Queda solo Leo" → ["Queda solo ", {Leo}]. */
export function splitByMembers(text: string): (string | { name: string; color: string })[] {
  const names = [...BAND.map((m) => m.name), ALL].sort((a, b) => b.length - a.length);
  const re = new RegExp(`\\b(${names.join('|')})\\b`, 'gi');
  const out: (string | { name: string; color: string })[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push({ name: m[0], color: colorOf(m[0])! });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export const SINGERS = BAND.filter((m) => m.sings).map((m) => m.name);
export const PLAYERS = BAND.filter((m) => m.instrument).map((m) => m.name);

/**
 * Shortest start of the name (2+ letters) that no other member shares:
 * Sergio → "Se", Leo → "Leo", Leandro → "Lea", Angel → "An", Elias → "El".
 */
export function shortName(name: string): string {
  const others = BAND.map((m) => m.name.toLowerCase()).filter((n) => n !== name.toLowerCase());
  for (let len = 2; len < name.length; len++) {
    const start = name.slice(0, len).toLowerCase();
    if (!others.some((o) => o.startsWith(start))) return name.slice(0, len);
  }
  return name;
}

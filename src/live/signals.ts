/** A director's signal: a big sign on every screen for a few seconds. */
export interface Signal {
  text: string;
  /** `#rrggbb`: the sign's background. */
  color: string;
  /** Phones that can, vibrate when it arrives. */
  vibrate: boolean;
}

/** Same limits as `set_live_signals` (migration 006). */
export const MAX_SIGNALS = 12;
export const MAX_SIGNAL_TEXT = 24;
const COLOR = /^#[0-9a-f]{6}$/i;

/** Until the owner changes them in Banda. */
export const DEFAULT_SIGNALS: Signal[] = [
  { text: 'Repetir coro', color: '#38bdf8', vibrate: false },
  { text: 'Último coro', color: '#a78bfa', vibrate: false },
  { text: 'Una vez más', color: '#34d399', vibrate: false },
  { text: 'Cortar', color: '#f0565a', vibrate: true },
  { text: 'Bajar intensidad', color: '#93c5fd', vibrate: false },
  { text: 'Subir intensidad', color: '#fb923c', vibrate: false },
  { text: 'Solo voz', color: '#f472b6', vibrate: false },
  { text: 'Final', color: '#ffaf3a', vibrate: true },
];

/** One signal as it comes from the band or a message; null if it isn't one. */
export function toSignal(raw: unknown): Signal | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const text = typeof r.text === 'string' ? r.text.trim() : '';
  if (!text || text.length > MAX_SIGNAL_TEXT) return null;
  if (typeof r.color !== 'string' || !COLOR.test(r.color)) return null;
  return { text, color: r.color.toLowerCase(), vibrate: r.vibrate === true };
}

/** The band's list (`bands.live_signals`); the factory one if it has none or it's broken. */
export function bandSignals(raw: unknown): Signal[] {
  if (!Array.isArray(raw) || !raw.length) return DEFAULT_SIGNALS;
  const list = raw.slice(0, MAX_SIGNALS).map(toSignal);
  return list.every((s) => s) ? (list as Signal[]) : DEFAULT_SIGNALS;
}

/** What's wrong with a list before saving it, or null. */
export function signalsProblem(list: Signal[]): string | null {
  if (!list.length) return 'Dejá al menos una señal.';
  if (list.length > MAX_SIGNALS) return `Hasta ${MAX_SIGNALS} señales.`;
  if (list.some((s) => !s.text.trim())) return 'Cada señal necesita un texto.';
  if (list.some((s) => s.text.trim().length > MAX_SIGNAL_TEXT)) return `Cada texto, hasta ${MAX_SIGNAL_TEXT} letras.`;
  if (list.some((s) => !COLOR.test(s.color))) return 'Hay un color que no es válido.';
  return null;
}

/** Text on a sign of that color: black or white, whichever reads better. */
export function inkOn(color: string): '#000' | '#fff' {
  const n = Number.parseInt(color.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const light = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Contrast against black vs against white.
  return (light + 0.05) / 0.05 >= 1.05 / (light + 0.05) ? '#000' : '#fff';
}

// ------------------------------------------------------------- count-in

/** Without `{tempo}`: one beat per second. */
export const COUNT_BPM = 60;

/** Beats to count: the top of `{time}` (3/4 → 3), 4 without it. */
export function countBeats(time: string | undefined): number {
  const top = Number.parseInt(time?.match(/^\s*(\d+)\s*\//)?.[1] ?? '', 10);
  return top >= 2 && top <= 8 ? top : 4;
}

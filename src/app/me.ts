import { useSyncExternalStore } from 'react';
import { getPrefs, setPrefs } from './hooks';

/** A band musician as the "¿Quién sos?" picker shows them. */
export interface Musician {
  /** The server's id, when the list comes from the band. */
  id?: string;
  name: string;
  sings: boolean;
  instrument?: string;
  color: string;
}

/** Who uses this device, remembered in this browser. */
export interface MeState {
  /** "¿Quién sos?" was answered (maybe with "Nadie en particular"). */
  chosen: boolean;
  me: Musician | null;
  /** The lines this person sings are lit in the sheet. */
  highlight: boolean;
}

const EMPTY: MeState = { chosen: false, me: null, highlight: false };
const ME_KEY = 'cancionero.me';

function readMe(): MeState {
  try {
    const raw = localStorage.getItem(ME_KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

let current: MeState | null = null;
const listeners = new Set<() => void>();
export const getMe = () => (current ??= readMe());
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function setMe(next: MeState) {
  current = next;
  try {
    localStorage.setItem(ME_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: keep it for this visit only.
  }
  listeners.forEach((l) => l());
}

export function useMe(): MeState {
  return useSyncExternalStore(subscribe, getMe);
}

/** Tests start with nobody chosen. */
export function resetMeForTests() {
  current = null;
}

/**
 * Where each one starts: whoever plays an instrument, in Acordes; whoever
 * only sings, in Letra.
 */
export function startsWithChords(m: Musician): boolean {
  return !!m.instrument || !m.sings;
}

/**
 * Answer to "¿Quién sos?": remembers it and sets the starting view. Singers
 * get their lines lit. `null` is "Nadie en particular": the view stays as it is.
 */
export function chooseMe(m: Musician | null) {
  setMe({ chosen: true, me: m, highlight: !!m?.sings });
  if (m) setPrefs({ ...getPrefs(), showChords: startsWithChords(m) });
}

/** Name whose lines are lit in the sheet, if any. */
export function litSinger(s: MeState): string | undefined {
  return s.highlight && s.me?.sings ? s.me.name : undefined;
}


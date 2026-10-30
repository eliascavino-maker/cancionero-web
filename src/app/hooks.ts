import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import type { Library } from '../data/library';

export const LibraryContext = createContext<Library | null>(null);

export function useLibrary(): Library {
  const lib = useContext(LibraryContext);
  if (!lib) throw new Error('useLibrary needs a LibraryContext provider');
  return lib;
}

/** Runs `load` and runs it again after every write to the library. */
export function useLive<T>(load: (lib: Library) => Promise<T>, deps: unknown[]): T | undefined {
  const lib = useLibrary();
  const [value, setValue] = useState<T>();
  useEffect(() => {
    let active = true;
    const run = () => {
      load(lib).then((v) => active && setValue(() => v));
    };
    run();
    const off = lib.subscribe(run);
    return () => {
      active = false;
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lib, ...deps]);
  return value;
}

// ------------------------------------------------------------------ router

const subscribeHash = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};

/** Current hash route without `#`, e.g. `/song/3`. */
export function useRoute(): string {
  return useSyncExternalStore(subscribeHash, () => window.location.hash.slice(1) || '/');
}

export function navigate(path: string) {
  window.location.hash = path;
}

// ------------------------------------------------------------- preferences

export interface Prefs {
  fontSize: number;
  showChords: boolean;
  /** Dark by default: easier to read on a dim stage. */
  theme: 'dark' | 'light';
}

const DEFAULT_PREFS: Prefs = { fontSize: 22, showChords: true, theme: 'dark' };
const PREFS_KEY = 'cancionero.prefs';

function readPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

// One shared copy, so every screen sees a change at once.
let currentPrefs: Prefs | null = null;
const prefListeners = new Set<() => void>();
const getPrefs = () => (currentPrefs ??= readPrefs());
const subscribePrefs = (cb: () => void) => {
  prefListeners.add(cb);
  return () => prefListeners.delete(cb);
};

export function setPrefs(p: Prefs) {
  currentPrefs = p;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // Storage blocked: keep the setting for this visit only.
  }
  prefListeners.forEach((l) => l());
}

/** Tests start from defaults. */
export function resetPrefsForTests() {
  currentPrefs = null;
}

/** Font size, Letra/Acordes and theme, remembered in this browser. */
export function usePrefs(): [Prefs, (p: Prefs) => void] {
  const prefs = useSyncExternalStore(subscribePrefs, getPrefs);
  return [prefs, setPrefs];
}

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
}

const DEFAULT_PREFS: Prefs = { fontSize: 20, showChords: true };
const PREFS_KEY = 'cancionero.prefs';

function readPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

/** Font size and chords on/off, remembered in this browser. */
export function usePrefs(): [Prefs, (p: Prefs) => void] {
  const [prefs, setPrefs] = useState(readPrefs);
  const update = (p: Prefs) => {
    setPrefs(p);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(p));
    } catch {
      // Storage blocked: keep the setting for this visit only.
    }
  };
  return [prefs, update];
}

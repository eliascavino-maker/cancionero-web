import { cleanCapo } from '../music/capo';
import { getPrefs, setPrefs, usePrefs } from './hooks';

/**
 * My capo for one song (0 = none). Kept in this device's preferences; with a
 * band, CloudProvider takes the changes to the account (`band_members.prefs.capo`).
 */
export function useCapo(songId: string | undefined): [number, (fret: number) => void] {
  const [prefs] = usePrefs();
  const fret = songId ? cleanCapo(prefs.capo?.[songId]) : 0;
  const set = (n: number) => {
    if (!songId) return;
    const p = getPrefs();
    const next = cleanCapo(n);
    const capo = { ...p.capo };
    if (next) capo[songId] = next;
    else delete capo[songId];
    setPrefs({ ...p, capo, capoEdits: { ...p.capoEdits, [songId]: next } });
  };
  return [fret, set];
}

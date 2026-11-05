import type { MeState, Musician } from '../app/me';
import { cleanCapo } from '../music/capo';

/** What `band_members.prefs` keeps: the choice made on the first device, for the next ones. */
export interface AccountPrefs {
  /** "¿Quién sos?" was answered. */
  chosen?: boolean;
  view?: 'chords' | 'lyrics';
  highlight?: boolean;
  /** Modo escenario on. */
  stage?: boolean;
  /** My capo per song id. */
  capo?: CapoMap;
}

/** Fret per song id; songs without a capo aren't there. */
export type CapoMap = Record<string, number>;

/** The account's row in the band, as far as "¿Quién sos?" goes. */
export interface AccountChoice {
  musicianId: string | null;
  prefs: AccountPrefs;
}

export type AccountStep =
  /** Nothing to do (or wait: nobody chosen anywhere, App asks). */
  | { kind: 'none' }
  /** New device: start as chosen on another one. */
  | { kind: 'adopt'; me: MeState; showChords?: boolean }
  /** This device chose something the account doesn't have yet. */
  | { kind: 'save'; musicianId: string | null; prefs: AccountPrefs };

/** The band's musician with this name (lists made on the device have no ids). */
export function musicianIdFor(me: Musician | null, musicians: Musician[]): string | null {
  if (!me) return null;
  const n = me.name.toLowerCase();
  return (musicians.find((m) => m.id === me.id) ?? musicians.find((m) => m.name.toLowerCase() === n))?.id ?? null;
}

/**
 * This device's answer wins; the account keeps it so a new device starts the
 * same way. A device that never answered takes the account's.
 */
export function accountStep(
  local: MeState,
  showChords: boolean,
  account: AccountChoice,
  musicians: Musician[],
): AccountStep {
  const saved = account.prefs;
  if (!local.chosen) {
    if (!saved.chosen) return { kind: 'none' };
    const me = musicians.find((m) => m.id === account.musicianId) ?? null;
    return {
      kind: 'adopt',
      me: { chosen: true, me, highlight: saved.highlight ?? !!me?.sings },
      showChords: saved.view ? saved.view === 'chords' : undefined,
    };
  }
  const musicianId = musicianIdFor(local.me, musicians);
  const prefs: AccountPrefs = { chosen: true, view: showChords ? 'chords' : 'lyrics', highlight: local.highlight };
  const same =
    musicianId === account.musicianId &&
    saved.chosen === prefs.chosen &&
    saved.view === prefs.view &&
    saved.highlight === prefs.highlight;
  return same ? { kind: 'none' } : { kind: 'save', musicianId, prefs };
}

export type StageStep = { kind: 'none' } | { kind: 'adopt'; on: boolean } | { kind: 'save'; on: boolean };

/**
 * Modo escenario with the account. A device that never chose takes the
 * account's; a choice made here goes to the account.
 */
export function stageStep(local: boolean | undefined, saved: boolean | undefined): StageStep {
  if (local === undefined) return saved === undefined ? { kind: 'none' } : { kind: 'adopt', on: saved };
  return local === saved ? { kind: 'none' } : { kind: 'save', on: local };
}

export type CapoStep =
  | { kind: 'none' }
  /** The account has other capos (set on another device): take them. */
  | { kind: 'adopt'; capo: CapoMap }
  /** Changes made here go to the account: `capo` is the new whole map, `sent` the changes in it. */
  | { kind: 'save'; capo: CapoMap; sent: CapoMap };

/** Only frets 1..11 under song ids; anything else (old or broken data) is left out. */
export function cleanCapoMap(value: unknown): CapoMap | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out: CapoMap = {};
  for (const [id, fret] of Object.entries(value)) if (cleanCapo(fret)) out[id] = fret as number;
  return out;
}

/** `map` with `edits` on it: 0 takes the song out. */
export function applyCapoEdits(map: CapoMap, edits: CapoMap): CapoMap {
  const out = { ...map };
  for (const [id, fret] of Object.entries(edits)) {
    if (cleanCapo(fret)) out[id] = fret;
    else delete out[id];
  }
  return out;
}

const sameCapo = (a: CapoMap, b: CapoMap) =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([id, fret]) => b[id] === fret);

/**
 * My capos with the account. Changes made here go up first (only those
 * songs, so another device's capos stay); with nothing pending, the account's
 * map is the one shown.
 */
export function capoStep(local: CapoMap | undefined, edits: CapoMap | undefined, saved: unknown): CapoStep {
  const account = cleanCapoMap(saved);
  if (edits && Object.keys(edits).length) return { kind: 'save', capo: applyCapoEdits(account ?? {}, edits), sent: edits };
  if (!account || sameCapo(local ?? {}, account)) return { kind: 'none' };
  return { kind: 'adopt', capo: account };
}

/** Edits still pending after `sent` was saved: those changed again meanwhile. */
export function capoEditsLeft(edits: CapoMap | undefined, sent: CapoMap): CapoMap {
  const left: CapoMap = {};
  for (const [id, fret] of Object.entries(edits ?? {})) if (sent[id] !== fret) left[id] = fret;
  return left;
}

import type { SupabaseClient, User } from '@supabase/supabase-js';
import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setPrefs, getPrefs, useLibrary, usePrefs } from '../app/hooks';
import { type Musician, getMe, setMe, useMe } from '../app/me';
import { BAND } from '../data/band';
import { accountStep } from './account';
import { supabaseRemote } from './remote';
import { supabase } from './supabase';
import { Sync, type SyncStatus } from './sync';

/** This account in its band. */
export interface Membership {
  bandId: string;
  bandName: string;
  role: 'owner' | 'member';
  guestCode: string;
  displayName: string;
  musicianId: string | null;
  prefs: Record<string, unknown>;
}

export interface Cloud {
  /** The build has Supabase settings. Without them the app is only local. */
  configured: boolean;
  client: SupabaseClient | null;
  /** Session and band are known (maybe from the last visit, if offline). */
  ready: boolean;
  user: User | null;
  band: Membership | null;
  /** This device has songs or setlists that aren't in the band yet: ask what to do. */
  needsLink: { songs: number; setlists: number; otherBand: boolean } | null;
  sync: SyncStatus | null;
  /** The band's musicians, for "¿Quién sos?". null until known. */
  musicians: Musician[] | null;
  /** Only the owner deletes songs. On a device without a band, anyone. */
  canDeleteSongs: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, name: string): Promise<void>;
  signOut(): Promise<void>;
  createBand(name: string): Promise<void>;
  acceptInvite(code: string): Promise<void>;
  /** Answer to `needsLink`: upload what is here, or start with only the band's. */
  link(upload: boolean): Promise<void>;
  /** Reads the band again (after leaving, being removed, renaming…). */
  refreshBand(): Promise<void>;
  syncNow(): void;
  clearNotices(): void;
}

const notConfigured: Cloud = {
  configured: false,
  client: null,
  ready: true,
  user: null,
  band: null,
  needsLink: null,
  sync: null,
  musicians: null,
  canDeleteSongs: true,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  createBand: async () => {},
  acceptInvite: async () => {},
  link: async () => {},
  refreshBand: async () => {},
  syncNow: () => {},
  clearNotices: () => {},
};

const CloudContext = createContext<Cloud>(notConfigured);

export const useCloud = () => useContext(CloudContext);

const BAND_CACHE = 'cancionero.band';

function cachedBand(userId: string): Membership | null {
  try {
    const c = JSON.parse(localStorage.getItem(BAND_CACHE) ?? 'null');
    return c?.userId === userId ? c.band : null;
  } catch {
    return null;
  }
}

function cacheBand(userId: string, band: Membership | null) {
  try {
    localStorage.setItem(BAND_CACHE, JSON.stringify({ userId, band }));
  } catch {
    // Storage blocked: it's read again next time.
  }
}

const MUSICIANS_CACHE = 'cancionero.musicians';

function cachedMusicians(bandId: string): Musician[] | null {
  try {
    const c = JSON.parse(localStorage.getItem(MUSICIANS_CACHE) ?? 'null');
    return c?.bandId === bandId ? c.musicians : null;
  } catch {
    return null;
  }
}

/** Supabase's messages in English, said in Spanish. Our own SQL errors are already Spanish. */
export function explain(e: unknown): string {
  const err = e as { code?: string; message?: string } | undefined;
  const messages: Record<string, string> = {
    invalid_credentials: 'El email o la contraseña no son correctos.',
    user_already_exists: 'Ya hay una cuenta con ese email. Entrá con tu contraseña.',
    email_exists: 'Ya hay una cuenta con ese email. Entrá con tu contraseña.',
    weak_password: 'La contraseña tiene que tener al menos 6 caracteres.',
    validation_failed: 'Revisá el email.',
    over_request_rate_limit: 'Demasiados intentos. Esperá un rato y probá de nuevo.',
    over_email_send_rate_limit: 'Demasiados intentos. Esperá un rato y probá de nuevo.',
  };
  if (err?.code && messages[err.code]) return messages[err.code];
  if (/fetch|network/i.test(err?.message ?? '')) return 'No hay conexión. Probá de nuevo cuando tengas internet.';
  return err?.message || 'Algo salió mal.';
}

/** Supabase answers with `{ error }` instead of throwing: this throws. */
async function check<R extends { error: unknown }>(p: PromiseLike<R>): Promise<R> {
  const r = await p;
  if (r.error) throw r.error;
  return r;
}

export function CloudProvider({ children }: { children: ReactNode }) {
  if (!supabase) return <>{children}</>;
  return <Connected client={supabase}>{children}</Connected>;
}

function Connected({ client, children }: { client: SupabaseClient; children: ReactNode }) {
  const lib = useLibrary();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [band, setBand] = useState<Membership | null>(null);
  const [needsLink, setNeedsLink] = useState<Cloud['needsLink']>(null);
  const [sync, setSync] = useState<Sync | null>(null);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  /** Goes up after linking this device, so syncing starts. */
  const [linkCount, setLinkCount] = useState(0);
  const [musicians, setMusicians] = useState<Musician[] | null>(null);
  const meState = useMe();
  const [prefs] = usePrefs();
  /** Goes up when the connection comes back, to retry saving "¿Quién sos?". */
  const [onlineCount, setOnlineCount] = useState(0);

  // ----- session (read from this device first, so it works offline)
  useEffect(() => {
    client.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthReady(true);
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, [client]);

  // ----- band: the last one known, then the server's answer
  const loadBand = useCallback(async () => {
    if (!user) return;
    const { data } = await check(
      client
        .from('band_members')
        .select('band_id, role, display_name, musician_id, prefs, bands(name, guest_code)')
        .eq('user_id', user.id)
        .order('joined_at'),
    );
    const rows = data ?? [];
    const linked = rows.find((r) => r.band_id === lib.bandId) ?? rows[0];
    const next: Membership | null = linked
      ? {
          bandId: linked.band_id,
          bandName: (linked.bands as unknown as { name: string }).name,
          guestCode: (linked.bands as unknown as { guest_code: string }).guest_code,
          role: linked.role as Membership['role'],
          displayName: linked.display_name,
          musicianId: linked.musician_id,
          prefs: linked.prefs as Record<string, unknown>,
        }
      : null;
    cacheBand(user.id, next);
    setBand(next);
    // Out of the band (left or removed): what's here stays as this device's copy.
    if (!next && lib.bandId) await lib.unlinkBand();
    if (next) {
      const { data: list } = await check(
        client.from('musicians').select('id, name, sings, instrument, color').eq('band_id', next.bandId).order('position'),
      );
      const roster: Musician[] = (list ?? []).map((m) => ({ ...m, instrument: m.instrument ?? undefined }));
      try {
        localStorage.setItem(MUSICIANS_CACHE, JSON.stringify({ bandId: next.bandId, musicians: roster }));
      } catch {
        // Storage blocked: read again next time.
      }
      setMusicians(roster);
    }
  }, [client, user, lib]);

  useEffect(() => {
    if (!user) {
      setBand(null);
      return;
    }
    const cached = cachedBand(user.id);
    setBand(cached);
    setMusicians(cached ? cachedMusicians(cached.bandId) : null);
    loadBand().catch(() => {
      // Offline: the cached band is used.
    });
  }, [user, loadBand]);

  // ----- link this device to the band, then sync
  useEffect(() => {
    setNeedsLink(null);
    if (!band) return;
    let active = true;
    (async () => {
      if (lib.bandId !== band.bandId) {
        const local = await lib.localOnlyCount();
        const otherBand = !!lib.bandId;
        if (local.songs || local.setlists || otherBand) {
          if (active) setNeedsLink({ ...local, otherBand });
          return;
        }
        await lib.linkBand(band.bandId, true);
      }
      if (!active) return;
      const s = new Sync(lib, supabaseRemote(client), band.bandId);
      setStatus(s.getStatus());
      s.subscribe(setStatus);
      s.start();
      setSync(s);
    })();
    return () => {
      active = false;
      setSync((s) => {
        s?.stop();
        return null;
      });
      setStatus(null);
    };
  }, [band?.bandId, lib, client, linkCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- "¿Quién sos?" with the account. This device's answer wins; the
  // account keeps it so a new device starts the same way.
  useEffect(() => {
    const again = () => setOnlineCount((n) => n + 1);
    window.addEventListener('online', again);
    return () => window.removeEventListener('online', again);
  }, []);

  useEffect(() => {
    if (!user || !band || !musicians) return;
    const step = accountStep(meState, prefs.showChords, band, musicians);
    if (step.kind === 'adopt') {
      setMe(step.me);
      if (step.showChords !== undefined) setPrefs({ ...getPrefs(), showChords: step.showChords });
    }
    if (step.kind !== 'save') return;
    const { musicianId } = step;
    // Wait a moment: switching Letra/Acordes back and forth saves once.
    const timer = setTimeout(async () => {
      const next = { ...band, musicianId, prefs: { ...band.prefs, ...step.prefs } };
      try {
        await check(
          client
            .from('band_members')
            .update({ musician_id: musicianId, prefs: next.prefs })
            .eq('band_id', band.bandId)
            .eq('user_id', user.id),
        );
      } catch {
        return; // Offline: tried again when the connection comes back.
      }
      cacheBand(user.id, next);
      setBand(next);
      // The list from the band has the server's ids.
      const me = getMe().me;
      const withId = musicians.find((m) => m.id === musicianId);
      if (me && withId && me.id !== withId.id) setMe({ ...getMe(), me: withId });
    }, 1000);
    return () => clearTimeout(timer);
  }, [client, user, band, musicians, meState, prefs.showChords, onlineCount]);

  const value = useMemo<Cloud>(() => {
    const myName = () => String(user?.user_metadata?.name ?? '');
    return {
      configured: true,
      client,
      ready: authReady,
      user,
      band,
      needsLink,
      sync: status,
      musicians,
      canDeleteSongs: !band || band.role === 'owner',
      async signIn(email, password) {
        await check(client.auth.signInWithPassword({ email: email.trim(), password }));
      },
      async signUp(email, password, name) {
        await check(client.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() } } }));
      },
      async signOut() {
        sync?.stop();
        await client.auth.signOut();
      },
      async createBand(name) {
        const musicians = BAND.map(({ name, sings, instrument, color }) => ({ name, sings, instrument, color }));
        await check(client.rpc('create_band', { band_name: name.trim(), my_name: myName(), band_musicians: musicians }));
        await loadBand();
      },
      async acceptInvite(code) {
        await check(client.rpc('accept_invite', { invite_code: code.trim(), my_name: myName() }));
        await loadBand();
      },
      async link(upload) {
        if (!band) return;
        await lib.linkBand(band.bandId, upload);
        setNeedsLink(null);
        setLinkCount((n) => n + 1);
      },
      refreshBand: loadBand,
      syncNow: () => void sync?.run(),
      clearNotices: () => sync?.clearNotices(),
    };
  }, [client, authReady, user, band, needsLink, status, sync, musicians, lib, loadBand]);

  return <CloudContext.Provider value={value}>{children}</CloudContext.Provider>;
}


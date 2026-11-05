import { type ReactNode, createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { useMe } from '../app/me';
import { useCloud } from '../cloud/CloudProvider';
import { LiveRoom, type LiveState } from './room';
import { supabaseLive } from './supabaseLive';

const CLOSED: LiveState = { loaded: true, session: null, leaderPos: null, peers: [], connected: false, cue: null };

interface Live {
  /** null: not in a band (or no server). */
  room: LiveRoom | null;
  state: LiveState;
}

const LiveContext = createContext<Live>({ room: null, state: CLOSED });

export const useRoom = () => useContext(LiveContext);

/** Provides the band's live room while signed in to a band. */
export function LiveProvider({ children }: { children: ReactNode }) {
  const cloud = useCloud();
  const me = useMe();
  const bandId = cloud.band?.bandId;
  const userId = cloud.user?.id;
  // "Dirige: Sergio": the musician chosen in "¿Quién sos?", else the name in the band.
  const name = me.me?.name || cloud.band?.displayName || 'Alguien';
  const [room, setRoom] = useState<LiveRoom | null>(null);

  useEffect(() => {
    if (!cloud.client || !bandId || !userId) return;
    const r = new LiveRoom(supabaseLive(cloud.client), bandId, { userId, name });
    r.start();
    setRoom(r);
    const again = () => void r.refresh();
    window.addEventListener('online', again);
    document.addEventListener('visibilitychange', again);
    return () => {
      window.removeEventListener('online', again);
      document.removeEventListener('visibilitychange', again);
      r.stop();
      setRoom(null);
    };
  }, [cloud.client, bandId, userId, name]);

  return <RoomState room={room}>{children}</RoomState>;
}

function RoomState({ room, children }: { room: LiveRoom | null; children: ReactNode }) {
  const state = useSyncExternalStore(
    (cb) => room?.subscribe(cb) ?? (() => {}),
    () => room?.getState() ?? CLOSED,
  );
  return <LiveContext.Provider value={{ room, state }}>{children}</LiveContext.Provider>;
}

/** For tests: a room that is already there. */
export function LiveTestProvider({ room, children }: { room: LiveRoom; children: ReactNode }) {
  return <RoomState room={room}>{children}</RoomState>;
}

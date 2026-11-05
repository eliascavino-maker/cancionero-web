/** For tests. */
import { LeaderChanged, type LiveHandlers, type LiveServer, type LiveSession, type PresenceMeta } from './room';

/** One band's room on a fake server: rows like live_sessions, a channel like Realtime. */
export class FakeHub {
  session: LiveSession | null = null;
  subs = new Map<string, LiveHandlers>();
  presence = new Map<string, PresenceMeta>();
  names = new Map<string, string>();
  sent: { from: string; event: string; payload: Record<string, unknown> }[] = [];
  /** Presence updates, per user. */
  tracks = new Map<string, number>();

  server(userId: string, name: string): LiveServer {
    this.names.set(userId, name);
    const hub = this;
    return {
      fetchSession: async () => (hub.session ? { ...hub.session } : null),
      async open(_band, setlistId) {
        hub.session = hub.session ? { ...hub.session, setlistId } : { setlistId, leaderId: null, leaderName: '' };
        hub.changed();
      },
      async close() {
        hub.session = null;
        hub.changed();
      },
      async takeLead(_band, expected) {
        const s = hub.session;
        if (!s) throw new Error('La sala está cerrada');
        if (s.leaderId === userId) return s.leaderName;
        if (s.leaderId !== expected) throw new LeaderChanged(`Ahora dirige ${s.leaderName}`);
        hub.session = { ...s, leaderId: userId, leaderName: name };
        hub.changed();
        return name;
      },
      async leaveLead() {
        if (hub.session?.leaderId === userId) hub.session = { ...hub.session, leaderId: null, leaderName: '' };
        hub.changed();
      },
      connect(_band, uid, handlers) {
        hub.subs.set(uid, handlers);
        handlers.onStatus(true);
        return {
          async send(event, payload) {
            hub.sent.push({ from: uid, event, payload });
            for (const [other, h] of hub.subs) if (other !== uid) h.onMessage(event, payload);
          },
          async track(meta) {
            hub.tracks.set(uid, (hub.tracks.get(uid) ?? 0) + 1);
            if (meta) hub.presence.set(uid, meta);
            else hub.presence.delete(uid);
            const metas = [...hub.presence.values()];
            for (const h of hub.subs.values()) h.onPresence(metas);
          },
          close: () => void hub.subs.delete(uid),
        };
      },
    };
  }

  /** postgres_changes: everyone reads the row again. */
  changed() {
    for (const h of this.subs.values()) h.onSessionChange();
  }
}


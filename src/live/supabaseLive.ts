import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { LeaderChanged, type LiveServer, type LiveSession, type PresenceMeta } from './room';

/** The room expires 12 h after its last change (same rule as the server). */
const OPEN_MS = 12 * 60 * 60 * 1000;
const EVENTS = ['pos', 'lead', 'session', 'hello'];
/** Waits before joining again after the channel closes. */
const RETRY_MS = [1000, 2000, 5000, 10_000, 30_000];

async function rpc(client: SupabaseClient, name: string, args: Record<string, unknown>) {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    if (error.hint === 'leader_changed') throw new LeaderChanged(error.message);
    throw error;
  }
  return data;
}

export function supabaseLive(client: SupabaseClient): LiveServer {
  return {
    async fetchSession(bandId) {
      const { data, error } = await client
        .from('live_sessions')
        .select('setlist_id, leader_id, leader_name, updated_at')
        .eq('band_id', bandId)
        .maybeSingle();
      if (error) throw error;
      if (!data || Date.now() - Date.parse(data.updated_at) > OPEN_MS) return null;
      const session: LiveSession = { setlistId: data.setlist_id, leaderId: data.leader_id, leaderName: data.leader_name };
      return session;
    },
    open: async (band, setlist) => void (await rpc(client, 'open_live', { band, setlist })),
    close: async (band) => void (await rpc(client, 'close_live', { band })),
    takeLead: async (band, expected) => String(await rpc(client, 'take_lead', { band, expected })),
    leaveLead: async (band) => void (await rpc(client, 'leave_lead', { band })),

    connect(bandId, userId, h) {
      let closed = false;
      let channel: RealtimeChannel;
      let retry: ReturnType<typeof setTimeout> | undefined;
      let tries = 0;

      /** Joins the channel; if the server closes it (a cut, a limit), joins again a bit later. */
      const join = () => {
        // Private: only members (realtime.messages policies of migration 005).
        const ch = client.channel(`live:${bandId}`, {
          config: { private: true, broadcast: { self: false }, presence: { key: userId } },
        });
        channel = ch;
        for (const event of EVENTS) {
          ch.on('broadcast', { event }, (m) => h.onMessage(event, (m.payload ?? {}) as Record<string, unknown>));
        }
        ch.on('presence', { event: 'sync' }, () => {
          h.onPresence(Object.values(ch.presenceState<PresenceMeta>()).flat());
        });
        ch.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'live_sessions', filter: `band_id=eq.${bandId}` },
          () => h.onSessionChange(),
        );
        ch.on('system', {}, (m: { status?: string; message?: string }) => {
          if (m.status === 'error') console.warn('Sala en vivo:', m.message);
        });
        // The session's token, so the server knows who joins the private channel.
        void client.realtime.setAuth().finally(() => {
          if (closed || ch !== channel) return;
          ch.subscribe((status) => {
            if (closed || ch !== channel) return;
            if (status === 'SUBSCRIBED') {
              tries = 0;
              h.onStatus(true);
              return;
            }
            h.onStatus(false);
            clearTimeout(retry);
            retry = setTimeout(() => {
              if (closed) return;
              void client.removeChannel(ch);
              join();
            }, RETRY_MS[Math.min(tries++, RETRY_MS.length - 1)]);
          });
        });
      };
      join();

      return {
        async send(event, payload) {
          await channel.send({ type: 'broadcast', event, payload });
        },
        async track(meta) {
          if (meta) await channel.track(meta);
          else await channel.untrack();
        },
        close() {
          closed = true;
          clearTimeout(retry);
          void client.removeChannel(channel);
        },
      };
    },
  };
}

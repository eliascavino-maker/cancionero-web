import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import type { Row, Table, Upload } from './rows';

/** Where a download continues: after this `updated_at` and id. */
export interface Cursor {
  at: string;
  id: string;
}

export const ZERO_ID = '00000000-0000-0000-0000-000000000000';

/** A failed request. `network`: no connection (try again later). */
export class RemoteError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly network: boolean,
  ) {
    super(message);
  }
}

/** The band's data on the server, as Sync needs it. */
export interface Remote {
  /** Rows of the band changed after `after`, oldest first. */
  pull(table: Table, bandId: string, after: Cursor | null, limit: number): Promise<Row[]>;
  /** Throws RemoteError code 23505 if the id already exists. */
  insert(table: Table, row: Upload): Promise<Row>;
  /** Only if the server still has `base` as updated_at; else null. */
  update(table: Table, row: Upload, base: string): Promise<Row | null>;
  fetch(table: Table, id: string): Promise<Row | null>;
  /** Calls `onChange` when something of the band changes. Returns a stop function. */
  watch(bandId: string, onChange: () => void): () => void;
}

const TABLES: Table[] = ['songs', 'setlists', 'setlist_items'];

function fail(e: PostgrestError): RemoteError {
  // Without a Postgres code the request didn't reach the database.
  return new RemoteError(e.message, e.code ?? '', !e.code);
}

export function supabaseRemote(client: SupabaseClient): Remote {
  return {
    async pull(table, bandId, after, limit) {
      let q = client.from(table).select('*').eq('band_id', bandId).order('updated_at').order('id').limit(limit);
      if (after) q = q.or(`updated_at.gt."${after.at}",and(updated_at.eq."${after.at}",id.gt.${after.id})`);
      const { data, error } = await q;
      if (error) throw fail(error);
      return data as Row[];
    },
    async insert(table, row) {
      const { data, error } = await client.from(table).insert(row as never).select().single();
      if (error) throw fail(error);
      return data as Row;
    },
    async update(table, row, base) {
      const { data, error } = await client.from(table).update(row as never).eq('id', row.id).eq('updated_at', base).select();
      if (error) throw fail(error);
      return (data?.[0] as Row | undefined) ?? null;
    },
    async fetch(table, id) {
      const { data, error } = await client.from(table).select('*').eq('id', id).maybeSingle();
      if (error) throw fail(error);
      return (data as Row | null) ?? null;
    },
    watch(bandId, onChange) {
      const channel = client.channel(`sync:${bandId}`);
      for (const table of TABLES) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `band_id=eq.${bandId}` }, onChange);
      }
      channel.subscribe();
      return () => void client.removeChannel(channel);
    },
  };
}

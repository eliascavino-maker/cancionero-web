import type { DataStore, SetlistItem, Setlist, SongRecord, StoredRecord } from '../data/library';

/** Server tables, one per local store. */
export type Table = 'songs' | 'setlists' | 'setlist_items';

export const TABLE_OF: Record<DataStore, Table> = {
  songs: 'songs',
  setlists: 'setlists',
  setlistItems: 'setlist_items',
};

interface Common {
  id: string;
  band_id: string;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
}

export interface SongRow extends Common {
  title: string;
  artist: string | null;
  song_key: string | null;
  content: string;
  /** Migration 7. Missing until it's applied. */
  arrangement_of?: string | null;
  arrangement_name?: string | null;
}

export interface SetlistRow extends Common {
  name: string;
}

export interface ItemRow extends Common {
  setlist_id: string;
  song_id: string;
  position: number;
  transpose: number;
}

export type Row = SongRow | SetlistRow | ItemRow;

type Server = 'created_at' | 'updated_at' | 'updated_by';
/** What is sent: the server fills in created_at, updated_at and updated_by. */
export type Upload = Omit<SongRow, Server> | Omit<SetlistRow, Server> | Omit<ItemRow, Server>;

const ms = (iso: string | null) => (iso ? Date.parse(iso) : undefined);
const iso = (ms: number | undefined) => (ms ? new Date(ms).toISOString() : null);

/** Server row → local record, clean (nothing to upload). */
export function toRecord<S extends DataStore>(store: S, row: Row): StoredRecord<S> {
  const common = {
    id: row.id,
    bandId: row.band_id,
    serverAt: row.updated_at,
    updatedBy: row.updated_by ?? undefined,
    deletedAt: ms(row.deleted_at),
    dirty: 0 as const,
    rev: 0,
  };
  if (store === 'songs') {
    const r = row as SongRow;
    const song: SongRecord = {
      ...common,
      title: r.title,
      artist: r.artist ?? undefined,
      songKey: r.song_key ?? undefined,
      content: r.content,
      createdAt: ms(r.created_at)!,
      updatedAt: ms(r.updated_at)!,
    };
    if (r.arrangement_of) {
      song.arrangementOf = r.arrangement_of;
      song.arrangementName = r.arrangement_name ?? undefined;
    }
    return song as StoredRecord<S>;
  }
  if (store === 'setlists') {
    const r = row as SetlistRow;
    const setlist: Setlist = { ...common, name: r.name, createdAt: ms(r.created_at)! };
    return setlist as StoredRecord<S>;
  }
  const r = row as ItemRow;
  const item: SetlistItem = { ...common, setlistId: r.setlist_id, songId: r.song_id, position: r.position, transpose: r.transpose };
  return item as StoredRecord<S>;
}

/** Local record → what is uploaded. */
export function toUpload<S extends DataStore>(store: S, record: StoredRecord<S>): Upload {
  const common = { id: record.id, band_id: record.bandId!, deleted_at: iso(record.deletedAt) };
  if (store === 'songs') {
    const s = record as SongRecord;
    const row = { ...common, title: s.title, artist: s.artist ?? null, song_key: s.songKey ?? null, content: s.content };
    // Only arrangements send these: songs keep uploading before migration 7.
    return s.arrangementOf
      ? { ...row, arrangement_of: s.arrangementOf, arrangement_name: s.arrangementName ?? null }
      : row;
  }
  if (store === 'setlists') return { ...common, name: (record as Setlist).name };
  const i = record as SetlistItem;
  return { ...common, setlist_id: i.setlistId, song_id: i.songId, position: i.position, transpose: i.transpose };
}

/** Both say the same (sync fields aside). */
export function sameData<S extends DataStore>(store: S, a: StoredRecord<S>, b: StoredRecord<S>): boolean {
  return JSON.stringify(toUpload(store, a)) === JSON.stringify(toUpload(store, b));
}

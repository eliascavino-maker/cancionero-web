import { type DBSchema, type IDBPDatabase, type IDBPTransaction, openDB } from 'idb';
import { parseChordPro } from '../chordpro/parser';
import { artistOf } from '../chordpro/song';
import { sampleSong } from './sample';

/**
 * Fields every stored record has, for syncing with the band.
 *
 * Records are never removed once uploaded: deleting sets `deletedAt`, so other
 * devices find out and it can be restored.
 */
export interface Synced {
  /** UUID made on this device, so records can be created offline. */
  id: string;
  /** Band it belongs to. Missing: it only exists on this device. */
  bandId?: string;
  /** The server's `updated_at` at the last sync. Missing: never uploaded. */
  serverAt?: string;
  /** 1 while there are changes to upload (a number, so it can be indexed). */
  dirty: 0 | 1;
  /** Grows with every local change: tells if it changed while uploading. */
  rev: number;
  deletedAt?: number;
  /** Account that changed it last, as the server says. */
  updatedBy?: string;
}

/** A song. `content` is the ChordPro source; title, artist and key are copied out on save. */
export interface SongRecord extends Synced {
  title: string;
  artist?: string;
  songKey?: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface Setlist extends Synced {
  name: string;
  createdAt: number;
}

/**
 * A song inside a setlist. `transpose` is the shift used in this setlist only.
 * `position` only orders: moving a song puts it between its new neighbours.
 */
export interface SetlistItem extends Synced {
  setlistId: string;
  songId: string;
  position: number;
  transpose: number;
}

export interface SetlistSummary {
  setlist: Setlist;
  songCount: number;
}

export interface SetlistEntry {
  item: SetlistItem;
  song: SongRecord;
}

/** Backup file format. Version 1 had numeric ids; it can still be imported. */
export interface LibraryExport {
  format: 'cancionero';
  version: 1 | 2;
  songs: Pick<SongRecord, 'id' | 'title' | 'artist' | 'songKey' | 'content' | 'createdAt' | 'updatedAt'>[];
  setlists: Pick<Setlist, 'id' | 'name' | 'createdAt'>[];
  setlistItems: Pick<SetlistItem, 'id' | 'setlistId' | 'songId' | 'position' | 'transpose'>[];
}

export type DataStore = 'songs' | 'setlists' | 'setlistItems';
export type StoredRecord<S extends DataStore> = Schema[S]['value'];

interface Schema extends DBSchema {
  songs: { key: string; value: SongRecord; indexes: { dirty: number } };
  setlists: { key: string; value: Setlist; indexes: { dirty: number } };
  setlistItems: {
    key: string;
    value: SetlistItem;
    indexes: { bySetlist: string; bySong: string; dirty: number };
  };
  meta: { key: string; value: unknown };
}

export const DATA_STORES: DataStore[] = ['songs', 'setlists', 'setlistItems'];

/** Lowercase without accents, for search. */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

const byTitle = (a: SongRecord, b: SongRecord) =>
  a.title.localeCompare(b.title, 'es', { sensitivity: 'base' });
const byPosition = (a: SetlistItem, b: SetlistItem) => a.position - b.position || (a.id < b.id ? -1 : 1);
const alive = <T extends Synced>(r: T | undefined): r is T => !!r && !r.deletedAt;
const uuid = () => crypto.randomUUID();

/** Marks a record as changed here. */
function touch<T extends Synced>(r: T): T {
  return { ...r, dirty: 1, rev: r.rev + 1 };
}

/** What changed: `local` is a change made on this device, else it came from the band. */
export interface Change {
  local: boolean;
}

/**
 * Songs and setlists stored in the browser (IndexedDB). Works without
 * internet; {@link Sync} uploads and downloads changes when linked to a band.
 */
export class Library {
  private listeners = new Set<(c: Change) => void>();
  private band: string | undefined;

  private constructor(private db: IDBPDatabase<Schema>) {}

  static async open(name = 'cancionero'): Promise<Library> {
    const db = await openDB<Schema>(name, 2, {
      async upgrade(db, oldVersion, _newVersion, tx) {
        const old = oldVersion === 1 ? await readV1(tx) : null;
        for (const store of DATA_STORES) {
          if (db.objectStoreNames.contains(store)) db.deleteObjectStore(store);
        }
        db.createObjectStore('songs', { keyPath: 'id' }).createIndex('dirty', 'dirty');
        db.createObjectStore('setlists', { keyPath: 'id' }).createIndex('dirty', 'dirty');
        const items = db.createObjectStore('setlistItems', { keyPath: 'id' });
        items.createIndex('bySetlist', 'setlistId');
        items.createIndex('bySong', 'songId');
        items.createIndex('dirty', 'dirty');
        db.createObjectStore('meta');
        if (old) await writeV1(tx, old);
      },
    });
    const lib = new Library(db);
    lib.band = (await db.get('meta', 'bandId')) as string | undefined;
    return lib;
  }

  close() {
    this.db.close();
  }

  /** Called after every write. Returns an unsubscribe function. */
  subscribe(listener: (c: Change) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private changed(local = true) {
    this.listeners.forEach((l) => l({ local }));
  }

  /** Band this device syncs with, if any. */
  get bandId(): string | undefined {
    return this.band;
  }

  // ---------------------------------------------------------------- songs

  /** Library sorted by title. `query` matches title or artist, ignoring case and accents. */
  async listSongs(query = ''): Promise<SongRecord[]> {
    const songs = (await this.db.getAll('songs')).filter(alive);
    const q = fold(query.trim());
    const filtered = q
      ? songs.filter((s) => fold(s.title).includes(q) || fold(s.artist ?? '').includes(q))
      : songs;
    return filtered.sort(byTitle);
  }

  async getSong(id: string): Promise<SongRecord | undefined> {
    const s = await this.db.get('songs', id);
    return alive(s) ? s : undefined;
  }

  /** Inserts (no `id`) or updates a song from its ChordPro text. Returns the id. */
  async saveSong(content: string, id?: string): Promise<string> {
    const meta = parseChordPro(content).metadata;
    const now = Date.now();
    const fields = {
      title: meta.title?.trim() || 'Sin título',
      artist: artistOf(meta),
      songKey: meta.key,
      content,
      updatedAt: now,
    };
    let result: string;
    if (id === undefined) {
      result = uuid();
      await this.db.put('songs', { ...fields, id: result, bandId: this.band, createdAt: now, dirty: 1, rev: 1 });
    } else {
      const old = await this.db.get('songs', id);
      if (!old) throw new Error(`No song ${id}`);
      await this.db.put('songs', touch({ ...old, ...fields }));
      result = id;
    }
    this.changed();
    return result;
  }

  /**
   * Hides the song everywhere, setlists included. Uploaded songs stay as
   * deleted and can be restored; the rest are removed for good.
   */
  async deleteSong(id: string): Promise<void> {
    const tx = this.db.transaction(['songs', 'setlistItems'], 'readwrite');
    const song = await tx.objectStore('songs').get(id);
    if (!song) return;
    if (song.serverAt) {
      await tx.objectStore('songs').put(touch({ ...song, deletedAt: Date.now() }));
    } else {
      const items = tx.objectStore('setlistItems');
      for (const item of await items.index('bySong').getAll(id)) await items.delete(item.id);
      await tx.objectStore('songs').delete(id);
    }
    await tx.done;
    this.changed();
  }

  async restoreSong(id: string): Promise<void> {
    const song = await this.db.get('songs', id);
    if (!song?.deletedAt) return;
    await this.db.put('songs', touch({ ...song, deletedAt: undefined }));
    this.changed();
  }

  /** Deleted songs, newest first. */
  async listDeletedSongs(): Promise<SongRecord[]> {
    const songs = await this.db.getAll('songs');
    return songs.filter((s) => s.deletedAt).sort((a, b) => b.deletedAt! - a.deletedAt!);
  }

  /** Adds a demo song the first time the app runs (not when linked to a band). */
  async seedIfEmpty(): Promise<void> {
    if (!this.band && (await this.db.count('songs')) === 0) await this.saveSong(sampleSong);
  }

  // ------------------------------------------------------------- setlists

  async listSetlists(): Promise<SetlistSummary[]> {
    const [setlists, items, songs] = await Promise.all([
      this.db.getAll('setlists'),
      this.db.getAll('setlistItems'),
      this.db.getAll('songs'),
    ]);
    const liveSongs = new Set(songs.filter(alive).map((s) => s.id));
    const counts = new Map<string, number>();
    for (const i of items) {
      if (alive(i) && liveSongs.has(i.songId)) counts.set(i.setlistId, (counts.get(i.setlistId) ?? 0) + 1);
    }
    return setlists
      .filter(alive)
      .sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : -1))
      .map((setlist) => ({ setlist, songCount: counts.get(setlist.id) ?? 0 }));
  }

  async getSetlist(id: string): Promise<Setlist | undefined> {
    const s = await this.db.get('setlists', id);
    return alive(s) ? s : undefined;
  }

  async createSetlist(name: string): Promise<string> {
    const id = uuid();
    await this.db.put('setlists', { id, name, bandId: this.band, createdAt: Date.now(), dirty: 1, rev: 1 });
    this.changed();
    return id;
  }

  async renameSetlist(id: string, name: string): Promise<void> {
    const s = await this.db.get('setlists', id);
    if (!s) return;
    await this.db.put('setlists', touch({ ...s, name }));
    this.changed();
  }

  /** Songs stay in the library. Uploaded setlists stay as deleted and can be restored. */
  async deleteSetlist(id: string): Promise<void> {
    const tx = this.db.transaction(['setlists', 'setlistItems'], 'readwrite');
    const setlist = await tx.objectStore('setlists').get(id);
    if (!setlist) return;
    if (setlist.serverAt) {
      await tx.objectStore('setlists').put(touch({ ...setlist, deletedAt: Date.now() }));
    } else {
      const items = tx.objectStore('setlistItems');
      for (const key of await items.index('bySetlist').getAllKeys(id)) await items.delete(key);
      await tx.objectStore('setlists').delete(id);
    }
    await tx.done;
    this.changed();
  }

  async restoreSetlist(id: string): Promise<void> {
    const s = await this.db.get('setlists', id);
    if (!s?.deletedAt) return;
    await this.db.put('setlists', touch({ ...s, deletedAt: undefined }));
    this.changed();
  }

  /** Deleted setlists, newest first. */
  async listDeletedSetlists(): Promise<Setlist[]> {
    const setlists = await this.db.getAll('setlists');
    return setlists.filter((s) => s.deletedAt).sort((a, b) => b.deletedAt! - a.deletedAt!);
  }

  /** Items that show: not removed, and their song not deleted. In order. */
  private async visible(setlistId: string): Promise<SetlistEntry[]> {
    const items = (await this.db.getAllFromIndex('setlistItems', 'bySetlist', setlistId)).filter(alive);
    const entries: SetlistEntry[] = [];
    for (const item of items.sort(byPosition)) {
      const song = await this.db.get('songs', item.songId);
      if (alive(song)) entries.push({ item, song });
    }
    return entries;
  }

  /** Items in order, each with its song. */
  getSetlistEntries(setlistId: string): Promise<SetlistEntry[]> {
    return this.visible(setlistId);
  }

  /** Appends a song at the end. The same song may appear more than once. */
  async addSongToSetlist(setlistId: string, songId: string, transpose = 0): Promise<string> {
    const items = (await this.db.getAllFromIndex('setlistItems', 'bySetlist', setlistId)).filter(alive);
    const position = items.length ? Math.max(...items.map((i) => i.position)) + 1 : 0;
    const id = uuid();
    await this.db.put('setlistItems', {
      id,
      setlistId,
      songId,
      position,
      transpose,
      bandId: this.band,
      dirty: 1,
      rev: 1,
    });
    this.changed();
    return id;
  }

  async removeSetlistItem(itemId: string): Promise<void> {
    const item = await this.db.get('setlistItems', itemId);
    if (!item) return;
    if (item.serverAt) await this.db.put('setlistItems', touch({ ...item, deletedAt: Date.now() }));
    else await this.db.delete('setlistItems', itemId);
    this.changed();
  }

  /** Moves the item at index `from` to index `to` (0-based), changing only that item. */
  async moveSetlistItem(setlistId: string, from: number, to: number): Promise<void> {
    const items = (await this.visible(setlistId)).map((e) => e.item);
    if (from < 0 || from >= items.length) return;
    const [moved] = items.splice(from, 1);
    const at = Math.max(0, Math.min(to, items.length));
    const prev = items[at - 1]?.position;
    const next = items[at]?.position;
    if (prev !== undefined && next !== undefined && next - prev < 1e-6) {
      // No room left between them: number them all again.
      items.splice(at, 0, moved);
      const tx = this.db.transaction('setlistItems', 'readwrite');
      await Promise.all(items.map((item, position) => tx.store.put(touch({ ...item, position }))));
      await tx.done;
    } else {
      const position =
        prev !== undefined && next !== undefined ? (prev + next) / 2 : prev !== undefined ? prev + 1 : next !== undefined ? next - 1 : 0;
      await this.db.put('setlistItems', touch({ ...moved, position }));
    }
    this.changed();
  }

  async setItemTranspose(itemId: string, transpose: number): Promise<void> {
    const item = await this.db.get('setlistItems', itemId);
    if (!item) return;
    await this.db.put('setlistItems', touch({ ...item, transpose }));
    this.changed();
  }

  // --------------------------------------------------------------- backup

  async exportAll(): Promise<LibraryExport> {
    const [songs, setlists, items] = await Promise.all([
      this.listSongs(),
      this.db.getAll('setlists'),
      this.db.getAll('setlistItems'),
    ]);
    return {
      format: 'cancionero',
      version: 2,
      songs: songs.map(({ id, title, artist, songKey, content, createdAt, updatedAt }) => ({
        id,
        title,
        artist,
        songKey,
        content,
        createdAt,
        updatedAt,
      })),
      setlists: setlists.filter(alive).map(({ id, name, createdAt }) => ({ id, name, createdAt })),
      setlistItems: items
        .filter(alive)
        .map(({ id, setlistId, songId, position, transpose }) => ({ id, setlistId, songId, position, transpose })),
    };
  }

  /**
   * Loads a backup. Not linked to a band: replaces everything on this device.
   * Linked: adds the songs and setlists to the band, nothing is replaced.
   */
  async importAll(data: LibraryExport): Promise<void> {
    if (data?.format !== 'cancionero' || (data.version !== 1 && data.version !== 2)) {
      throw new Error('El archivo no es un respaldo de Cancionero.');
    }
    // New ids always: a backup can be loaded twice, or on another band.
    // Version 1 ids are numbers per table, so the table is part of the key.
    const ids = new Map<string, string>();
    const idOf = (table: string, old: string | number) => {
      const k = `${table}:${old}`;
      if (!ids.has(k)) ids.set(k, uuid());
      return ids.get(k)!;
    };
    const base = { bandId: this.band, dirty: 1 as const, rev: 1 };
    const tx = this.db.transaction(DATA_STORES, 'readwrite');
    if (!this.band) await Promise.all(DATA_STORES.map((s) => tx.objectStore(s).clear()));
    await Promise.all([
      ...data.songs.map((s) => tx.objectStore('songs').put({ ...s, ...base, id: idOf('song', s.id) })),
      ...data.setlists.map((s) => tx.objectStore('setlists').put({ ...s, ...base, id: idOf('setlist', s.id) })),
      ...data.setlistItems.map((i) =>
        tx.objectStore('setlistItems').put({
          ...i,
          ...base,
          id: idOf('item', i.id),
          setlistId: idOf('setlist', i.setlistId),
          songId: idOf('song', i.songId),
        }),
      ),
    ]);
    await tx.done;
    this.changed();
  }

  // ----------------------------------------------------------------- sync
  // Used by Sync. Writes here don't count as local changes.

  /** Records with changes to upload. */
  dirtyRecords<S extends DataStore>(store: S): Promise<StoredRecord<S>[]> {
    // Every data store has the `dirty` index; TypeScript can't see it through S.
    return this.db.getAllFromIndex(store as 'songs', 'dirty', 1) as unknown as Promise<StoredRecord<S>[]>;
  }

  async pendingCount(): Promise<number> {
    const counts = await Promise.all(DATA_STORES.map((s) => this.db.countFromIndex(s, 'dirty', 1)));
    return counts.reduce((a, b) => a + b, 0);
  }

  getRecord<S extends DataStore>(store: S, id: string): Promise<StoredRecord<S> | undefined> {
    return this.db.get(store, id) as Promise<StoredRecord<S> | undefined>;
  }

  /**
   * The upload of `rev` worked and the server answered `server`. If nothing
   * changed meanwhile, the record is clean; else only its base moves forward.
   */
  async markUploaded<S extends DataStore>(store: S, id: string, rev: number, server: StoredRecord<S>): Promise<void> {
    const cur = await this.db.get(store, id);
    if (!cur) return;
    const next = cur.rev === rev ? { ...server, rev, dirty: 0 as const } : { ...cur, serverAt: server.serverAt };
    await this.db.put(store, next as never);
  }

  /**
   * Records downloaded from the band. Records with changes still to upload
   * are left alone (the upload resolves them), unless `force`.
   */
  async applyRemote<S extends DataStore>(store: S, records: StoredRecord<S>[], force = false): Promise<void> {
    if (!records.length) return;
    const tx = this.db.transaction(store, 'readwrite');
    let changed = false;
    for (const r of records) {
      const cur = (await tx.store.get(r.id)) as StoredRecord<S> | undefined;
      if (cur && !force && (cur.dirty || cur.serverAt === r.serverAt)) continue;
      await tx.store.put({ ...r, rev: (cur?.rev ?? 0) + 1, dirty: 0 } as never);
      changed = true;
    }
    await tx.done;
    if (changed) this.changed(false);
  }

  async getMeta<T>(key: string): Promise<T | undefined> {
    return (await this.db.get('meta', key)) as T | undefined;
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    await this.db.put('meta', value, key);
  }

  /** Songs and setlists on this device that aren't in any band. The demo song doesn't count. */
  async localOnlyCount(): Promise<{ songs: number; setlists: number }> {
    const [songs, setlists] = await Promise.all([this.db.getAll('songs'), this.db.getAll('setlists')]);
    return {
      songs: songs.filter((s) => alive(s) && !s.bandId && s.content !== sampleSong).length,
      setlists: setlists.filter((s) => alive(s) && !s.bandId).length,
    };
  }

  /**
   * Links this device to `bandId`. `upload`: what is only on this device
   * goes to the band; else it is removed. Data of another band is removed
   * from this device (it stays in that band).
   */
  async linkBand(bandId: string, upload: boolean): Promise<void> {
    const tx = this.db.transaction([...DATA_STORES, 'meta'], 'readwrite');
    for (const store of DATA_STORES) {
      const os = tx.objectStore(store);
      for (const r of await os.getAll()) {
        if (r.bandId === bandId) continue;
        const demo = store === 'songs' && (r as SongRecord).content === sampleSong;
        if (!r.bandId && upload && !r.deletedAt && !demo) {
          await os.put(touch({ ...r, bandId, serverAt: undefined }) as never);
        } else {
          await os.delete(r.id);
        }
      }
    }
    // Items whose setlist or song didn't make it.
    const items = tx.objectStore('setlistItems');
    const setlists = new Set(await tx.objectStore('setlists').getAllKeys());
    const songs = new Set(await tx.objectStore('songs').getAllKeys());
    for (const i of await items.getAll()) {
      if (!setlists.has(i.setlistId) || !songs.has(i.songId)) await items.delete(i.id);
    }
    const meta = tx.objectStore('meta');
    await meta.put(bandId, 'bandId');
    for (const store of DATA_STORES) await meta.delete(`cursor:${store}`);
    await tx.done;
    this.band = bandId;
    this.changed(false);
  }

  /**
   * Stops syncing (left the band or was removed). Everything stays on this
   * device as its own copy.
   */
  async unlinkBand(): Promise<void> {
    const tx = this.db.transaction([...DATA_STORES, 'meta'], 'readwrite');
    for (const store of DATA_STORES) {
      const os = tx.objectStore(store);
      for (const r of await os.getAll()) {
        if (r.deletedAt) await os.delete(r.id);
        else await os.put({ ...r, bandId: undefined, serverAt: undefined, updatedBy: undefined, dirty: 1 } as never);
      }
    }
    const meta = tx.objectStore('meta');
    await meta.delete('bandId');
    for (const store of DATA_STORES) await meta.delete(`cursor:${store}`);
    await tx.done;
    this.band = undefined;
    this.changed(false);
  }

  /**
   * Keeps this version of a song as a new song, "Title (conflicto)": used
   * when someone else changed the same song first. Returns the new title.
   */
  async addConflictCopy(song: SongRecord): Promise<string> {
    const title = `${song.title} (conflicto)`;
    const re = /^\{\s*(title|t)\s*:[^}]*\}/m;
    const content = re.test(song.content)
      ? song.content.replace(re, `{title: ${title}}`)
      : `{title: ${title}}\n${song.content}`;
    await this.saveSong(content);
    return title;
  }

  /** Old numeric song id → new id, after upgrading from version 1. Read once. */
  async takeUpgradedSongIds(): Promise<Record<string, string> | undefined> {
    const map = await this.getMeta<Record<string, string>>('v1SongIds');
    if (map) await this.db.delete('meta', 'v1SongIds');
    return map;
  }
}

// ------------------------------------------------- upgrade from version 1

interface V1 {
  songs: (Omit<SongRecord, keyof Synced> & { id: number })[];
  setlists: (Omit<Setlist, keyof Synced> & { id: number })[];
  items: { id: number; setlistId: number; songId: number; position: number; transpose: number }[];
}

type UpgradeTx = IDBPTransaction<Schema, ('songs' | 'setlists' | 'setlistItems' | 'meta')[], 'versionchange'>;

async function readV1(tx: UpgradeTx): Promise<V1> {
  const store = (name: DataStore) => (tx.objectStore as (n: string) => { getAll(): Promise<unknown[]> })(name);
  return {
    songs: (await store('songs').getAll()) as V1['songs'],
    setlists: (await store('setlists').getAll()) as V1['setlists'],
    items: (await store('setlistItems').getAll()) as V1['items'],
  };
}

/** Same data with UUIDs. Everything starts as only on this device. */
async function writeV1(tx: UpgradeTx, old: V1): Promise<void> {
  const songIds = new Map(old.songs.map((s) => [s.id, uuid()]));
  const setlistIds = new Map(old.setlists.map((s) => [s.id, uuid()]));
  const base = { dirty: 1 as const, rev: 1 };
  for (const s of old.songs) await tx.objectStore('songs').put({ ...s, ...base, id: songIds.get(s.id)! });
  for (const s of old.setlists) await tx.objectStore('setlists').put({ ...s, ...base, id: setlistIds.get(s.id)! });
  for (const i of old.items) {
    const songId = songIds.get(i.songId);
    const setlistId = setlistIds.get(i.setlistId);
    if (!songId || !setlistId) continue;
    await tx.objectStore('setlistItems').put({ ...i, ...base, id: uuid(), songId, setlistId });
  }
  await tx.objectStore('meta').put(
    Object.fromEntries([...songIds].map(([k, v]) => [String(k), v])),
    'v1SongIds',
  );
}

import { type DBSchema, type IDBPDatabase, openDB } from 'idb';
import { parseChordPro } from '../chordpro/parser';
import { artistOf } from '../chordpro/song';
import { sampleSong } from './sample';

/** A song. `content` is the ChordPro source; title, artist and key are copied out on save. */
export interface SongRecord {
  id: number;
  title: string;
  artist?: string;
  songKey?: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface Setlist {
  id: number;
  name: string;
  createdAt: number;
}

/** A song inside a setlist. `transpose` is the shift used in this setlist only. */
export interface SetlistItem {
  id: number;
  setlistId: number;
  songId: number;
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

/** Backup file format. */
export interface LibraryExport {
  format: 'cancionero';
  version: 1;
  songs: SongRecord[];
  setlists: Setlist[];
  setlistItems: SetlistItem[];
}

interface Schema extends DBSchema {
  songs: { key: number; value: SongRecord };
  setlists: { key: number; value: Setlist };
  setlistItems: {
    key: number;
    value: SetlistItem;
    indexes: { bySetlist: number; bySong: number };
  };
}

/** Lowercase without accents, for search. */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

const byTitle = (a: SongRecord, b: SongRecord) =>
  a.title.localeCompare(b.title, 'es', { sensitivity: 'base' });

/**
 * Songs and setlists stored in the browser (IndexedDB).
 *
 * Data lives only in this browser: use {@link exportAll} / {@link importAll}
 * for backups or to move to another device.
 */
export class Library {
  private listeners = new Set<() => void>();

  private constructor(private db: IDBPDatabase<Schema>) {}

  static async open(name = 'cancionero'): Promise<Library> {
    const db = await openDB<Schema>(name, 1, {
      upgrade(db) {
        db.createObjectStore('songs', { keyPath: 'id', autoIncrement: true });
        db.createObjectStore('setlists', { keyPath: 'id', autoIncrement: true });
        const items = db.createObjectStore('setlistItems', { keyPath: 'id', autoIncrement: true });
        items.createIndex('bySetlist', 'setlistId');
        items.createIndex('bySong', 'songId');
      },
    });
    return new Library(db);
  }

  close() {
    this.db.close();
  }

  /** Called after every write. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private changed() {
    this.listeners.forEach((l) => l());
  }

  // ---------------------------------------------------------------- songs

  /** Library sorted by title. `query` matches title or artist, ignoring case and accents. */
  async listSongs(query = ''): Promise<SongRecord[]> {
    const songs = await this.db.getAll('songs');
    const q = fold(query.trim());
    const filtered = q
      ? songs.filter((s) => fold(s.title).includes(q) || fold(s.artist ?? '').includes(q))
      : songs;
    return filtered.sort(byTitle);
  }

  getSong(id: number): Promise<SongRecord | undefined> {
    return this.db.get('songs', id);
  }

  /** Inserts (no `id`) or updates a song from its ChordPro text. Returns the id. */
  async saveSong(content: string, id?: number): Promise<number> {
    const meta = parseChordPro(content).metadata;
    const now = Date.now();
    const fields = {
      title: meta.title?.trim() || 'Sin título',
      artist: artistOf(meta),
      songKey: meta.key,
      content,
      updatedAt: now,
    };
    let result: number;
    if (id === undefined) {
      result = await this.db.add('songs', { ...fields, createdAt: now } as SongRecord);
    } else {
      const old = await this.db.get('songs', id);
      if (!old) throw new Error(`No song ${id}`);
      await this.db.put('songs', { ...old, ...fields });
      result = id;
    }
    this.changed();
    return result;
  }

  /** Also removes the song from every setlist. */
  async deleteSong(id: number): Promise<void> {
    const tx = this.db.transaction(['songs', 'setlistItems'], 'readwrite');
    const items = tx.objectStore('setlistItems');
    for (const key of await items.index('bySong').getAllKeys(id)) {
      await items.delete(key);
    }
    await tx.objectStore('songs').delete(id);
    await tx.done;
    this.changed();
  }

  /** Adds a demo song the first time the app runs. */
  async seedIfEmpty(): Promise<void> {
    if ((await this.db.count('songs')) === 0) await this.saveSong(sampleSong);
  }

  // ------------------------------------------------------------- setlists

  async listSetlists(): Promise<SetlistSummary[]> {
    const [setlists, items] = await Promise.all([this.db.getAll('setlists'), this.db.getAll('setlistItems')]);
    const counts = new Map<number, number>();
    for (const i of items) counts.set(i.setlistId, (counts.get(i.setlistId) ?? 0) + 1);
    return setlists
      .sort((a, b) => b.createdAt - a.createdAt || b.id - a.id)
      .map((setlist) => ({ setlist, songCount: counts.get(setlist.id) ?? 0 }));
  }

  getSetlist(id: number): Promise<Setlist | undefined> {
    return this.db.get('setlists', id);
  }

  async createSetlist(name: string): Promise<number> {
    const id = await this.db.add('setlists', { name, createdAt: Date.now() } as Setlist);
    this.changed();
    return id;
  }

  async renameSetlist(id: number, name: string): Promise<void> {
    const s = await this.db.get('setlists', id);
    if (!s) return;
    await this.db.put('setlists', { ...s, name });
    this.changed();
  }

  /** Also removes its items. Songs stay in the library. */
  async deleteSetlist(id: number): Promise<void> {
    const tx = this.db.transaction(['setlists', 'setlistItems'], 'readwrite');
    const items = tx.objectStore('setlistItems');
    for (const key of await items.index('bySetlist').getAllKeys(id)) {
      await items.delete(key);
    }
    await tx.objectStore('setlists').delete(id);
    await tx.done;
    this.changed();
  }

  private async items(setlistId: number): Promise<SetlistItem[]> {
    const items = await this.db.getAllFromIndex('setlistItems', 'bySetlist', setlistId);
    return items.sort((a, b) => a.position - b.position);
  }

  /** Items in order, each with its song. */
  async getSetlistEntries(setlistId: number): Promise<SetlistEntry[]> {
    const entries: SetlistEntry[] = [];
    for (const item of await this.items(setlistId)) {
      const song = await this.db.get('songs', item.songId);
      if (song) entries.push({ item, song });
    }
    return entries;
  }

  /** Appends a song at the end. The same song may appear more than once. */
  async addSongToSetlist(setlistId: number, songId: number, transpose = 0): Promise<number> {
    const items = await this.items(setlistId);
    const position = items.length ? items[items.length - 1].position + 1 : 0;
    const id = await this.db.add('setlistItems', { setlistId, songId, position, transpose } as SetlistItem);
    this.changed();
    return id;
  }

  async removeSetlistItem(itemId: number): Promise<void> {
    const item = await this.db.get('setlistItems', itemId);
    if (!item) return;
    await this.db.delete('setlistItems', itemId);
    await this.writePositions((await this.items(item.setlistId)));
    this.changed();
  }

  /** Moves the item at index `from` to index `to` (0-based). */
  async moveSetlistItem(setlistId: number, from: number, to: number): Promise<void> {
    const items = await this.items(setlistId);
    if (from < 0 || from >= items.length) return;
    const [moved] = items.splice(from, 1);
    items.splice(Math.max(0, Math.min(to, items.length)), 0, moved);
    await this.writePositions(items);
    this.changed();
  }

  async setItemTranspose(itemId: number, transpose: number): Promise<void> {
    const item = await this.db.get('setlistItems', itemId);
    if (!item) return;
    await this.db.put('setlistItems', { ...item, transpose });
    this.changed();
  }

  private async writePositions(items: SetlistItem[]): Promise<void> {
    const tx = this.db.transaction('setlistItems', 'readwrite');
    await Promise.all(
      items.map((item, position) => (item.position === position ? null : tx.store.put({ ...item, position }))),
    );
    await tx.done;
  }

  // --------------------------------------------------------------- backup

  async exportAll(): Promise<LibraryExport> {
    const [songs, setlists, setlistItems] = await Promise.all([
      this.db.getAll('songs'),
      this.db.getAll('setlists'),
      this.db.getAll('setlistItems'),
    ]);
    return { format: 'cancionero', version: 1, songs, setlists, setlistItems };
  }

  /** Replaces everything with the contents of a backup. */
  async importAll(data: LibraryExport): Promise<void> {
    if (data?.format !== 'cancionero' || data.version !== 1) {
      throw new Error('El archivo no es un respaldo de Cancionero.');
    }
    const tx = this.db.transaction(['songs', 'setlists', 'setlistItems'], 'readwrite');
    await Promise.all([
      tx.objectStore('songs').clear(),
      tx.objectStore('setlists').clear(),
      tx.objectStore('setlistItems').clear(),
    ]);
    await Promise.all([
      ...data.songs.map((s) => tx.objectStore('songs').put(s)),
      ...data.setlists.map((s) => tx.objectStore('setlists').put(s)),
      ...data.setlistItems.map((i) => tx.objectStore('setlistItems').put(i)),
    ]);
    await tx.done;
    this.changed();
  }
}

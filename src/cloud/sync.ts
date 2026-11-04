import { DATA_STORES, type DataStore, type Library, type SongRecord, type StoredRecord } from '../data/library';
import { type Cursor, type Remote, RemoteError, ZERO_ID } from './remote';
import { TABLE_OF, sameData, toRecord, toUpload } from './rows';

export interface SyncStatus {
  /** `offline`: no connection, changes wait on this device. */
  state: 'idle' | 'syncing' | 'offline' | 'error';
  /** Changes waiting to be uploaded. */
  pending: number;
  lastSync?: number;
  error?: string;
  /** Things the user should know (conflicts, refused changes). Newest last. */
  notices: string[];
}

interface Options {
  /** Wait after a local change before uploading, so quick edits go together. */
  debounceMs: number;
  /** Check for changes this often even without a realtime notice. */
  intervalMs: number;
  online: () => boolean;
}

const PAGE = 500;
/** Downloads start a bit before the last one ended: writes that committed late aren't missed. */
const OVERLAP_MS = 60_000;
const MAX_NOTICES = 5;

/**
 * Keeps the library in step with the band's copy on the server.
 *
 * Upload first, then download. Conflicts (someone changed the same thing
 * first): for songs, the server's version stays and ours is kept as a new
 * song "Title (conflicto)", so no text is lost. For setlists and their songs,
 * the last change wins.
 */
export class Sync {
  private status: SyncStatus = { state: 'idle', pending: 0, notices: [] };
  private listeners = new Set<(s: SyncStatus) => void>();
  private running: Promise<void> | null = null;
  private again = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stops: (() => void)[] = [];
  private opts: Options;

  constructor(
    private lib: Library,
    private remote: Remote,
    private bandId: string,
    opts: Partial<Options> = {},
  ) {
    this.opts = { debounceMs: 1500, intervalMs: 60_000, online: () => navigator.onLine, ...opts };
  }

  /** Starts syncing now and whenever something changes. */
  start() {
    this.stops.push(
      this.lib.subscribe((c) => {
        if (!c.local) return;
        void this.refreshPending();
        this.schedule();
      }),
    );
    const now = () => this.schedule(0);
    const visible = () => document.visibilityState === 'visible' && now();
    window.addEventListener('online', now);
    document.addEventListener('visibilitychange', visible);
    const interval = setInterval(now, this.opts.intervalMs);
    this.stops.push(
      () => window.removeEventListener('online', now),
      () => document.removeEventListener('visibilitychange', visible),
      () => clearInterval(interval),
      this.remote.watch(this.bandId, () => this.schedule(300)),
    );
    void this.refreshPending();
    now();
  }

  stop() {
    clearTimeout(this.timer);
    this.stops.forEach((s) => s());
    this.stops = [];
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  subscribe(listener: (s: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  clearNotices() {
    this.set({ notices: [] });
  }

  schedule(ms = this.opts.debounceMs) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.run(), ms);
  }

  /** One full sync. If called while running, runs once more afterwards. */
  run(): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      do {
        this.again = false;
        await this.once();
      } while (this.again);
    })().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private set(p: Partial<SyncStatus>) {
    this.status = { ...this.status, ...p };
    this.listeners.forEach((l) => l(this.status));
  }

  private note(message: string) {
    this.set({ notices: [...this.status.notices, message].slice(-MAX_NOTICES) });
  }

  private async refreshPending() {
    this.set({ pending: await this.lib.pendingCount() });
  }

  private async once() {
    if (!this.opts.online()) {
      this.set({ state: 'offline' });
      return this.refreshPending();
    }
    this.set({ state: 'syncing' });
    try {
      // A conflict copy is a new change: upload it in the same sync.
      for (let pass = 0; pass < 3 && (await this.push()); pass++);
      await this.pull();
      this.set({ state: 'idle', lastSync: Date.now(), error: undefined });
    } catch (e) {
      if (e instanceof RemoteError && e.network) this.set({ state: 'offline' });
      else this.set({ state: 'error', error: e instanceof Error ? e.message : String(e) });
    }
    await this.refreshPending();
  }

  // ---------------------------------------------------------------- upload

  /** Uploads every pending change. True if it made new ones (conflict copies). */
  private async push(): Promise<boolean> {
    let more = false;
    // Songs and setlists before their items: the server checks they exist.
    for (const store of DATA_STORES) {
      for (const rec of await this.lib.dirtyRecords(store)) {
        if (rec.bandId !== this.bandId) continue;
        if (await this.pushOne(store, rec)) more = true;
      }
    }
    return more;
  }

  private async pushOne<S extends DataStore>(store: S, rec: StoredRecord<S>): Promise<boolean> {
    const table = TABLE_OF[store];
    try {
      let saved;
      if (!rec.serverAt) {
        try {
          saved = await this.remote.insert(table, toUpload(store, rec));
        } catch (e) {
          // Already there: an earlier upload worked but its answer got lost.
          if (!(e instanceof RemoteError && e.code === '23505')) throw e;
          saved = null;
        }
      } else {
        saved = await this.remote.update(table, toUpload(store, rec), rec.serverAt);
      }
      if (saved) {
        await this.lib.markUploaded(store, rec.id, rec.rev, toRecord(store, saved));
        return false;
      }
      return await this.resolve(store, rec);
    } catch (e) {
      if (!(e instanceof RemoteError) || e.network) throw e;
      if (e.code === '42501') {
        // Not allowed (e.g. only the owner deletes songs): back to the server's version.
        await this.takeServer(store, rec);
        this.note(`${describe(store, rec)}: ${e.message}.`);
      } else {
        // Stays pending; tried again next time.
        this.note(`${describe(store, rec)} no se pudo subir: ${e.message}`);
      }
      return false;
    }
  }

  /** The server changed first. */
  private async resolve<S extends DataStore>(store: S, rec: StoredRecord<S>): Promise<boolean> {
    const table = TABLE_OF[store];
    const row = await this.remote.fetch(table, rec.id);
    if (!row) return false; // Not visible anymore (out of the band): stays here.
    const theirs = toRecord(store, row);
    if (sameData(store, rec, theirs)) {
      await this.lib.markUploaded(store, rec.id, rec.rev, theirs);
      return false;
    }
    if (store === 'songs') {
      const song = rec as SongRecord;
      await this.lib.applyRemote(store, [theirs], true);
      if (song.deletedAt) {
        this.note(`«${song.title}» cambió en otro dispositivo, así que no se borró.`);
        return false;
      }
      const copy = await this.lib.addConflictCopy(song);
      this.note(`«${song.title}» cambió en otro dispositivo. Tu versión quedó como «${copy}».`);
      return true;
    }
    // Setlists and their items: this change is the last one, so it wins.
    const saved = await this.remote.update(table, toUpload(store, rec), theirs.serverAt!);
    if (saved) await this.lib.markUploaded(store, rec.id, rec.rev, toRecord(store, saved));
    return false;
  }

  private async takeServer<S extends DataStore>(store: S, rec: StoredRecord<S>) {
    const row = await this.remote.fetch(TABLE_OF[store], rec.id);
    if (row) await this.lib.applyRemote(store, [toRecord(store, row)], true);
  }

  // -------------------------------------------------------------- download

  private async pull() {
    for (const store of DATA_STORES) {
      const key = `cursor:${store}`;
      const saved = await this.lib.getMeta<Cursor>(key);
      let after: Cursor | null = saved
        ? { at: new Date(Date.parse(saved.at) - OVERLAP_MS).toISOString(), id: ZERO_ID }
        : null;
      let newest = saved;
      for (;;) {
        const rows = await this.remote.pull(TABLE_OF[store], this.bandId, after, PAGE);
        await this.lib.applyRemote(
          store,
          rows.map((r) => toRecord(store, r)),
        );
        const tail = rows.at(-1);
        if (tail) {
          after = { at: tail.updated_at, id: tail.id };
          if (!newest || Date.parse(tail.updated_at) > Date.parse(newest.at)) newest = after;
        }
        if (rows.length < PAGE) break;
      }
      if (newest) await this.lib.setMeta(key, newest);
    }
  }
}

function describe(store: DataStore, rec: StoredRecord<DataStore>): string {
  if (store === 'songs') return `«${(rec as SongRecord).title}»`;
  if (store === 'setlists') return `El setlist «${(rec as { name: string }).name}»`;
  return 'Un cambio en un setlist';
}

import { Library } from '../data/library';
import { type Cursor, type Remote, RemoteError } from './remote';
import type { Row, Table, Upload } from './rows';
import { Sync } from './sync';

const BAND = 'band-1';

/** The server in memory: the same rules as the migrations (server time, base check). */
class FakeServer {
  tables: Record<Table, Map<string, Row>> = { songs: new Map(), setlists: new Map(), setlist_items: new Map() };
  private clock = Date.parse('2026-11-04T12:00:00Z');
  offline = false;
  /** Simulates the owner-only rule for deleting songs. */
  owners = new Set<string>();
  /** Several writes in one transaction share the time. */
  frozen = false;

  private now() {
    if (!this.frozen) this.clock += 1000;
    return new Date(this.clock).toISOString();
  }

  private check() {
    if (this.offline) throw new RemoteError('Failed to fetch', '', true);
  }

  remote(user: string): Remote {
    const write = (table: Table, row: Upload, old: Row | undefined): Row => {
      if (table === 'songs' && (row.deleted_at ?? null) !== (old?.deleted_at ?? null) && !this.owners.has(user)) {
        throw new RemoteError('Solo el owner puede borrar o restaurar canciones', '42501', false);
      }
      const at = this.now();
      const saved = { ...row, created_at: old?.created_at ?? at, updated_at: at, updated_by: user } as Row;
      this.tables[table].set(row.id, saved);
      return { ...saved };
    };
    return {
      pull: async (table, bandId, after: Cursor | null, limit) => {
        this.check();
        return [...this.tables[table].values()]
          .filter((r) => r.band_id === bandId)
          .filter((r) => !after || r.updated_at > after.at || (r.updated_at === after.at && r.id > after.id))
          .sort((a, b) => (a.updated_at === b.updated_at ? (a.id < b.id ? -1 : 1) : a.updated_at < b.updated_at ? -1 : 1))
          .slice(0, limit)
          .map((r) => ({ ...r }));
      },
      insert: async (table, row) => {
        this.check();
        if (this.tables[table].has(row.id)) throw new RemoteError('duplicate key', '23505', false);
        const of = (row as { arrangement_of?: string | null }).arrangement_of;
        if (of && !this.tables.songs.has(of)) throw new RemoteError('violates foreign key', '23503', false);
        return write(table, row, undefined);
      },
      update: async (table, row, base) => {
        this.check();
        const old = this.tables[table].get(row.id);
        if (!old || old.updated_at !== base) return null;
        return write(table, row, old);
      },
      fetch: async (table, id) => {
        this.check();
        const r = this.tables[table].get(id);
        return r ? { ...r } : null;
      },
      watch: () => () => {},
    };
  }

  /** Someone else's write, straight on the server. */
  async edit(table: Table, id: string, change: Partial<Row>) {
    const old = this.tables[table].get(id)!;
    this.tables[table].set(id, { ...old, ...change, updated_at: this.now(), updated_by: 'otro' } as Row);
  }
}

let n = 0;
let server: FakeServer;
const devices: { lib: Library; sync: Sync }[] = [];

async function device(user = 'u1') {
  const lib = await Library.open(`sync-${n++}`);
  await lib.linkBand(BAND, true);
  const sync = new Sync(lib, server.remote(user), BAND, { online: () => !server.offline });
  devices.push({ lib, sync });
  return { lib, sync };
}

beforeEach(() => {
  server = new FakeServer();
});
afterEach(() => {
  for (const d of devices.splice(0)) {
    d.sync.stop();
    d.lib.close();
  }
});

const song = (title: string, body = '[C]la') => `{title: ${title}}\n${body}`;

it('uploads a song and another device downloads it', async () => {
  const a = await device();
  const b = await device('u2');
  const id = await a.lib.saveSong(song('Faro'));
  await a.sync.run();
  expect(a.sync.getStatus()).toMatchObject({ state: 'idle', pending: 0 });
  expect(server.tables.songs.get(id)).toMatchObject({ title: 'Faro', band_id: BAND });

  await b.sync.run();
  expect(await b.lib.getSong(id)).toMatchObject({ title: 'Faro', dirty: 0, updatedBy: 'u1' });
});

it('setlists with their order and tone travel too', async () => {
  const a = await device();
  const b = await device('u2');
  const s1 = await a.lib.saveSong(song('Uno'));
  const s2 = await a.lib.saveSong(song('Dos'));
  const setlist = await a.lib.createSetlist('Peña');
  await a.lib.addSongToSetlist(setlist, s1);
  await a.lib.addSongToSetlist(setlist, s2, 2);
  await a.lib.moveSetlistItem(setlist, 1, 0);
  await a.sync.run();
  await b.sync.run();
  const entries = await b.lib.getSetlistEntries(setlist);
  expect(entries.map((e) => [e.song.title, e.item.transpose])).toEqual([
    ['Dos', 2],
    ['Uno', 0],
  ]);
});

it('arrangements go up after their original, in the same sync, and arrive linked', async () => {
  const a = await device();
  const b = await device('u2');
  // Several, so the order on this device (by id) can't be right by chance.
  for (const t of ['Uno', 'Dos', 'Tres']) {
    const original = await a.lib.saveSong(song(t));
    await a.lib.createArrangement(original, 'Acústica');
  }
  await a.sync.run();
  expect(a.sync.getStatus()).toMatchObject({ pending: 0, notices: [] });
  await b.sync.run();
  const groups = [...(await b.lib.arrangementGroups()).values()];
  expect(groups.map((g) => g.map((s) => s.arrangementName ?? s.title)).sort()).toEqual([
    ['Dos', 'Acústica'],
    ['Tres', 'Acústica'],
    ['Uno', 'Acústica'],
  ]);
});

it('without connection, changes wait and go up later', async () => {
  const a = await device();
  server.offline = true;
  const id = await a.lib.saveSong(song('Faro'));
  await a.sync.run();
  expect(a.sync.getStatus()).toMatchObject({ state: 'offline', pending: 1 });
  server.offline = false;
  await a.sync.run();
  expect(a.sync.getStatus()).toMatchObject({ state: 'idle', pending: 0 });
  expect(server.tables.songs.has(id)).toBe(true);
});

it('a song edited on two devices keeps both versions', async () => {
  const a = await device();
  const b = await device('u2');
  const id = await a.lib.saveSong(song('Faro'));
  await a.sync.run();
  await b.sync.run();

  await a.lib.saveSong(song('Faro', '[G]versión de A'), id);
  await b.lib.saveSong(song('Faro', '[D]versión de B'), id);
  await a.sync.run();
  await b.sync.run();

  // B: the song is A's version, and B's is a new song.
  expect((await b.lib.getSong(id))!.content).toContain('versión de A');
  const copy = (await b.lib.listSongs()).find((s) => s.title === 'Faro (conflicto)')!;
  expect(copy.content).toContain('versión de B');
  expect(server.tables.songs.has(copy.id)).toBe(true);
  expect(b.sync.getStatus().notices.at(-1)).toMatch(/quedó como «Faro \(conflicto\)»/);

  await a.sync.run();
  expect((await a.lib.listSongs()).map((s) => s.title)).toEqual(['Faro', 'Faro (conflicto)']);
});

it('the same change on both sides is not a conflict', async () => {
  const a = await device();
  const b = await device('u2');
  const id = await a.lib.saveSong(song('Faro'));
  await a.sync.run();
  await b.sync.run();
  await a.lib.saveSong(song('Faro 2'), id);
  await b.lib.saveSong(song('Faro 2'), id);
  await a.sync.run();
  await b.sync.run();
  expect((await b.lib.listSongs()).map((s) => s.title)).toEqual(['Faro 2']);
  expect(b.sync.getStatus().pending).toBe(0);
});

it('in a setlist the last change wins', async () => {
  const a = await device();
  const b = await device('u2');
  const s1 = await a.lib.saveSong(song('Uno'));
  const setlist = await a.lib.createSetlist('Peña');
  const item = await a.lib.addSongToSetlist(setlist, s1);
  await a.sync.run();
  await b.sync.run();
  await a.lib.setItemTranspose(item, 2);
  await b.lib.setItemTranspose(item, -1);
  await a.sync.run();
  await b.sync.run();
  await a.sync.run();
  expect(server.tables.setlist_items.get(item)).toMatchObject({ transpose: -1 });
  expect((await a.lib.getSetlistEntries(setlist))[0].item.transpose).toBe(-1);
});

it('a member who deletes a song offline gets it back, with a notice', async () => {
  const a = await device('member');
  const id = await a.lib.saveSong(song('Faro'));
  await a.sync.run();
  await a.lib.deleteSong(id);
  await a.sync.run();
  expect(await a.lib.getSong(id)).toBeDefined();
  expect(a.sync.getStatus().notices.at(-1)).toMatch(/Solo el owner/);
  expect(a.sync.getStatus().pending).toBe(0);
});

it('the owner deletes and restores, and other devices follow', async () => {
  server.owners.add('owner');
  const a = await device('owner');
  const b = await device('u2');
  const id = await a.lib.saveSong(song('Faro'));
  await a.sync.run();
  await b.sync.run();
  await a.lib.deleteSong(id);
  await a.sync.run();
  await b.sync.run();
  expect(await b.lib.getSong(id)).toBeUndefined();
  await a.lib.restoreSong(id);
  await a.sync.run();
  await b.sync.run();
  expect(await b.lib.getSong(id)).toBeDefined();
});

it('an upload whose answer got lost is not uploaded twice', async () => {
  const a = await device();
  const id = await a.lib.saveSong(song('Faro'));
  // The insert reached the server, but the device never heard back.
  const rec = (await a.lib.getRecord('songs', id))!;
  await server.remote('u1').insert('songs', {
    id,
    band_id: BAND,
    title: rec.title,
    artist: null,
    song_key: null,
    content: rec.content,
    deleted_at: null,
  });
  await a.sync.run();
  expect(a.sync.getStatus()).toMatchObject({ pending: 0, notices: [] });
  expect((await a.lib.listSongs()).map((s) => s.title)).toEqual(['Faro']);
});

it('downloads everything even when many rows share the same time', async () => {
  const a = await device();
  const b = await device('u2');
  server.frozen = true;
  for (let i = 0; i < 1203; i++) await a.lib.saveSong(song(`S${String(i).padStart(4, '0')}`));
  await a.sync.run();
  server.frozen = false;
  await b.sync.run();
  expect(await b.lib.listSongs()).toHaveLength(1203);
}, 60_000);

it('changes made by others reach this device on the next sync', async () => {
  const a = await device();
  const id = await a.lib.saveSong(song('Faro'));
  await a.sync.run();
  await server.edit('songs', id, { title: 'Faro (en vivo)', content: song('Faro (en vivo)') });
  await a.sync.run();
  expect((await a.lib.getSong(id))!.title).toBe('Faro (en vivo)');
});

import { Library, fold } from './library';

let n = 0;
let lib: Library;

beforeEach(async () => {
  lib = await Library.open(`test-${n++}`);
});
afterEach(() => lib.close());

const song1 = '{title: Zamba}\n{artist: Ána}\n{key: Am}\n[Am]la';
const song2 = '{title: alfajor}\n{artist: Beto}\n[C]lo';

describe('songs', () => {
  it('saveSong copies title, artist and key from ChordPro', async () => {
    const id = await lib.saveSong(song1);
    expect(await lib.getSong(id)).toMatchObject({ title: 'Zamba', artist: 'Ána', songKey: 'Am', content: song1 });
  });

  it('song without title gets a placeholder', async () => {
    const id = await lib.saveSong('[C]sin título');
    expect((await lib.getSong(id))!.title).toBe('Sin título');
  });

  it('update keeps id and createdAt', async () => {
    const id = await lib.saveSong(song1);
    const before = (await lib.getSong(id))!;
    await lib.saveSong('{title: Zamba 2}', id);
    const after = (await lib.getSong(id))!;
    expect(after.title).toBe('Zamba 2');
    expect(after.createdAt).toBe(before.createdAt);
    expect(after.artist).toBeUndefined();
  });

  it('sorted ignoring case; search ignores case and accents', async () => {
    await lib.saveSong(song1);
    await lib.saveSong(song2);
    expect((await lib.listSongs()).map((s) => s.title)).toEqual(['alfajor', 'Zamba']);
    expect((await lib.listSongs('ana')).map((s) => s.title)).toEqual(['Zamba']);
    expect((await lib.listSongs('ALFA')).map((s) => s.title)).toEqual(['alfajor']);
  });

  it('seedIfEmpty seeds once', async () => {
    await lib.seedIfEmpty();
    await lib.seedIfEmpty();
    expect(await lib.listSongs()).toHaveLength(1);
  });

  it('notifies subscribers on writes', async () => {
    const spy = vi.fn();
    const off = lib.subscribe(spy);
    await lib.saveSong(song1);
    off();
    await lib.saveSong(song2);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('fold', () => {
    expect(fold('Canción ÁRBOL')).toBe('cancion arbol');
  });
});

describe('setlists', () => {
  let setlist: string;
  let b: string;

  beforeEach(async () => {
    setlist = await lib.createSetlist('Sábado');
    const a = await lib.saveSong('{title: A}');
    b = await lib.saveSong('{title: B}');
    const c = await lib.saveSong('{title: C}');
    await lib.addSongToSetlist(setlist, a);
    await lib.addSongToSetlist(setlist, b, 2);
    await lib.addSongToSetlist(setlist, c);
  });

  const titles = async () => (await lib.getSetlistEntries(setlist)).map((e) => e.song.title);

  it('entries in order with their transpose', async () => {
    const entries = await lib.getSetlistEntries(setlist);
    expect(entries.map((e) => e.song.title)).toEqual(['A', 'B', 'C']);
    expect(entries.map((e) => e.item.position)).toEqual([0, 1, 2]);
    expect(entries[1].item.transpose).toBe(2);
  });

  it('summary counts songs', async () => {
    await lib.createSetlist('Vacía');
    const byName = Object.fromEntries((await lib.listSetlists()).map((s) => [s.setlist.name, s.songCount]));
    expect(byName).toEqual({ Sábado: 3, Vacía: 0 });
  });

  it('move down and up', async () => {
    await lib.moveSetlistItem(setlist, 0, 2);
    expect(await titles()).toEqual(['B', 'C', 'A']);
    await lib.moveSetlistItem(setlist, 2, 0);
    expect(await titles()).toEqual(['A', 'B', 'C']);
  });

  it('remove keeps the others in order without touching them', async () => {
    const entries = await lib.getSetlistEntries(setlist);
    await lib.removeSetlistItem(entries[1].item.id);
    const after = await lib.getSetlistEntries(setlist);
    expect(after.map((e) => e.song.title)).toEqual(['A', 'C']);
    expect(after.map((e) => e.item.rev)).toEqual([1, 1]);
  });

  it('putting back a removed song (Deshacer) returns it to its place', async () => {
    const entries = await lib.getSetlistEntries(setlist);
    const item = entries[1].item;
    await lib.removeSetlistItem(item.id);
    await lib.putBackSetlistItem(item);
    expect((await lib.getSetlistEntries(setlist)).map((e) => e.song.title)).toEqual(['A', 'B', 'C']);
  });

  it('putting back an uploaded item undeletes it and keeps its sync data', async () => {
    const item = (await lib.getSetlistEntries(setlist))[0].item;
    await lib.markUploaded('setlistItems', item.id, item.rev, { ...item, serverAt: 'x' });
    await lib.removeSetlistItem(item.id);
    await lib.putBackSetlistItem(item);
    const back = await lib.getRecord('setlistItems', item.id);
    expect(back).toMatchObject({ serverAt: 'x', dirty: 1, deletedAt: undefined });
    expect((await lib.getSetlistEntries(setlist)).map((e) => e.song.title)).toEqual(['A', 'B', 'C']);
  });

  it('moving changes only the moved item', async () => {
    await lib.moveSetlistItem(setlist, 2, 1);
    const after = await lib.getSetlistEntries(setlist);
    expect(after.map((e) => e.song.title)).toEqual(['A', 'C', 'B']);
    expect(after.map((e) => e.item.rev)).toEqual([1, 2, 1]);
  });

  it('many moves between the same two songs still keep the order', async () => {
    for (let i = 0; i < 60; i++) await lib.moveSetlistItem(setlist, 2, 1);
    expect(await titles()).toEqual(['A', 'B', 'C']);
  });

  it('setItemTranspose', async () => {
    const first = (await lib.getSetlistEntries(setlist))[0];
    await lib.setItemTranspose(first.item.id, -3);
    expect((await lib.getSetlistEntries(setlist))[0].item.transpose).toBe(-3);
  });

  it('deleting a song removes it from setlists', async () => {
    await lib.deleteSong(b);
    expect(await titles()).toEqual(['A', 'C']);
  });

  it('deleting a setlist keeps the songs', async () => {
    await lib.deleteSetlist(setlist);
    expect(await lib.listSetlists()).toEqual([]);
    expect(await lib.listSongs()).toHaveLength(3);
  });

  it('export and import round-trip', async () => {
    const backup = await lib.exportAll();
    await lib.deleteSetlist(setlist);
    await lib.importAll(JSON.parse(JSON.stringify(backup)));
    const [imported] = await lib.listSetlists();
    expect(imported.setlist.name).toBe('Sábado');
    const entries = await lib.getSetlistEntries(imported.setlist.id);
    expect(entries.map((e) => [e.song.title, e.item.transpose])).toEqual([
      ['A', 0],
      ['B', 2],
      ['C', 0],
    ]);
    await expect(lib.importAll({} as never)).rejects.toThrow('respaldo');
  });

  it('imports a version 1 backup (numeric ids shared between tables)', async () => {
    await lib.importAll({
      format: 'cancionero',
      version: 1,
      songs: [
        { id: 1, title: 'Uno', content: '{title: Uno}', createdAt: 1, updatedAt: 1 },
        { id: 2, title: 'Dos', content: '{title: Dos}', createdAt: 1, updatedAt: 1 },
      ],
      setlists: [{ id: 1, name: 'Show', createdAt: 1 }],
      setlistItems: [
        { id: 1, setlistId: 1, songId: 2, position: 0, transpose: 0 },
        { id: 2, setlistId: 1, songId: 1, position: 1, transpose: 0 },
      ],
    } as never);
    const [show] = await lib.listSetlists();
    expect((await lib.getSetlistEntries(show.setlist.id)).map((e) => e.song.title)).toEqual(['Dos', 'Uno']);
  });
});

describe('sync bookkeeping', () => {
  const uploaded = async (id: string) => {
    const r = (await lib.getRecord('songs', id))!;
    await lib.markUploaded('songs', id, r.rev, { ...r, serverAt: '2026-01-01T00:00:00Z' });
  };

  it('every change is pending until uploaded', async () => {
    const id = await lib.saveSong(song1);
    expect(await lib.pendingCount()).toBe(1);
    await uploaded(id);
    expect(await lib.pendingCount()).toBe(0);
    await lib.saveSong(song2, id);
    expect((await lib.dirtyRecords('songs')).map((s) => s.id)).toEqual([id]);
  });

  it('a change made during the upload stays pending', async () => {
    const id = await lib.saveSong(song1);
    const sent = (await lib.getRecord('songs', id))!;
    await lib.saveSong(song2, id);
    await lib.markUploaded('songs', id, sent.rev, { ...sent, serverAt: 'x' });
    expect(await lib.getRecord('songs', id)).toMatchObject({ dirty: 1, serverAt: 'x', title: 'alfajor' });
  });

  it('uploaded songs are deleted softly and can be restored', async () => {
    const id = await lib.saveSong(song1);
    await uploaded(id);
    await lib.deleteSong(id);
    expect(await lib.getSong(id)).toBeUndefined();
    expect((await lib.listDeletedSongs()).map((s) => s.id)).toEqual([id]);
    await lib.restoreSong(id);
    expect(await lib.getSong(id)).toBeDefined();
  });

  it('a song never uploaded is removed for good', async () => {
    const id = await lib.saveSong(song1);
    await lib.deleteSong(id);
    expect(await lib.getRecord('songs', id)).toBeUndefined();
    expect(await lib.pendingCount()).toBe(0);
  });

  it('a deleted song hides from setlists and comes back when restored', async () => {
    const id = await lib.saveSong(song1);
    await uploaded(id);
    const setlist = await lib.createSetlist('S');
    await lib.addSongToSetlist(setlist, id);
    await lib.deleteSong(id);
    expect(await lib.getSetlistEntries(setlist)).toEqual([]);
    expect((await lib.listSetlists())[0].songCount).toBe(0);
    await lib.restoreSong(id);
    expect(await lib.getSetlistEntries(setlist)).toHaveLength(1);
  });

  it('downloaded changes do not overwrite pending ones, unless forced', async () => {
    const id = await lib.saveSong(song1);
    const r = (await lib.getRecord('songs', id))!;
    await lib.applyRemote('songs', [{ ...r, title: 'del servidor', serverAt: 'y' }]);
    expect((await lib.getSong(id))!.title).toBe('Zamba');
    await lib.applyRemote('songs', [{ ...r, title: 'del servidor', serverAt: 'y' }], true);
    expect(await lib.getSong(id)).toMatchObject({ title: 'del servidor', dirty: 0 });
  });

  it('downloads notify as not local, and only when something changed', async () => {
    const spy = vi.fn();
    lib.subscribe(spy);
    const remote = { id: 'r1', title: 'R', content: 'x', createdAt: 1, updatedAt: 1, serverAt: 'a', dirty: 0, rev: 0 } as const;
    await lib.applyRemote('songs', [remote]);
    expect(spy).toHaveBeenCalledWith({ local: false });
    spy.mockClear();
    await lib.applyRemote('songs', [remote]);
    expect(spy).not.toHaveBeenCalled();
  });

  it('linking uploads what is only here, except the demo song', async () => {
    await lib.seedIfEmpty();
    const id = await lib.saveSong(song1);
    expect(await lib.localOnlyCount()).toEqual({ songs: 1, setlists: 0 });
    await lib.linkBand('band-1', true);
    expect(lib.bandId).toBe('band-1');
    expect((await lib.listSongs()).map((s) => [s.id, s.bandId])).toEqual([[id, 'band-1']]);
    const next = await lib.saveSong(song2);
    expect((await lib.getSong(next))!.bandId).toBe('band-1');
  });

  it('linking without uploading starts empty; unlinking keeps a local copy', async () => {
    await lib.saveSong(song1);
    await lib.linkBand('band-1', false);
    expect(await lib.listSongs()).toEqual([]);
    const id = await lib.saveSong(song2);
    await uploaded(id);
    await lib.unlinkBand();
    expect(lib.bandId).toBeUndefined();
    expect(await lib.getSong(id)).toMatchObject({ bandId: undefined, serverAt: undefined, dirty: 1 });
  });
});

describe('upgrade from version 1', () => {
  it('keeps songs, setlists, order and tone with new ids', async () => {
    const { openDB } = await import('idb');
    const name = `v1-${n++}`;
    const v1 = await openDB(name, 1, {
      upgrade(db) {
        db.createObjectStore('songs', { keyPath: 'id', autoIncrement: true });
        db.createObjectStore('setlists', { keyPath: 'id', autoIncrement: true });
        const items = db.createObjectStore('setlistItems', { keyPath: 'id', autoIncrement: true });
        items.createIndex('bySetlist', 'setlistId');
        items.createIndex('bySong', 'songId');
      },
    });
    await v1.put('songs', { id: 1, title: 'Faro', content: '{title: Faro}', createdAt: 5, updatedAt: 5 });
    await v1.put('songs', { id: 2, title: 'Cusco', content: '{title: Cusco}', createdAt: 5, updatedAt: 5 });
    await v1.put('setlists', { id: 1, name: 'Show', createdAt: 5 });
    await v1.put('setlistItems', { id: 1, setlistId: 1, songId: 2, position: 0, transpose: 3 });
    await v1.put('setlistItems', { id: 2, setlistId: 1, songId: 1, position: 1, transpose: 0 });
    v1.close();

    const up = await Library.open(name);
    const [show] = await up.listSetlists();
    const entries = await up.getSetlistEntries(show.setlist.id);
    expect(entries.map((e) => [e.song.title, e.item.transpose])).toEqual([
      ['Cusco', 3],
      ['Faro', 0],
    ]);
    expect(entries[0].song.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await up.takeUpgradedSongIds()).toEqual({ '1': entries[1].song.id, '2': entries[0].song.id });
    expect(await up.takeUpgradedSongIds()).toBeUndefined();
    up.close();
  });
});

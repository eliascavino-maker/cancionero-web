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
  let setlist: number;
  let b: number;

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

  it('remove renumbers positions', async () => {
    const entries = await lib.getSetlistEntries(setlist);
    await lib.removeSetlistItem(entries[1].item.id);
    const after = await lib.getSetlistEntries(setlist);
    expect(after.map((e) => e.song.title)).toEqual(['A', 'C']);
    expect(after.map((e) => e.item.position)).toEqual([0, 1]);
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
    expect(await titles()).toEqual(['A', 'B', 'C']);
    await expect(lib.importAll({} as never)).rejects.toThrow('respaldo');
  });
});

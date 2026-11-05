import { toRecord, toUpload } from '../cloud/rows';
import { Library, songLabel } from './library';

let n = 0;
let lib: Library;

beforeEach(async () => {
  lib = await Library.open(`arreglos-${n++}`);
});
afterEach(() => lib.close());

const cusco = '{title: Cusco}\n{key: Bb}\n[Bb]la';

describe('arrangements', () => {
  it('copy the text, point to the original and keep their name', async () => {
    const original = await lib.saveSong(cusco);
    const id = await lib.createArrangement(original, '  Acústica  ');
    expect(await lib.getSong(id)).toMatchObject({
      title: 'Cusco',
      content: cusco,
      arrangementOf: original,
      arrangementName: 'Acústica',
      dirty: 1,
    });
    // An arrangement of an arrangement belongs to the original.
    const other = await lib.createArrangement(id, 'En C', '{title: Cusco}\n{key: C}');
    expect(await lib.getSong(other)).toMatchObject({ arrangementOf: original, songKey: 'C' });
  });

  it('the library lists the original only; its arrangements are found by name', async () => {
    const original = await lib.saveSong(cusco);
    await lib.saveSong('{title: Faro}');
    await lib.createArrangement(original, 'Acústica');
    expect((await lib.listSongs()).map((s) => s.title)).toEqual(['Cusco', 'Faro']);
    expect((await lib.listSongs('acust')).map((s) => s.id)).toEqual([original]);
  });

  it('groups: original first, then by name; a deleted original lets its arrangements go free', async () => {
    const original = await lib.saveSong(cusco);
    const b = await lib.createArrangement(original, 'Con banda');
    const a = await lib.createArrangement(original, 'Acústica');
    const ids = (list: { id: string }[]) => list.map((s) => s.id);
    expect(ids((await lib.arrangementGroups()).get(original)!)).toEqual([original, a, b]);
    expect(ids(await lib.arrangementsOf(b))).toEqual([original, a, b]);

    await lib.deleteSong(original);
    expect((await lib.arrangementGroups()).size).toBe(0);
    expect((await lib.listSongs()).map(songLabel)).toEqual(['Cusco · Acústica', 'Cusco · Con banda']);
  });

  it('rename', async () => {
    const original = await lib.saveSong(cusco);
    const id = await lib.createArrangement(original, 'Acústica');
    await lib.renameArrangement(id, 'Unplugged');
    expect((await lib.getSong(id))!.arrangementName).toBe('Unplugged');
    // Originals have no name to change, and an empty name isn't one.
    await lib.renameArrangement(original, 'X');
    await lib.renameArrangement(id, '   ');
    expect((await lib.getSong(original))!.arrangementName).toBeUndefined();
    expect((await lib.getSong(id))!.arrangementName).toBe('Unplugged');
  });

  it('the setlist picks which one plays, in its own key', async () => {
    const original = await lib.saveSong(cusco);
    const id = await lib.createArrangement(original, 'Acústica');
    const setlist = await lib.createSetlist('Show');
    const item = await lib.addSongToSetlist(setlist, original, 3);
    await lib.setItemSong(item, id);
    const [entry] = await lib.getSetlistEntries(setlist);
    expect(entry.song.id).toBe(id);
    expect(entry.item.transpose).toBe(0);
  });

  it('backups keep them linked', async () => {
    const original = await lib.saveSong(cusco);
    await lib.createArrangement(original, 'Acústica');
    const data = await lib.exportAll();
    expect(data.songs).toHaveLength(2);

    const other = await Library.open(`arreglos-${n++}`);
    await other.importAll(data);
    const groups = [...(await other.arrangementGroups()).values()];
    expect(groups.map((g) => g.map(songLabel))).toEqual([['Cusco', 'Cusco · Acústica']]);
    other.close();
  });

  it('linking to a band frees arrangements whose original stays behind', async () => {
    const original = await lib.saveSong(cusco);
    const id = await lib.createArrangement(original, 'Acústica');
    // The original was deleted before it was ever uploaded: it is gone for good.
    await lib.deleteSong(original);
    await lib.linkBand('band-1', true);
    expect(await lib.getSong(id)).toMatchObject({ arrangementOf: undefined, arrangementName: undefined, bandId: 'band-1' });
  });

  it('a conflict copy of an arrangement stays with its original', async () => {
    const original = await lib.saveSong(cusco);
    const id = await lib.createArrangement(original, 'Acústica');
    await lib.addConflictCopy((await lib.getSong(id))!);
    const group = (await lib.arrangementGroups()).get(original)!;
    expect(group.map((s) => s.arrangementName ?? 'Original')).toEqual(['Original', 'Acústica', 'Acústica (conflicto)']);
  });
});

describe('arrangements on the server', () => {
  const row = {
    id: 's',
    band_id: 'b',
    title: 'Cusco',
    artist: null,
    song_key: null,
    content: 'x',
    created_at: '2026-11-05T00:00:00Z',
    updated_at: '2026-11-05T00:00:00Z',
    updated_by: null,
    deleted_at: null,
  };

  it('only arrangements send the new columns (songs keep uploading before migration 7)', () => {
    const song = toRecord('songs', row);
    expect(toUpload('songs', song)).not.toHaveProperty('arrangement_of');
    const arr = toRecord('songs', { ...row, arrangement_of: 'o', arrangement_name: 'Acústica' });
    expect(arr).toMatchObject({ arrangementOf: 'o', arrangementName: 'Acústica' });
    expect(toUpload('songs', arr)).toMatchObject({ arrangement_of: 'o', arrangement_name: 'Acústica' });
  });
});

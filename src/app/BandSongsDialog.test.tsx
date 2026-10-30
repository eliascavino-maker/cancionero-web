import { fireEvent, render, screen } from '@testing-library/react';

import { Library } from '../data/library';
import { BandSongsDialog } from './BandSongsDialog';
import { LibraryContext } from './hooks';

let lib: Library;
beforeEach(async () => {
  lib = await Library.open(`band-${Math.random()}`);
});
afterEach(() => lib.close());

it('adds the chords to lyrics typed by hand and builds the setlist', async () => {
  const lyrics = '{title: Mar adentro}\n\n{start_of_verse: Estrofa}\nPrimera línea\n{end_of_verse}\n';
  const id = await lib.saveSong(lyrics);
  render(
    <LibraryContext.Provider value={lib}>
      <BandSongsDialog onClose={() => {}} />
    </LibraryContext.Provider>,
  );
  expect(await screen.findByText('Se agregan los acordes a tu letra')).toBeInTheDocument();
  expect(await screen.findByText(/Armar el setlist «Repertorio»/)).toBeInTheDocument();
  expect(screen.getByText('Armar el setlist «Peña 24/10» en orden', { exact: false })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^Cargar \d+$/ }));
  await screen.findByText('Acordes agregados');

  const song = await lib.getSong(id);
  expect(song!.content).toContain('Primera línea');
  expect(song!.content).toContain('[G] [C] [G] [D]');

  const setlists = await lib.listSetlists();
  const byName = (n: string) => setlists.find((s) => s.setlist.name === n)!.setlist.id;
  const pena = await lib.getSetlistEntries(byName('Peña 24/10'));
  expect(pena).toHaveLength(16);
  expect(pena[0]).toMatchObject({ song: { title: 'Sopla' }, item: { transpose: 1 } });
  const entries = await lib.getSetlistEntries(byName('Repertorio'));
  expect(entries.map((e) => e.song.title).slice(0, 3)).toEqual(['Mar adentro', 'Rendid a Yahvé', 'Dios de la vida']);
  expect(entries).toHaveLength(17);
});

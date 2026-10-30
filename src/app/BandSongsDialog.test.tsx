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
  expect(await screen.findByText(/Armar el setlist/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^Cargar \d+$/ }));
  await screen.findByText('Acordes agregados');

  const song = await lib.getSong(id);
  expect(song!.content).toContain('Primera línea');
  expect(song!.content).toContain('[G] [C] [G] [D]');

  const [summary] = await lib.listSetlists();
  expect(summary.setlist.name).toBe('Repertorio');
  const entries = await lib.getSetlistEntries(summary.setlist.id);
  expect(entries.map((e) => e.song.title).slice(0, 3)).toEqual(['Mar adentro', 'Rendid a Yahvé', 'Dios de la vida']);
  expect(entries).toHaveLength(17);
});

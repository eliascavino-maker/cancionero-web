import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Library } from '../../data/library';
import { LibraryContext, resetPrefsForTests } from '../hooks';
import { PlayerPage } from './PlayerPage';

let lib: Library;
let setlist: string;

beforeEach(async () => {
  window.scrollTo = () => {};
  localStorage.clear();
  resetPrefsForTests();
  lib = await Library.open(`player-${Math.random()}`);
  setlist = await lib.createSetlist('Peña');
  for (const t of ['Uno', 'Dos', 'Tres']) await lib.addSongToSetlist(setlist, await lib.saveSong(`{title: ${t}}\n[C]Letra ${t}`));
});
afterEach(() => lib.close());

it('the strip shows the song in the setlist; its map jumps to another one', async () => {
  render(
    <LibraryContext.Provider value={lib}>
      <PlayerPage setlistId={setlist} index={1} />
    </LibraryContext.Provider>,
  );
  const strip = await screen.findByRole('button', { name: /Abrir el mapa/ });
  expect(strip).toHaveTextContent('Dos');
  expect(strip).toHaveTextContent('Canción 2 de 3');
  fireEvent.click(strip);
  const map = screen.getByRole('dialog', { name: 'Mapa del setlist' });
  expect(within(map).getByRole('button', { name: /Dos/ })).toHaveAttribute('aria-current', 'step');
  fireEvent.click(within(map).getByRole('button', { name: /Tres/ }));
  await waitFor(() => expect(location.hash).toBe(`#/play/${setlist}/2`));
});

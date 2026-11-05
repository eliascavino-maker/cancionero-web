import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Library } from '../../data/library';
import { LibraryContext, resetPrefsForTests } from '../hooks';
import { SongPage } from './SongPage';

let lib: Library;
let original: string;
beforeEach(async () => {
  localStorage.clear();
  resetPrefsForTests();
  lib = await Library.open(`song-${Math.random()}`);
  original = await lib.saveSong('{title: Cusco}\n{key: G}\n[G]Hola');
  window.location.hash = '';
});
afterEach(async () => {
  cleanup();
  // Loads already on their way finish before the library closes.
  await new Promise((r) => setTimeout(r, 50));
  lib.close();
});

const show = (id: string) =>
  render(
    <LibraryContext.Provider value={lib}>
      <SongPage id={id} />
    </LibraryContext.Provider>,
  );

const answer = async (title: string, text: string, ok = 'Crear') => {
  const box = await screen.findByRole('textbox', { name: title });
  fireEvent.change(box, { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: ok }));
};

it('+ Arreglo makes a copy in the key on screen, and opens it', async () => {
  show(original);
  fireEvent.click(await screen.findByRole('button', { name: 'Subir medio tono' }));
  fireEvent.click(screen.getByRole('button', { name: 'Subir medio tono' }));
  fireEvent.click(screen.getByRole('button', { name: /Arreglo/ }));
  // Suggests the name from the new key.
  expect(await screen.findByRole('textbox', { name: 'Nombre del nuevo arreglo' })).toHaveValue('En A');
  await answer('Nombre del nuevo arreglo', 'En A');

  await waitFor(() => expect(window.location.hash).toMatch(/^#\/song\//));
  const id = window.location.hash.split('/')[2];
  const song = (await lib.getSong(id))!;
  expect(song).toMatchObject({ arrangementOf: original, arrangementName: 'En A', songKey: 'A' });
  expect(song.content).toContain('[A]Hola');
  // The original is still in G.
  expect((await lib.getSong(original))!.songKey).toBe('G');
});

it('shows the versions, the current one marked, and renames an arrangement', async () => {
  const id = await lib.createArrangement(original, 'Acústica');
  show(id);
  const nav = await screen.findByRole('navigation', { name: 'Arreglos' });
  await waitFor(() => expect(within(nav).getByRole('link', { name: 'Acústica' })).toHaveAttribute('aria-current', 'page'));
  expect(within(nav).getByRole('link', { name: 'Original' })).toHaveAttribute('href', `#/song/${original}`);

  fireEvent.click(within(nav).getByRole('button', { name: 'Renombrar el arreglo' }));
  await answer('Nombre del arreglo', 'Unplugged', 'Guardar');
  await waitFor(async () => expect((await lib.getSong(id))!.arrangementName).toBe('Unplugged'));
  expect(await within(nav).findByRole('link', { name: 'Unplugged' })).toBeInTheDocument();
});

it('a song without arrangements only offers to make one', async () => {
  show(original);
  const nav = await screen.findByRole('navigation', { name: 'Arreglos' });
  expect(within(nav).queryAllByRole('link')).toEqual([]);
  expect(within(nav).queryByRole('button', { name: 'Renombrar el arreglo' })).toBeNull();
});

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Library } from '../../data/library';
import { LibraryContext } from '../hooks';
import { EditorPage } from './EditorPage';

const invoke = vi.fn();
const cloud = { client: { functions: { invoke } } as unknown, band: { bandId: 'b' } as unknown };
vi.mock('../../cloud/CloudProvider', () => ({ useCloud: () => cloud }));

let lib: Library;
beforeEach(async () => {
  lib = await Library.open(`editor-${Math.random()}`);
  invoke.mockReset();
  cloud.band = { bandId: 'b' };
  window.location.hash = '';
});
afterEach(async () => {
  cleanup();
  await new Promise((r) => setTimeout(r, 30));
  lib.close();
});

const show = (fromLink = true) =>
  render(
    <LibraryContext.Provider value={lib}>
      <EditorPage fromLink={fromLink} />
    </LibraryContext.Provider>,
  );

const bring = (url: string) => {
  fireEvent.change(screen.getByRole('textbox', { name: 'Link de la canción' }), { target: { value: url } });
  fireEvent.click(screen.getByRole('button', { name: /Traer/ }));
};

it('brings the song from a link into the paste box, to check before saving', async () => {
  invoke.mockResolvedValue({ data: { title: 'Cusco', artist: 'Encontra', text: 'G    D\nHola mundo' }, error: null });
  show();
  expect(screen.getByRole('textbox', { name: 'Link de la canción' })).toHaveFocus();
  bring('https://acordes.lacuerda.net/encontra/cusco.shtml');
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Título' })).toHaveValue('Cusco'));
  expect(invoke).toHaveBeenCalledWith('import-url', { body: { url: 'https://acordes.lacuerda.net/encontra/cusco.shtml' } });
  expect(screen.getByRole('textbox', { name: 'Artista' })).toHaveValue('Encontra');
  expect(screen.getByRole('textbox', { name: 'Letra' })).toHaveValue('G    D\nHola mundo');

  // Nothing saved until "Guardar".
  expect(await lib.listSongs()).toEqual([]);
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  await waitFor(() => expect(window.location.hash).toMatch(/^#\/song\//));
  const [song] = await lib.listSongs();
  expect(song).toMatchObject({ title: 'Cusco', artist: 'Encontra' });
  expect(song.content).toContain('[G]Hola [D]mundo');
});

it("says why it couldn't, and the paste box is ready", async () => {
  const context = new Response(JSON.stringify({ error: 'Llegaste al límite de importaciones por link.' }), { status: 429 });
  invoke.mockResolvedValue({ data: null, error: { name: 'FunctionsHttpError', context } });
  show();
  bring('https://example.org/x');
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Llegaste al límite de importaciones por link. Copiala de la página y pegala abajo.',
  );
  expect(screen.getByRole('textbox', { name: 'Letra' })).toHaveFocus();
});

it('a function not installed yet, or no connection, is said plainly', async () => {
  invoke.mockResolvedValueOnce({ data: null, error: { name: 'FunctionsHttpError', context: new Response('{}', { status: 404 }) } });
  show();
  bring('https://example.org/x');
  expect(await screen.findByRole('alert')).toHaveTextContent(/todavía no está instalada/);

  invoke.mockResolvedValueOnce({ data: null, error: { name: 'FunctionsFetchError' } });
  bring('https://example.org/x');
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Sin conexión/));
});

it('without a band there is no link field: paste instead', () => {
  cloud.band = null;
  show();
  expect(screen.queryByRole('textbox', { name: 'Link de la canción' })).toBeNull();
  expect(screen.getByRole('status')).toHaveTextContent(/miembros de una banda/);
  cleanup();
  show(false);
  expect(screen.queryByRole('status')).toBeNull();
});

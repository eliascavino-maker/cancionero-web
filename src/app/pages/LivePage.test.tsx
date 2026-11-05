import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Library } from '../../data/library';
import { FakeHub } from '../../live/fakeHub';
import { LiveTestProvider } from '../../live/LiveProvider';
import { LiveRoom } from '../../live/room';
import { LibraryContext, getPrefs, resetPrefsForTests } from '../hooks';
import { LivePage } from './LivePage';

// Three parts: verse, chorus, and the chorus again.
const SONG = (t: string) => `{title: ${t}}\n{start_of_verse}\n[C]Verso ${t}\n{end_of_verse}\n{start_of_chorus}\n[G]Coro ${t}\n{end_of_chorus}\n{chorus}`;

let lib: Library;
let setlist: string;
let hub: FakeHub;
let sergio: LiveRoom;
let leo: LiveRoom;

beforeEach(async () => {
  window.scrollTo = () => {}; // jsdom doesn't scroll
  localStorage.clear();
  resetPrefsForTests();
  lib = await Library.open(`live-${Math.random()}`);
  setlist = await lib.createSetlist('Peña');
  for (const t of ['Uno', 'Dos']) await lib.addSongToSetlist(setlist, await lib.saveSong(SONG(t)));
  hub = new FakeHub();
  sergio = new LiveRoom(hub.server('u-sergio', 'Sergio'), 'band', { userId: 'u-sergio', name: 'Sergio' });
  leo = new LiveRoom(hub.server('u-leo', 'Leo'), 'band', { userId: 'u-leo', name: 'Leo' });
  sergio.start();
  leo.start();
  await act(() => sergio.open(setlist));
});
afterEach(() => lib.close());

/** One device on the live page. */
function device(room: LiveRoom) {
  const { container } = render(
    <LibraryContext.Provider value={lib}>
      <LiveTestProvider room={room}>
        <LivePage />
      </LiveTestProvider>
    </LibraryContext.Provider>,
  );
  const page = within(container);
  // Words in the sheet are joined by a zero-width space.
  const now = () => container.querySelector('[aria-current="step"]')?.textContent?.replace(/​/g, ' ');
  return { page, now, container };
}

it('the room opens without a leader: each one moves on their own', async () => {
  const s = device(sergio);
  expect(await s.page.findByText('Sin director: cada uno navega libre')).toBeInTheDocument();
  expect(s.page.getByRole('button', { name: 'Ser director' })).toBeInTheDocument();
  expect(s.page.queryByRole('group', { name: 'Dirigir' })).toBeNull();
});

it('"Ser director": the leader moves by part and the follower goes along', async () => {
  const s = device(sergio);
  const l = device(leo);
  fireEvent.click(await s.page.findByRole('button', { name: 'Ser director' }));
  await waitFor(() => expect(s.page.getByText('vos')).toBeInTheDocument());
  expect(await l.page.findByText('Sergio')).toBeInTheDocument();
  expect(l.page.getByRole('button', { name: 'Tomar la dirección' })).toBeInTheDocument();
  expect(l.page.queryByRole('button', { name: 'Ser director' })).toBeNull();

  const next = s.page.getByRole('button', { name: /Parte siguiente/ });
  fireEvent.click(next);
  await waitFor(() => expect(l.now()).toContain('Coro Uno'));
  expect(s.now()).toContain('Coro Uno');
  // Past the last part: the next song.
  fireEvent.click(next);
  fireEvent.click(next);
  await waitFor(() => expect(l.page.getByText(/2\/2 · Peña/)).toBeInTheDocument());
  expect(l.now()).toContain('Verso Dos');
  fireEvent.click(s.page.getByRole('button', { name: /Parte anterior/ }));
  await waitFor(() => expect(l.page.getByText(/1\/2 · Peña/)).toBeInTheDocument());
});

it('keys while leading: ↓/AvPág part, → song', async () => {
  const s = device(sergio);
  const l = device(leo);
  fireEvent.click(await s.page.findByRole('button', { name: 'Ser director' }));
  await waitFor(() => expect(s.page.getByRole('group', { name: 'Dirigir' })).toBeInTheDocument());
  fireEvent.keyDown(window, { key: 'PageDown' });
  await waitFor(() => expect(l.now()).toContain('Coro Uno'));
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  await waitFor(() => expect(l.page.getByText(/2\/2 · Peña/)).toBeInTheDocument());
});

it('"Tomar la dirección" asks first', async () => {
  device(sergio);
  const l = device(leo);
  await act(() => sergio.takeLead(null));
  fireEvent.click(await l.page.findByRole('button', { name: 'Tomar la dirección' }));
  const ask = await screen.findByRole('dialog', { name: /Ahora dirige Sergio/ });
  fireEvent.click(within(ask).getByRole('button', { name: 'Tomar la dirección' }));
  await waitFor(() => expect(hub.session?.leaderId).toBe('u-leo'));
  expect(await l.page.findByRole('button', { name: 'Dejar de dirigir' })).toBeInTheDocument();
});

it('"Dejar de seguir": the leader no longer moves you; "Dejar de dirigir" frees everyone', async () => {
  const s = device(sergio);
  const l = device(leo);
  fireEvent.click(await s.page.findByRole('button', { name: 'Ser director' }));
  await waitFor(() => expect(l.page.getByRole('button', { name: 'Dejar de seguir' })).toBeInTheDocument());
  fireEvent.click(l.page.getByRole('button', { name: 'Dejar de seguir' }));
  fireEvent.click(s.page.getByRole('button', { name: /Parte siguiente/ }));
  await waitFor(() => expect(s.now()).toContain('Coro Uno'));
  expect(l.now()).toContain('Verso Uno');
  fireEvent.click(s.page.getByRole('button', { name: 'Dejar de dirigir' }));
  expect(await l.page.findByText('Sin director: cada uno navega libre')).toBeInTheDocument();
  expect(l.page.getByRole('button', { name: 'Ser director' })).toBeInTheDocument();
});

it('closed room', async () => {
  await act(() => sergio.close());
  const s = device(sergio);
  expect(await s.page.findByText(/No hay una sala abierta/)).toBeInTheDocument();
});

describe('modo escenario', () => {
  const root = document.documentElement;
  afterEach(() => root.classList.remove('stage-mode', 'stage-chrome'));

  it('dark, big letters, controls on a tap; remembered', async () => {
    const s = device(sergio);
    fireEvent.click(await s.page.findByRole('button', { name: 'Modo escenario' }));
    // No full screen in this browser (like iPhone Safari): the tip to install it.
    const tip = await screen.findByRole('dialog', { name: /no deja poner pantalla completa/ });
    fireEvent.click(within(tip).getByRole('button', { name: 'Entendido' }));

    expect(root.classList.contains('stage-mode')).toBe(true);
    expect(getPrefs().stageMode).toBe(true);
    expect(s.container.querySelector<HTMLElement>('.cp-song')!.style.fontSize).toBe('32px');
    fireEvent.click(s.page.getByRole('button', { name: 'Letra más grande' }));
    expect(getPrefs()).toMatchObject({ stageFontSize: 34, fontSize: 22 });

    // A tap on the song brings the controls up; another one hides them.
    fireEvent.click(s.container.querySelector('.cp-song')!);
    expect(root.classList.contains('stage-chrome')).toBe(true);
    fireEvent.click(s.container.querySelector('.cp-song')!);
    expect(root.classList.contains('stage-chrome')).toBe(false);

    fireEvent.click(s.page.getByRole('button', { name: 'Modo escenario' }));
    expect(root.classList.contains('stage-mode')).toBe(false);
    expect(getPrefs().stageMode).toBe(false);
  });
});

it('locked: touches do nothing, but the leader still arrives and keys still work', async () => {
  const s = device(sergio);
  const l = device(leo);
  fireEvent.click(await s.page.findByRole('button', { name: 'Ser director' }));
  await waitFor(() => expect(l.page.getByRole('button', { name: 'Dejar de seguir' })).toBeInTheDocument());
  fireEvent.click(l.page.getByRole('button', { name: 'Bloquear la pantalla' }));
  expect(screen.getByRole('dialog', { name: 'Pantalla bloqueada' })).toBeInTheDocument();

  fireEvent.click(s.page.getByRole('button', { name: /Parte siguiente/ }));
  await waitFor(() => expect(l.now()).toContain('Coro Uno'));
  fireEvent.keyDown(screen.getByRole('dialog', { name: 'Pantalla bloqueada' }), { key: 'ArrowRight' });
  await waitFor(() => expect(l.page.getByText(/2\/2 · Peña/)).toBeInTheDocument());
});

it('the strip says where we are; its map jumps (and the leader takes everyone)', async () => {
  const s = device(sergio);
  const l = device(leo);
  fireEvent.click(await s.page.findByRole('button', { name: 'Ser director' }));
  await waitFor(() => expect(l.page.getByRole('button', { name: 'Dejar de seguir' })).toBeInTheDocument());
  const strip = s.page.getByRole('button', { name: /Abrir el mapa/ });
  expect(strip).toHaveTextContent('Estrofa · 1/3 partes');
  expect(strip).toHaveTextContent('Canción 1 de 2');

  fireEvent.click(strip);
  const map = s.page.getByRole('dialog', { name: 'Mapa del setlist' });
  fireEvent.click(within(within(map).getByRole('group', { name: 'Partes de Dos' })).getAllByRole('button')[1]);
  await waitFor(() => expect(l.now()).toContain('Coro Dos'));
  expect(l.page.getByRole('button', { name: /Abrir el mapa/ })).toHaveTextContent('Estribillo · 2/3 partes');
  expect(l.page.getByRole('button', { name: /Abrir el mapa/ })).toHaveTextContent('Canción 2 de 2');
  expect(s.page.queryByRole('dialog', { name: 'Mapa del setlist' })).toBeNull();
});

it('"Contar" and "Señales": the leader shows them big on every screen', async () => {
  const vibrate = vi.fn();
  Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate });
  const s = device(sergio);
  const l = device(leo);
  fireEvent.click(await s.page.findByRole('button', { name: 'Ser director' }));
  await waitFor(() => expect(l.page.getByRole('button', { name: 'Dejar de seguir' })).toBeInTheDocument());
  // Followers don't have them.
  expect(l.page.queryByRole('button', { name: /Contar/ })).toBeNull();

  fireEvent.click(s.page.getByRole('button', { name: /Contar/ }));
  // No {time}: 4 beats. Both screens count.
  await waitFor(() => expect(screen.getAllByRole('status').filter((e) => e.classList.contains('cue'))).toHaveLength(2));
  expect(document.querySelector('.cue__beat')).toHaveTextContent('4');

  fireEvent.click(s.page.getByRole('button', { name: /Señales/ }));
  const dialog = s.page.getByRole('dialog', { name: 'Señales' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cortar' }));
  await waitFor(() => expect(screen.getAllByRole('alert').filter((e) => e.textContent === 'Cortar')).toHaveLength(2));
  expect(s.page.queryByRole('dialog', { name: 'Señales' })).toBeNull();
  // "Cortar" vibrates, but not on the leader's phone.
  expect(vibrate).toHaveBeenCalledTimes(1);
  delete (navigator as { vibrate?: unknown }).vibrate;
});

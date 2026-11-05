import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Library } from '../../data/library';
import { FakeHub } from '../../live/fakeHub';
import { LiveTestProvider } from '../../live/LiveProvider';
import { LiveRoom } from '../../live/room';
import { LibraryContext, resetPrefsForTests } from '../hooks';
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

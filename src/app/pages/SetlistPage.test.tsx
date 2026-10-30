import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Library } from '../../data/library';
import { LibraryContext } from '../hooks';
import { SetlistPage } from './SetlistPage';

// jsdom has no PointerEvent: a MouseEvent with a pointerId is enough here.
if (!globalThis.PointerEvent) {
  class PointerEvent extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  globalThis.PointerEvent = PointerEvent as typeof globalThis.PointerEvent;
}

let lib: Library;
let setlist: number;
beforeEach(async () => {
  lib = await Library.open(`setlist-${Math.random()}`);
  setlist = await lib.createSetlist('Show');
  for (const t of ['Uno', 'Dos', 'Tres', 'Cuatro'])
    await lib.addSongToSetlist(setlist, await lib.saveSong(`{title: ${t}}\n[C]la`));
});
afterEach(() => lib.close());

const order = async () => (await lib.getSetlistEntries(setlist)).map((e) => e.song.title);

function show() {
  render(
    <LibraryContext.Provider value={lib}>
      <SetlistPage id={setlist} />
    </LibraryContext.Provider>,
  );
}

it('drags a song to another place', async () => {
  show();
  const grip = await screen.findByRole('button', { name: /Mover Uno/ });
  // Rows 50px tall, 10px apart: Uno 0, Dos 60, Tres 120, Cuatro 180.
  const rows = grip.closest('ol')!.children;
  Array.from(rows).forEach((row, k) => {
    row.getBoundingClientRect = () => ({ top: k * 60, bottom: k * 60 + 50, height: 50 }) as DOMRect;
  });
  fireEvent.pointerDown(grip, { button: 0, clientY: 25, pointerId: 1 });
  fireEvent.pointerMove(grip, { clientY: 160, pointerId: 1 });
  expect(screen.getByRole('button', { name: /Mover Uno/ }).closest('li')).toHaveClass('card--dragged');
  fireEvent.pointerUp(grip, { clientY: 160, pointerId: 1 });
  await waitFor(async () => expect(await order()).toEqual(['Dos', 'Tres', 'Uno', 'Cuatro']));
});

it('moves with the arrow keys', async () => {
  show();
  fireEvent.keyDown(await screen.findByRole('button', { name: /Mover Tres/ }), { key: 'ArrowUp' });
  await waitFor(async () => expect(await order()).toEqual(['Uno', 'Tres', 'Dos', 'Cuatro']));
});

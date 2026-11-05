import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { LockButton, LockOverlay, UNLOCK_MS } from './Lock';

function Screen({ onKey }: { onKey: (key: string) => void }) {
  const [locked, setLocked] = useState(false);
  return (
    <div onKeyDown={(e) => onKey(e.key)}>
      <LockButton onLock={() => setLocked(true)} />
      {locked && <LockOverlay onUnlock={() => setLocked(false)} />}
    </div>
  );
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('locks; a short touch does nothing; holding 2 s unlocks', () => {
  render(<Screen onKey={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Bloquear la pantalla' }));
  const lock = screen.getByRole('dialog', { name: 'Pantalla bloqueada' });

  fireEvent.pointerDown(lock);
  act(() => vi.advanceTimersByTime(UNLOCK_MS - 300));
  fireEvent.pointerUp(lock);
  act(() => vi.advanceTimersByTime(UNLOCK_MS));
  expect(screen.getByRole('dialog', { name: 'Pantalla bloqueada' })).toBeInTheDocument();

  fireEvent.pointerDown(lock);
  expect(screen.getByText('Seguí apretando…')).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(UNLOCK_MS));
  expect(screen.queryByRole('dialog', { name: 'Pantalla bloqueada' })).toBeNull();
});

it('lifting the finger off the screen stops the hold', () => {
  render(<Screen onKey={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Bloquear la pantalla' }));
  const lock = screen.getByRole('dialog', { name: 'Pantalla bloqueada' });
  fireEvent.pointerDown(lock);
  fireEvent.pointerCancel(lock);
  act(() => vi.advanceTimersByTime(UNLOCK_MS * 2));
  expect(screen.getByRole('dialog', { name: 'Pantalla bloqueada' })).toBeInTheDocument();
});

it('keys still work (pedals); holding Enter unlocks', () => {
  const keys: string[] = [];
  render(<Screen onKey={(k) => keys.push(k)} />);
  fireEvent.click(screen.getByRole('button', { name: 'Bloquear la pantalla' }));
  const lock = screen.getByRole('dialog', { name: 'Pantalla bloqueada' });
  expect(document.activeElement).toBe(lock);

  fireEvent.keyDown(lock, { key: 'PageDown' });
  expect(keys).toContain('PageDown');
  fireEvent.keyDown(lock, { key: 'Enter' });
  act(() => vi.advanceTimersByTime(UNLOCK_MS));
  expect(screen.queryByRole('dialog', { name: 'Pantalla bloqueada' })).toBeNull();
});

import { fireEvent, render, screen } from '@testing-library/react';
import { FullscreenButton } from './FullscreenButton';

it('asks the browser for full screen and shows the way out', async () => {
  let full: Element | null = null;
  const root = document.documentElement;
  root.requestFullscreen = vi.fn(async () => {
    full = root;
    document.dispatchEvent(new Event('fullscreenchange'));
  });
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => full });
  document.exitFullscreen = vi.fn(async () => {
    full = null;
    document.dispatchEvent(new Event('fullscreenchange'));
  });

  render(<FullscreenButton />);
  fireEvent.click(screen.getByRole('button', { name: 'Pantalla completa' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Salir de pantalla completa' }));
  expect(await screen.findByRole('button', { name: 'Pantalla completa' })).toBeInTheDocument();

  // F key on a computer.
  fireEvent.keyDown(window, { key: 'f' });
  expect(await screen.findByRole('button', { name: 'Salir de pantalla completa' })).toBeInTheDocument();
  expect(root.requestFullscreen).toHaveBeenCalledTimes(2);
});

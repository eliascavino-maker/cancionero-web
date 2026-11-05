import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { FullscreenButton, resetFullscreenForTests } from './FullscreenButton';

const root = document.documentElement;
const immersive = () => root.classList.contains('is-immersive');

afterEach(() => {
  resetFullscreenForTests();
  delete (root as Partial<HTMLElement>).requestFullscreen;
  delete (navigator as { standalone?: boolean }).standalone;
  delete (document as { fullscreenElement?: Element | null }).fullscreenElement;
  localStorage.clear();
});

it('asks the browser for full screen and shows the way out', async () => {
  let full: Element | null = null;
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

describe('iPhone (no requestFullscreen)', () => {
  it('installed: no notice; hides the app bars; out by the small button, a tap or Escape', async () => {
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });
    render(
      <>
        <p>Letra</p>
        <FullscreenButton />
      </>,
    );
    const enter = () => fireEvent.click(screen.getByRole('button', { name: 'Pantalla completa' }));

    enter();
    await screen.findAllByRole('button', { name: 'Salir de pantalla completa' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(immersive()).toBe(true);
    fireEvent.click(document.querySelector('.immersive-exit')!);
    expect(immersive()).toBe(false);

    enter();
    await screen.findAllByRole('button', { name: 'Salir de pantalla completa' });
    fireEvent.click(screen.getByText('Letra'));
    expect(immersive()).toBe(false);

    enter();
    await screen.findAllByRole('button', { name: 'Salir de pantalla completa' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(immersive()).toBe(false);
  });

  it('in the browser: the notice once per visit, never again after "No mostrar de nuevo"', async () => {
    render(<FullscreenButton />);
    const enter = () => fireEvent.click(screen.getByRole('button', { name: 'Pantalla completa' }));

    enter();
    let dialog = await screen.findByRole('dialog', { name: 'En iPhone el navegador no deja poner pantalla completa' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Entendido' }));
    await screen.findAllByRole('button', { name: 'Salir de pantalla completa' });
    expect(immersive()).toBe(true);
    fireEvent.click(document.querySelector('.immersive-exit')!);

    // Same visit: straight in.
    enter();
    await screen.findAllByRole('button', { name: 'Salir de pantalla completa' });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(document.querySelector('.immersive-exit')!);

    // Next visit: once more, and "No mostrar de nuevo".
    act(() => resetFullscreenForTests());
    enter();
    dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'No mostrar de nuevo' }));
    await screen.findAllByRole('button', { name: 'Salir de pantalla completa' });
    fireEvent.click(document.querySelector('.immersive-exit')!);

    act(() => resetFullscreenForTests());
    enter();
    await screen.findAllByRole('button', { name: 'Salir de pantalla completa' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('leaving the page brings the bars back', async () => {
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });
    const { unmount } = render(<FullscreenButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Pantalla completa' }));
    await screen.findAllByRole('button', { name: 'Salir de pantalla completa' });
    unmount();
    expect(immersive()).toBe(false);
    expect(document.querySelector('.immersive-exit')).toBeNull();
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DEFAULT_SIGNALS } from '../live/signals';
import { SignalsEditor } from './SignalsEditor';

it('edits, reorders and saves the list; checks it first', async () => {
  const onSave = vi.fn(async () => {});
  render(<SignalsEditor initial={DEFAULT_SIGNALS.slice(0, 2)} onSave={onSave} />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Señal 2' }), { target: { value: ' Último  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Subir «Último»' }));
  fireEvent.click(screen.getByRole('button', { name: /Agregar/ }));

  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Cada señal necesita un texto.');
  expect(onSave).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Quitar «»' }));
  fireEvent.click(screen.getAllByRole('checkbox')[1]);
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith([
      { text: 'Último', color: DEFAULT_SIGNALS[1].color, vibrate: false },
      { text: 'Repetir coro', color: DEFAULT_SIGNALS[0].color, vibrate: true },
    ]),
  );
  expect(await screen.findByRole('status')).toHaveTextContent('Guardadas');
});

it('shows the server error', async () => {
  render(<SignalsEditor initial={DEFAULT_SIGNALS} onSave={async () => Promise.reject(new Error('Solo el owner de la banda puede hacer esto'))} />);
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Solo el owner');
});

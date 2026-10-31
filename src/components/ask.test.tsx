import { fireEvent, screen, waitFor } from '@testing-library/react';
import { askConfirm, askText, tell } from './ask';

it('askText gives the text typed, or null on Cancelar', async () => {
  const typed = askText('Nuevo setlist', '', { ok: 'Crear' });
  fireEvent.change(await screen.findByRole('textbox', { name: 'Nuevo setlist' }), { target: { value: 'Peña' } });
  fireEvent.click(screen.getByRole('button', { name: 'Crear' }));
  expect(await typed).toBe('Peña');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

  const cancelled = askText('Renombrar setlist', 'Viejo');
  expect(await screen.findByRole('textbox', { name: 'Renombrar setlist' })).toHaveValue('Viejo');
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(await cancelled).toBeNull();
});

it('Enter in the text box accepts', async () => {
  const typed = askText('Nombre');
  const box = await screen.findByRole('textbox', { name: 'Nombre' });
  fireEvent.change(box, { target: { value: 'Ensayo' } });
  fireEvent.submit(box);
  expect(await typed).toBe('Ensayo');
});

it('askConfirm and tell', async () => {
  const yes = askConfirm('Las canciones quedan.', { title: '¿Borrar «X»?', ok: 'Borrar', danger: true });
  expect(await screen.findByText('Las canciones quedan.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Borrar' }));
  expect(await yes).toBe(true);

  const no = askConfirm('¿Seguir?');
  fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
  expect(await no).toBe(false);

  const notice = tell('Algo pasó');
  expect(await screen.findByRole('button', { name: 'Entendido' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Entendido' }));
  await expect(notice).resolves.toBeUndefined();
});

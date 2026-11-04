import { act, fireEvent, render, screen } from '@testing-library/react';
import { getPrefs, resetPrefsForTests } from './hooks';
import { chooseMe, getMe, resetMeForTests } from './me';
import { SongPanel } from './SongPanel';
import { MeCard, WhoAreYouDialog } from './WhoAreYou';
import { BAND } from '../data/band';

beforeEach(() => {
  localStorage.clear();
  resetMeForTests();
  resetPrefsForTests();
});

const pick = (name: string) => fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name}`) }));

describe('¿Quién sos?', () => {
  it('the dialog lists the band and remembers the answer', () => {
    render(<WhoAreYouDialog />);
    expect(screen.getByRole('heading', { name: '¿Quién sos?' })).toBeInTheDocument();
    for (const m of BAND) expect(screen.getByRole('button', { name: new RegExp(`^${m.name}`) })).toBeInTheDocument();
    pick('Angel');
    expect(getMe()).toMatchObject({ chosen: true, me: { name: 'Angel' }, highlight: true });
    expect(getPrefs().showChords).toBe(false);
  });

  it('"Vos": shows who is chosen, and the highlight can be turned off', () => {
    render(<MeCard />);
    const box = screen.getByRole('checkbox', { name: 'Resaltar las líneas que canto' });
    expect(box).toBeDisabled();
    pick('Leandro');
    expect(screen.getByRole('button', { name: /^Leandro/ })).toHaveAttribute('aria-pressed', 'true');
    expect(getPrefs().showChords).toBe(true);
    expect(box).toBeChecked();
    fireEvent.click(box);
    expect(getMe().highlight).toBe(false);
    pick('Elias');
    expect(box).toBeDisabled();
    expect(box).not.toBeChecked();
    pick('Nadie en particular');
    expect(getMe()).toMatchObject({ chosen: true, me: null });
  });

  it('the sheet lights the lines of whoever is chosen, in Acordes', () => {
    const song = '{start_of_verse}\n{x_voz: Leo}\n[G]Canta Leo\n{x_voz: Sergio}\n[C]Canta Sergio\n{end_of_verse}';
    const { container } = render(<SongPanel content={song} transpose={0} onTransposeChange={() => {}} />);
    expect(container.querySelector('.cp-mine')).toBeNull();
    act(() => chooseMe(BAND.find((m) => m.name === 'Leo')!));
    expect(screen.getByRole('button', { name: 'Acordes' })).toHaveAttribute('aria-pressed', 'true');
    const lit = [...container.querySelectorAll('.cp-mine')];
    expect(lit).toHaveLength(1);
    expect(lit[0].textContent).toContain('Leo');
  });
});

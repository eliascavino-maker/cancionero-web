import { fireEvent, render, screen, within } from '@testing-library/react';
import { SPEED_LEVELS, nearestLevel, parseDuration } from './autoscroll';
import { SongPanel } from './SongPanel';
import { resetPrefsForTests } from './hooks';

describe('parseDuration', () => {
  it.each([
    ['3:30', 210],
    ['210', 210],
    ['1:02:03', 3723],
    [' 4:05 ', 245],
  ])('%s = %i s', (text, seconds) => expect(parseDuration(text)).toBe(seconds));

  it.each([undefined, '', 'tres', '3:3a', '0', '1:2:3:4'])('%s is unreadable', (text) =>
    expect(parseDuration(text)).toBeNull(),
  );
});

describe('nearestLevel', () => {
  it('picks the closest speed', () => {
    expect(nearestLevel(0)).toBe(0);
    expect(nearestLevel(1000)).toBe(SPEED_LEVELS.length - 1);
    expect(SPEED_LEVELS[nearestLevel(21)]).toBe(22);
  });
});

describe('SongPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    resetPrefsForTests();
  });

  const song = `{title: X}
{key: G}
{start_of_intro: Intro}
[G]   [D]
{end_of_intro}
[G]Hola [D]mundo
{sot}
e|--3--|
{eot}`;

  const renderPanel = (content = song, songKey = '1') =>
    render(<SongPanel content={content} transpose={0} onTransposeChange={() => {}} songKey={songKey} />);

  it('Letra hides chords, chord-only sections and tabs', () => {
    renderPanel();
    expect(screen.getByText('Intro')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Letra' }));
    expect(screen.getByRole('button', { name: 'Letra' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Hola mundo')).toBeInTheDocument();
    expect(screen.queryByText('Intro')).toBeNull();
    expect(screen.queryByText('e|--3--|')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Subir medio tono' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Acordes' }));
    expect(screen.getAllByText('D')).toHaveLength(2);
    expect(screen.getByText('Intro')).toBeInTheDocument();
  });

  it('Mover acordes: pick a chord, move it, save the text', () => {
    const saved: string[] = [];
    render(
      <SongPanel content={'[G]Hola [D]mundo'} transpose={2} onTransposeChange={() => {}} onContentChange={(c) => saved.push(c)} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Editar canción' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mover acordes' }));
    expect(screen.getByText('Tocá un acorde para moverlo')).toBeInTheDocument();
    // Shown transposed (+2), saved in the original key.
    fireEvent.click(screen.getByRole('button', { name: 'Acorde E' }));
    fireEvent.click(screen.getByRole('button', { name: 'Antes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Antes' }));
    expect(saved).toEqual(['[G]Hola[D] mundo', '[G]Hol[D]a mundo']);
    expect(screen.getByRole('button', { name: 'Acorde E' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Listo' }));
    expect(screen.queryByRole('button', { name: 'Acorde E' })).toBeNull();
  });

  it('BPM: tap the tempo chip, change it, save', () => {
    const saved: string[] = [];
    render(
      <SongPanel content={'{title: X}\n{tempo: 90}\n[C]la'} transpose={0} onTransposeChange={() => {}} onContentChange={(c) => saved.push(c)} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar BPM' }));
    fireEvent.click(screen.getByRole('button', { name: 'Más BPM' }));
    expect(saved).toEqual(['{title: X}\n{tempo: 91}\n[C]la']);
    expect(screen.getByRole('spinbutton', { name: 'BPM' })).toHaveValue(91);
    expect(screen.getByText('♩ 91')).toBeInTheDocument();

    // Typing a number saves it when leaving the field (out of range is clamped).
    const field = screen.getByRole('spinbutton', { name: 'BPM' });
    fireEvent.change(field, { target: { value: '128' } });
    fireEvent.blur(field);
    expect(saved.at(-1)).toBe('{title: X}\n{tempo: 128}\n[C]la');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'BPM' }), { target: { value: '999' } });
    fireEvent.blur(screen.getByRole('spinbutton', { name: 'BPM' }));
    expect(screen.getByText('♩ 300')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Listo' }));
    expect(screen.getByRole('button', { name: 'Desplazar automáticamente' })).toBeInTheDocument();
  });

  it('Notas: tap a word to add a note, tap the note to change or delete it', () => {
    const saved: string[] = [];
    const prompt = vi.spyOn(window, 'prompt');
    render(<SongPanel content={'[G]Hola mundo'} transpose={0} onTransposeChange={() => {}} onContentChange={(c) => saved.push(c)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar canción' }));
    fireEvent.click(screen.getByRole('button', { name: 'Notas' }));

    prompt.mockReturnValueOnce('Queda solo Leo');
    fireEvent.click(screen.getByRole('button', { name: 'Nota en «mundo»' }));
    expect(saved.at(-1)).toBe('[G]Hola [*Queda solo Leo]mundo');
    // The member name inside the note gets their color.
    expect(screen.getByText('Leo', { selector: '.cp-note__member' })).toBeInTheDocument();

    prompt.mockReturnValueOnce('Silencio largo');
    fireEvent.click(screen.getByRole('button', { name: 'Nota: Queda solo Leo' }));
    expect(saved.at(-1)).toBe('[G]Hola [*Silencio largo]mundo');

    prompt.mockReturnValueOnce('');
    fireEvent.click(screen.getByRole('button', { name: 'Nota: Silencio largo' }));
    expect(saved.at(-1)).toBe('[G]Hola mundo');
    prompt.mockRestore();
  });

  it('notes also show in Letra mode', () => {
    renderPanel('Hola [*Silencio largo]mundo', '3');
    fireEvent.click(screen.getByRole('button', { name: 'Letra' }));
    expect(screen.getByText('Silencio largo')).toBeInTheDocument();
  });

  it('Voces: pick lines and who sings them', () => {
    const saved: string[] = [];
    const src = '{start_of_verse: Estrofa 1}\nUno\nDos\nTres\n{end_of_verse}';
    render(<SongPanel content={src} transpose={0} onTransposeChange={() => {}} onContentChange={(c) => saved.push(c)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar canción' }));
    fireEvent.click(screen.getByRole('button', { name: 'Voces' }));
    expect(screen.getByText('Tocá la primera y la última línea que canta alguien')).toBeInTheDocument();

    // Lines 2-3 sung by Leo.
    fireEvent.click(screen.getByRole('button', { name: 'Línea: Dos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Línea: Tres' }));
    expect(screen.getByRole('button', { name: 'Línea: Dos' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(screen.getByRole('group', { name: 'Quién canta' })).getByRole('button', { name: 'Leo' }));
    expect(saved.at(-1)).toBe('{start_of_verse: Estrofa 1}\nUno\n{x_voz: Leo}\nDos\nTres\n{end_of_verse}');
    expect(screen.getByRole('img', { name: 'Canta: Leo' })).toBeInTheDocument();

    // Line 1 by Angel: a new selection.
    fireEvent.click(screen.getByRole('button', { name: 'Línea: Uno' }));
    fireEvent.click(screen.getByRole('button', { name: 'Línea: Uno' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Quién canta' })).getByRole('button', { name: 'Angel' }));
    expect(saved.at(-1)).toBe('{start_of_verse: Estrofa 1}\n{x_voz: Angel}\nUno\n{x_voz: Leo}\nDos\nTres\n{end_of_verse}');

    fireEvent.click(screen.getByRole('button', { name: 'Quitar' }));
    expect(saved.at(-1)).toBe('{start_of_verse: Estrofa 1}\nUno\n{x_voz: Leo}\nDos\nTres\n{end_of_verse}');
  });

  it('no editing without a place to save', () => {
    renderPanel();
    expect(screen.queryByRole('button', { name: 'Editar canción' })).toBeNull();
  });

  it('Partes: assign who sings and plays a section', () => {
    const saved: string[] = [];
    const src = '{start_of_verse: Estrofa 1}\n[G]Hola\n{end_of_verse}\n\n{start_of_chorus}\n[C]Coro\n{end_of_chorus}\n\n{chorus}';
    render(<SongPanel content={src} transpose={0} onTransposeChange={() => {}} onContentChange={(c) => saved.push(c)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar canción' }));
    fireEvent.click(screen.getByRole('button', { name: /Partes/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Asignar partes: Estrofa 1' }));
    const sergio = screen.getByRole('group', { name: 'Voz de Sergio' });
    fireEvent.click(within(sergio).getByRole('button', { name: 'Voz' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Voz de Leo' })).getByRole('button', { name: 'Coro' }));
    fireEvent.click(screen.getByRole('button', { name: /Elias/ }));
    expect(saved.at(-1)).toBe(
      '{start_of_verse: Estrofa 1}\n{x_band: voz=Sergio; coros=Leo; tocan=Elias}\n[G]Hola\n{end_of_verse}\n\n{start_of_chorus}\n[C]Coro\n{end_of_chorus}\n\n{chorus}',
    );
    // Acordes view: who plays, no voice brackets.
    expect(screen.getByRole('listitem', { name: 'Tocan: Elias' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Canta: Sergio' })).toBeNull();

    // "Todos" in the chorus; the repeated chorus shows the same parts.
    fireEvent.click(screen.getAllByRole('button', { name: 'Asignar partes: Estribillo' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
    expect(saved.at(-1)).toContain('{start_of_chorus}\n{x_band: tocan=Sergio, Leo, Leandro, Elias}\n[C]Coro');
    expect(screen.getAllByRole('listitem', { name: 'Tocan: todos' })).toHaveLength(2);

    // Letra view: voices as colored brackets, no "Tocan".
    fireEvent.click(within(screen.getByRole('toolbar', { name: 'Partes de la banda' })).getByRole('button', { name: 'Listo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Letra' }));
    expect(screen.getByRole('img', { name: 'Canta: Sergio' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Coro: Leo' })).toBeInTheDocument();
    expect(screen.queryByRole('listitem', { name: 'Tocan: Elias' })).toBeNull();
  });

  it('notes on the lyrics show in Letra only; notes on chord lines in Acordes only', () => {
    renderPanel('[G]Hola [*Silencio largo]mundo\n[*Sin piano][C] [D]', '4');
    expect(screen.queryByText('Silencio largo')).toBeNull();
    expect(screen.getByText('Sin piano')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Letra' }));
    expect(screen.getByText('Silencio largo')).toBeInTheDocument();
    expect(screen.queryByText('Sin piano')).toBeNull();
  });

  it('play toggles and touching the sheet pauses', () => {
    renderPanel();
    const play = screen.getByRole('button', { name: 'Desplazar automáticamente' });
    fireEvent.click(play);
    expect(screen.getByRole('button', { name: 'Pausar desplazamiento' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.pointerDown(screen.getByTestId('sheet'));
    expect(screen.getByRole('button', { name: 'Desplazar automáticamente' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('Space toggles play', () => {
    renderPanel();
    fireEvent.keyDown(window, { key: ' ' });
    expect(screen.getByRole('button', { name: 'Pausar desplazamiento' })).toBeInTheDocument();
  });

  it('speed is remembered per song', () => {
    const { unmount } = renderPanel();
    expect(screen.getByText('4', { selector: '.speed strong' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Más rápido' }));
    expect(screen.getByText('5', { selector: '.speed strong' })).toBeInTheDocument();
    unmount();

    renderPanel(song, '1');
    expect(screen.getByText('5', { selector: '.speed strong' })).toBeInTheDocument();
  });

  it('{duration} gives an automatic speed until changed', () => {
    renderPanel('{title: Y}\n{duration: 3:30}\n[C]la', '2');
    expect(screen.getByText('auto')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Más lento' }));
    expect(screen.queryByText('auto')).toBeNull();
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
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

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { parseChordPro } from '../chordpro/parser';
import { StageView, slideSeconds, stageSlides } from './StageView';

const song = parseChordPro(`{title: Prueba}
{tempo: 120}

{start_of_intro: Intro}
[D] [G]
{end_of_intro}

{start_of_verse: Estrofa 1}
[D]Primera línea
Segunda línea
{end_of_verse}

{start_of_chorus: Estribillo}
Coro uno
Coro dos
{end_of_chorus}

{start_of_verse: Estrofa 2}
Otra estrofa
{end_of_verse}

{chorus}
`);

it('one slide per part, {chorus} repeats the chorus', () => {
  const slides = stageSlides(song);
  expect(slides.map((s) => s.label)).toEqual(['Intro', 'Estrofa 1', 'Estribillo', 'Estrofa 2', 'Estribillo']);
  expect(slides[4].lines).toEqual(slides[2].lines);
});

it('timing from BPM: 8 beats per sung line, 4 per chord when instrumental', () => {
  const [intro, verse] = stageSlides(song);
  expect(slideSeconds(verse, 120, 13, 20)).toBe(8);
  expect(slideSeconds(intro, 120, 13, 20)).toBe(4);
});

function show(playing = false) {
  const onPlayingChange = vi.fn();
  render(
    <StageView song={song} playing={playing} onPlayingChange={onPlayingChange} onClose={() => {}} bpm={120} pxPerSecond={13} fontSize={20} />,
  );
  return onPlayingChange;
}

it('shows one part and the start of the next; tap and arrows move', () => {
  show();
  const sheet = screen.getByTestId('stage-sheet');
  const next = () => screen.getByText(/^Sigue:/).parentElement!;
  expect(within(sheet).getByText('Instrumental')).toBeInTheDocument();
  expect(next()).toHaveTextContent('Sigue: Estrofa 1Primera líneaSegunda línea');

  fireEvent.click(sheet, { clientX: 500 });
  expect(within(sheet).getByText('Primera línea')).toBeInTheDocument();
  expect(within(sheet).queryByText('Coro uno')).toBeNull();
  expect(next()).toHaveTextContent('Sigue: Estribillo');

  fireEvent.keyDown(window, { key: 'ArrowDown' });
  expect(within(sheet).getByText('Coro uno')).toBeInTheDocument();
  fireEvent.keyDown(window, { key: 'ArrowUp' });
  expect(within(sheet).getByText('Primera línea')).toBeInTheDocument();
});

it('advances by itself while playing and stops at the end', () => {
  vi.useFakeTimers();
  try {
    const onPlayingChange = show(true);
    const sheet = screen.getByTestId('stage-sheet');
    act(() => void vi.advanceTimersByTime(4000)); // intro: 2 chords at 120
    expect(within(sheet).getByText('Primera línea')).toBeInTheDocument();
    for (const ms of [8000, 8000, 4000, 8000]) act(() => void vi.advanceTimersByTime(ms));
    expect(screen.getByText('Fin de la canción')).toBeInTheDocument();
    expect(onPlayingChange).toHaveBeenCalledWith(false);
  } finally {
    vi.useRealTimers();
  }
});

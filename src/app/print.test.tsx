import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { getPrefs, resetPrefsForTests, setPrefs } from './hooks';
import { ExportPdfDialog, PrintSheet, printSheet } from './print';

const cusco = { id: 's1', content: '{title: Cusco}\n{key: A}\n{x_cue: 4 compases}\n[A]Hola [D]mundo', transpose: 1 };
const faro = { id: 's2', content: '{title: Faro}\n{key: G}\n[G]Luz', transpose: 0 };
const chords = () => [...document.querySelectorAll('.cp-chord')].map((c) => c.textContent);

beforeEach(() => {
  localStorage.clear();
  resetPrefsForTests();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('PrintSheet', () => {
  it('a setlist: cover with the band, the songs and their keys, then the songs', () => {
    render(<PrintSheet songs={[cusco, faro]} opts={{ chords: true, cues: true, capo: false }} cover={{ title: 'Peña', band: 'Encontra' }} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Peña' })).toBeInTheDocument();
    expect(screen.getByText('Encontra')).toBeInTheDocument();
    const items = [...document.querySelectorAll('.print-cover__list li')].map((li) => li.textContent);
    expect(items).toEqual(['CuscoBb', 'FaroG']);
    expect(document.querySelectorAll('.print-song')).toHaveLength(2);
    // In the setlist's key.
    expect(chords()).toEqual(['Bb', 'Eb', 'G']);
    expect(screen.getByText('4 compases')).toBeInTheDocument();
  });

  it('Letra without indications', () => {
    render(<PrintSheet songs={[cusco]} opts={{ chords: false, cues: false, capo: false }} />);
    expect(document.querySelector('.print-cover')).toBeNull();
    expect(chords()).toEqual([]);
    expect(screen.queryByText('4 compases')).toBeNull();
    expect(screen.getByText('Hola mundo')).toBeInTheDocument();
  });

  it('with my capo: shapes, and the band key in the header', () => {
    setPrefs({ ...getPrefs(), capo: { s1: 3 } });
    render(<PrintSheet songs={[cusco]} opts={{ chords: true, cues: true, capo: true }} />);
    expect(chords()).toEqual(['G', 'C']);
    expect(document.querySelector('.cp-info__key')).toHaveTextContent('Tono: Bb');
    expect(document.querySelector('.cp-info__capo')).toHaveTextContent('Mi capo 3 · formas de G');
  });
});

it('printSheet: only the sheet while the print dialog is open, then everything back', () => {
  document.title = 'Cancionero';
  let during: { printing: boolean; title: string; text: string } | null = null;
  vi.spyOn(window, 'print').mockImplementation(() => {
    during = {
      printing: document.documentElement.classList.contains('printing'),
      title: document.title,
      text: document.querySelector('.print-root')?.textContent ?? '',
    };
  });
  printSheet(<PrintSheet songs={[faro]} opts={{ chords: true, cues: true, capo: false }} />, 'Faro');
  expect(during).toMatchObject({ printing: true, title: 'Faro' });
  expect(during!.text).toContain('Luz');
  window.dispatchEvent(new Event('afterprint'));
  expect(document.querySelector('.print-root')).toBeNull();
  expect(document.documentElement).not.toHaveClass('printing');
  expect(document.title).toBe('Cancionero');
});

it('the dialog: options, then the print dialog', () => {
  setPrefs({ ...getPrefs(), capo: { s1: 2 } });
  const printed: string[] = [];
  vi.spyOn(window, 'print').mockImplementation(() => {
    printed.push([...document.querySelectorAll('.print-root .cp-chord')].map((c) => c.textContent).join(' '));
  });
  const onClose = vi.fn();
  render(<ExportPdfDialog songs={[cusco]} name="Cusco" onClose={onClose} />);
  expect(screen.getByText(/en el tono que tenés en pantalla/)).toBeInTheDocument();
  // My capo is offered (this song has one) and on by default.
  expect(screen.getByRole('checkbox', { name: 'Con mi capo' })).toBeChecked();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Con mi capo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Exportar' }));
  expect(printed).toEqual(['Bb Eb']);

  fireEvent.click(screen.getByRole('button', { name: 'Letra' }));
  expect(screen.queryByRole('checkbox', { name: 'Con mi capo' })).toBeNull();
});

it('a second export replaces a sheet whose dialog never said it closed', () => {
  vi.spyOn(window, 'print').mockImplementation(() => {});
  printSheet(<PrintSheet songs={[faro]} opts={{ chords: true, cues: true, capo: false }} />, 'Faro');
  printSheet(<PrintSheet songs={[cusco]} opts={{ chords: true, cues: true, capo: false }} />, 'Cusco');
  expect(document.querySelectorAll('.print-root')).toHaveLength(1);
  expect(document.querySelector('.print-root')).toHaveTextContent('Cusco');
  window.dispatchEvent(new Event('afterprint'));
  expect(document.querySelector('.print-root')).toBeNull();
  expect(document.documentElement).not.toHaveClass('printing');
});

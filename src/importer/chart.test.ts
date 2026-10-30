import { parseChordPro } from '../chordpro/parser';
import { chartToChordPro, mergeChart, parseChart } from './chart';
import { linesFromText, readDocument } from './docx';
import { bandDocLines } from '../data/bandChords';

describe('parseChart on the band document', () => {
  const songs = parseChart(bandDocLines());
  const byTitle = (t: string) => songs.find((s) => s.title === t)!;
  const cho = (t: string) => chartToChordPro(byTitle(t), songs);

  it('finds every song', () => {
    expect(songs.map((s) => s.title)).toEqual([
      'Encontrarte',
      'Cusco',
      'Faro',
      'Fuego de noviembre',
      'Prueben que bueno',
      'Esto que soy',
      'Vida en abundancia',
      'Amor como fuego',
    ]);
  });

  it('a song without part names keeps its lines, notes and repeats', () => {
    expect(cho('Encontrarte')).toBe(`{title: Encontrarte}

[C] [G] [Am] [F] [*x2]
[G] [Am] [F] [*x2] [*…] [G]
[C] [G] [Am] [F]
[Am] [Bb] [F] [Am] [Bb] [G]
[F] [Am] [F] [G]
[F] [Am] [*solo piano][G]
[C]
`);
  });

  it('parts, "inter::" and "estribillo." as a chorus repeat', () => {
    const song = parseChordPro(cho('Cusco'));
    expect(song.sections.map((s) => s.label ?? s.kind)).toEqual([
      'Intro',
      'Estrofa',
      'Pre-coro',
      'Estribillo',
      'Interludio',
      'Estrofa',
      'Pre-coro',
      'none',
    ]);
    expect(cho('Cusco')).toContain('{end_of_prechorus}\n\n{chorus}\n');
  });

  it('red and blue chords become piano notes; parentheses go above their chord', () => {
    const text = cho('Fuego de noviembre');
    expect(text).toContain('{start_of_verse: Estrofa 1}\n[*Sin piano][G] [D] [Bm] [F#7]\n[G] [D] [Bm] [F#7]\n[G] [D] [*Entra piano][C#°]');
    expect(text).toContain('{start_of_verse: Estrofa 2}\n[G] [D] [Bm] [F#7]');
    expect(text).toContain('[*SOL SILENCIO][G] [D]');
    expect(text).toContain('[G] [*PAUSA][D]');
  });

  it('"x2" of a one-line part goes into its name', () => {
    expect(cho('Prueben que bueno')).toContain('{start_of_verse: Estrofa x2}\n[G] [Gm] [D] [Bm] [Em] [A7] [D] [D7]\n');
    expect(cho('Prueben que bueno')).toContain('[G] [Gm] [D] [D7] [*x2]\n[G] [Gm]');
  });

  it('"Intro y Estrofa", "Estrofa y Pre" and "Inter" without colon', () => {
    const labels = parseChordPro(cho('Vida en abundancia')).sections.map((s) => s.label);
    expect(labels).toEqual(['Intro', 'Estrofa', 'Pre-coro', 'Estrofa', 'Pre-coro', 'Estribillo x2', 'Interludio']);
  });

  it('"Estribillo vida en abundancia" copies that song\'s chorus', () => {
    expect(cho('Esto que soy')).toContain('[*Como en «Vida en abundancia»][F#m] [D] [A] [E]');
  });

  it('part names on their own line, chords below', () => {
    expect(cho('Amor como fuego')).toContain('{start_of_verse: Estrofa}\n[D] [D7m] [G] [Gm] [D]\n[D] [D7m] [G] [A] [D]\n');
  });

  it('a title starting like a part name is still a title', () => {
    expect(parseChart(linesFromText('SOLO PARA TI\nestrofa: C - G')).map((s) => s.title)).toEqual(['Solo para ti']);
    expect(parseChart(linesFromText('PRESENTE\nestrofa: C')).map((s) => s.title)).toEqual(['Presente']);
  });
});

describe('mergeChart', () => {
  const chart = parseChart(
    linesFromText(`CUSCO
intro: Bb
estrofa: Bb - Gm
estribillo: Bb - D#
inter: Bb - Gm
estrofa: D# - F
estribillo.
final: Gm`),
  )[0];

  const lyrics = `{title: Cusco}

{start_of_verse: Estrofa 1}
{x_band: voz=Leo}
Uno
{end_of_verse}

{start_of_chorus}
Coro
{end_of_chorus}

{start_of_verse: Estrofa 2}
[C]Dos
{end_of_verse}

{chorus}
`;

  it('adds each progression on top of its part and new parts where they go', () => {
    const r = mergeChart(lyrics, chart);
    expect(r).toMatchObject({ added: 2, skipped: 1, inserted: 3 });
    expect(r.content).toBe(`{title: Cusco}

{start_of_intro: Intro}
[Bb]
{end_of_intro}

{start_of_verse: Estrofa 1}
{x_band: voz=Leo}
[Bb] [Gm]
Uno
{end_of_verse}

{start_of_chorus}
[Bb] [D#]
Coro
{end_of_chorus}

{start_of_interlude: Interludio}
[Bb] [Gm]
{end_of_interlude}

{start_of_verse: Estrofa 2}
[C]Dos
{end_of_verse}

{start_of_outro: Final}
[Gm]
{end_of_outro}

{chorus}
`);
  });

  it('importing twice changes nothing', () => {
    const once = mergeChart(lyrics, chart).content;
    expect(mergeChart(once, chart).content).toBe(once);
  });
});

describe('readDocument (.docx)', () => {
  /** A tiny .docx: a zip with word/document.xml (deflated). */
  async function docx(xml: string): Promise<File> {
    const name = new TextEncoder().encode('word/document.xml');
    const raw = new TextEncoder().encode(xml);
    const deflated = new Response(raw).body!.pipeThrough(new CompressionStream('deflate-raw'));
    const data = new Uint8Array(await new Response(deflated).arrayBuffer());
    const local = new Uint8Array(30 + name.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(8, 8, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, raw.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, 8, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, raw.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, 0, true);
    central.set(name, 46);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, 1, true);
    ev.setUint16(10, 1, true);
    ev.setUint32(12, central.length, true);
    ev.setUint32(16, local.length, true);
    return new File([local, central, end], 'acordes.docx');
  }

  it('reads paragraphs and chord colors', async () => {
    const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const run = (t: string, color?: string) =>
      `<w:r>${color ? `<w:rPr><w:b/><w:color w:val="${color}"/></w:rPr>` : ''}<w:t xml:space="preserve">${t}</w:t></w:r>`;
    const xml = `<w:document ${W}><w:body>
      <w:p>${run('FUEGO')}</w:p>
      <w:p>${run('estrofa: ')}${run('G - D - ', 'CC4125')}${run('Bm', '1155CC')}</w:p>
    </w:body></w:document>`;
    const lines = await readDocument(await docx(xml));
    expect(lines.map((l) => l.text)).toEqual(['FUEGO', 'estrofa: G - D - Bm']);
    const songs = parseChart(lines);
    expect(chartToChordPro(songs[0])).toContain('[*Sin piano][G] [D] [*Entra piano][Bm]');
  });

  it('reads plain text too', async () => {
    const lines = await readDocument(new File(['FARO\nintro: D - A'], 'acordes.txt'));
    expect(parseChart(lines)[0].title).toBe('Faro');
  });
});

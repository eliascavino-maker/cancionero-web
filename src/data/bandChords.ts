import type { DocLine } from '../importer/docx';
import { linesFromText } from '../importer/docx';

/** The band's chord document (Google Doc "acordes"), as text. */
export const BAND_DOC = `ENCONTRARTE
C - G - Am - F x2
G - Am - Fx2 … G
C - G - Am - F
Am - Bb - F - Am - Bb - G
F - Am - F - G
F - Am - G (solo piano)
C

CUSCO
intro: Bb

estrofa: Bb - Gm

pre coro: D# - Bb - F

estribillo: Bb - D# - Bb - D# - Bb - F - Gm

inter:: Bb - Gm

estrofa: D# - F - Gm - F

pre coro: D# - Bb - F

estribillo.

FARO
intro: D - F#m - A - E

estrofa: D - F#m - A - E

FUEGO DE NOVIEMBRE
intro: G - D - G - D - C#º - F#7 - Bm

1 estrofa: G - D - Bm - F#7
         G - D - Bm - F#7
         G - D - C#º - F#7 - Bm

2 estrofa: G - D - Bm - F#7
         G - D - Bm - F#7
         G - D - C#º - F#7 - Bm

estribillo: G - D - F#7 - Bm
          G (SOL SILENCIO) - D - C#º - F#7 - Bm - Bm/A
          G - D (PAUSA) - C#º - F#7 - Bm

final: Bm - Bm/A - Bm/G - Em - F#7 - Bm

PRUEBEN QUE BUENO
intro: D - D7 - G - A7 - D
       D - G - A7 - D - D7

estrofa: G - Gm - D - Bm - Em - A7 - D - D7 x2

pre coro: G - Gm - D - D7 x2
          G - Gm - D - Bm - Em - A7 - D - D7

ESTO QUE SOY

Estrofa: A - F#m - D - A

Estribillo:  E - F#m - D - A - E - F#m - C#m - D - E - A x2

Estribillo vida en abundancia

VIDA EN ABUNDANCIA

Intro y Estrofa: A - D - E

Pre estribillo: F#m - D - A - E (blancas)

Estrofa y Pre

Estribillo: F#m - D - A - E - F#m - D - A - E x2

Inter A - D - E

AMOR COMO FUEGO
intro
D
estrofa
D D7m G Gm D
D D7m G A D

estribillo
Bm G D A x2
D A Bm G A D

interludio
Bm G D A
`;

/** Paints `from`..end of a line in a color (as the Doc does). */
function paint(line: DocLine, from: string, color: string, to?: string) {
  const start = line.text.indexOf(from);
  const end = to ? line.text.indexOf(to, start) + to.length : line.text.length;
  for (let i = start; i < end; i++) line.colors[i] = color;
}

/** The document with the colors of "Fuego de noviembre": red = no piano, blue = piano comes in. */
export function bandDocLines(): DocLine[] {
  const lines = linesFromText(BAND_DOC);
  const at = lines.findIndex((l) => l.text.startsWith('1 estrofa'));
  paint(lines[at], 'G', 'cc4125');
  paint(lines[at + 1], 'G', 'cc4125');
  paint(lines[at + 2], 'G', 'cc4125', 'D');
  paint(lines[at + 2], 'C#º', '1155cc');
  return lines;
}

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

/**
 * The "REPERTORIO" document, as text. Same songs as before (Vida en abundancia,
 * Esto que soy, Amor como fuego) are left out: they're in BAND_DOC.
 * "Dios de la vida" comes with lyrics, so it's written by hand in bandSongs.ts.
 * Small fixes so it reads well: "/" splits into lines, parentheses that only
 * wrap chords are dropped.
 */
export const REPERTORIO_DOC = `MAR ADENTRO
intro: (Voz responde piano x4) G - C - Em - D - A - C - D

estrofa: G - C - G - D

estribillo: G - C - Em - D - A - B - C - D … G

inter: G - C - Em - D - A - C - D

estrofa.

estribillo.

RENDID A YAHVÉ
intro: (Pre estrofa) G - C - G - D

estrofa: G - C - G
         G - F - D

estribillo: C - D - Em … G

UN MONTÓN DE ESTRELLAS
intro: A - F#m - D - E x2

estrofa: A - Em - D - E x2

pre estribillo: F#m - C#m - D - E

estribillo: A - F#m - D - Bm - D - E

CARALUNA
estribillo: A - E - F#m - D - A - E - D - Dm7 x2

estrofa: A - E - Bm - D - A - E - D - Dm7 x2

pre estribillo: D - E - F#m - D - E

estribillo.

ENTRA EN MI VIDA
intro: A - D - A - Bm - A/C# - Dm - E7

estrofa: A - D - A - D - Bm7 - C#m7 - Bm7 - E4 x2

estribillo: A - F#m - D - E4 - A - F#m - D - Bm - D - E - A

LA DE LA MALA SUERTE
estrofa: A - F#m - D - F#m - E x2 … Bm - E

estribillo: A - E - F#m - D - E
            A - E - F#m - D - E

DALE VIEJA DALE
estrofa: E - G#m - C#m - A - F#m - B - A - B

estribillo: E - G# - A - F#m - B - A - B

ESTÁ PASANDO POR AQUÍ
estrofa: E - A - E x2

estribillo: E7 - A - B - G#m - C#m - A - B

ELLA MULTIMILLONARIA
estrofa: E - B - C#m - G#m - A - E - F#m - B

EL LEÓN
Bm - Em - Bm - G - F#
Bm - Em - Bm - F#7 - Bm
Bm - A - G - Em - F#7
Bm - D - Em - G - F#7

GRANITO DE MOSTAZA
estrofa: (Presentación en La menor) Am - E - Am

pre: A7 - Dm - Am - E … A

estribillo: E - A

YA NO MÁS
estrofa: Am - F - C - G

pre: Dm - F - C - G

estribillo: Am - F - C - G

ZAQUEO
D - G - D - D - G - A - Bm - F#m - G - D - D - G - A - D

SAL Y LUZ
B - C#m - E - B
G#m - F# - E9
Anuncia la palabra
B - G#m - F# - C#m - B - A - F#

RECIBAN LA PAZ
A - E - F#m - D - E - A
A - D - A - D - F#m - C#m - D - Bm - E

SOPLA
E - A - C#m - A - B
A - B7
E - A - B
C#m - A - B7

LUZ DE LA CIUDAD
intro
E A
estrofa
E A E B A E x2

estribillo
E A E B A E

final
E D C#m B E
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

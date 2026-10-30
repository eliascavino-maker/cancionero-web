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
E D C#m B E A Am E
`;

/**
 * The "Peña 24/10" document. Sopla, Luz de la ciudad and Ya no más are left
 * out (already in REPERTORIO_DOC). Small fixes so it reads well: "PASAJE" and the
 * repeats in parentheses go on their own lines; the red title (piano doesn't
 * play) becomes a "Sin piano" note.
 */
export const PENA_DOC = `YO TOCO SOLO BOMBO
intro: (Sin piano) E

estrofa: G - A - B7 - Em

estribillo: Em - B7

interludio: Em - C - Am - F … B7

AVE DE LUZ
intro: Bm - G - A

estrofa: Bm - Em - G - A
         Em - G - F# - Bm

estribillo: Bm - G - A - F#m - G
            Em - C#7 - F#7 - Bm

inter: Bm - G - A

LA VOZ DE UN AMIGO
intro: B7 - A - G#m - F#m - E
       B7 - A - B7 - E
       B7 - A - B7 - E

estrofa: B7 - A - E - B7 - E
         B7 - A - G#m - F#m - E

ENGANCHADO DE ZAMBA
estrofa 1: (Sin intro) E - F#7 - B7 - A - E x2
           E - F#7 - B7 - A - G#m - F#m - E

estribillo 1: E - A - Am - G#m - Gm - F#m - B7 - E
              B7 - E
              E - F#7 - B7 - A - G#m - F#m - E

estrofa 2: (Sin intro) E - B - E - A - Am
           E - B - E - C#7 - F#m - B - E x2

estribillo 2: E - G#7 - C#m - A - Am - E
              E - B - E - C#7 - F#m - B - E x2

LA LÓPEZ PEREYRA
estrofa: C - G - C - E7 - Am - F - C - G - C - C7
         F - C - G - C

CHICHARRA
intro: C - F - G

estrofa: C - F - C - G - C
         C - F - C - G - C
         C - G/B - A - A/G - F - C - G - Bb

COMO PÁJAROS EN EL AIRE
intro: G - B7 - Em - G - Am - C - D - C - G

estrofa 1: G - D - F - C - G - G - F - C - D - G
           G - D - F - C - G - B7 - Em - F - C - D - G
           G - D - F - C - G - B7 - Em - F - C - D - G - G/D# - G/E
           C - Bm - Dm - G7 - C - Cm - Bm - A - C - D - G

inter: (Pasaje) D - E - A

estrofa 2: A - E - G - D - A - A - G - D - E - A
           A - E - G - D - A - C#7 - F#m - G - D - E - A
           A - E - G - D - A - C#7 - F#m - G - D - E - A - A/F - A/F#
           D - C#m - Em - A7 - D - Dm - C#m - B - D - E - A

QUE ALCEN SUS MANOS
intro: Dm - Am - Gm - Dm - C
       Dm - Am - Gm - Dm - C
       F - C - Gm - Bb - C
       F - C - Gm - Dm - C

estrofa: C - F - C - G - C
         C - F - C - G - C
         C - G/B - A - A/G - F - C - G - Bb

COMADRE COMPADRE
D - A - Bm - A - D
G - D - A - Bm

BICHO BICHO
intro: C - Am - Dm - G
       C - Am - Dm - G

estrofa: C - Am - F - G
         C - Am - F - G - Em - F - G … (Silencio)

estribillo: C - Am - Dm - G

ILUMINARÁ
intro: Gm - F - Cm
       Gm - F x4

POR QUÉ TE AMO
intro: F#m - E

estrofa: A - E - D - A - E x2
         C#m - F#m - C#m - F#m - D - C#m - Bm - E

estribillo: A - E - D - A - E x2
            A - E - D - E - D - C#m - Bm - E

final: F#m
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

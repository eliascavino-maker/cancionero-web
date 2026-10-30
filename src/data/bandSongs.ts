import { type ChartSong, chartToChordPro, fold, parseChart } from '../importer/chart';
import { bandDocLines } from './bandChords';

/**
 * The band's songs: the lyric sheets (one PDF per song) combined with the
 * chord document. Each part of the lyrics gets its progression on top.
 *
 * Voices in "Faro" come from the highlighted PDF:
 * violeta = Todos, amarillo = Angel, celeste = Sergio, verde = Leo.
 */

const CUSCO = `{title: Cusco}
{key: Bb}

{start_of_intro: Intro}
[Bb]
{end_of_intro}

{start_of_verse: Estrofa 1}
[Bb] [Gm]
Como una gota de agua
dentro de un mar
que viaja en mi interior
vienen latiendo
en los tambores del tiempo
como una oración

Una mirada que transforma
mis dolores en una canción
vuela por mis manos
abrazando las palabras de mi corazón
{end_of_verse}

{start_of_verse: Estrofa 2}
[Bb] [Gm]
Viaja en el tiempo
con impulso del viento
por llegar a mí (a mi voz)
es un camino
que nos lleva al destino
más que el de seguir (a tu voz)

Una plegaria que en mi boca
se desboca en ganas de vivir
y poder seguir
flor de los abrazos
una lluvia de verano
para compartir
{end_of_verse}

{start_of_prechorus: Pre-coro}
[D#] [Bb] [F]
Canta por los que están
y por los que vendrán
{end_of_prechorus}

{start_of_chorus: Estribillo}
[Bb] [D#] [Bb] [D#] [Bb] [F] [Gm]
Soy tu voz hecha de amor y de fiesta
va por mis pies la tormenta
del fuego que despertó
porque soy grito que rompe fronteras
fruto de la primavera
lleno de luna y de sol
{end_of_chorus}

{start_of_interlude: Interludio}
[Bb] [Gm]
{end_of_interlude}

{start_of_verse: Estrofa 3}
[D#] [F] [Gm] [F]
Agua del cielo
va curando con versos
todo mi dolor
tierra y semilla
nuestra vida germina
agradeciendo al sol

Brota en el aire
la conciencia cristalina
que me hará volver
hacia la niñez
{end_of_verse}

{start_of_verse: Estrofa 4}
[D#] [F] [Gm] [F]
Fuego que quema
que transmuta cada pena
para renacer (y poder crecer)
{end_of_verse}

{start_of_prechorus: Pre-coro}
[D#] [Bb] [F]
Siempre estarás aquí
copla que corre en mi
{end_of_prechorus}

{start_of_chorus: Estribillo x2}
[Bb] [D#] [Bb] [D#] [Bb] [F] [Gm]
Soy tu voz hecha de amor y de fiesta
va por mis pies la tormenta
del fuego que despertó
porque soy grito que rompe fronteras
fruto de la primavera
lleno de luna y de sol

Soy tu voz traigo del viento la fuerza
la danza de los que sueñan con un destino mejor
porque soy grito que rompe fronteras
fruto de la primavera
lleno de luna y de sol
lleno de luna y de sol
lleno de luna y de sol
{end_of_chorus}
`;

const AMOR_COMO_FUEGO = `{title: Amor como fuego}
{key: D}

{start_of_intro: Intro}
[D]
{end_of_intro}

{start_of_verse: Estrofa 1}
[D] [D7m] [G] [Gm] [D]
[D] [D7m] [G] [A] [D]
Anhelo un toque de tu amor
Solo un destello de tu gloria en mí, Señor
En un momento todo puedes transformar
Mi vida has cambiado, Dios
{end_of_verse}

{start_of_verse: Estrofa 2}
[D] [D7m] [G] [Gm] [D]
[D] [D7m] [G] [A] [D]
Y no alcanzo a comprender
Tu amor sostiene por completo hoy mi ser
Tu gracia y sangre que mi vida transformó
Borraste mi pasado, Dios
{end_of_verse}

{start_of_prechorus: Pre-coro}
[Bm] [G] [D] [A] [*x2]
Tu amor es como fuego que arde en mi interior
Mi único anhelo, rendirte adoración
Con tu fuego lléname
{end_of_prechorus}

{start_of_chorus: Estribillo}
[D] [A] [Bm] [G] [A] [D]
Que tu amor me atraiga
Al lugar donde Tú estás
Quiero más de Ti, Señor
{end_of_chorus}

{start_of_interlude: Interludio}
[Bm] [G] [D] [A]
{end_of_interlude}

{start_of_verse: Estrofa 3}
[D] [D7m] [G] [Gm] [D]
[D] [D7m] [G] [A] [D]
Me rindo ante ti, Jesús
Me entrego humilde ante el mensaje de la cruz
Y me abandono en tu presencia y amor
Jamás seré igual, oh, Dios
{end_of_verse}

{start_of_prechorus: Pre-coro}
[Bm] [G] [D] [A] [*x2]
Tu amor es como fuego que arde en mi interior
Mi único anhelo, rendirte adoración
Con tu fuego lléname
{end_of_prechorus}

{start_of_chorus: Estribillo}
[D] [A] [Bm] [G] [A] [D]
Que tu amor me atraiga
Al lugar donde Tú estás
Quiero más de Ti, Señor
En la cruz hoy me rindo
Seguiré tu llamado, Dios
Cristo, pertenezco a Ti
{end_of_chorus}
`;

const FARO = `{title: Faro}
{key: A}

{start_of_intro: Intro}
[D] [F#m] [A] [E]
{end_of_intro}

{start_of_verse: Estrofa}
[D] [F#m] [A] [E]
{x_voz: Todos}
Nadie llegó esperando a nadie
Pensó en equivocarse,
Y aún así pasó…
Esa mirada de la vida,
Donde todos te lastiman,
No sirvió
{x_voz}

Toca mover [*Todos]de nuevo fichas,
Toca ser lo que se [*Todos]aprendió,
Reconocer [*Todos]las melodías,
{x_voz: Todos}
Si no resuenan, hola y adiós…
{x_voz: Leo}

Seamos honestos, aceptemos
El hecho de perdernos, y ganar.
Tarde o temprano lo que somos,
Inevitablemente, se verá
{end_of_verse}

{start_of_chorus: Estribillo}
[*Todos]Para [*Angel]alumbrarnos la salida,
[*Angel]Para podernos [*Todos]perdonar,
{x_voz: Todos}
Para lamernos las heridas,
Voy a tu lado y sé que estarás
{x_voz: Sergio}

Si es el momento de partir
{x_voz}
Vámonos sin odiar,
{x_voz: Sergio}
Démonos las gracias y a seguir,
{x_voz}
Que fue amor, y lo será
{end_of_chorus}

{start_of_chorus: Estribillo}
Para alumbrarnos la salida,
Para podernos perdonar,
Para besarnos [*Todos]las heridas,
{x_voz: Todos}
Voy a tu lado y sé que estarás
{end_of_chorus}
`;

const BENDECIRE = `{title: Bendeciré al Señor}
{subtitle: Prueben qué bueno}
{key: G}

{start_of_intro: Intro}
[D] [D7] [G] [A7] [D]
[D] [G] [A7] [D] [D7]
{end_of_intro}

{start_of_verse: Estrofa 1}
[G] [Gm] [D] [Bm] [Em] [A7] [D] [D7] [*x2]
Bendeciré al Señor en todo tiempo,
y mi boca no dejará de alabarlo.
Mi alma se enorgullece en el Señor,
que lo oigan los humildes y se alegren.
{end_of_verse}

{start_of_chorus: Estribillo}
[G] [Gm] [D] [D7] [*x2]
[G] [Gm] [D] [Bm] [Em] [A7] [D] [D7]
Prueben qué bueno es el Señor,
hagan la prueba y véanlo.
Dichoso aquel
que busca en El, refugio
{end_of_chorus}

{start_of_verse: Estrofa 2}
[G] [Gm] [D] [Bm] [Em] [A7] [D] [D7] [*x2]
Engrandezcan conmigo al Señor,
ensalcemos todos su Nombre.
Busqué al Señor, y me dio una respuesta,
me libró de todos mis temores.
{end_of_verse}
`;

const SOPLO_DE_DIOS = `{title: Soplo de Dios}
{key: E}

{start_of_chorus: Estribillo}
SOPLO DE DIOS DAME VIDA, DAME VIDA
SOPLO DE DIOS DAME VIDA, DAME VIDA
{end_of_chorus}

{start_of_verse: Estrofa 1}
Suave brisa de la paz
Tu rumor me trae calma
Frente a los terremotos
Mi manto cubrirá mi rostro
Mantenme de pie en la entrada
Yo quiero oír tu palabra
{end_of_verse}

{chorus}

{start_of_verse: Estrofa 2}
Viento de la libertad
No sé de dónde vienes, ni a dónde vas
Pero te oigo y sé que estás
Como Nicodemo, Señor
Quisiera nacer de tu aliento
{end_of_verse}

{chorus}

{chorus: Estribillo en F#}

{start_of_outro: Final}
Sopla Espíritu Santo tu Amor

Sin vos no tiene sentido mi Voz
No tiene sentido sin vos
No tengo sentido sin Dios
{end_of_outro}
`;

const REFLEJO_DE_DIOS = `{title: Reflejo de Dios}
{key: A}

{start_of_verse: Estrofa 1}
Tal como soy oí tu voz hablando al corazón,
tú sabes lo que guardo en mi interior,
mira bien mi Señor;

seguirte me da miedo temo fallar,
mi vida me es difícil poder dejar,
pero cómo negarme si sentí tu amor,
si escuche tu voz en mi corazón:
{end_of_verse}

{start_of_chorus: Estribillo}
Tú eres mi instrumento
elegido para llevar mi nombre,
tú eres la esperanza
que dará paz y consuelo a los hombres,
yo soy tu Dios, contigo yo voy,
contigo siempre estoy, por ti la vida doy,
ven sígueme que yo te cuidaré, te amo y te amaré,
en mi reflejo te transformaré.
{end_of_chorus}

{start_of_verse: Estrofa 2}
No sé hablar, no sé cantar, ¿en qué podré ayudar?
Pero que se haga en mí tu voluntad,
me entrego a ti sin ver atrás;

tu espíritu que encienda mi corazón,
que me haga iluminar y reflejar tu amor,
que quiero ir a gritar que tú eres salvación
y que mi bendición fue oír tu voz:
{end_of_verse}

{chorus}
`;

export interface BandSong {
  title: string;
  content: string;
  /** Other names it may have in the library (e.g. its chord-sheet title). */
  aliases: string[];
}

const WITH_LYRICS: BandSong[] = [
  { title: 'Cusco', content: CUSCO, aliases: [] },
  { title: 'Amor como fuego', content: AMOR_COMO_FUEGO, aliases: [] },
  { title: 'Faro', content: FARO, aliases: [] },
  { title: 'Bendeciré al Señor', content: BENDECIRE, aliases: ['Prueben que bueno'] },
  { title: 'Soplo de Dios', content: SOPLO_DE_DIOS, aliases: [] },
  { title: 'Reflejo de Dios', content: REFLEJO_DE_DIOS, aliases: [] },
];

/** Every band song: the ones with lyrics, plus the chord-only ones from the chord document. */
export function bandSongs(): BandSong[] {
  const chart: ChartSong[] = parseChart(bandDocLines());
  const covered = new Set(WITH_LYRICS.flatMap((s) => [s.title, ...s.aliases].map(fold)));
  const chordsOnly = chart
    .filter((s) => !covered.has(fold(s.title)))
    .map((s) => ({ title: s.title, content: chartToChordPro(s, chart), aliases: [] }));
  return [...WITH_LYRICS, ...chordsOnly];
}

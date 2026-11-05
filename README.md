# Cancionero

Página web tipo OnSong: canciones en formato ChordPro, acordes dibujados sobre
la letra, transposición, biblioteca y setlists con modo escenario.

React + TypeScript + Vite. Los datos se guardan en el navegador (IndexedDB) y,
si el dispositivo está en una banda, se sincronizan con Supabase.

## Uso

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests (Vitest)
npm run typecheck
npm run build      # genera dist/, se puede subir a cualquier hosting estático
```

`base: './'` en `vite.config.ts` hace que `dist/` funcione desde cualquier
carpeta (GitHub Pages, Netlify, etc.). Las rutas usan `#/...`, así que no hace
falta configurar el servidor.

## Datos

- Sin banda, todo queda en el navegador donde se cargó. Otro navegador o
  dispositivo arranca vacío. Con banda, se sincroniza (ver abajo).
- **Exportar / Importar** (en Biblioteca) baja o carga un respaldo `.json`.
  Sin banda, importar reemplaza todo; con banda, agrega lo del respaldo.
- El editor abre archivos `.cho`, `.chopro`, `.chordpro`, `.pro`, `.txt`.

## Banda y sincronización

- En **Banda** cada uno entra con email y contraseña. El owner crea la banda
  e invita con un link de un solo uso (vence a los 7 días).
- Canciones y setlists se guardan primero en el dispositivo y se suben solos
  cuando hay conexión. La pestaña Banda muestra un punto si hay cambios sin
  subir o algo para leer.
- Si dos personas editan la misma canción a la vez, queda la que llegó
  primero y la otra se guarda como «Título (conflicto)». En los setlists gana
  el último cambio.
- Todos crean y editan. Solo el owner borra canciones, invita, saca miembros
  y borra la banda. Borrar no es definitivo: va a **Banda → Borrados**.
- **Historial** (en la canción y en el menú del setlist): quién cambió qué y
  cuándo, con botón para volver atrás. Guarda los últimos 30 cambios de cada
  cosa, de los últimos 90 días.
- Sin `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (en `.env.local` o en los
  secrets de Actions) la app funciona como antes, solo en el dispositivo.

### Supabase

Las migraciones están en `supabase/migrations/` y cada una tiene su consulta
de verificación en `supabase/verify/` (todas las filas tienen que dar
`ok = true`). `supabase/diagnostics/privilegios.sql` muestra qué privilegios
tienen anon y authenticated y cuáles sobran. `npm test` las aplica en un Postgres local (PGlite) y prueba
los permisos.

## Sin conexión

- Después de abrirla una vez con internet, la app funciona sin conexión: un
  service worker (`vite-plugin-pwa`) guarda la app y las fuentes.
- Cuando hay una versión nueva aparece **Hay una versión nueva · Actualizar**.
  No se actualiza sola, así la página no se recarga en medio de un show. En
  ▶ Tocar y en la Sala en vivo el aviso no aparece.
- En iPhone conviene instalarla en la pantalla de inicio (Compartir → Agregar a
  inicio): Safari puede borrar los datos de sitios que no se abren en 7 días.
- **Pantalla completa** en iPhone: el navegador no la tiene, así que el botón
  esconde la barra de abajo, el encabezado y los controles, y deja solo la
  canción. Se sale tocando la pantalla, con el botón chico de arriba o con Esc.
  En Safari, sin instalar, la primera vez de cada visita avisa cómo sacar
  también las barras de Safari, hasta que tocás «No mostrar de nuevo».

## Vista de canción

- **Letra / Acordes**: Letra muestra solo la letra (sin acordes, intros ni
  tablaturas), para quien canta. Acordes muestra los acordes sobre la letra y
  los controles de tono.
- **Quién sos** (Banda → Vos; en una banda, la app lo pregunta la primera
  vez): elige la vista de arranque, Acordes si tocás y Letra si solo cantás, y
  resalta en las dos vistas las líneas que cantás, las de «Todos» y tus coros
  (con borde punteado). La elección queda en el dispositivo y en tu cuenta, así
  un dispositivo nuevo arranca igual.
- **Indicaciones** («4 compases de intro», «x2», «Corte»): van en su propio
  renglón, nunca encima de la letra, en Letra y en Acordes. El ícono de la
  bandera las oculta o las muestra. Se agregan con ✎ → Indicaciones (tocando
  una línea, o «Indicación al final» de una parte) o en el editor de texto.
- **Segunda voz**: las palabras o líneas que lleva una segunda voz se ven en
  cursiva, subrayadas con puntos y en el color de quien la canta, con
  «2ª voz · Angel» al lado. Se marca en ✎ → Voces (eligiendo líneas) o, para
  palabras sueltas, seleccionándolas en el editor de texto y tocando
  **Segunda voz**. A quien la canta se le resaltan esas líneas.
- **Mi capo** (botón con las cuerdas, en Acordes): cada músico pone su capo en
  una canción y ve las formas de los acordes para tocar con ese capo, sin
  cambiar el tono real. La cabecera dice «Tono: Bb · Mi capo 3 · formas de G».
  **Sugerir** elige el capo (hasta el 7) que deja las formas más fáciles
  (G, C, D, A, E, Am, Em, Dm…). Se suma al tono del setlist y al del director
  en la Sala en vivo. Lo ve solo quien lo puso: en su tarjeta del setlist dice
  «Mi capo 3». Cada arreglo tiene el suyo. Se guarda en el dispositivo y, en
  una banda, en tu cuenta (`band_members.prefs.capo`), así lo ves igual en el
  celu y en la compu.
- **Autoscroll** (▶): baja solo la página. 🐢/🐇 cambian la velocidad, que se
  recuerda por canción. Si la canción tiene `{duration: 3:30}`, arranca en
  `auto`: llega al final en ese tiempo. Tocar la pantalla o mover la rueda
  pausa; la barra espaciadora pausa y reanuda. Mientras se desplaza, la
  pantalla no se apaga, en los navegadores que lo permiten.

## Arreglos

- Una canción puede tener **arreglos** (acústica, con banda, otro tono): cada
  uno con su propio texto, ligado a la original. En la biblioteca aparece solo
  la original, con «2 arreglos» abajo; buscar el nombre del arreglo también la
  encuentra.
- Arriba de la canción están **Original · Acústica · …** para pasar de uno a
  otro, y **+ Arreglo** para hacer uno nuevo a partir de lo que se ve. Si
  cambiaste el tono, el arreglo nace en ese tono y se propone «En A» como
  nombre. El lápiz renombra el arreglo.
- En el setlist, las canciones con arreglos tienen un selector para elegir
  cuál se toca. Al cambiarlo vuelve a su tono propio. El historial del setlist
  lo registra y «Volver acá» también vuelve el arreglo.
- Borrar la original no borra los arreglos: quedan como canciones sueltas.

## Tocar un setlist

Desde un setlist, **▶ Tocar**. Las flechas ←/→ cambian de canción: sirven
los pedales Bluetooth para pasar páginas configurados en flechas. El tono que
elijas ahí se guarda para esa canción en ese setlist.

En **▶ Tocar** y en la **Sala en vivo**:

- **Franja de arriba**: la parte («Estribillo · 2/3 partes», solo en la sala)
  y la canción («Canción 4 de 12»). Tocarla abre el **mapa** del setlist para
  saltar a otra canción o parte.
- **Modo escenario** (ícono de pantalla): negro puro, letra blanca, acordes
  amarillos y letra más grande (con su propio tamaño, A−/A+). Solo quedan la
  franja y los botones del director; tocar la canción muestra el resto unos
  segundos. La pantalla no se apaga. Pide pantalla completa donde el
  navegador la tiene; en iPhone esconde los controles de la app (instalada,
  sin barras de Safari). Se recuerda en el dispositivo y en tu cuenta.
- **Candado**: la pantalla ignora los toques. Se desbloquea manteniendo
  apretado 2 s (o Enter). Los pedales, el teclado y el director siguen
  andando.
- Al cambiar de canción o parte hay una animación corta, salvo con «reducir
  movimiento» activado en el sistema.

## Sala en vivo

Solo para los miembros de la banda, cada uno con su cuenta.

- **Abrir la sala:** desde un setlist, con **Sala en vivo**. Arranca sin
  director, y a los demás les aparece **En vivo** abajo.
- **Ser director:** el primero que lo toca dirige, y todos ven
  «Dirige: Sergio». Si ya hay director, **Tomar la dirección** pide
  confirmación. **Dejar de dirigir** deja la sala abierta sin director: cada uno
  navega libre.
- **Dirigir:** con los botones grandes **Parte anterior** y **Parte siguiente**
  (después de la última parte sigue la próxima canción), tocando una parte, o
  con ↑/↓ y RePág/AvPág. ←/→ cambian de canción. La canción, la parte y el tono
  llegan a los demás en unos 60 ms.
- **Seguir:** quien sigue ve la parte actual marcada y en pantalla, con su
  vista y su resaltado. Moverse a mano o **Dejar de seguir** lo suelta.
- **Contar:** el director toca **Contar** y a todos les aparece la cuenta
  grande (4-3-2-1) al BPM de la canción. Los tiempos salen de `{time}` (3/4
  cuenta 3); sin `{tempo}`, uno por segundo.
- **Señales:** el director elige un cartel («Último coro», «Cortar»…) y sale
  grande en todas las pantallas 3,5 s, con su color. Las que tienen «Vibra»
  hacen vibrar los teléfonos que pueden (Safari en iPhone no). La lista la
  cambia el owner en **Banda → Señales en vivo** (hasta 12).
- La cuenta y las señales solo se muestran si vienen de quien dirige.
- **Por dentro:** quién dirige está en `live_sessions`. La posición va por
  broadcast en el canal privado `live:<banda>`, sin pasar por la base. Presence
  solo dice quién está, porque Supabase limita cuántas veces se actualiza.
  Quien entra tarde o se reconecta pide la posición con `hello`. La sala vence
  a las 12 h sin cambios. La cuenta (`count`) y las señales (`signal`) van
  por el mismo canal; la lista de señales está en `bands.live_signals`
  (migración 6).

## Estructura

| Ruta | Qué hace |
| --- | --- |
| `src/chordpro/song.ts` | Modelo: `Song`, secciones, líneas, segmentos acorde+letra |
| `src/chordpro/parser.ts` | Parser ChordPro tolerante a errores |
| `src/chordpro/writer.ts` | `Song` → texto ChordPro (guardar una transposición) |
| `src/music/chord.ts` | Notas y acordes, notación inglesa y latina |
| `src/music/transposer.ts` | Transposición de acordes, tonos y canciones |
| `src/music/capo.ts` | Formas con capo y el capo sugerido |
| `src/components/SongView.tsx` | Dibuja la canción con los acordes sobre la letra |
| `src/data/library.ts` | IndexedDB: canciones, setlists, orden, respaldo |
| `src/cloud/sync.ts` | Sube y baja cambios con la banda; resuelve conflictos |
| `src/cloud/CloudProvider.tsx` | Sesión, banda y cuándo sincronizar |
| `src/live/room.ts` | Sala en vivo: director, posición por broadcast, quién está |
| `supabase/` | Migraciones, consultas de verificación y tests de permisos |
| `src/app/` | Pantallas, rutas y preferencias |

## ChordPro soportado

- Metadatos: `title/t`, `subtitle/st`, `artist`, `composer`, `album`, `year`,
  `key`, `capo`, `tempo`, `time`, `duration`, `meta: nombre valor`.
- Secciones `start_of_/end_of_` verse, chorus, bridge, tab, grid y nombres
  propios (`start_of_intro`); formas cortas `soc/eoc`, `sov/eov`, `sob/eob`,
  `sot/eot`, `sog/eog`; etiqueta `{sov: Verso 1}` o `{sov label="Verso 1"}`.
- `{chorus}` repite el último estribillo.
- Comentarios `c`, `ci`, `cb`, `highlight`. Las líneas `#` se ignoran.
- Anotaciones `[*Rit.]`: se muestran como acorde y no se transponen.
- Propias de la app (las demás apps ignoran las directivas `x_`):
  - `{x_band: voz=…; coros=…; tocan=…}` y `{x_voz: Leo}`: quién canta y toca.
  - `{x_cue: 4 compases de intro}`: indicación en su propio renglón.
  - `{x_voz2: Angel}` … `{x_voz2}`: segunda voz en esas líneas. Con
    `((palabras))` solo esas palabras son segunda voz.
- `\[` y `\]` para corchetes literales.
- No soportado: selectores (`{title-guitar: …}`, se ignoran), directivas de
  formato (`textfont`, `columns`, …), varias canciones por archivo.

## Transposición

- Acordes en inglés (`C`, `F#m7b5/C`) y latino (`Do`, `Fa#m/La`, `Sib7`); se
  mantiene la notación de la canción.
- Sostenidos o bemoles según el tono destino: F, Bb, Eb, Dm, Gm… usan
  bemoles; G, D, A, E, Bm… sostenidos; C y Am la forma más común
  (C# Eb F# Ab Bb).
- Sin `{key}`, el primer acorde define el tono.
- Lo que no es acorde (`N.C.`, `Intro`, `[Solo]`) queda igual.

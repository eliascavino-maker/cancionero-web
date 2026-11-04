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
  No se actualiza sola, así la página no se recarga en medio de un show. En el
  modo escenario el aviso no aparece.
- En iPhone conviene instalarla en la pantalla de inicio (Compartir → Agregar a
  inicio): Safari puede borrar los datos de sitios que no se abren en 7 días.

## Vista de canción

- **Letra / Acordes**: Letra muestra solo la letra (sin acordes, intros ni
  tablaturas), para quien canta. Acordes muestra los acordes sobre la letra y
  los controles de tono.
- **Autoscroll** (▶): baja solo la página. 🐢/🐇 cambian la velocidad, que se
  recuerda por canción. Si la canción tiene `{duration: 3:30}`, arranca en
  `auto`: llega al final en ese tiempo. Tocar la pantalla o mover la rueda
  pausa; la barra espaciadora pausa y reanuda. Mientras se desplaza, la
  pantalla no se apaga, en los navegadores que lo permiten.

## Modo escenario

Desde un setlist, **▶ Tocar**. Las flechas ←/→ cambian de canción: sirven
los pedales Bluetooth para pasar páginas configurados en flechas. El tono que
elijas ahí se guarda para esa canción en ese setlist.

## Estructura

| Ruta | Qué hace |
| --- | --- |
| `src/chordpro/song.ts` | Modelo: `Song`, secciones, líneas, segmentos acorde+letra |
| `src/chordpro/parser.ts` | Parser ChordPro tolerante a errores |
| `src/chordpro/writer.ts` | `Song` → texto ChordPro (guardar una transposición) |
| `src/music/chord.ts` | Notas y acordes, notación inglesa y latina |
| `src/music/transposer.ts` | Transposición de acordes, tonos y canciones |
| `src/components/SongView.tsx` | Dibuja la canción con los acordes sobre la letra |
| `src/data/library.ts` | IndexedDB: canciones, setlists, orden, respaldo |
| `src/cloud/sync.ts` | Sube y baja cambios con la banda; resuelve conflictos |
| `src/cloud/CloudProvider.tsx` | Sesión, banda y cuándo sincronizar |
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

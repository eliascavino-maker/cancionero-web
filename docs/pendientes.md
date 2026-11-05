# Pendientes

Mejoras pedidas, por etapas. Cada etapa: commit, tests y deploy en verde. Si
lleva migración, va con su verificación en `supabase/verify/`.

## Etapa A — En vivo (sala y director)

Migración 006 (señales de la banda). Lo demás va por broadcast en `live:<banda>`.

- [x] **Modo escenario**: tema ultra oscuro, alto contraste, letra grande, solo
  lo indispensable (el resto aparece al tocar). En la Sala en vivo y en ▶ Tocar.
  Se recuerda en el dispositivo y en la cuenta (`band_members.prefs.stage`).
  Pide pantalla completa donde existe; en iPhone esconde los controles de la app.
- [x] **Bloqueo**: candado que ignora los toques. Se desbloquea manteniendo
  apretado 2 s. Los pedales y el teclado siguen andando, y el director sigue
  llegando.
- [x] **Cuenta regresiva**: el director toca «Contar» y a todos les aparece la
  cuenta al BPM de la canción (tiempos según `{time}`, 4 si no hay).
- [x] **Señales del director**: cartel grande unos segundos en todas las
  pantallas, con color y vibración opcional (Safari en iPhone no vibra). Lista
  editable por el owner en Banda.
- [x] **Barra de progreso**: «Coro · 3/6» y «Canción 4 de 12». Tocarla abre el
  mapa para saltar.
- [x] **Animación** al cambiar de parte o canción, sin animar con
  `prefers-reduced-motion`.

## Etapa B — Canciones y arreglos (migración 007)

- [x] Arreglos ligados a la original (`songs.arrangement_of`), elegibles en el setlist.
- [x] Indicaciones por compás en renglón propio (`{x_cue: …}`), ocultables.
- [x] Segunda voz / armonía con otro color y quién la canta.

## Etapa C — Música

- [x] Transposición por persona (`band_members.prefs.capo`), sin cambiar el tono real.

## Etapa D — Importar y marca (migraciones 008 y 009, Edge Function)

- [ ] Importar desde un link con la Edge Function `import-url` (solo miembros,
  con límite de uso). Si no se puede leer, ofrecer pegar el texto.
- [ ] Logo de la banda en Storage. Antes: crear «Exportar PDF».

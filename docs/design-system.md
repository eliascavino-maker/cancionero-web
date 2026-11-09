# Sistema de diseño · En Contra

La app es el cancionero impreso del atril: negro y blanco como la marca de la
banda, títulos en serif, líneas finas. El color aparece solo cuando dice algo.

Los tokens viven en `src/styles.css` (`:root` es el tema oscuro, por defecto;
`:root[data-theme='light']` el claro; `:root.stage-mode` el modo escenario).
Siempre se usan los tokens, nunca un hex suelto.

## Color

### Marca (estructura)

| Token | Oscuro | Claro | Para qué |
| --- | --- | --- | --- |
| `--fondo` | `#000000` | `#ffffff` | Fondo de página |
| `--hoja` | `#121212` | `#ffffff` | Menús, hojas, diálogos, barra de controles |
| `--tecla` / `--tecla-alta` / `--tecla-luz` | `#1c1c1c` / `#262626` / `#333333` | `#f2f2f2` / `#e8e8e8` / `#dcdcdc` | Botones, hover, segmento elegido |
| `--hueco` | `#121212` | `#f4f4f4` | Campos: búsqueda, inputs |
| `--tinta` | `#ffffff` | `#000000` | Letra y títulos |
| `--grafito` | `#bdbdbd` | `#474747` | Texto secundario |
| `--humo` | `#8a8a8a` | `#6b6b6b` | Etiquetas, placeholders, navegación inactiva (≥ 4.5:1) |
| `--tenue` | `#5c5c5c` | `#a3a3a3` | Deshabilitado, líneas de otro cantante atenuadas |
| `--filo` / `--filo-fuerte` | blanco 11 % / 20 % | negro 10 % / 20 % | Líneas finas |
| `--foco` | blanco 7 % | negro 5 % | Fila elegida, parte que suena |
| `--accion` / `--sobre-accion` | blanco / negro | negro / blanco | Acción principal |
| `--anillo` | blanco | negro | Anillo de foco |

### Funcionales (informan)

| Token | Oscuro | Claro | Qué dice |
| --- | --- | --- | --- |
| `--acorde` | `#f5a524` | `#9a5800` | Acordes y tono. El único color de la hoja de Acordes |
| `--vivo` | `#ff3b30` | `#d70015` | Sala en vivo abierta, EN VIVO |
| `--error` | `#ff7a70` | `#c42b30` | Errores y borrar |
| `--ok` | `#4cd47a` | `#1a7f3c` | Sincronizado, hecho |

Sin conexión se dice con gris (`--humo`) más ícono y texto: no es un error.
Los estados nunca van solo con color: siempre con ícono o palabra.

### Cantantes

Los tonos del resaltador de la banda, nivelados para leerse igual en negro
(`src/data/band.ts`): Sergio `#4db2f7`, Leo `#45c98a`, Angel `#efe15a`,
Leandro `#f27bb6`, Todos `#a78bfa`, Elias `#ff8a3d` (no canta: solo avatar).
El color de la persona llega como `--m`. Para texto se mezcla con `--tinta`
(`color-mix(in srgb, var(--m) 75%, var(--tinta))`), así en el tema claro se
oscurece solo.

El amarillo de Angel y el ámbar de los acordes nunca se confunden porque son
cosas distintas: el acorde es texto sobre la sílaba; el cantante es una raya
al costado o un subrayado.

### Señales del director

Cada señal tiene el color que elige el owner. Fondo lleno y texto que
contrasta (`src/live/signals.ts`).

## Tipografía

- `--font-marca`: **Tinos** (el diseño de Liberation Serif), 700. Nombre de la
  banda, títulos de página y de canción, títulos de diálogos, etiquetas de
  parte (en itálica).
- `--font-letra`: **Atkinson Hyperlegible Next**. La letra y toda la interfaz.
  Hecha para leer con poca luz y a distancia.
- Escala 1,25 sobre 16 px: 12 · 13 · 16 · 20 · 25 · 31 · 39 · 49. La letra va
  de 18 a 40 px con A− / A+.
- Números que cambian (tono, BPM, contadores): `font-variant-numeric: tabular-nums`.
- Sin mayúsculas sostenidas, salvo el cartel EN VIVO.

## Espacio, forma y profundidad

- Base 4 px. Márgenes de página 16 px en celular.
- Radios: `--r-chico` 6 px (chips chicos), `--r-boton` 10 px (botones,
  inputs), `--r-panel` 14 px (paneles, barra de controles), `--r-hoja` 20 px
  (hojas inferiores y diálogos). Chips de filtro y avatares, redondos.
- Profundidad por escalones de superficie y líneas finas. Sombra
  (`--sombra`) solo en lo que flota: menú, hoja, diálogo, fila arrastrada.
- Listas como filas con línea fina abajo, no tarjetas.
- Objetivos táctiles de 44 px como mínimo.

## Navegación

- Celular: barra inferior con Biblioteca, Setlists, En vivo y Banda. La
  sección actual lleva una rayita arriba. En vivo se pone rojo con un punto si
  hay una sala abierta.
- Tablet y compu (≥ 900 px): barra lateral de 232 px con el escudo y el
  nombre de la banda (`--side-w`). La barra inferior desaparece (`--nav-h: 0`).
- En ▶ Tocar y la sala en vivo no hay navegación (`.app--stage`).

## Estados

- Hover: un escalón de superficie (`--tecla` → `--tecla-alta`).
- Activo (al tocar): `scale(0.97)`, nunca menos de 0.95.
- Foco: anillo de 2 px `--anillo` con 2 px de separación.
- Deshabilitado: opacidad 0.35.
- Cargando: esqueletos con la forma del contenido, no spinners.
- Vacío: una frase que dice qué hacer y el botón para hacerlo.
- Error: `--error`, con qué pasó y cómo se arregla.

## Movimiento

- Curva: `--ease` `cubic-bezier(0.23, 1, 0.32, 1)`.
- Duraciones: `--t-toque` 150 ms (botones), `--t-hoja` 200 ms (hojas, menús),
  `--t-parte` 250 ms (cambio de parte o canción).
- Solo `transform` y `opacity`. Nada de `transition: all`.
- Con «reducir movimiento» del sistema: sin desplazamientos, solo fundidos.

## Señal propia: el mapa de barras

El mapa de la canción son barras apiladas, como la cruz de la banda: una por
parte, largas según la parte. La parte que suena es blanca y se corre hacia
afuera. Va en la sala en vivo, el modo escenario y la canción.

## Marca

`src/components/BrandMark.tsx`: el escudo EC (E espejada arriba, C abajo).
Es un placeholder hasta tener el SVG de la banda; se cambia ahí y se usa en
la barra lateral, el inicio, el splash, el ícono de la PWA, la sala en vivo y
los PDF.

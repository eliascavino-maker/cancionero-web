# Cancionero design system: the songbook on the music stand

Black and white like En Contra's mark, serif titles, hairlines. Color only
when it informs: chords, who sings, live / offline / error / ok, the leader's
signals. Read from a music stand ~1.5 m away, in low light.

Full reference (Spanish, for the band): `docs/design-system.md`. Tokens live
in `src/styles.css`: `:root` dark (default), `:root[data-theme='light']`,
`:root.stage-mode`. Use the tokens, never raw hex.

## Tokens

- Surfaces: `--fondo` #000 → `--hoja` #121212 → `--tecla` #1c1c1c →
  `--tecla-alta` #262626 → `--tecla-luz` #333. Inputs `--hueco`.
- Text: `--tinta` (white) · `--grafito` · `--humo` · `--tenue`.
- Lines: `--filo` (11 %), `--filo-fuerte` (20 %). `--foco`: neutral light for
  the selected row / the part being played.
- Main action: `--accion` white with `--sobre-accion` black. No brand accent.
- Functional: `--acorde` amber (chords and keys only), `--vivo` red, `--error`,
  `--ok`. Singers in `src/data/band.ts`, passed as `--m`; text mixes them with
  `--tinta`.

## Type

- `--font-marca`: Tinos 700 (Liberation Serif design). Band name, page and
  song titles, dialog titles; part labels in italic.
- `--font-letra`: Atkinson Hyperlegible Next. Lyrics, chords (700) and UI.
- Scale 1.25 on 16 px. Tabular numbers for keys, BPM, counters.

## Shape and depth

Radius 6 / 10 / 14 / 20 (chip, button, panel, sheet). Depth from surface steps
and hairlines; `--sombra` only on floating things. Lists are rows with a
hairline. Touch targets ≥ 44 px.

## Navigation

Phones: bottom bar (Biblioteca, Setlists, En vivo, Banda), current section
marked with a short bar on top. ≥ 900 px: 232 px left rail (`--side-w`) with
the EC mark; `--nav-h` becomes 0. Stage screens (`.app--stage`) have no nav.

## Motion

`--ease` cubic-bezier(0.23, 1, 0.32, 1). `--t-toque` 150 ms, `--t-hoja`
200 ms, `--t-parte` 250 ms. Press = scale(0.97). Transform and opacity only.
Reduced motion: fades only.

## Signature

The song map as stacked bars, like the band's cross: one bar per part, the
current one white and shifted out.

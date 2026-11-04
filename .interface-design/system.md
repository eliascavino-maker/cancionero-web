# Telón: design system for the Cancionero

The stage at night. Black curtain, paper lyrics, tungsten chords. Read from a
music stand about 1.5 m away, in low light, without glare.

Tokens live in `src/styles.css` (`:root`, plus `:root[data-theme='light']` for
"Ensayo", the daylight rehearsal theme). Use the tokens, never raw hex.

## Color

| Token | Dark | Role |
| --- | --- | --- |
| `--telon` | `#131011` | Page background |
| `--tarima` | `#1a1516` | Menus, dialogs, floating toolbar, row hover |
| `--case` / `--case-alto` / `--case-luz` | `#211b1c` / `#2a2324` / `#352d2e` | Buttons, hover, pressed segment |
| `--hueco` | `#0d0a0b` | Inset fields: search, inputs, textareas, segmented track |
| `--papel` | `#efe7da` | Lyrics and titles (15:1). Not pure white: no glow in the dark |
| `--ceniza` | `#b3a89f` | Artist, secondary data (8:1) |
| `--humo` | `#958a84` | Section labels, placeholders, inactive nav (≥4.5:1) |
| `--filo` / `--filo-fuerte` | papel at 9% / 16% | Hairlines: row dividers, button and panel edges |
| `--tungsteno` | `#ffaf3a` | The only accent: chords, key, main action, focus ring |
| `--foco` | tungsteno at 12% | Key chip, chorus light |
| `--poncho` | `#f0565a` | Deleting only |

Band member colors (`src/data/band.ts`) are separate and unchanged.

## Type

- `--font-letra`: Atkinson Hyperlegible Next (variable). Lyrics and all UI text.
- `--font-cartel`: Barlow Semi Condensed 600/700. Chords, key, song and page
  titles, section labels, setlist numbers.
- No uppercase labels. Section labels read "Verso 1", in Barlow 600, `--humo`.

## Signature: chords as on a lead sheet

`<ChordName chord="C#m7/G#" />` (`src/components/ChordName.tsx`): root at full
size, quality and extensions in `.chord__ext` (0.62em, raised), bass after the
slash in `.chord__bass`. Used in the sheet, the key in lists, and the toolbar.

## Shape and depth

- Radius: `--r-chico` 6px (chips, info, checkboxes) · `--r-boton` 10px
  (buttons, icon buttons, inputs) · `--r-panel` 16px (toolbar, menus) · 20px
  dialogs. Member chips and the play button stay round.
- Depth from surface steps and hairlines. Shadow (`--sombra`) only on things
  that float: toolbar, menu, dialog, dragged row.
- Lists are rows with a hairline below, not cards. Setlist rows are numbered.
- The chorus is lit: a radial `--foco` from the top left, no box or bar.

## Motion

`--ease: cubic-bezier(0.23, 1, 0.32, 1)`. Press = `scale(0.95)`. Name the
transitioned properties. Reduced motion turns transitions and press scaling off.

## Touch

Every control is at least 44px, except toolbar buttons (38px) inside the
toolbar's padding.

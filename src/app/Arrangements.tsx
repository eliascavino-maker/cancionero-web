import { parseChordPro } from '../chordpro/parser';
import { writeChordPro } from '../chordpro/writer';
import { askText } from '../components/ask';
import { Icon } from '../components/Icon';
import { MAX_ARRANGEMENT_NAME, type SongRecord } from '../data/library';
import { effectiveKey, transposeSong } from '../music/transposer';
import { navigate, useLibrary, useLive } from './hooks';

const NAME_HINT = 'Ej: Acústica, Con banda, En Bb';

/**
 * The versions of a song, above it: Original, Acústica, Con banda… Tapping
 * one opens it. "+ Arreglo" makes a new one from what is on screen (in the
 * key it is shown in).
 */
export function ArrangementBar({ song, transpose }: { song: SongRecord; transpose: number }) {
  const lib = useLibrary();
  const group = useLive((l) => l.arrangementsOf(song.id), [song.id]) ?? [song];

  const create = async () => {
    const parsed = parseChordPro(song.content);
    const shifted = transpose ? transposeSong(parsed, transpose) : parsed;
    const key = transpose ? effectiveKey(shifted) : undefined;
    const name = (
      await askText('Nombre del nuevo arreglo', key ? `En ${key}` : '', { placeholder: NAME_HINT, ok: 'Crear' })
    )?.trim();
    if (!name) return;
    // Its own copy of the text; in the key on screen if it was changed.
    const id = await lib.createArrangement(song.id, name, transpose ? writeChordPro(shifted) : song.content);
    navigate(`/song/${id}`);
  };

  const rename = async () => {
    const name = (
      await askText('Nombre del arreglo', song.arrangementName ?? '', { placeholder: NAME_HINT })
    )?.trim();
    if (name) await lib.renameArrangement(song.id, name.slice(0, MAX_ARRANGEMENT_NAME));
  };

  return (
    <nav className="arrangements" aria-label="Arreglos">
      {group.length > 1 &&
        group.map((s) => (
          <a
            key={s.id}
            className="arrangements__item"
            href={`#/song/${s.id}`}
            aria-current={s.id === song.id ? 'page' : undefined}
          >
            {s.arrangementName ?? 'Original'}
          </a>
        ))}
      {song.arrangementOf && (
        <button className="arrangements__tool" aria-label="Renombrar el arreglo" title="Renombrar el arreglo" onClick={rename}>
          <Icon name="edit" size={16} />
        </button>
      )}
      <button className="arrangements__tool arrangements__new" onClick={create} title="Otra versión de esta canción, con su propio texto">
        <Icon name="plus" size={16} /> Arreglo
      </button>
    </nav>
  );
}

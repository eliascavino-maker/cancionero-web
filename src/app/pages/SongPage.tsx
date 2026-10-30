import { useState } from 'react';
import { parseChordPro } from '../../chordpro/parser';
import { writeChordPro } from '../../chordpro/writer';
import { FullscreenButton } from '../../components/FullscreenButton';
import { Icon } from '../../components/Icon';
import { transposeSong } from '../../music/transposer';
import { SongPanel } from '../SongPanel';
import { navigate, useLibrary, useLive } from '../hooks';

export function SongPage({ id }: { id: number }) {
  const lib = useLibrary();
  const song = useLive((l) => l.getSong(id).then((s) => s ?? null), [id]);
  const [transpose, setTranspose] = useState(0);

  if (song === undefined) return null;
  if (song === null) return <p className="empty">La canción no existe.</p>;

  const saveTransposed = async () => {
    if (!confirm('¿Guardar la canción en este tono? Se pierden los comentarios "#" del archivo.')) return;
    await lib.saveSong(writeChordPro(transposeSong(parseChordPro(song.content), transpose)), song.id);
    setTranspose(0);
  };

  const remove = async () => {
    if (!confirm(`¿Borrar "${song.title}"? También sale de los setlists.`)) return;
    await lib.deleteSong(song.id);
    navigate('/');
  };

  return (
    <div className="page page--song">
      <header className="page__header page__header--sticky">
        <a className="icon-btn" href="#/" aria-label="Volver a canciones">
          <Icon name="back" />
        </a>
        <span className="page__spacer" />
        <div className="page__actions">
          <FullscreenButton />
          {transpose !== 0 && (
            <button className="btn" onClick={saveTransposed}>
              <Icon name="save" size={18} /> Guardar tono
            </button>
          )}
          <button className="icon-btn" aria-label="Editar" title="Editar" onClick={() => navigate(`/edit/${song.id}`)}>
            <Icon name="edit" />
          </button>
          <button className="icon-btn icon-btn--danger" aria-label="Borrar" title="Borrar" onClick={remove}>
            <Icon name="trash" />
          </button>
        </div>
      </header>
      <SongPanel
        content={song.content}
        transpose={transpose}
        onTransposeChange={setTranspose}
        songKey={String(song.id)}
        onContentChange={(c) => lib.saveSong(c, song.id)}
      />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { parseChordPro } from '../../chordpro/parser';
import { writeChordPro } from '../../chordpro/writer';
import { askConfirm } from '../../components/ask';
import { FullscreenButton } from '../../components/FullscreenButton';
import { Icon } from '../../components/Icon';
import { Menu } from '../../components/Menu';
import { transposeSong } from '../../music/transposer';
import { useCloud } from '../../cloud/CloudProvider';
import { songLabel } from '../../data/library';
import { ArrangementBar } from '../Arrangements';
import { SongPanel } from '../SongPanel';
import { ExportPdfDialog } from '../print';
import { markRecent, navigate, useLibrary, useLive } from '../hooks';
import { AddToSetlistDialog } from '../AddToSetlist';

export function SongPage({ id }: { id: string }) {
  const lib = useLibrary();
  const cloud = useCloud();
  const song = useLive((l) => l.getSong(id).then((s) => s ?? null), [id]);
  const [transpose, setTranspose] = useState(0);
  const [pdf, setPdf] = useState(false);
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    if (song) markRecent(song.id);
  }, [song?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (song === undefined) return null;
  if (song === null) return <p className="empty">La canción no existe.</p>;

  const saveTransposed = async () => {
    const ok = await askConfirm('Se pierden los comentarios "#" del archivo.', {
      title: '¿Guardar la canción en este tono?',
      ok: 'Guardar',
    });
    if (!ok) return;
    await lib.saveSong(writeChordPro(transposeSong(parseChordPro(song.content), transpose)), song.id);
    setTranspose(0);
  };

  const remove = async () => {
    const ok = await askConfirm(cloud.band ? 'Sale de la banda y de los setlists. Se puede restaurar desde Banda → Borrados.' : 'También sale de los setlists.', {
      title: `¿Borrar «${songLabel(song)}»?`,
      ok: 'Borrar',
      danger: true,
    });
    if (!ok) return;
    await lib.deleteSong(song.id);
    navigate(song.arrangementOf ? `/song/${song.arrangementOf}` : '/');
  };

  return (
    <div className="page page--song">
      <header className="page__header page__header--sticky">
        <a className="icon-btn" href="#/" aria-label="Volver a la biblioteca">
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
          <Menu
            label="Más opciones"
            title={songLabel(song)}
            items={[
              { label: 'Editar', icon: 'edit', onSelect: () => navigate(`/edit/${song.id}`) },
              { label: 'Exportar PDF', icon: 'print', onSelect: () => setPdf(true) },
              { label: 'Historial', icon: 'history', onSelect: () => navigate(`/song/${song.id}/historial`), hidden: !cloud.band },
              { label: 'Agregar a un setlist', icon: 'list', onSelect: () => setAdding(true) },
              { label: 'Borrar', icon: 'trash', danger: true, onSelect: remove, hidden: !cloud.canDeleteSongs },
            ]}
          />
        </div>
      </header>
      {pdf && (
        <ExportPdfDialog
          songs={[{ id: song.id, content: song.content, transpose }]}
          name={songLabel(song)}
          onClose={() => setPdf(false)}
        />
      )}
      {adding && <AddToSetlistDialog songId={song.id} title={songLabel(song)} onClose={() => setAdding(false)} />}
      <ArrangementBar song={song} transpose={transpose} />
      <SongPanel
        content={song.content}
        transpose={transpose}
        onTransposeChange={setTranspose}
        songKey={song.id}
        onContentChange={(c) => lib.saveSong(c, song.id)}
      />
    </div>
  );
}

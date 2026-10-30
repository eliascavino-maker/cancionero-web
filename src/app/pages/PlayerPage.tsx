import { useEffect } from 'react';
import { Icon } from '../../components/Icon';
import { SongPanel } from '../SongPanel';
import { navigate, useLibrary, useLive } from '../hooks';

/**
 * Stage mode: one song of a setlist at a time. ←/→ keys (or a Bluetooth
 * page-turner pedal set to arrows) move between songs. Transpose changes are
 * saved for this setlist item.
 */
export function PlayerPage({ setlistId, index }: { setlistId: number; index: number }) {
  const lib = useLibrary();
  const data = useLive(
    async (l) => ({ setlist: await l.getSetlist(setlistId), entries: await l.getSetlistEntries(setlistId) }),
    [setlistId],
  );
  const count = data?.entries.length ?? 0;
  const go = (i: number) => i >= 0 && i < count && navigate(`/play/${setlistId}/${i}`);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight') go(index + 1);
      if (e.key === 'ArrowLeft') go(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [index]);

  if (!data) return null;
  const entry = data.entries[index];
  if (!entry) return <p className="empty">No hay canción en esa posición.</p>;
  const next = data.entries[index + 1];

  return (
    <div className="page page--song">
      <header className="page__header page__header--sticky">
        <a className="icon-btn" href={`#/setlist/${setlistId}`} aria-label="Salir del modo en vivo">
          <Icon name="close" />
        </a>
        <button className="icon-btn icon-btn--filled" aria-label="Canción anterior" disabled={index === 0} onClick={() => go(index - 1)}>
          <Icon name="prev" size={20} />
        </button>
        <div className="player__title">
          <strong>
            {index + 1}/{count} · {data.setlist?.name}
          </strong>
          <small>{next ? `Sigue: ${next.song.title}` : 'Última canción'}</small>
        </div>
        <button
          className="icon-btn icon-btn--filled"
          aria-label="Canción siguiente"
          disabled={index >= count - 1}
          onClick={() => go(index + 1)}
        >
          <Icon name="next" size={20} />
        </button>
      </header>
      <SongPanel
        key={entry.item.id}
        content={entry.song.content}
        transpose={entry.item.transpose}
        onTransposeChange={(n) => lib.setItemTranspose(entry.item.id, n)}
        songKey={String(entry.song.id)}
      />
    </div>
  );
}

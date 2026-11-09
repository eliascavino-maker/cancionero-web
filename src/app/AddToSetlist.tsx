import { useEffect, useRef, useState } from 'react';
import { askText } from '../components/ask';
import { Icon } from '../components/Icon';
import { toast } from '../components/toast';
import { useLibrary, useLive } from './hooks';

/** "Agregar a un setlist": the setlists to pick from, or a new one. Appends the song at the end. */
export function AddToSetlistDialog({ songId, title, onClose }: { songId: string; title: string; onClose: () => void }) {
  const lib = useLibrary();
  const setlists = useLive((l) => l.listSetlists(), []);
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const d = dialog.current;
    if (d && typeof d.showModal === 'function') d.showModal();
    else d?.setAttribute('open', '');
  }, []);

  const add = async (setlistId: string, name: string) => {
    setBusy(true);
    await lib.addSongToSetlist(setlistId, songId);
    dialog.current?.close();
    toast(`«${title}» quedó al final de ${name}.`);
  };
  const addToNew = async () => {
    const name = await askText('Nombre del setlist', '', { ok: 'Crear', placeholder: 'Peña del sábado' });
    if (!name?.trim()) return;
    const id = await lib.createSetlist(name.trim());
    await add(id, name.trim());
  };

  return (
    <dialog
      ref={dialog}
      className="dialog"
      aria-label={`Agregar «${title}» a un setlist`}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && dialog.current?.close()}
    >
      <header className="page__header">
        <h2>Agregar a un setlist</h2>
        <button className="icon-btn" aria-label="Cerrar" onClick={() => dialog.current?.close()}>
          <Icon name="close" />
        </button>
      </header>
      <ul className="list">
        {setlists?.map((s) => (
          <li key={s.setlist.id}>
            <button className="card" disabled={busy} onClick={() => add(s.setlist.id, s.setlist.name)}>
              <span className="card__main">
                <span className="card__title">{s.setlist.name}</span>
                <span className="card__sub">{s.songCount === 1 ? '1 canción' : `${s.songCount} canciones`}</span>
              </span>
              <Icon name="plus" />
            </button>
          </li>
        ))}
      </ul>
      <div className="dialog__foot">
        <button className="btn" disabled={busy} onClick={addToNew}>
          <Icon name="plus" size={20} /> Setlist nuevo
        </button>
      </div>
    </dialog>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { parseChordPro } from '../../chordpro/parser';
import { askConfirm } from '../../components/ask';
import { Icon } from '../../components/Icon';
import { SongView } from '../../components/SongView';
import { explain, useCloud } from '../../cloud/CloudProvider';
import { songLabel } from '../../data/library';
import { navigate, useLibrary } from '../hooks';

interface Revision {
  id: number;
  table_name: 'songs' | 'setlists' | 'setlist_items';
  row_id: string;
  action: 'create' | 'edit' | 'delete' | 'restore';
  data: Record<string, unknown>;
  changed_by: string | null;
  changed_at: string;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Who changed what, from the server. Needs a connection. */
function useRevisions(filter: string) {
  const { client, band } = useCloud();
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!client || !band) return;
    setError(null);
    const [revs, members] = await Promise.all([
      client
        .from('revisions')
        .select('id, table_name, row_id, action, data, changed_by, changed_at')
        .or(filter)
        .order('changed_at', { ascending: false })
        .order('id', { ascending: false }),
      client.from('band_members').select('user_id, display_name').eq('band_id', band.bandId),
    ]);
    if (revs.error) return setError(explain(revs.error));
    setRevisions(revs.data as Revision[]);
    setNames(new Map((members.data ?? []).map((m) => [m.user_id as string, (m.display_name as string) || 'Alguien'])));
  }, [client, band, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const who = (r: Revision) => (r.changed_by ? (names.get(r.changed_by) ?? 'Un ex miembro') : 'Alguien');
  return { revisions, error, who, reload: load };
}

function Shell({ back, title, children }: { back: string; title: string; children: React.ReactNode }) {
  const { band } = useCloud();
  return (
    <div className="page">
      <header className="page__header">
        <a className="icon-btn" href={back} aria-label="Volver">
          <Icon name="back" />
        </a>
        <h1>{title}</h1>
      </header>
      {band ? children : <p className="empty">El historial está disponible cuando este dispositivo está en una banda.</p>}
      <p className="history__note">Se guardan los últimos 30 cambios de cada cosa, de los últimos 90 días.</p>
    </div>
  );
}

const SONG_ACTION = { create: 'Creó la canción', edit: 'Editó', delete: 'Borró la canción', restore: 'Restauró la canción' };

/** Versions of a song: see one and bring it back. */
export function SongHistoryPage({ id }: { id: string }) {
  const lib = useLibrary();
  const filter = useMemo(() => `and(table_name.eq.songs,row_id.eq.${id})`, [id]);
  const { revisions, error, who } = useRevisions(filter);
  const [open, setOpen] = useState<number | null>(null);

  const restore = async (r: Revision) => {
    const ok = await askConfirm('La versión de ahora queda en el historial.', {
      title: `¿Volver a la versión del ${when(r.changed_at)}?`,
      ok: 'Restaurar',
    });
    if (!ok) return;
    await lib.saveSong(String(r.data.content), id);
    navigate(`/song/${id}`);
  };

  return (
    <Shell back={`#/song/${id}`} title="Historial">
      {error && <p className="form__error" role="alert">{error}</p>}
      {revisions?.length === 0 && <p className="empty">Todavía no hay cambios guardados.</p>}
      <ul className="list">
        {revisions?.map((r, i) => (
          <li key={r.id} className="history__item">
            <button className="card" aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)}>
              <span className="card__main">
                <span className="card__title">
                  {SONG_ACTION[r.action]} · {who(r)}
                </span>
                <span className="card__sub">
                  {when(r.changed_at)}
                  {i === 0 && ' · versión actual'}
                </span>
              </span>
            </button>
            {open === r.id && (
              <div className="history__preview">
                <SongView song={parseChordPro(String(r.data.content))} showChords />
                {i > 0 && (
                  <button className="btn btn--primary" onClick={() => restore(r)}>
                    <Icon name="restore" size={18} /> Restaurar esta versión
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Shell>
  );
}

/** Changes to a setlist (name, songs, order, tone): go back to how it was. */
export function SetlistHistoryPage({ id }: { id: string }) {
  const lib = useLibrary();
  const cloud = useCloud();
  const filter = useMemo(
    () => `and(table_name.eq.setlists,row_id.eq.${id}),and(table_name.eq.setlist_items,parent_id.eq.${id})`,
    [id],
  );
  const { revisions, error, who, reload } = useRevisions(filter);
  const [titles, setTitles] = useState<Map<string, string>>(new Map());
  const [restoreError, setRestoreError] = useState<string | null>(null);

  // Song names, from this device (deleted songs included).
  useEffect(() => {
    if (!revisions) return;
    const ids = [...new Set(revisions.map((r) => r.data.song_id as string | undefined).filter(Boolean))] as string[];
    Promise.all(ids.map((s) => lib.getRecord('songs', s))).then((songs) =>
      setTitles(new Map(songs.filter(Boolean).map((s) => [s!.id, songLabel(s!)]))),
    );
  }, [revisions, lib]);

  const describe = (r: Revision, older: Revision | undefined) => {
    if (r.table_name === 'setlists') {
      if (r.action === 'create') return `Creó el setlist «${r.data.name}»`;
      if (r.action === 'delete') return 'Borró el setlist';
      if (r.action === 'restore') return 'Restauró el setlist';
      return `Le puso de nombre «${r.data.name}»`;
    }
    const song = `«${titles.get(r.data.song_id as string) ?? 'una canción'}»`;
    if (r.action === 'create') return `Agregó ${song}`;
    if (r.action === 'delete') return `Sacó ${song}`;
    if (r.action === 'restore') return `Volvió a poner ${song}`;
    if (older && older.data.song_id !== r.data.song_id) {
      return `Eligió ${song}`;
    }
    const t = Number(r.data.transpose);
    const toneChanged = older && Number(older.data.transpose) !== t;
    const moved = older && Number(older.data.position) !== Number(r.data.position);
    const tone = `cambió el tono de ${song} a ${t > 0 ? `+${t}` : t}`;
    if (toneChanged && moved) return `Movió y ${tone}`;
    if (toneChanged) return tone[0].toUpperCase() + tone.slice(1);
    return `Movió ${song}`;
  };

  const restore = async (r: Revision) => {
    const ok = await askConfirm('Nombre, canciones, orden y tonos vuelven a como estaban justo después de este cambio.', {
      title: `¿Dejar el setlist como estaba el ${when(r.changed_at)}?`,
      ok: 'Volver',
    });
    if (!ok) return;
    setRestoreError(null);
    const { error } = await cloud.client!.rpc('restore_setlist', { target: id, as_of: r.changed_at });
    if (error) return setRestoreError(explain(error));
    cloud.syncNow();
    await reload();
  };

  return (
    <Shell back={`#/setlist/${id}`} title="Historial del setlist">
      {(error || restoreError) && (
        <p className="form__error" role="alert">
          {error ?? restoreError}
        </p>
      )}
      {revisions?.length === 0 && <p className="empty">Todavía no hay cambios guardados.</p>}
      <ul className="list">
        {revisions?.map((r, i) => {
          const older = revisions.slice(i + 1).find((o) => o.row_id === r.row_id);
          return (
            <li key={r.id} className="card">
              <span className="card__main">
                <span className="card__title history__what">{describe(r, older)}</span>
                <span className="card__sub">
                  {who(r)} · {when(r.changed_at)}
                </span>
              </span>
              {i > 0 && (
                <button className="btn" onClick={() => restore(r)} title="Dejarlo como estaba después de este cambio">
                  <Icon name="restore" size={18} /> Volver acá
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Shell>
  );
}

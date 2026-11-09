import { useMemo, useRef, useState } from 'react';
import { askConfirm, tell } from '../../components/ask';
import { ChordName } from '../../components/ChordName';
import { Icon } from '../../components/Icon';
import { Menu } from '../../components/Menu';
import { SwipeRow } from '../../components/SwipeRow';
import { toast } from '../../components/toast';
import { type ChartSong, parseChart } from '../../importer/chart';
import { readDocument } from '../../importer/docx';
import { useCloud } from '../../cloud/CloudProvider';
import type { SongRecord } from '../../data/library';
import { AddToSetlistDialog } from '../AddToSetlist';
import { HomeStrip } from '../Home';
import { exportBackup, importBackup } from '../backup';
import { BandSongsDialog } from '../BandSongsDialog';
import { ImportChartDialog } from '../ImportChartDialog';
import { openSearch } from '../SearchPalette';
import { navigate, toggleFavorite, useLibrary, useLive, usePrefs } from '../hooks';

/** BPM and time signature written in the song, for the list. */
function songFacts(content: string): { bpm?: string; time?: string } {
  const bpm = /\{\s*(?:tempo|bpm)\s*:\s*(\d{2,3})/i.exec(content)?.[1];
  const time = /\{\s*time\s*:\s*([^}]+)\}/i.exec(content)?.[1].trim();
  return { bpm, time };
}

type Filter = { kind: 'all' } | { kind: 'fav' } | { kind: 'arr' } | { kind: 'setlist'; id: string };

export function LibraryPage() {
  const lib = useLibrary();
  const cloud = useCloud();
  const [prefs, setPrefs] = usePrefs();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>({ kind: 'all' });
  const songs = useLive((l) => l.listSongs(query), [query]);
  const groups = useLive((l) => l.arrangementGroups(), []);
  const setlists = useLive(
    async (l) =>
      Promise.all(
        (await l.listSetlists()).map(async (s) => ({
          id: s.setlist.id,
          name: s.setlist.name,
          songs: new Set((await l.getSetlistEntries(s.setlist.id)).map((e) => e.song.arrangementOf ?? e.song.id)),
        })),
      ),
    [],
  );
  const favorites = useMemo(() => new Set(prefs.favorites ?? []), [prefs.favorites]);
  const view = prefs.libraryView ?? 'list';
  const sort = prefs.librarySort ?? 'title';

  const fileInput = useRef<HTMLInputElement>(null);
  const docInput = useRef<HTMLInputElement>(null);
  const [chart, setChart] = useState<ChartSong[] | null>(null);
  const [bandOpen, setBandOpen] = useState(false);
  const [adding, setAdding] = useState<SongRecord | null>(null);

  const importDocument = async (file: File) => {
    try {
      setChart(parseChart(await readDocument(file)));
    } catch (e) {
      await tell(e instanceof Error ? e.message : 'No se pudo leer el documento.');
    }
  };

  // ----- deleting several songs: pick them in the list, then "Eliminar".
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  const confirmDelete = (n: number) =>
    askConfirm(
      cloud.band
        ? 'Salen de la banda y de los setlists. Se pueden restaurar desde Banda → Borrados.'
        : 'También salen de los setlists. No se puede deshacer.',
      { title: `¿Eliminar ${n === 1 ? '1 canción' : `${n} canciones`}?`, ok: 'Eliminar', danger: true },
    );
  const removeSelected = async () => {
    if (!selected?.size) return;
    if (!(await confirmDelete(selected.size))) return;
    for (const id of selected) await lib.deleteSong(id);
    setSelected(null);
  };
  const removeOne = async (s: SongRecord) => {
    if (!(await confirmDelete(1))) return;
    await lib.deleteSong(s.id);
    // Songs already on the server go to Borrados and can come back.
    if (s.serverAt) toast(`«${s.title}» eliminada.`, { label: 'Deshacer', run: () => void lib.restoreSong(s.id) });
    else toast(`«${s.title}» eliminada.`);
  };
  const duplicate = async (s: SongRecord) => {
    const copy = /\{\s*(title|t)\s*:/i.test(s.content)
      ? s.content.replace(/\{\s*(title|t)\s*:\s*([^}]*)\}/i, (_m, d, t) => `{${d}: ${String(t).trim()} (copia)}`)
      : `{title: ${s.title} (copia)}\n${s.content}`;
    const id = await lib.saveSong(copy);
    toast(`Hiciste una copia de «${s.title}».`, { label: 'Abrir', run: () => navigate(`/song/${id}`) });
  };

  // ----- what the list shows
  const arrangementsOf = (id: string) => (groups?.get(id)?.length ?? 1) - 1;
  const inSetlists = (id: string) => setlists?.filter((s) => s.songs.has(id)).map((s) => s.name) ?? [];
  const shown = useMemo(() => {
    if (!songs) return undefined;
    let list = songs;
    if (filter.kind === 'fav') list = list.filter((s) => favorites.has(s.id));
    else if (filter.kind === 'arr') list = list.filter((s) => (groups?.get(s.id)?.length ?? 1) > 1);
    else if (filter.kind === 'setlist') {
      const ids = setlists?.find((s) => s.id === filter.id)?.songs;
      list = ids ? list.filter((s) => ids.has(s.id)) : list;
    }
    if (sort === 'recent') list = [...list].sort((a, b) => b.updatedAt - a.updatedAt);
    return list;
  }, [songs, filter, favorites, groups, setlists, sort]);

  const meta = (s: SongRecord) => {
    const { bpm, time } = songFacts(s.content);
    const n = arrangementsOf(s.id);
    return [
      s.artist,
      bpm && `${bpm} BPM`,
      time,
      n ? `${n} arreglo${n === 1 ? '' : 's'}` : '',
      inSetlists(s.id)[0],
    ]
      .filter(Boolean)
      .join(' · ');
  };
  const isFilter = (f: Filter) =>
    f.kind === filter.kind && (f.kind !== 'setlist' || (filter.kind === 'setlist' && filter.id === f.id));

  const chips: { label: string; f: Filter }[] = [
    { label: 'Todas', f: { kind: 'all' } },
    { label: 'Favoritas', f: { kind: 'fav' } },
    ...(setlists ?? []).slice(0, 6).map((s) => ({ label: s.name, f: { kind: 'setlist', id: s.id } as Filter })),
    { label: 'Con arreglos', f: { kind: 'arr' } },
  ];

  return (
    <div className="page library">
      <header className="page__header">
        <h1>Biblioteca</h1>
        <div className="page__actions">
          <button className="icon-btn" aria-label="Buscar en todo (Ctrl K)" title="Buscar en todo (Ctrl K)" onClick={openSearch}>
            <Icon name="search" />
          </button>
          <Menu
            label="Más opciones"
            items={[
              { label: 'Cargar canciones de la banda', icon: 'band', onSelect: () => setBandOpen(true) },
              { label: 'Importar acordes (.docx / .txt)', icon: 'file', onSelect: () => docInput.current?.click() },
              { label: 'Importar desde un link', icon: 'download', onSelect: () => navigate('/edit/link'), hidden: !cloud.band },
              {
                label: 'Eliminar canciones',
                icon: 'trash',
                danger: true,
                onSelect: () => setSelected(new Set()),
                hidden: !cloud.canDeleteSongs,
              },
              { label: 'Exportar respaldo', icon: 'download', onSelect: () => exportBackup(lib) },
              { label: 'Importar respaldo', icon: 'upload', onSelect: () => fileInput.current?.click() },
              {
                label: prefs.theme === 'dark' ? 'Tema claro' : 'Tema oscuro',
                icon: 'stage',
                onSelect: () => setPrefs({ ...prefs, theme: prefs.theme === 'dark' ? 'light' : 'dark' }),
              },
            ]}
          />
          <button className="btn btn--primary btn--round" aria-label="Nueva canción" onClick={() => navigate('/edit/new')}>
            <Icon name="plus" size={22} />
            <span className="btn__label">Nueva</span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importBackup(lib, f, cloud.band?.bandName);
              e.target.value = '';
            }}
          />
          <input
            ref={docInput}
            type="file"
            accept=".docx,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            hidden
            aria-label="Documento de acordes"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importDocument(f);
              e.target.value = '';
            }}
          />
          {chart && <ImportChartDialog songs={chart} onClose={() => setChart(null)} />}
          {bandOpen && <BandSongsDialog onClose={() => setBandOpen(false)} />}
          {adding && <AddToSetlistDialog songId={adding.id} title={adding.title} onClose={() => setAdding(null)} />}
        </div>
      </header>

      {selected && (
        <div className="select-bar" role="toolbar" aria-label="Eliminar canciones">
          <span>
            {selected.size ? `${selected.size} elegida${selected.size === 1 ? '' : 's'}` : 'Tocá las canciones a eliminar'}
          </span>
          <span className="toolbar__spacer" />
          <button className="btn" onClick={() => setSelected(null)}>
            Cancelar
          </button>
          <button className="btn btn--danger-fill" disabled={!selected.size} onClick={removeSelected}>
            <Icon name="trash" size={18} /> Eliminar
          </button>
        </div>
      )}

      {!selected && <HomeStrip />}

      <label className="search">
        <Icon name="search" size={20} />
        <input
          type="search"
          placeholder="Filtrar por título o artista"
          aria-label="Buscar"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      <div className="chips" role="group" aria-label="Filtrar">
        {chips.map((c) => (
          <button key={c.label} className="chip" aria-pressed={isFilter(c.f)} onClick={() => setFilter(c.f)}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="list-bar">
        <span className="list-bar__count">
          {shown ? (shown.length === 1 ? '1 canción' : `${shown.length} canciones`) : ' '}
        </span>
        <button
          className="list-bar__btn"
          onClick={() => setPrefs({ ...prefs, librarySort: sort === 'title' ? 'recent' : 'title' })}
          aria-label={sort === 'title' ? 'Orden: de la A a la Z. Cambiar a recientes' : 'Orden: recientes. Cambiar a A–Z'}
        >
          {sort === 'title' ? 'A–Z' : 'Recientes'}
        </button>
        <div className="segmented segmented--icons" role="group" aria-label="Vista">
          <button aria-pressed={view === 'list'} aria-label="Lista" onClick={() => setPrefs({ ...prefs, libraryView: 'list' })}>
            <Icon name="list" size={18} />
          </button>
          <button aria-pressed={view === 'grid'} aria-label="Cuadrícula" onClick={() => setPrefs({ ...prefs, libraryView: 'grid' })}>
            <Icon name="grid" size={18} />
          </button>
        </div>
      </div>

      {shown === undefined ? (
        <ul className="list" aria-busy="true" aria-label="Cargando canciones">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <li key={i} className="song-row song-row--skeleton">
              <span className="skeleton" style={{ width: `${45 + ((i * 17) % 35)}%` }} />
              <span className="skeleton skeleton--small" style={{ width: `${25 + ((i * 11) % 20)}%` }} />
            </li>
          ))}
        </ul>
      ) : shown.length === 0 ? (
        <div className="empty">
          {query ? (
            <p>Nada con «{query}» en el título o el artista.</p>
          ) : filter.kind === 'fav' ? (
            <p>Todavía no marcaste favoritas. Tocá la estrella de una canción.</p>
          ) : filter.kind !== 'all' ? (
            <p>No hay canciones acá.</p>
          ) : (
            <>
              <p>Todavía no hay canciones.</p>
              <div className="empty__actions">
                <button className="btn btn--primary" onClick={() => navigate('/edit/new')}>
                  <Icon name="plus" size={20} /> Nueva canción
                </button>
                <button className="btn" onClick={() => setBandOpen(true)}>
                  <Icon name="band" size={20} /> Cargar las de la banda
                </button>
              </div>
            </>
          )}
          {query && (
            <button className="btn" onClick={openSearch}>
              <Icon name="search" size={18} /> Buscar también en la letra
            </button>
          )}
        </div>
      ) : selected ? (
        <ul className="list">
          {shown.map((s) => (
            <li key={s.id}>
              <button
                className={`card card--pick${selected.has(s.id) ? ' card--picked' : ''}`}
                aria-pressed={selected.has(s.id)}
                onClick={() => toggle(s.id)}
              >
                <span className="card__check" aria-hidden="true">
                  {selected.has(s.id) && <Icon name="check" size={16} />}
                </span>
                <span className="card__main">
                  <span className="card__title">{s.title}</span>
                  {meta(s) && <span className="card__sub">{meta(s)}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : view === 'grid' ? (
        <ul className="song-grid">
          {shown.map((s) => (
            <li key={s.id} className="song-tile">
              <a className="song-tile__link" href={`#/song/${s.id}`}>
                <span className="song-tile__key">{s.songKey ? <ChordName chord={s.songKey} /> : '—'}</span>
                <span className="song-tile__title">{s.title}</span>
                <span className="song-tile__meta">{meta(s) || ' '}</span>
              </a>
              <FavButton id={s.id} on={favorites.has(s.id)} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="list">
          {shown.map((s) => (
            <li key={s.id}>
              <SwipeRow
                actions={[
                  { label: 'Duplicar', icon: 'copy', onSelect: () => duplicate(s) },
                  { label: 'Setlist', icon: 'list', onSelect: () => setAdding(s) },
                  ...(cloud.canDeleteSongs ? [{ label: 'Borrar', icon: 'trash' as const, danger: true, onSelect: () => removeOne(s) }] : []),
                ]}
              >
                <div className="song-row">
                  <a className="song-row__link" href={`#/song/${s.id}`}>
                    <span className="song-row__title">
                      {s.title}
                      {s.bandId && s.dirty === 1 && (
                        <span className="pending-dot" role="img" aria-label="Con cambios sin subir" title="Con cambios sin subir" />
                      )}
                    </span>
                    {meta(s) && <span className="song-row__meta">{meta(s)}</span>}
                  </a>
                  <FavButton id={s.id} on={favorites.has(s.id)} />
                  <span className="key-badge">{s.songKey && <ChordName chord={s.songKey} />}</span>
                  <Menu
                    className="song-row__menu"
                    label={`Opciones de ${s.title}`}
                    title={s.title}
                    items={[
                      { label: 'Duplicar', icon: 'copy', onSelect: () => duplicate(s) },
                      { label: 'Agregar a un setlist', icon: 'list', onSelect: () => setAdding(s) },
                      { label: 'Borrar', icon: 'trash', danger: true, onSelect: () => removeOne(s), hidden: !cloud.canDeleteSongs },
                    ]}
                  />
                </div>
              </SwipeRow>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FavButton({ id, on }: { id: string; on: boolean }) {
  return (
    <button
      className={`fav-btn${on ? ' fav-btn--on' : ''}`}
      aria-label={on ? 'Quitar de favoritas' : 'Marcar como favorita'}
      aria-pressed={on}
      onClick={() => toggleFavorite(id)}
    >
      <Icon name="star" size={18} />
    </button>
  );
}

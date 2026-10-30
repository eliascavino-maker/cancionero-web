import { useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { navigate, useLibrary, useLive, usePrefs } from '../hooks';

export function LibraryPage() {
  const lib = useLibrary();
  const [prefs, setPrefs] = usePrefs();
  const [query, setQuery] = useState('');
  const songs = useLive((l) => l.listSongs(query), [query]);
  const fileInput = useRef<HTMLInputElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const closeMenu = () => menu.current?.removeAttribute('open');

  const exportBackup = async () => {
    closeMenu();
    const data = await lib.exportAll();
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `cancionero-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = async (file: File) => {
    if (!confirm('Importar reemplaza todas las canciones y setlists de este navegador. ¿Seguir?')) return;
    try {
      await lib.importAll(JSON.parse(await file.text()));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo importar el archivo.');
    }
  };

  return (
    <div className="page">
      <header className="page__header">
        <h1>Canciones</h1>
        <div className="page__actions">
          <details className="menu" ref={menu}>
            <summary className="icon-btn" aria-label="Más opciones">
              <Icon name="more" />
            </summary>
            <div className="menu__panel">
              <button onClick={exportBackup}>
                <Icon name="download" /> Exportar respaldo
              </button>
              <button
                onClick={() => {
                  closeMenu();
                  fileInput.current?.click();
                }}
              >
                <Icon name="upload" /> Importar respaldo
              </button>
              <button
                onClick={() => {
                  closeMenu();
                  setPrefs({ ...prefs, theme: prefs.theme === 'dark' ? 'light' : 'dark' });
                }}
              >
                <Icon name="stage" /> {prefs.theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
              </button>
            </div>
          </details>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importBackup(f);
              e.target.value = '';
            }}
          />
          <button className="btn btn--primary" onClick={() => navigate('/edit/new')}>
            <Icon name="plus" size={20} /> Nueva
          </button>
        </div>
      </header>

      <label className="search">
        <Icon name="search" size={20} />
        <input
          type="search"
          placeholder="Buscar por título o artista"
          aria-label="Buscar"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      {songs === undefined ? null : songs.length === 0 ? (
        <p className="empty">
          {query ? `Sin resultados para "${query}".` : 'Todavía no hay canciones. Tocá "Nueva" para agregar la primera.'}
        </p>
      ) : (
        <ul className="list">
          {songs.map((s) => (
            <li key={s.id}>
              <a className="card" href={`#/song/${s.id}`}>
                <span className="card__main">
                  <span className="card__title">{s.title}</span>
                  {s.artist && <span className="card__sub">{s.artist}</span>}
                </span>
                {s.songKey && <span className="key-badge">{s.songKey}</span>}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

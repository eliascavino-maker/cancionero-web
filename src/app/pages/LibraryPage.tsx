import { useRef, useState } from 'react';
import { navigate, useLibrary, useLive } from '../hooks';

export function LibraryPage() {
  const lib = useLibrary();
  const [query, setQuery] = useState('');
  const songs = useLive((l) => l.listSongs(query), [query]);
  const fileInput = useRef<HTMLInputElement>(null);

  const exportBackup = async () => {
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
        <h1>Biblioteca</h1>
        <div className="page__actions">
          <button className="btn" onClick={exportBackup}>
            Exportar
          </button>
          <button className="btn" onClick={() => fileInput.current?.click()}>
            Importar
          </button>
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
            + Nueva
          </button>
        </div>
      </header>
      <input
        className="search"
        type="search"
        placeholder="Buscar por título o artista"
        aria-label="Buscar"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {songs === undefined ? null : songs.length === 0 ? (
        <p className="empty">
          {query ? `Sin resultados para "${query}".` : 'Todavía no hay canciones. Tocá "+ Nueva" para agregar una.'}
        </p>
      ) : (
        <ul className="list">
          {songs.map((s) => (
            <li key={s.id}>
              <a className="list__item" href={`#/song/${s.id}`}>
                <span className="list__main">
                  <span className="list__title">{s.title}</span>
                  {s.artist && <span className="list__sub">{s.artist}</span>}
                </span>
                {s.songKey && <span className="list__key">{s.songKey}</span>}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

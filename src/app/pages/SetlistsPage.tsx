import { navigate, useLibrary, useLive } from '../hooks';

export function SetlistsPage() {
  const lib = useLibrary();
  const setlists = useLive((l) => l.listSetlists(), []);

  const create = async () => {
    const name = prompt('Nombre del setlist')?.trim();
    if (!name) return;
    navigate(`/setlist/${await lib.createSetlist(name)}`);
  };

  return (
    <div className="page">
      <header className="page__header">
        <h1>Setlists</h1>
        <div className="page__actions">
          <button className="btn btn--primary" onClick={create}>
            + Nuevo
          </button>
        </div>
      </header>
      {setlists === undefined ? null : setlists.length === 0 ? (
        <p className="empty">Sin setlists. Tocá "+ Nuevo" para armar uno.</p>
      ) : (
        <ul className="list">
          {setlists.map(({ setlist, songCount }) => (
            <li key={setlist.id}>
              <a className="list__item" href={`#/setlist/${setlist.id}`}>
                <span className="list__main">
                  <span className="list__title">{setlist.name}</span>
                  <span className="list__sub">{songCount === 1 ? '1 canción' : `${songCount} canciones`}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

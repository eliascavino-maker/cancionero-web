import { Icon } from '../../components/Icon';
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
            <Icon name="plus" size={20} /> Nuevo
          </button>
        </div>
      </header>
      {setlists === undefined ? null : setlists.length === 0 ? (
        <p className="empty">Sin setlists todavía. Armá uno con "Nuevo" para el próximo show.</p>
      ) : (
        <ul className="list">
          {setlists.map(({ setlist, songCount }) => (
            <li key={setlist.id}>
              <a className="card" href={`#/setlist/${setlist.id}`}>
                <span className="num-badge">
                  <Icon name="list" size={18} />
                </span>
                <span className="card__main">
                  <span className="card__title">{setlist.name}</span>
                  <span className="card__sub">{songCount === 1 ? '1 canción' : `${songCount} canciones`}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

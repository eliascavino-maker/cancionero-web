import { useEffect } from 'react';
import { Icon } from '../components/Icon';
import { usePrefs, useRoute } from './hooks';
import { EditorPage } from './pages/EditorPage';
import { LibraryPage } from './pages/LibraryPage';
import { PlayerPage } from './pages/PlayerPage';
import { SetlistPage } from './pages/SetlistPage';
import { SetlistsPage } from './pages/SetlistsPage';
import { SongPage } from './pages/SongPage';

function Page({ route }: { route: string }) {
  const parts = route.split('/').filter(Boolean);
  const num = (i: number) => Number(parts[i]);
  switch (parts[0]) {
    case undefined:
      return <LibraryPage />;
    case 'song':
      return <SongPage id={num(1)} />;
    case 'edit':
      return <EditorPage key={parts[1]} id={parts[1] === 'new' ? undefined : num(1)} />;
    case 'setlists':
      return <SetlistsPage />;
    case 'setlist':
      return <SetlistPage id={num(1)} />;
    case 'play':
      return <PlayerPage setlistId={num(1)} index={num(2) || 0} />;
    default:
      return <p className="empty">Página no encontrada.</p>;
  }
}

export function App() {
  const route = useRoute();
  const [prefs] = usePrefs();
  const section = route.startsWith('/setlist') || route.startsWith('/play') ? 'setlists' : 'library';
  const stage = route.startsWith('/play');

  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', prefs.theme === 'dark' ? '#0c0c0f' : '#faf8f4');
  }, [prefs.theme]);

  return (
    <div className={stage ? 'app app--stage' : 'app'}>
      <main className="app__main">
        <Page route={route} />
      </main>
      {!stage && (
        <nav className="nav" aria-label="Secciones">
          <a href="#/" aria-current={section === 'library' ? 'page' : undefined}>
            <Icon name="music" />
            Canciones
          </a>
          <a href="#/setlists" aria-current={section === 'setlists' ? 'page' : undefined}>
            <Icon name="list" />
            Setlists
          </a>
        </nav>
      )}
    </div>
  );
}

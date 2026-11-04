import { useEffect } from 'react';
import { Icon } from '../components/Icon';
import { useCloud } from '../cloud/CloudProvider';
import { BandPage, syncSummary } from './pages/BandPage';
import { SetlistHistoryPage, SongHistoryPage } from './pages/HistoryPage';
import { usePrefs, useRoute } from './hooks';
import { EditorPage } from './pages/EditorPage';
import { LibraryPage } from './pages/LibraryPage';
import { PlayerPage } from './pages/PlayerPage';
import { SetlistPage } from './pages/SetlistPage';
import { SetlistsPage } from './pages/SetlistsPage';
import { SongPage } from './pages/SongPage';
import { UpdatePrompt } from './UpdatePrompt';

function Page({ route }: { route: string }) {
  const parts = route.split('/').filter(Boolean);
  switch (parts[0]) {
    case undefined:
      return <LibraryPage />;
    case 'song':
      return parts[2] === 'historial' ? <SongHistoryPage id={parts[1]} /> : <SongPage id={parts[1]} />;
    case 'edit':
      return <EditorPage key={parts[1]} id={parts[1] === 'new' ? undefined : parts[1]} />;
    case 'setlists':
      return <SetlistsPage />;
    case 'setlist':
      return parts[2] === 'historial' ? <SetlistHistoryPage id={parts[1]} /> : <SetlistPage id={parts[1]} />;
    case 'play':
      return <PlayerPage setlistId={parts[1]} index={Number(parts[2]) || 0} />;
    case 'banda':
      return <BandPage />;
    case 'invitacion':
      // key: a new link while the page is open starts with its own code.
      return <BandPage key={parts[1]} invite={parts[1]} />;
    default:
      return <p className="empty">Página no encontrada.</p>;
  }
}

export function App() {
  const route = useRoute();
  const [prefs] = usePrefs();
  const cloud = useCloud();
  const section =
    route.startsWith('/setlist') || route.startsWith('/play')
      ? 'setlists'
      : route.startsWith('/banda') || route.startsWith('/invitacion')
        ? 'band'
        : 'library';
  // A dot on "Banda" when something waits or needs attention.
  const s = cloud.sync;
  const alert = !!cloud.needsLink || !!s?.notices.length || s?.state === 'error';
  const waiting = !!s && (s.pending > 0 || s.state === 'offline');
  const stage = route.startsWith('/play');

  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', prefs.theme === 'dark' ? '#131011' : '#faf8f5');
  }, [prefs.theme]);

  return (
    <div className={stage ? 'app app--stage' : 'app'}>
      <main className="app__main">
        <Page route={route} />
      </main>
      <UpdatePrompt hidden={stage} />
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
          {cloud.configured && (
            <a
              href="#/banda"
              aria-current={section === 'band' ? 'page' : undefined}
              title={s ? syncSummary(s) : undefined}
            >
              <span className="nav__icon">
                <Icon name="band" />
                {(alert || waiting) && <span className={`nav__dot${alert ? ' nav__dot--alert' : ''}`} />}
              </span>
              Banda
            </a>
          )}
        </nav>
      )}
    </div>
  );
}

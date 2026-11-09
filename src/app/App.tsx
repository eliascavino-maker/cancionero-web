import { useEffect } from 'react';
import { BrandMark } from '../components/BrandMark';
import { Icon } from '../components/Icon';
import { useCloud } from '../cloud/CloudProvider';
import { BandPage, syncSummary } from './pages/BandPage';
import { LivePage } from './pages/LivePage';
import { useRoom } from '../live/LiveProvider';
import { SetlistHistoryPage, SongHistoryPage } from './pages/HistoryPage';
import { usePrefs, useRoute } from './hooks';
import { EditorPage } from './pages/EditorPage';
import { LibraryPage } from './pages/LibraryPage';
import { PlayerPage } from './pages/PlayerPage';
import { SetlistPage } from './pages/SetlistPage';
import { SetlistsPage } from './pages/SetlistsPage';
import { SongPage } from './pages/SongPage';
import { UpdatePrompt } from './UpdatePrompt';
import { SearchPalette, useSearchShortcut } from './SearchPalette';
import { Toaster } from '../components/toast';
import { useMe } from './me';
import { WhoAreYouDialog } from './WhoAreYou';

function Page({ route }: { route: string }) {
  const parts = route.split('/').filter(Boolean);
  switch (parts[0]) {
    case undefined:
      return <LibraryPage />;
    case 'song':
      return parts[2] === 'historial' ? <SongHistoryPage id={parts[1]} /> : <SongPage key={parts[1]} id={parts[1]} />;
    case 'edit':
      if (parts[1] === 'link') return <EditorPage key="link" fromLink />;
      return <EditorPage key={parts[1]} id={parts[1] === 'new' ? undefined : parts[1]} />;
    case 'setlists':
      return <SetlistsPage />;
    case 'setlist':
      return parts[2] === 'historial' ? <SetlistHistoryPage id={parts[1]} /> : <SetlistPage id={parts[1]} />;
    case 'play':
      return <PlayerPage setlistId={parts[1]} index={Number(parts[2]) || 0} />;
    case 'banda':
      return <BandPage />;
    case 'vivo':
      return <LivePage />;
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
        : route.startsWith('/vivo')
          ? 'live'
          : 'library';
  // A dot on "Banda" when something waits or needs attention.
  const s = cloud.sync;
  const alert = !!cloud.needsLink || !!s?.notices.length || s?.state === 'error';
  const waiting = !!s && (s.pending > 0 || s.state === 'offline');
  const stage = route.startsWith('/play') || route.startsWith('/vivo');
  const live = useRoom().state.session;
  const me = useMe();
  // In a band and nobody chosen yet, here or on another device of this account.
  const askWho =
    !stage && !!cloud.band && !!cloud.musicians && !me.chosen && !(cloud.band.prefs as { chosen?: boolean }).chosen;

  useSearchShortcut(!stage);

  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', prefs.theme === 'dark' ? '#000000' : '#ffffff');
  }, [prefs.theme]);

  return (
    <div className={stage ? 'app app--stage' : 'app'}>
      <main className="app__main">
        <Page route={route} />
      </main>
      <UpdatePrompt hidden={stage} />
      <SearchPalette />
      <Toaster />
      {askWho && <WhoAreYouDialog />}
      {!stage && (
        <nav className="nav" aria-label="Secciones">
          <a className="nav__brand" href="#/" aria-label={cloud.band?.bandName ?? 'En Contra'}>
            <BrandMark size={28} />
            <span>{cloud.band?.bandName ?? 'En Contra'}</span>
          </a>
          <a href="#/" aria-current={section === 'library' ? 'page' : undefined}>
            <Icon name="music" />
            <span>Biblioteca</span>
          </a>
          <a href="#/setlists" aria-current={section === 'setlists' ? 'page' : undefined}>
            <Icon name="list" />
            <span>Setlists</span>
          </a>
          <a
            href="#/vivo"
            className={live ? 'nav__live' : undefined}
            aria-current={section === 'live' ? 'page' : undefined}
            aria-label={live ? 'En vivo: hay una sala abierta' : undefined}
          >
            <span className="nav__icon">
              <Icon name="live" />
              {live && <span className="nav__dot nav__dot--live" />}
            </span>
            <span>En vivo</span>
          </a>
          <a
            href="#/banda"
            aria-current={section === 'band' ? 'page' : undefined}
            title={s ? syncSummary(s) : undefined}
          >
            <span className="nav__icon">
              <Icon name="band" />
              {(alert || waiting) && <span className={`nav__dot${alert ? ' nav__dot--alert' : ''}`} />}
            </span>
            <span>Banda</span>
          </a>
        </nav>
      )}
    </div>
  );
}

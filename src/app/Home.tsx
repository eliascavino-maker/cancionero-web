import { ChordName } from '../components/ChordName';
import { Icon } from '../components/Icon';
import { useCloud } from '../cloud/CloudProvider';
import { useRoom } from '../live/LiveProvider';
import { syncSummary } from './pages/BandPage';
import { navigate, useLive, usePrefs } from './hooks';

/**
 * The top of the Biblioteca: what's on now. The live room when it's open (big,
 * to get in fast), the setlist to play, the songs opened lately and how the
 * band's sync is doing.
 */
export function HomeStrip() {
  const [prefs] = usePrefs();
  const cloud = useCloud();
  const { state: live } = useRoom();
  const session = live.session;
  const data = useLive(
    async (l) => {
      const setlists = await l.listSetlists();
      const recent = (await Promise.all((prefs.recent ?? []).slice(0, 8).map((id) => l.getSong(id)))).filter(
        (s) => s && !s.deletedAt,
      );
      const liveName = session ? (await l.getSetlist(session.setlistId))?.name : undefined;
      return { next: setlists[0], recent, liveName };
    },
    [prefs.recent, session?.setlistId],
  );
  if (!data) return null;
  const { next, recent, liveName } = data;
  const inRoom = live.peers.map((p) => p.name).filter(Boolean);

  return (
    <div className="home">
      {session && (
        <a className="home-live" href="#/vivo">
          <span className="live-badge">EN VIVO</span>
          <span className="home-live__text">
            <strong>{liveName ?? 'Sala abierta'}</strong>
            <small>
              {session.leaderId ? `Dirige ${session.leaderName || 'alguien'}` : 'Sin director'}
              {inRoom.length ? ` · En la sala: ${inRoom.join(', ')}` : ''}
            </small>
          </span>
          <span className="home-live__go">
            Entrar <Icon name="right" size={18} />
          </span>
        </a>
      )}

      {next && next.songCount > 0 && (
        <section className="home-card" aria-label="Para tocar">
          <span className="home-card__eyebrow">Para tocar</span>
          <a className="home-card__title" href={`#/setlist/${next.setlist.id}`}>
            {next.setlist.name}
          </a>
          <span className="home-card__meta">{next.songCount === 1 ? '1 canción' : `${next.songCount} canciones`}</span>
          <div className="home-card__actions">
            <button className="btn btn--primary" onClick={() => navigate(`/play/${next.setlist.id}/0`)}>
              <Icon name="play" size={18} /> Tocar
            </button>
            <a className="btn" href="#/setlists">
              Todos los setlists
            </a>
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section aria-label="Recientes">
          <h2 className="home__label">Recientes</h2>
          <ul className="home-recent">
            {recent.map((s) => (
              <li key={s!.id}>
                <a href={`#/song/${s!.id}`}>
                  <span className="home-recent__title">{s!.title}</span>
                  <span className="home-recent__key">{s!.songKey ? <ChordName chord={s!.songKey} /> : ' '}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {cloud.band && cloud.sync && (
        <a className="home-band" href="#/banda">
          <Icon name={cloud.sync.state === 'offline' ? 'cloudOff' : 'cloud'} size={18} />
          <span>
            {cloud.band.bandName} · {syncSummary(cloud.sync)}
          </span>
        </a>
      )}
      <h2 className="home__label home__label--library">Todas las canciones</h2>
    </div>
  );
}

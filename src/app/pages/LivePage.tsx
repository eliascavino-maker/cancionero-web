import { useEffect, useMemo, useRef, useState } from 'react';
import { parseChordPro } from '../../chordpro/parser';
import { askConfirm, tell } from '../../components/ask';
import { FullscreenButton, canGoFull } from '../../components/FullscreenButton';
import { useBandLogo } from '../../cloud/logo';
import { Icon } from '../../components/Icon';
import { explain, useCloud } from '../../cloud/CloudProvider';
import { useRoom } from '../../live/LiveProvider';
import { LeaderChanged, type LivePos } from '../../live/room';
import { COUNT_BPM, bandSignals, countBeats } from '../../live/signals';
import { clampBpm, parseBpm } from '../../chordpro/tempo';
import { CueOverlay, SignalsDialog } from '../Cue';
import { type SetlistEntry, songLabel } from '../../data/library';
import { navigate, useLibrary, useLive } from '../hooks';
import { LiveStrip } from '../LiveStrip';
import { useMoveDirection } from '../motion';
import { LockOverlay } from '../Lock';
import { SongPanel } from '../SongPanel';
import { useStageMode } from '../stageMode';
import { stageSlides } from '../StageView';

/** The leader's song in this setlist: by position, or by song if the list moved. */
function leaderIndex(entries: SetlistEntry[], pos: LivePos): number {
  if (entries[pos.index]?.song.id === pos.songId) return pos.index;
  return entries.findIndex((e) => e.song.id === pos.songId);
}

/**
 * Sala en vivo. Whoever taps "Ser director" leads: their song, part and key
 * reach everyone at once. Without a leader, each one moves on their own.
 */
export function LivePage() {
  const logo = useBandLogo();
  const lib = useLibrary();
  const { room, state } = useRoom();
  const session = state.session;
  const setlistId = session?.setlistId;
  const data = useLive(
    async (l) => (setlistId ? { setlist: await l.getSetlist(setlistId), entries: await l.getSetlistEntries(setlistId) } : null),
    [setlistId],
  );
  const entries = data?.entries ?? [];

  const myId = room?.me.userId;
  const leaderId = session?.leaderId ?? null;
  const leading = !!leaderId && leaderId === myId;
  const [follow, setFollow] = useState(true);
  const stage = useStageMode();
  const [locked, setLocked] = useState(false);
  const cloud = useCloud();
  const signals = bandSignals(cloud.band?.liveSignals);
  const [picking, setPicking] = useState(false);
  const refreshBand = cloud.refreshBand;
  // The owner may have just changed the signals.
  useEffect(() => {
    refreshBand().catch(() => {});
  }, [refreshBand]);
  const [local, setLocal] = useState({ index: 0, part: 0 });

  const lp = state.leaderPos;
  const lpIndex = lp && lp.setlistId === setlistId ? leaderIndex(entries, lp) : -1;
  const following = !leading && !!leaderId && follow && lpIndex !== -1;
  const at = following ? { index: lpIndex, part: lp!.part } : local;
  const entry = entries[at.index];
  const transpose = following ? lp!.transpose : (entry?.item.transpose ?? 0);
  const song = useMemo(() => (entry ? parseChordPro(entry.song.content) : null), [entry?.song.content]);
  const slides = useMemo(() => (song ? stageSlides(song) : []), [song]);
  const parts = slides.length;
  const dir = useMoveDirection(at.index);
  const part = Math.min(at.part, Math.max(0, parts - 1));

  // Stop following where the leader was, so nothing jumps.
  useEffect(() => {
    if (following) setLocal({ index: at.index, part: at.part });
  }, [following, at.index, at.part]);

  // On this page: the others see us in the room.
  useEffect(() => {
    room?.enter();
    return () => room?.leave();
  }, [room]);

  // Where we are. Sent only while leading.
  useEffect(() => {
    if (room && setlistId && entry) {
      room.sendPos({ setlistId, index: at.index, songId: entry.song.id, part, transpose });
    }
  }, [room, setlistId, at.index, entry?.song.id, part, transpose, leading]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Moving by yourself while following stops following. */
  const move = (index: number, p: number) => {
    if (index < 0 || index >= entries.length) return;
    if (following) setFollow(false);
    setLocal({ index, part: p });
  };
  const isFirst = at.index === 0 && part === 0;
  const isLast = at.index >= entries.length - 1 && part >= parts - 1;
  const nextPart = () => (part < parts - 1 ? move(at.index, part + 1) : move(at.index + 1, 0));
  const prevPart = () => (part > 0 ? move(at.index, part - 1) : move(at.index - 1, 0));

  // Keys (and Bluetooth pedals). Leading: ↑/↓ and RePág/AvPág change the part.
  // Everyone: ←/→ change the song.
  const keys = useRef({ nextPart, prevPart, move, at, leading });
  keys.current = { nextPart, prevPart, move, at, leading };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
      const k = keys.current;
      if (k.leading && (e.key === 'ArrowDown' || e.key === 'PageDown')) k.nextPart();
      else if (k.leading && (e.key === 'ArrowUp' || e.key === 'PageUp')) k.prevPart();
      else if (e.key === 'ArrowRight') k.move(k.at.index + 1, 0);
      else if (e.key === 'ArrowLeft') k.move(k.at.index - 1, 0);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ----- leading
  const [busy, setBusy] = useState(false);
  const act = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      await tell(e instanceof LeaderChanged ? `${e.message}.` : explain(e));
    } finally {
      setBusy(false);
    }
  };
  const lead = () => act(() => room!.takeLead(null));
  const takeOver = async () => {
    const ok = await askConfirm(`Ahora dirige ${session?.leaderName || 'otra persona'}. ¿Tomás la dirección?`, {
      ok: 'Tomar la dirección',
    });
    if (ok) await act(() => room!.takeLead(leaderId));
  };
  const closeRoom = async () => {
    const ok = await askConfirm('¿Cerrar la sala? Se corta para todos.', { ok: 'Cerrar la sala', danger: true });
    if (!ok) return;
    const back = setlistId;
    await act(() => room!.close());
    navigate(back ? `/setlist/${back}` : '/setlists');
  };

  if (!state.loaded || (session && !data)) return null;
  if (!room || !session) {
    return (
      <div className="page">
        <header className="page__header">
          <a className="icon-btn" href="#/setlists" aria-label="Volver a setlists">
            <Icon name="back" />
          </a>
          <h1>Sala en vivo</h1>
        </header>
        <p className="empty">No hay una sala abierta. Abrila desde un setlist con «Sala en vivo».</p>
      </div>
    );
  }
  if (!data?.setlist || !entry) {
    return <p className="empty">Esperando el setlist de la sala…</p>;
  }

  const next = entries[at.index + 1];
  const leaderHere = state.peers.some((p) => p.userId === leaderId);
  const others = state.peers.filter((p) => p.userId !== myId).map((p) => p.name);

  return (
    <div className="page page--song live" data-dir={dir}>
      <header className="page__header page__header--sticky page__header--strip live__header">
        <a className="icon-btn" href={`#/setlist/${setlistId}`} aria-label="Salir de la sala">
          <Icon name="close" />
        </a>
        <button
          className="icon-btn icon-btn--filled"
          aria-label="Canción anterior"
          disabled={at.index === 0}
          onClick={() => move(at.index - 1, 0)}
        >
          <Icon name="prev" size={20} />
        </button>
        {logo && <img className="band-logo live__logo" src={logo} alt="" />}
        <div className="player__title">
          <strong>
            {at.index + 1}/{entries.length} · {data.setlist.name}
          </strong>
          <small>{next ? `Sigue: ${songLabel(next.song)}` : 'Última canción'}</small>
        </div>
        <button
          className="icon-btn icon-btn--filled"
          aria-label="Canción siguiente"
          disabled={at.index >= entries.length - 1}
          onClick={() => move(at.index + 1, 0)}
        >
          <Icon name="next" size={20} />
        </button>
        <button
          className="icon-btn"
          aria-label="Modo escenario"
          title="Modo escenario"
          aria-pressed={stage.on}
          onClick={stage.toggle}
        >
          <Icon name="stage" />
        </button>
        {(!stage.on || canGoFull()) && <FullscreenButton />}
        <details className="menu">
          <summary className="icon-btn" aria-label="Más opciones de la sala">
            <Icon name="more" />
          </summary>
          <div className="menu__panel">
            <button onClick={closeRoom} style={{ color: 'var(--poncho)' }}>
              <Icon name="close" /> Cerrar la sala
            </button>
          </div>
        </details>

        <div className="live__status" role="status" aria-live="polite">
          <span className={`live__who${leaderId ? ' live__who--lead' : ''}`}>
            {leaderId ? (
              <>
                Dirige: <strong>{leading ? 'vos' : session.leaderName || 'alguien'}</strong>
                {!leading && !leaderHere && <small> · no está conectado</small>}
              </>
            ) : (
              'Sin director: cada uno navega libre'
            )}
          </span>
          <span className="live__people" title={others.join(', ')}>
            {others.length ? `Con vos: ${others.join(', ')}` : 'Solo vos en la sala'}
          </span>
          {!state.connected && <span className="live__offline">Sin conexión: seguís con lo que tenés</span>}
          <div className="live__actions">
            {!leaderId && (
              <button className="btn btn--primary live__lead" disabled={busy} onClick={lead}>
                Ser director
              </button>
            )}
            {leaderId && !leading && (
              <>
                <button className="btn" aria-pressed={following} onClick={() => setFollow(!following)}>
                  {following ? 'Dejar de seguir' : 'Seguir'}
                </button>
                <button className="btn live__lead" disabled={busy} onClick={takeOver}>
                  Tomar la dirección
                </button>
              </>
            )}
            {leading && (
              <button className="btn live__lead" disabled={busy} onClick={() => act(() => room.leaveLead())}>
                Dejar de dirigir
              </button>
            )}
          </div>
        </div>
        <LiveStrip
          entries={entries}
          index={at.index}
          part={{ index: part, slides }}
          onJump={move}
          onLock={() => setLocked(true)}
        />
      </header>
      {locked && <LockOverlay onUnlock={() => setLocked(false)} />}
      <CueOverlay cue={state.cue} me={myId} />
      {picking && <SignalsDialog signals={signals} onPick={(s) => room.signal(s)} onClose={() => setPicking(false)} />}

      <SongPanel
        key={entry.item.id}
        content={entry.song.content}
        transpose={transpose}
        onTransposeChange={(n) => lib.setItemTranspose(entry.item.id, n)}
        songKey={entry.song.id}
        stage={stage.on}
        live={{
          part: leaderId ? part : -1,
          follow: following || leading,
          onPart: leading ? (p) => move(at.index, p) : undefined,
          bar: leading ? (
            <div className="live-lead" role="group" aria-label="Dirigir">
              <div className="live-parts">
                <button className="live-parts__btn" disabled={isFirst} onClick={prevPart}>
                  <Icon name="left" size={22} /> Parte anterior
                </button>
                <button className="live-parts__btn live-parts__btn--next" disabled={isLast} onClick={nextPart}>
                  Parte siguiente <Icon name="right" size={22} />
                </button>
              </div>
              <div className="live-cues">
                <button
                  className="live-cues__btn"
                  onClick={() => room.count(clampBpm(parseBpm(song?.metadata.tempo) ?? COUNT_BPM), countBeats(song?.metadata.time))}
                >
                  <Icon name="metronome" size={20} /> Contar
                </button>
                <button className="live-cues__btn" aria-haspopup="dialog" onClick={() => setPicking(true)}>
                  <Icon name="signal" size={20} /> Señales
                </button>
              </div>
            </div>
          ) : undefined,
        }}
      />
    </div>
  );
}

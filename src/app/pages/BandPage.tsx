import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from 'react';
import { askConfirm, askText, tell } from '../../components/ask';
import { Icon } from '../../components/Icon';
import { explain, useCloud } from '../../cloud/CloudProvider';
import type { SyncStatus } from '../../cloud/sync';
import { useLibrary, useLive } from '../hooks';

/** Runs an async action, with "busy" and a readable error. */
function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (e) {
      setError(explain(e));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);
  return { run, busy, error, setError };
}

/** Loads now and again when the connection comes back (a load made offline fails). */
function useReloadOnline(load: () => Promise<unknown>) {
  useEffect(() => {
    void load();
    const again = () => void load();
    window.addEventListener('online', again);
    return () => window.removeEventListener('online', again);
  }, [load]);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="band__section">
      <h2 className="band__title">{title}</h2>
      {children}
    </section>
  );
}

function ErrorText({ error }: { error: string | null }) {
  return error ? (
    <p className="form__error" role="alert">
      {error}
    </p>
  ) : null;
}

/**
 * Account and band: sign in, create or join the band, sync status, members,
 * invitations, deleted songs and setlists.
 *
 * `invite`: code from an invitation link (#/invitacion/CODE).
 */
export function BandPage({ invite }: { invite?: string }) {
  const cloud = useCloud();

  let body: ReactNode;
  if (!cloud.configured) {
    body = <p className="empty">Esta copia de la app no tiene servidor: todo queda en este dispositivo.</p>;
  } else if (!cloud.ready) {
    body = null;
  } else if (!cloud.user) {
    body = (
      <>
        <p className="band__lead">
          Con una cuenta, las canciones y los setlists de la banda están en todos tus dispositivos y en los de
          los demás.
        </p>
        <AuthForm />
      </>
    );
  } else if (!cloud.band) {
    body = (
      <>
        <JoinOrCreate invite={invite} />
        <Account />
      </>
    );
  } else {
    body = (
      <>
        {invite && <p className="band__lead">Ya estás en «{cloud.band.bandName}».</p>}
        {cloud.needsLink && <LinkChoice />}
        {cloud.sync && <SyncCard status={cloud.sync} />}
        <Members />
        {cloud.band.role === 'owner' && <Invites />}
        <Trash />
        <Account />
      </>
    );
  }

  return (
    <div className="page band">
      <header className="page__header">
        <h1>{cloud.band?.bandName ?? 'Banda'}</h1>
      </header>
      {body}
    </div>
  );
}

// ------------------------------------------------------------------ account

function AuthForm() {
  const cloud = useCloud();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const { run, busy, error, setError } = useAction();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'up' && !name.trim()) return setError('Poné tu nombre: así te ven los demás.');
    void run(() => (mode === 'in' ? cloud.signIn(email, password) : cloud.signUp(email, password, name)));
  };

  return (
    <form className="form" onSubmit={submit}>
      <div className="segmented" role="group" aria-label="Cuenta">
        <button type="button" aria-pressed={mode === 'in'} onClick={() => setMode('in')}>
          Entrar
        </button>
        <button type="button" aria-pressed={mode === 'up'} onClick={() => setMode('up')}>
          Crear cuenta
        </button>
      </div>
      {mode === 'up' && (
        <label className="field">
          <span>Tu nombre</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={40} />
        </label>
      )}
      <label className="field">
        <span>Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </label>
      <label className="field">
        <span>Contraseña</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          minLength={6}
          required
        />
      </label>
      <ErrorText error={error} />
      <button className="btn btn--primary" disabled={busy}>
        {mode === 'in' ? 'Entrar' : 'Crear cuenta'}
      </button>
    </form>
  );
}

function Account() {
  const cloud = useCloud();
  const { run, busy, error } = useAction();
  const band = cloud.band;

  const leave = async () => {
    const ok = await askConfirm('Las canciones quedan en este dispositivo como copia tuya.', {
      title: `¿Dejar «${band!.bandName}»?`,
      ok: 'Dejar la banda',
      danger: true,
    });
    if (ok) await run(async () => {
      const { error } = await cloud.client!.rpc('leave_band', { band: band!.bandId });
      if (error) throw error;
      await cloud.refreshBand();
    });
  };

  const remove = async () => {
    const typed = await askText(
      'Se borran para todos las canciones, los setlists y el historial. No se puede deshacer. En este dispositivo queda una copia.',
      '',
      { title: `Escribí «${band!.bandName}» para borrar la banda`, ok: 'Borrar la banda', danger: true },
    );
    if (typed === null) return;
    if (typed.trim() !== band!.bandName) return tell('El nombre no coincide. No se borró nada.');
    await run(async () => {
      const { error } = await cloud.client!.rpc('delete_band', { band: band!.bandId });
      if (error) throw error;
      await cloud.refreshBand();
    });
  };

  return (
    <Section title="Tu cuenta">
      <p className="band__line">{cloud.user?.email}</p>
      <ErrorText error={error} />
      <div className="band__actions">
        <button className="btn" onClick={() => run(cloud.signOut)} disabled={busy}>
          <Icon name="logout" size={18} /> Cerrar sesión
        </button>
        {band?.role === 'member' && (
          <button className="btn btn--danger" onClick={leave} disabled={busy}>
            Dejar la banda
          </button>
        )}
        {band?.role === 'owner' && (
          <button className="btn btn--danger" onClick={remove} disabled={busy}>
            <Icon name="trash" size={18} /> Borrar la banda
          </button>
        )}
      </div>
    </Section>
  );
}

// --------------------------------------------------------------- join band

function JoinOrCreate({ invite }: { invite?: string }) {
  const cloud = useCloud();
  const [code, setCode] = useState(invite ?? '');
  const [name, setName] = useState('');
  const join = useAction();
  const create = useAction();

  return (
    <>
      <Section title="Tengo una invitación">
        <form
          className="form form--row"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) void join.run(() => cloud.acceptInvite(code));
          }}
        >
          <label className="field">
            <span>Código</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
          </label>
          <button className="btn btn--primary" disabled={join.busy || !code.trim()}>
            Unirme
          </button>
        </form>
        <ErrorText error={join.error} />
      </Section>
      <Section title="Crear una banda">
        <p className="band__line">
          Quien la crea es el owner: invita y saca miembros, y es el único que borra canciones.
        </p>
        <form
          className="form form--row"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) void create.run(() => cloud.createBand(name));
          }}
        >
          <label className="field">
            <span>Nombre de la banda</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </label>
          <button className="btn" disabled={create.busy || !name.trim()}>
            Crear
          </button>
        </form>
        <ErrorText error={create.error} />
      </Section>
    </>
  );
}

/** This device has its own songs: upload them, or start with the band's. */
function LinkChoice() {
  const cloud = useCloud();
  const { songs, setlists, otherBand } = cloud.needsLink!;
  const { run, busy, error } = useAction();
  const parts = [
    songs && (songs === 1 ? '1 canción' : `${songs} canciones`),
    setlists && (setlists === 1 ? '1 setlist' : `${setlists} setlists`),
  ].filter(Boolean);

  const fresh = async () => {
    const ok = await askConfirm(
      'Lo que está solo en este dispositivo se borra de acá. Si lo querés guardar, exportá un respaldo antes (Canciones → ⋯ → Exportar respaldo).',
      { title: '¿Empezar solo con lo de la banda?', ok: 'Empezar', danger: true },
    );
    if (ok) await run(() => cloud.link(false));
  };

  return (
    <div className="band__panel" role="region" aria-label="Canciones de este dispositivo">
      <p className="band__panel-title">
        {parts.length ? `Este dispositivo tiene ${parts.join(' y ')} que no están en la banda.` : 'Este dispositivo tiene datos de otra banda.'}
      </p>
      {otherBand && (
        <p className="band__line">Lo de la otra banda se quita de este dispositivo; sigue estando en esa banda.</p>
      )}
      <ErrorText error={error} />
      <div className="band__actions">
        {parts.length > 0 && (
          <button className="btn btn--primary" onClick={() => run(() => cloud.link(true))} disabled={busy}>
            <Icon name="upload" size={18} /> Subirlas a la banda
          </button>
        )}
        <button className="btn" onClick={fresh} disabled={busy}>
          Empezar solo con lo de la banda
        </button>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------- sync

const timeAgo = (ms: number) => {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return 'recién';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  return new Date(ms).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
};

export function syncSummary(s: SyncStatus): string {
  const waiting = s.pending === 1 ? '1 cambio sin subir' : `${s.pending} cambios sin subir`;
  if (s.state === 'syncing') return 'Sincronizando…';
  if (s.state === 'offline') return s.pending ? `Sin conexión · ${waiting}` : 'Sin conexión · todo guardado en este dispositivo';
  if (s.state === 'error') return `No se pudo sincronizar: ${s.error}`;
  if (s.pending) return waiting;
  return s.lastSync ? `Todo sincronizado · ${timeAgo(s.lastSync)}` : 'Todo sincronizado';
}

function SyncCard({ status }: { status: SyncStatus }) {
  const cloud = useCloud();
  return (
    <Section title="Sincronización">
      <p className={`band__sync band__sync--${status.state}`} role="status">
        <Icon name={status.state === 'offline' || status.state === 'error' ? 'cloudOff' : 'cloud'} size={20} />
        {syncSummary(status)}
      </p>
      {status.notices.length > 0 && (
        <div className="band__panel">
          <ul className="band__notices">
            {status.notices.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
          <button className="btn" onClick={cloud.clearNotices}>
            Entendido
          </button>
        </div>
      )}
      <div className="band__actions">
        <button className="btn" onClick={cloud.syncNow} disabled={status.state === 'syncing'}>
          Sincronizar ahora
        </button>
      </div>
    </Section>
  );
}

// ----------------------------------------------------------------- members

interface MemberRow {
  user_id: string;
  role: 'owner' | 'member';
  display_name: string;
}

function Members() {
  const cloud = useCloud();
  const band = cloud.band!;
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const { run, error, setError } = useAction();

  const load = useCallback(async () => {
    const { data, error } = await cloud
      .client!.from('band_members')
      .select('user_id, role, display_name')
      .eq('band_id', band.bandId)
      .order('joined_at');
    if (error) return setError(explain(error));
    setMembers(data as MemberRow[]);
  }, [cloud.client, band.bandId, setError]);

  useReloadOnline(load);

  const removeMember = async (m: MemberRow) => {
    const ok = await askConfirm('Deja de ver las canciones y los setlists de la banda.', {
      title: `¿Sacar a ${m.display_name || 'este miembro'}?`,
      ok: 'Sacar',
      danger: true,
    });
    if (ok)
      await run(async () => {
        const { error } = await cloud.client!.rpc('remove_member', { band: band.bandId, member: m.user_id });
        if (error) throw error;
        await load();
      });
  };

  return (
    <Section title="Miembros">
      <ErrorText error={error} />
      {members && (
        <ul className="list">
          {members.map((m) => (
            <li key={m.user_id} className="card">
              <span className="card__main">
                <span className="card__title">
                  {m.display_name || 'Sin nombre'}
                  {m.user_id === cloud.user?.id && ' (vos)'}
                </span>
                <span className="card__sub">{m.role === 'owner' ? 'Owner' : 'Miembro'}</span>
              </span>
              {band.role === 'owner' && m.role !== 'owner' && (
                <button className="btn btn--danger" onClick={() => removeMember(m)}>
                  Sacar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

interface InviteRow {
  code: string;
  expires_at: string;
}

function inviteLink(code: string) {
  return `${location.origin}${location.pathname}#/invitacion/${code}`;
}

function Invites() {
  const cloud = useCloud();
  const band = cloud.band!;
  const [pending, setPending] = useState<InviteRow[]>([]);
  const [fresh, setFresh] = useState<string | null>(null);
  const { run, busy, error } = useAction();

  const load = useCallback(async () => {
    const { data } = await cloud
      .client!.from('band_invites')
      .select('code, expires_at')
      .eq('band_id', band.bandId)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    setPending((data as InviteRow[] | null) ?? []);
  }, [cloud.client, band.bandId]);

  useReloadOnline(load);

  const create = () =>
    run(async () => {
      const { data, error } = await cloud.client!.rpc('create_invite', { band: band.bandId });
      if (error) throw error;
      setFresh(data as string);
      await load();
    });

  const cancel = (code: string) =>
    run(async () => {
      const { error } = await cloud.client!.from('band_invites').delete().eq('code', code);
      if (error) throw error;
      if (fresh === code) setFresh(null);
      await load();
    });

  const share = async (code: string) => {
    const url = inviteLink(code);
    const text = `Sumate a «${band.bandName}» en el Cancionero: ${url}`;
    if (navigator.share) {
      await navigator.share({ title: 'Invitación', text }).catch(() => {});
    } else {
      await navigator.clipboard?.writeText(url);
      await tell('Copié el link. Pegalo en un mensaje para quien quieras invitar.');
    }
  };

  return (
    <Section title="Invitaciones">
      <p className="band__line">Cada invitación sirve para una persona y vence a los 7 días.</p>
      <ErrorText error={error} />
      {fresh && (
        <div className="band__panel">
          <p className="band__code">{fresh}</p>
          <p className="band__line">{inviteLink(fresh)}</p>
          <div className="band__actions">
            <button className="btn btn--primary" onClick={() => share(fresh)}>
              <Icon name="share" size={18} /> Compartir
            </button>
          </div>
        </div>
      )}
      <div className="band__actions">
        <button className="btn" onClick={create} disabled={busy}>
          <Icon name="plus" size={18} /> Invitar a alguien
        </button>
      </div>
      {pending.length > 0 && (
        <ul className="list">
          {pending.map((i) => (
            <li key={i.code} className="card">
              <span className="card__main">
                <span className="card__title band__mono">{i.code}</span>
                <span className="card__sub">
                  Vence el {new Date(i.expires_at).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                </span>
              </span>
              <button className="icon-btn" aria-label={`Compartir ${i.code}`} onClick={() => share(i.code)}>
                <Icon name="share" />
              </button>
              <button className="btn btn--danger" onClick={() => cancel(i.code)} disabled={busy}>
                Cancelar
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

// ------------------------------------------------------------------- trash

function Trash() {
  const lib = useLibrary();
  const cloud = useCloud();
  const songs = useLive((l) => l.listDeletedSongs(), []);
  const setlists = useLive((l) => l.listDeletedSetlists(), []);
  if (!songs?.length && !setlists?.length) return null;

  return (
    <Section title="Borrados">
      {!cloud.canDeleteSongs && songs?.length ? (
        <p className="band__line">Las canciones borradas solo las puede restaurar el owner.</p>
      ) : null}
      <ul className="list">
        {setlists?.map((s) => (
          <li key={s.id} className="card">
            <span className="card__main">
              <span className="card__title">{s.name}</span>
              <span className="card__sub">Setlist</span>
            </span>
            <button className="btn" onClick={() => lib.restoreSetlist(s.id)}>
              <Icon name="restore" size={18} /> Restaurar
            </button>
          </li>
        ))}
        {songs?.map((s) => (
          <li key={s.id} className="card">
            <span className="card__main">
              <span className="card__title">{s.title}</span>
              <span className="card__sub">{s.artist ?? 'Canción'}</span>
            </span>
            {cloud.canDeleteSongs && (
              <button className="btn" onClick={() => lib.restoreSong(s.id)}>
                <Icon name="restore" size={18} /> Restaurar
              </button>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

-- 5/5 · Sala en vivo. Solo miembros de la banda, cada uno con su cuenta.
--
-- Reglas:
--   · Abrir la sala y ser director son cosas separadas: abrir la sala desde
--     un setlist no hace director a nadie.
--   · Cualquier miembro abre o cierra la sala, y puede ser director.
--   · "Ser director": gana el primero. Si ya hay director, tomar la dirección
--     pide decir a quién se le saca (la app lo confirma antes).
--   · Solo el director deja de dirigir. La sala sigue abierta sin director.
--   · La sala vence a las 12 h del último cambio (abrir, dirigir, dejar).
--   · La posición (canción, parte, tono) va por broadcast en el canal privado
--     'live:<band_id>', no pasa por la base. Solo los miembros lo escuchan y
--     mandan.
--   · Se quita el código de invitados: no hay invitados.

-- ------------------------------------------------------- sin invitados
-- guest_code y new_guest_code no los usa nada más.

drop function public.new_guest_code(uuid);
alter table public.bands drop column guest_code;

-- ------------------------------------------------------------------ tabla

create table public.live_sessions (
  band_id     uuid primary key references public.bands on delete cascade,
  setlist_id  uuid not null,
  opened_by   uuid references auth.users on delete set null,
  opened_at   timestamptz not null default now(),
  -- Sin director: null. Cada uno navega libre.
  leader_id   uuid references auth.users on delete set null,
  -- Para mostrar "Dirige: Sergio" sin otra consulta.
  leader_name text not null default '' check (length(leader_name) <= 40),
  lead_since  timestamptz,
  updated_at  timestamptz not null default now(),
  -- El setlist tiene que ser de la misma banda.
  foreign key (setlist_id, band_id) references public.setlists (id, band_id) on delete cascade
);

-- ---------------------------------------------------------------- helpers

create function private.require_member(band uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_member(band) then
    raise exception 'No sos miembro de esta banda' using errcode = '42501';
  end if;
end $$;

/** Vigente: cambió en las últimas 12 h. */
create function private.live_open(s public.live_sessions) returns boolean
language sql stable set search_path = '' as $$
  select s.updated_at > now() - interval '12 hours'
$$;

/** Nombre para "Dirige: …": su músico, si eligió; si no, su nombre en la banda. */
create function private.member_name(band uuid, uid uuid) returns text
language sql stable security definer set search_path = '' as $$
  select left(coalesce(nullif(mu.name, ''), nullif(m.display_name, ''), 'Alguien'), 40)
  from public.band_members m
  left join public.musicians mu on mu.id = m.musician_id
  where m.band_id = band and m.user_id = uid
$$;

/** La banda de un topic de Realtime 'prefijo:<band_id>', o null. */
create function private.topic_band(prefix text) returns uuid
language plpgsql stable set search_path = '' as $$
declare t text := realtime.topic();
begin
  if t is null or left(t, length(prefix) + 1) <> prefix || ':' then
    return null;
  end if;
  return substr(t, length(prefix) + 2)::uuid;
exception when invalid_text_representation then
  return null;
end $$;

-- --------------------------------------------------------- grants y RLS

revoke all on table public.live_sessions from anon, authenticated, public;
-- Se lee directo; se cambia solo con las funciones de abajo.
grant select on public.live_sessions to authenticated;
grant all on public.live_sessions to service_role;

alter table public.live_sessions enable row level security;

create policy "miembros ven la sala" on public.live_sessions
  for select to authenticated using (private.is_member(band_id));

-- Respaldo del broadcast: quién dirige también llega por postgres_changes.
alter publication supabase_realtime add table public.live_sessions;

-- Canales privados de Realtime. 'live:<band>': la sala. 'sync:<band>': el
-- aviso de cambios de la sincronización, que pasa a ser privado para poder
-- apagar "Allow public access".
create policy "miembros escuchan la sala y la sincronización" on realtime.messages
  for select to authenticated
  using (private.is_member(private.topic_band('live')) or private.is_member(private.topic_band('sync')));

create policy "miembros hablan en la sala" on realtime.messages
  for insert to authenticated
  with check (private.is_member(private.topic_band('live')) and realtime.messages.extension in ('broadcast', 'presence'));

-- Quien sale de la banda deja de dirigir.
create function private.drop_leader() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.live_sessions
    set leader_id = null, leader_name = '', lead_since = null, updated_at = now()
    where band_id = old.band_id and leader_id = old.user_id;
  return old;
end $$;

create trigger band_members_drop_leader
  after delete on public.band_members
  for each row execute function private.drop_leader();

-- --------------------------------------------------------------------- RPC

/**
 * Abre la sala con ese setlist, o le cambia el setlist. No toca al director,
 * salvo que la sala estuviera vencida: entonces arranca sin director.
 */
create function public.open_live(band uuid, setlist uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_account();
begin
  perform private.require_member(band);
  if not exists (select 1 from public.setlists s where s.id = setlist and s.band_id = band and s.deleted_at is null) then
    raise exception 'El setlist no existe' using errcode = 'P0002';
  end if;
  insert into public.live_sessions as l (band_id, setlist_id, opened_by)
    values (band, setlist, uid)
  on conflict (band_id) do update set
    setlist_id  = excluded.setlist_id,
    opened_by   = case when private.live_open(l) then l.opened_by else excluded.opened_by end,
    opened_at   = case when private.live_open(l) then l.opened_at else now() end,
    leader_id   = case when private.live_open(l) then l.leader_id end,
    leader_name = case when private.live_open(l) then l.leader_name else '' end,
    lead_since  = case when private.live_open(l) then l.lead_since end,
    updated_at  = now();
end $$;

/** Cierra la sala. Cualquier miembro (la app lo confirma antes). */
create function public.close_live(band uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_account();
  perform private.require_member(band);
  delete from public.live_sessions where band_id = band;
end $$;

/**
 * "Ser director" (expected = null) o "Tomar la dirección" (expected = quien
 * dirige ahora, según la app). Si mientras tanto cambió, no hace nada y avisa
 * quién dirige: hint 'leader_changed'. Devuelve el nombre que ven los demás.
 */
create function public.take_lead(band uuid, expected uuid default null) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_account();
  me text;
  s public.live_sessions;
begin
  perform private.require_member(band);
  select * into s from public.live_sessions where band_id = band for update;
  if not found or not private.live_open(s) then
    raise exception 'La sala está cerrada' using errcode = 'P0002';
  end if;
  if s.leader_id = uid then
    return s.leader_name;
  end if;
  if s.leader_id is distinct from expected then
    raise exception 'Ahora dirige %', coalesce(nullif(s.leader_name, ''), 'otra persona')
      using errcode = 'P0001', hint = 'leader_changed';
  end if;
  me := private.member_name(band, uid);
  update public.live_sessions
    set leader_id = uid, leader_name = me, lead_since = now(), updated_at = now()
    where band_id = band;
  return me;
end $$;

/** "Dejar de dirigir": solo el director. La sala queda abierta sin director. */
create function public.leave_lead(band uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_account();
begin
  update public.live_sessions
    set leader_id = null, leader_name = '', lead_since = null, updated_at = now()
    where band_id = band and leader_id = uid;
end $$;

-- Las funciones nacen ejecutables por PUBLIC: se cierra y se abre solo a
-- authenticated.
revoke execute on function
  private.require_member(uuid),
  private.live_open(public.live_sessions),
  private.member_name(uuid, uuid),
  private.topic_band(text),
  private.drop_leader(),
  public.open_live(uuid, uuid),
  public.close_live(uuid),
  public.take_lead(uuid, uuid),
  public.leave_lead(uuid)
from public, anon;
grant execute on function
  private.require_member(uuid),
  private.live_open(public.live_sessions),
  private.member_name(uuid, uuid),
  private.topic_band(text),
  public.open_live(uuid, uuid),
  public.close_live(uuid),
  public.take_lead(uuid, uuid),
  public.leave_lead(uuid)
to authenticated;

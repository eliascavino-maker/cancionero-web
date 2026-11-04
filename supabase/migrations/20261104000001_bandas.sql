-- 1/4 · Bandas, músicos, miembros e invitaciones.
--
-- Reglas:
--   · Solo los miembros ven su banda.
--   · Solo el owner invita, saca miembros, cambia el código de invitados y
--     borra la banda.
--   · Los usuarios anónimos (invitados de la sala en vivo) no pueden crear
--     bandas ni aceptar invitaciones.
--   · anon no tiene ningún permiso: todo pide sesión.

-- ------------------------------------------------------------------ helpers
-- Schema no expuesto por la API: funciones que usan las políticas.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

/** Código legible al azar: sin 0/O, 1/I/L ni U. */
create function private.new_code(len int) returns text
language sql volatile set search_path = '' as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTVWXYZ23456789', 1 + get_byte(b, i) % 30, 1), '' order by i)
  from (select uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid()) as b) s,
       generate_series(0, len - 1) i
$$;

/** La sesión es de un invitado anónimo. */
create function private.is_anon() returns boolean
language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;

-- ------------------------------------------------------------------- tablas

create table public.bands (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) between 1 and 80),
  -- Para entrar a la sala en vivo como invitado (solo lectura).
  guest_code text not null unique default private.new_code(8),
  created_at timestamptz not null default now()
);

create table public.musicians (
  id         uuid primary key default gen_random_uuid(),
  band_id    uuid not null references public.bands on delete cascade,
  name       text not null check (length(trim(name)) between 1 and 40),
  sings      boolean not null default true,
  instrument text,
  color      text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  position   int not null default 0,
  unique (band_id, name),
  unique (id, band_id)
);

create table public.band_members (
  band_id      uuid not null references public.bands on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'member')),
  -- Qué músico de la banda es esta cuenta (define su vista por defecto).
  musician_id  uuid,
  display_name text not null default '' check (length(display_name) <= 40),
  -- Preferencias que viajan con la cuenta, p. ej. {"view": "chords"}.
  prefs        jsonb not null default '{}' check (jsonb_typeof(prefs) = 'object'),
  joined_at    timestamptz not null default now(),
  primary key (band_id, user_id),
  -- El músico tiene que ser de la misma banda.
  foreign key (musician_id, band_id) references public.musicians (id, band_id)
    on delete set null (musician_id)
);
create index band_members_user on public.band_members (user_id);
create unique index band_members_one_owner on public.band_members (band_id) where role = 'owner';

create table public.band_invites (
  code       text primary key default private.new_code(10),
  band_id    uuid not null references public.bands on delete cascade,
  created_by uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by    uuid references auth.users on delete set null,
  used_at    timestamptz
);
create index band_invites_band on public.band_invites (band_id);

-- Usadas por las políticas. security definer: leen band_members sin pasar por su RLS.

create function private.is_member(band uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.band_members m
    where m.band_id = band and m.user_id = (select auth.uid())
  )
$$;

create function private.is_owner(band uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.band_members m
    where m.band_id = band and m.user_id = (select auth.uid()) and m.role = 'owner'
  )
$$;

-- ------------------------------------------------------------------- grants
-- Nuevas tablas no se exponen solas: cada permiso va explícito.

grant select on public.bands, public.musicians, public.band_members to authenticated;
grant insert, update, delete on public.musicians to authenticated;
grant update (musician_id, display_name, prefs) on public.band_members to authenticated;
grant select, delete on public.band_invites to authenticated;

grant all on public.bands, public.musicians, public.band_members, public.band_invites to service_role;

-- ---------------------------------------------------------------------- RLS

alter table public.bands        enable row level security;
alter table public.musicians    enable row level security;
alter table public.band_members enable row level security;
alter table public.band_invites enable row level security;

create policy "miembros ven su banda" on public.bands
  for select to authenticated using (private.is_member(id));

create policy "miembros ven los músicos" on public.musicians
  for select to authenticated using (private.is_member(band_id));
create policy "owner agrega músicos" on public.musicians
  for insert to authenticated with check (private.is_owner(band_id));
create policy "owner edita músicos" on public.musicians
  for update to authenticated using (private.is_owner(band_id)) with check (private.is_owner(band_id));
create policy "owner borra músicos" on public.musicians
  for delete to authenticated using (private.is_owner(band_id));

create policy "miembros ven a los miembros" on public.band_members
  for select to authenticated using (private.is_member(band_id));
-- Solo la fila propia, y solo las columnas del grant de arriba.
create policy "cada uno edita lo suyo" on public.band_members
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "owner ve las invitaciones" on public.band_invites
  for select to authenticated using (private.is_owner(band_id));
create policy "owner cancela invitaciones" on public.band_invites
  for delete to authenticated using (private.is_owner(band_id));

-- --------------------------------------------------------------------- RPC
-- security definer: hacen lo que el usuario no puede hacer directo, después
-- de chequear quién es.

create function private.require_account() returns uuid
language plpgsql stable set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null or private.is_anon() then
    raise exception 'Necesitás una cuenta' using errcode = '42501';
  end if;
  return uid;
end $$;

create function private.require_owner(band uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_owner(band) then
    raise exception 'Solo el owner de la banda puede hacer esto' using errcode = '42501';
  end if;
end $$;

/**
 * Crea una banda con sus músicos y deja a quien la crea como owner.
 * `band_musicians`: [{"name", "sings", "instrument", "color"}, ...]
 */
create function public.create_band(band_name text, my_name text default '', band_musicians jsonb default '[]')
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_account();
  band uuid;
begin
  insert into public.bands (name) values (trim(band_name)) returning id into band;
  insert into public.musicians (band_id, name, sings, instrument, color, position)
    select band, m ->> 'name', coalesce((m ->> 'sings')::boolean, true), m ->> 'instrument', m ->> 'color', i - 1
    from jsonb_array_elements(band_musicians) with ordinality as t(m, i);
  insert into public.band_members (band_id, user_id, role, display_name)
    values (band, uid, 'owner', left(trim(coalesce(my_name, '')), 40));
  return band;
end $$;

/** Invitación de un solo uso, vence en 7 días. Solo el owner. */
create function public.create_invite(band uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare result text;
begin
  perform private.require_account();
  perform private.require_owner(band);
  insert into public.band_invites (band_id) values (band) returning code into result;
  return result;
end $$;

/** Usa una invitación: la cuenta queda como miembro. Devuelve la banda. */
create function public.accept_invite(invite_code text, my_name text default '') returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_account();
  inv public.band_invites;
begin
  select * into inv from public.band_invites
    where code = upper(trim(invite_code))
    for update;
  if not found or inv.expires_at < now() or (inv.used_at is not null and inv.used_by is distinct from uid) then
    raise exception 'La invitación no existe, ya se usó o venció' using errcode = 'P0002';
  end if;
  insert into public.band_members (band_id, user_id, display_name)
    values (inv.band_id, uid, left(trim(coalesce(my_name, '')), 40))
    on conflict (band_id, user_id) do nothing;
  update public.band_invites set used_by = uid, used_at = coalesce(used_at, now())
    where code = inv.code;
  return inv.band_id;
end $$;

/** Saca a un miembro. Solo el owner, y no a sí mismo. */
create function public.remove_member(band uuid, member uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_account();
begin
  perform private.require_owner(band);
  if member = uid then
    raise exception 'El owner no puede sacarse a sí mismo' using errcode = '42501';
  end if;
  delete from public.band_members where band_id = band and user_id = member;
end $$;

/** Dejar la banda. El owner no puede: tendría que borrarla. */
create function public.leave_band(band uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_account();
begin
  if private.is_owner(band) then
    raise exception 'El owner no puede dejar la banda' using errcode = '42501';
  end if;
  delete from public.band_members where band_id = band and user_id = uid;
end $$;

/** Borra la banda con todo lo que tiene. Solo el owner. No se puede deshacer. */
create function public.delete_band(band uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_account();
  perform private.require_owner(band);
  delete from public.bands where id = band;
end $$;

/** Nuevo código de invitados para la sala en vivo. Solo el owner. */
create function public.new_guest_code(band uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare result text;
begin
  perform private.require_account();
  perform private.require_owner(band);
  update public.bands set guest_code = private.new_code(8) where id = band
    returning guest_code into result;
  return result;
end $$;

-- Las funciones nacen ejecutables por PUBLIC: se cierra y se abre solo a
-- authenticated.
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

revoke execute on function
  public.create_band(text, text, jsonb),
  public.create_invite(uuid),
  public.accept_invite(text, text),
  public.remove_member(uuid, uuid),
  public.leave_band(uuid),
  public.delete_band(uuid),
  public.new_guest_code(uuid)
from public, anon;
grant execute on function
  public.create_band(text, text, jsonb),
  public.create_invite(uuid),
  public.accept_invite(text, text),
  public.remove_member(uuid, uuid),
  public.leave_band(uuid),
  public.delete_band(uuid),
  public.new_guest_code(uuid)
to authenticated;

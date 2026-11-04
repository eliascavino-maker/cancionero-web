-- 3/4 · Canciones, setlists y su orden y tono.
--
-- Reglas:
--   · Los miembros ven, crean y editan todo lo de su banda.
--   · Nada se borra de verdad: borrar es poner deleted_at, así los otros
--     dispositivos se enteran y se puede restaurar.
--   · Solo el owner borra o restaura canciones. Setlists y su contenido, cualquier miembro.
--   · updated_at y updated_by los pone el servidor, no el dispositivo.

-- ------------------------------------------------------------------- tablas
-- Los ids los genera el dispositivo (UUID), así se puede crear sin conexión.

create table public.songs (
  id         uuid primary key,
  band_id    uuid not null references public.bands on delete cascade,
  title      text not null,
  artist     text,
  song_key   text,
  content    text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users on delete set null,
  deleted_at timestamptz,
  unique (id, band_id)
);
create index songs_sync on public.songs (band_id, updated_at);

create table public.setlists (
  id         uuid primary key,
  band_id    uuid not null references public.bands on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users on delete set null,
  deleted_at timestamptz,
  unique (id, band_id)
);
create index setlists_sync on public.setlists (band_id, updated_at);

create table public.setlist_items (
  id         uuid primary key,
  band_id    uuid not null references public.bands on delete cascade,
  setlist_id uuid not null,
  song_id    uuid not null,
  -- Fraccional: mover una canción cambia una sola fila.
  position   double precision not null,
  -- Tono de la canción en este setlist.
  transpose  smallint not null default 0 check (transpose between -11 and 11),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users on delete set null,
  deleted_at timestamptz,
  -- Setlist y canción de la misma banda.
  foreign key (setlist_id, band_id) references public.setlists (id, band_id) on delete cascade,
  foreign key (song_id, band_id) references public.songs (id, band_id) on delete cascade
);
create index setlist_items_sync on public.setlist_items (band_id, updated_at);
create index setlist_items_setlist on public.setlist_items (setlist_id);

-- ----------------------------------------------------------------- triggers

/** Hora y autor del servidor. created_at no cambia y nada se muda de banda. */
create function private.stamp() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.band_id is distinct from old.band_id then
      raise exception 'No se puede mover a otra banda' using errcode = '42501';
    end if;
    new.created_at := old.created_at;
  else
    new.created_at := now();
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

create trigger stamp before insert or update on public.songs
  for each row execute function private.stamp();
create trigger stamp before insert or update on public.setlists
  for each row execute function private.stamp();
create trigger stamp before insert or update on public.setlist_items
  for each row execute function private.stamp();

/** Borrar o restaurar una canción: solo el owner. */
create function private.guard_song_delete() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (tg_op = 'INSERT' and new.deleted_at is not null)
     or (tg_op = 'UPDATE' and new.deleted_at is distinct from old.deleted_at) then
    if not private.is_owner(new.band_id) then
      raise exception 'Solo el owner puede borrar o restaurar canciones' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger guard_delete before insert or update on public.songs
  for each row execute function private.guard_song_delete();

-- ------------------------------------------------------------------- grants
-- Sin DELETE: el borrado es poner deleted_at.
-- Primero se saca lo que hayan dado los privilegios por defecto.

revoke all on table public.songs, public.setlists, public.setlist_items from anon, authenticated, public;
grant select, insert, update on public.songs, public.setlists, public.setlist_items to authenticated;
grant all on public.songs, public.setlists, public.setlist_items to service_role;

revoke execute on function private.stamp(), private.guard_song_delete() from public, anon;

-- ---------------------------------------------------------------------- RLS

alter table public.songs         enable row level security;
alter table public.setlists      enable row level security;
alter table public.setlist_items enable row level security;

create policy "miembros ven canciones" on public.songs
  for select to authenticated using (private.is_member(band_id));
create policy "miembros crean canciones" on public.songs
  for insert to authenticated with check (private.is_member(band_id));
create policy "miembros editan canciones" on public.songs
  for update to authenticated using (private.is_member(band_id)) with check (private.is_member(band_id));

create policy "miembros ven setlists" on public.setlists
  for select to authenticated using (private.is_member(band_id));
create policy "miembros crean setlists" on public.setlists
  for insert to authenticated with check (private.is_member(band_id));
create policy "miembros editan setlists" on public.setlists
  for update to authenticated using (private.is_member(band_id)) with check (private.is_member(band_id));

create policy "miembros ven el contenido de los setlists" on public.setlist_items
  for select to authenticated using (private.is_member(band_id));
create policy "miembros agregan al setlist" on public.setlist_items
  for insert to authenticated with check (private.is_member(band_id));
create policy "miembros editan el setlist" on public.setlist_items
  for update to authenticated using (private.is_member(band_id)) with check (private.is_member(band_id));

-- ----------------------------------------------------------------- realtime
-- Avisa a los otros dispositivos cuando algo cambia (respeta el RLS).

alter publication supabase_realtime add table public.songs, public.setlists, public.setlist_items;

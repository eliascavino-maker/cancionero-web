-- 7 · Arreglos: otra versión de una canción (acústica, con banda, otro tono),
-- ligada a la original.
--
-- Reglas:
--   · Un arreglo es una canción más, con su texto propio, que apunta a la
--     original con arrangement_of y tiene un nombre («Acústica»).
--   · La original y el arreglo son de la misma banda.
--   · No hay arreglos de arreglos: la original no es un arreglo, y una
--     canción con arreglos no puede pasar a ser arreglo de otra.
--   · En el setlist se elige el arreglo cambiando el song_id del ítem. Volver
--     atrás en el historial del setlist también vuelve el arreglo elegido.

alter table public.songs
  add column arrangement_of   uuid,
  add column arrangement_name text,
  add constraint songs_arrangement_same_band
    foreign key (arrangement_of, band_id) references public.songs (id, band_id) on delete cascade,
  add constraint songs_arrangement_not_itself check (arrangement_of <> id),
  add constraint songs_arrangement_named check (
    (arrangement_of is null and arrangement_name is null)
    or (arrangement_of is not null and arrangement_name is not null
        and char_length(btrim(arrangement_name)) between 1 and 40));

create index songs_arrangements on public.songs (arrangement_of) where arrangement_of is not null;

/** Un solo nivel: ni arreglos de arreglos ni originales que pasen a ser arreglos. */
create function private.guard_arrangement() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.arrangement_of is null
     or (tg_op = 'UPDATE' and new.arrangement_of is not distinct from old.arrangement_of) then
    return new;
  end if;
  if exists (select 1 from public.songs o where o.id = new.arrangement_of and o.arrangement_of is not null) then
    raise exception 'Un arreglo no puede ser de otro arreglo' using errcode = '42501';
  end if;
  if exists (select 1 from public.songs a where a.arrangement_of = new.id) then
    raise exception 'Una canción con arreglos no puede ser arreglo de otra' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger guard_arrangement before insert or update on public.songs
  for each row execute function private.guard_arrangement();

revoke execute on function private.guard_arrangement() from public, anon;

/**
 * Igual que en la migración 4, y además vuelve la canción (el arreglo) de cada
 * ítem a la que tenía.
 */
create or replace function public.restore_setlist(target uuid, as_of timestamptz) returns void
language plpgsql security invoker set search_path = '' as $$
declare band uuid;
begin
  select s.band_id into band from public.setlists s where s.id = target;
  if band is null or not private.is_member(band) then
    raise exception 'No existe el setlist' using errcode = 'P0002';
  end if;

  update public.setlists s
    set name = r.data ->> 'name', deleted_at = (r.data ->> 'deleted_at')::timestamptz
    from (select k.data from public.revisions k
          where k.table_name = 'setlists' and k.row_id = target and k.changed_at <= as_of
          order by k.changed_at desc, k.id desc limit 1) r
    where s.id = target;

  update public.setlist_items i
    set position   = (p.data ->> 'position')::double precision,
        transpose  = (p.data ->> 'transpose')::smallint,
        song_id    = coalesce((p.data ->> 'song_id')::uuid, i.song_id),
        deleted_at = (p.data ->> 'deleted_at')::timestamptz
    from (select distinct on (k.row_id) k.row_id, k.data from public.revisions k
          where k.table_name = 'setlist_items' and k.parent_id = target and k.changed_at <= as_of
          order by k.row_id, k.changed_at desc, k.id desc) p
    where i.id = p.row_id;

  update public.setlist_items i
    set deleted_at = now()
    where i.setlist_id = target and i.deleted_at is null and i.created_at > as_of;
end $$;

revoke execute on function public.restore_setlist(uuid, timestamptz) from public, anon;
grant execute on function public.restore_setlist(uuid, timestamptz) to authenticated;

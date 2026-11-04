-- 4/4 · Historial: quién cambió qué y cuándo, para volver atrás.
--
-- Cada cambio en songs, setlists y setlist_items guarda una revisión con la
-- fila como quedó. Nadie puede editar ni borrar revisiones.
--
-- Para que no crezca sin límite, por cada elemento se guardan:
--   · como mucho las últimas 30 revisiones, y
--   · solo las de los últimos 90 días,
--   · pero siempre la más reciente.
-- Las ediciones seguidas de la misma persona sobre el mismo elemento, con
-- menos de 10 minutos entre una y otra, se juntan en una sola revisión.

create table public.revisions (
  id         bigint generated always as identity primary key,
  band_id    uuid not null references public.bands on delete cascade,
  table_name text not null check (table_name in ('songs', 'setlists', 'setlist_items')),
  row_id     uuid not null,
  -- Para setlist_items: su setlist. Así se arma el historial de un setlist.
  parent_id  uuid,
  action     text not null check (action in ('create', 'edit', 'delete', 'restore')),
  data       jsonb not null,
  changed_by uuid references auth.users on delete set null,
  changed_at timestamptz not null default now()
);
create index revisions_row on public.revisions (table_name, row_id, changed_at desc);
create index revisions_parent on public.revisions (parent_id, changed_at desc) where parent_id is not null;
create index revisions_band on public.revisions (band_id, changed_at desc);

create function private.log_revision() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  uid  uuid := auth.uid();
  snapshot jsonb := to_jsonb(new) - 'band_id' - 'updated_at' - 'updated_by';
  act  text;
  prev public.revisions;
begin
  if tg_op = 'INSERT' then
    act := 'create';
  elsif new.deleted_at is not null and old.deleted_at is null then
    act := 'delete';
  elsif new.deleted_at is null and old.deleted_at is not null then
    act := 'restore';
  elsif snapshot = to_jsonb(old) - 'band_id' - 'updated_at' - 'updated_by' then
    return null;  -- no cambió nada
  else
    act := 'edit';
    select * into prev from public.revisions r
      where r.table_name = tg_table_name and r.row_id = new.id
      order by r.changed_at desc, r.id desc
      limit 1;
    if found and prev.action = 'edit' and prev.changed_by is not distinct from uid
       and prev.changed_at > now() - interval '10 minutes' then
      update public.revisions set data = snapshot, changed_at = now() where id = prev.id;
      return null;
    end if;
  end if;

  insert into public.revisions (band_id, table_name, row_id, parent_id, action, data, changed_by)
  values (new.band_id, tg_table_name, new.id, (to_jsonb(new) ->> 'setlist_id')::uuid, act, snapshot, uid);

  -- Las 30 más recientes de este elemento.
  delete from public.revisions r
    where r.table_name = tg_table_name and r.row_id = new.id
      and r.id not in (
        select k.id from public.revisions k
        where k.table_name = tg_table_name and k.row_id = new.id
        order by k.changed_at desc, k.id desc
        limit 30);

  -- Más de 90 días, salvo la última de cada elemento.
  delete from public.revisions r
    where r.band_id = new.band_id
      and r.changed_at < now() - interval '90 days'
      and exists (
        select 1 from public.revisions n
        where n.table_name = r.table_name and n.row_id = r.row_id
          and (n.changed_at, n.id) > (r.changed_at, r.id));
  return null;
end $$;

create trigger log_revision after insert or update on public.songs
  for each row execute function private.log_revision();
create trigger log_revision after insert or update on public.setlists
  for each row execute function private.log_revision();
create trigger log_revision after insert or update on public.setlist_items
  for each row execute function private.log_revision();

revoke execute on function private.log_revision() from public, anon;

/**
 * Deja un setlist como estaba en `as_of`: nombre, si estaba borrado, y el orden,
 * tono y presencia de cada canción. Lo agregado después de `as_of` se quita.
 * Corre con los permisos del usuario (RLS), y el cambio queda en el historial.
 */
create function public.restore_setlist(target uuid, as_of timestamptz) returns void
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
        deleted_at = (p.data ->> 'deleted_at')::timestamptz
    from (select distinct on (k.row_id) k.row_id, k.data from public.revisions k
          where k.table_name = 'setlist_items' and k.parent_id = target and k.changed_at <= as_of
          order by k.row_id, k.changed_at desc, k.id desc) p
    where i.id = p.row_id;

  update public.setlist_items i
    set deleted_at = now()
    where i.setlist_id = target and i.deleted_at is null and i.created_at > as_of;
end $$;

-- Primero se saca lo que hayan dado los privilegios por defecto.
revoke all on table public.revisions from anon, authenticated, public;
revoke all on sequence public.revisions_id_seq from anon, authenticated, public;
grant select on public.revisions to authenticated;
grant all on public.revisions to service_role;

alter table public.revisions enable row level security;
create policy "miembros ven el historial" on public.revisions
  for select to authenticated using (private.is_member(band_id));

revoke execute on function public.restore_setlist(uuid, timestamptz) from public, anon;
grant execute on function public.restore_setlist(uuid, timestamptz) to authenticated;

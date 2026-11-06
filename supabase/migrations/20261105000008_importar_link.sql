-- 8 · Importar desde un link: la Edge Function import-url baja la página de
-- acordes. Antes de bajar nada, pide permiso con claim_import().
--
-- Reglas:
--   · Solo miembros de una banda (no invitados anónimos ni cuentas sueltas).
--   · Límite por persona: 20 por hora y 100 por día.
--   · Se guarda solo el sitio (host) y cuándo, nunca la dirección completa.
--     Lo de más de un día se borra solo al pedir el siguiente.

create table private.url_imports (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users on delete cascade,
  host       text not null check (char_length(host) between 1 and 253),
  created_at timestamptz not null default now()
);

create index url_imports_by_user on private.url_imports (user_id, created_at);

alter table private.url_imports enable row level security;
revoke all on private.url_imports from public, anon, authenticated;

/**
 * Anota un import de este usuario, o lo rechaza: 42501 si no es miembro de
 * una banda, 54000 si llegó al límite.
 */
create function public.claim_import(host text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  last_hour int;
  last_day int;
begin
  if me is null or private.is_anon()
     or not exists (select 1 from public.band_members m where m.user_id = me) then
    raise exception 'Importar desde un link es para los miembros de una banda' using errcode = '42501';
  end if;
  if host is null or char_length(host) not between 1 and 253 then
    raise exception 'Dirección no válida' using errcode = '22023';
  end if;

  -- De a uno por usuario: dos pedidos a la vez no se saltean el límite.
  perform pg_advisory_xact_lock(hashtext('url_imports'), hashtext(me::text));

  delete from private.url_imports u where u.user_id = me and u.created_at < now() - interval '1 day';
  select count(*) filter (where u.created_at > now() - interval '1 hour'), count(*)
    into last_hour, last_day
    from private.url_imports u where u.user_id = me;
  if last_hour >= 20 or last_day >= 100 then
    raise exception 'Llegaste al límite de importaciones por link. Probá más tarde o pegá el texto.'
      using errcode = '54000';
  end if;

  insert into private.url_imports (user_id, host) values (me, lower(host));
end $$;

revoke execute on function public.claim_import(text) from public, anon;
grant execute on function public.claim_import(text) to authenticated;

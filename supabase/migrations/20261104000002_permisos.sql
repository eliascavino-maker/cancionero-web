-- 2/4 · Saca los privilegios que Supabase da solo y deja exactamente los de 1/4.
--
-- Con "exponer automáticamente nuevas tablas" apagado, las tablas nuevas igual
-- recibían de los privilegios por defecto lo que no es leer ni escribir
-- (TRUNCATE, REFERENCES, TRIGGER y, en Postgres 17, MAINTAIN). La API no los
-- usa, pero no tienen por qué estar.
--
-- 1. Las tablas de 1/4: se saca todo y se vuelve a dar lo justo.
-- 2. Las tablas y secuencias que se creen después en public no reciben nada
--    solas, y las funciones no se dan solas a anon ni authenticated: cada
--    migración da sus permisos a mano.

-- -------------------------------------------------------------- 1. tablas

-- REVOKE ALL a nivel tabla también saca los permisos por columna.
revoke all on table public.bands, public.musicians, public.band_members, public.band_invites
  from anon, authenticated, public;

grant select on public.bands, public.musicians, public.band_members to authenticated;
grant insert, update, delete on public.musicians to authenticated;
grant update (musician_id, display_name, prefs) on public.band_members to authenticated;
grant select, delete on public.band_invites to authenticated;

-- --------------------------------------------------- 2. lo que viene después
-- Para objetos creados por postgres (el SQL Editor y las migraciones) en public.
-- service_role se deja como está.

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, public;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, public;
-- Funciones: se saca lo que Supabase da a anon y authenticated. El EXECUTE de
-- PUBLIC viene de Postgres para todos los schemas y no se puede sacar solo en
-- public; por eso cada función hace su propio REVOKE ... FROM PUBLIC, anon.
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

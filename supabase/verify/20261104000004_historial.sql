-- Verificación 4/4. Pegala en el SQL Editor después de 20261104000004_historial.sql.
-- Todas las filas tienen que dar ok = true.
select n, chequeo, ok from (values
  (1, 'revisions existe y tiene RLS activo',
   coalesce((select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'revisions'), false)),
  (2, 'anon no tiene ningún permiso en revisions',
   not exists (select 1 from information_schema.role_table_grants
     where table_schema = 'public' and grantee = 'anon' and table_name = 'revisions')),
  (3, 'authenticated solo puede leer revisions',
   (select array_agg(privilege_type::text order by privilege_type) = '{SELECT}'
      from information_schema.role_table_grants
     where table_schema = 'public' and grantee = 'authenticated' and table_name = 'revisions')),
  (4, 'Hay 1 política RLS en revisions',
   (select count(*) = 1 from pg_policies where schemaname = 'public' and tablename = 'revisions')),
  (5, 'Trigger log_revision en las 3 tablas',
   (select count(*) = 3 from pg_trigger
     where not tgisinternal and tgname = 'log_revision'
       and tgrelid in ('public.songs'::regclass, 'public.setlists'::regclass, 'public.setlist_items'::regclass))),
  (6, 'restore_setlist: authenticated sí, anon no',
   has_function_privilege('authenticated', 'public.restore_setlist(uuid, timestamptz)', 'EXECUTE')
   and not has_function_privilege('anon', 'public.restore_setlist(uuid, timestamptz)', 'EXECUTE'))
) as t(n, chequeo, ok)
order by n;

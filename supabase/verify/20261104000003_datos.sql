-- Verificación 3/4. Pegala en el SQL Editor después de 20261104000003_datos.sql.
-- Todas las filas tienen que dar ok = true.
select n, chequeo, ok from (values
  (1, 'Las 3 tablas existen y tienen RLS activo',
   (select count(*) = 3 from pg_tables
     where schemaname = 'public' and rowsecurity
       and tablename in ('songs', 'setlists', 'setlist_items'))),
  (2, 'anon no tiene ningún permiso en esas tablas',
   not exists (select 1 from information_schema.role_table_grants
     where table_schema = 'public' and grantee = 'anon'
       and table_name in ('songs', 'setlists', 'setlist_items'))),
  (3, 'authenticated puede leer, crear y editar, pero nunca DELETE',
   (select count(*) = 3 and bool_and(p = '{INSERT,SELECT,UPDATE}') from (
      select array_agg(privilege_type::text order by privilege_type) as p
        from information_schema.role_table_grants
       where table_schema = 'public' and grantee = 'authenticated'
         and table_name in ('songs', 'setlists', 'setlist_items')
       group by table_name) g)),
  (4, 'Hay 9 políticas RLS',
   (select count(*) = 9 from pg_policies
     where schemaname = 'public' and tablename in ('songs', 'setlists', 'setlist_items'))),
  (5, 'Triggers: stamp en las 3 tablas y guard_delete en songs',
   (select count(*) = 4 from pg_trigger
     where not tgisinternal
       and tgrelid in ('public.songs'::regclass, 'public.setlists'::regclass, 'public.setlist_items'::regclass)
       and tgname in ('stamp', 'guard_delete'))),
  (6, 'Las 3 tablas avisan por Realtime',
   (select count(*) = 3 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public'
       and tablename in ('songs', 'setlists', 'setlist_items')))
) as t(n, chequeo, ok)
order by n;

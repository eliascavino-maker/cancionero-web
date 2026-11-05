-- Verificación 7. Pegala en el SQL Editor después de 20261105000007_arreglos.sql.
-- Todas las filas tienen que dar ok = true.
select n, chequeo, ok from (values
  (1, 'songs tiene arrangement_of (uuid) y arrangement_name (text)',
   (select count(*) = 2 from information_schema.columns
     where table_schema = 'public' and table_name = 'songs'
       and ((column_name = 'arrangement_of' and data_type = 'uuid')
         or (column_name = 'arrangement_name' and data_type = 'text')))),
  (2, 'El arreglo apunta a una canción de la misma banda',
   exists (select 1 from pg_constraint
     where conrelid = 'public.songs'::regclass and contype = 'f'
       and conname = 'songs_arrangement_same_band'
       and confrelid = 'public.songs'::regclass)),
  (3, 'Checks: no es arreglo de sí mismo y tiene nombre de 1 a 40 letras',
   (select count(*) = 2 from pg_constraint
     where conrelid = 'public.songs'::regclass and contype = 'c'
       and conname in ('songs_arrangement_not_itself', 'songs_arrangement_named'))),
  (4, 'Trigger guard_arrangement en songs (un solo nivel de arreglos)',
   exists (select 1 from pg_trigger
     where not tgisinternal and tgrelid = 'public.songs'::regclass and tgname = 'guard_arrangement')),
  (5, 'songs: authenticated sigue con SELECT, INSERT y UPDATE, sin DELETE; anon nada',
   (select coalesce(array_agg(grantee || ':' || privilege_type order by grantee, privilege_type), '{}')
      from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'songs' and grantee in ('anon', 'authenticated', 'PUBLIC'))
   = '{authenticated:INSERT,authenticated:SELECT,authenticated:UPDATE}'),
  (6, 'anon no ejecuta guard_arrangement ni restore_setlist; authenticated sí restore_setlist',
   not has_function_privilege('anon', 'private.guard_arrangement()', 'EXECUTE')
   and not has_function_privilege('anon', 'public.restore_setlist(uuid, timestamptz)', 'EXECUTE')
   and has_function_privilege('authenticated', 'public.restore_setlist(uuid, timestamptz)', 'EXECUTE')),
  (7, 'restore_setlist también vuelve el arreglo (song_id) y sigue con los permisos del usuario',
   (select pg_get_functiondef(p.oid) like '%song_id%' and not p.prosecdef
      from pg_proc p where p.oid = 'public.restore_setlist(uuid, timestamptz)'::regprocedure)),
  (8, 'Índice para buscar los arreglos de una canción',
   exists (select 1 from pg_indexes
     where schemaname = 'public' and tablename = 'songs' and indexname = 'songs_arrangements'))
) as t(n, chequeo, ok)
order by n;

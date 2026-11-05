-- Verificación 6. Pegala en el SQL Editor después de 20261105000006_senales.sql.
-- Todas las filas tienen que dar ok = true.
select n, chequeo, ok from (values
  (1, 'bands tiene la columna live_signals (jsonb)',
   exists (select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'bands' and column_name = 'live_signals' and data_type = 'jsonb')),
  (2, 'live_signals se valida con un check',
   exists (select 1 from pg_constraint
     where conrelid = 'public.bands'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) like '%valid_signals(live_signals)%')),
  (3, 'bands: authenticated sigue solo leyendo; anon nada',
   (select coalesce(array_agg(grantee || ':' || privilege_type order by grantee, privilege_type), '{}')
      from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'bands' and grantee in ('anon', 'authenticated', 'PUBLIC'))
   = '{authenticated:SELECT}'),
  (4, 'anon no puede ejecutar set_live_signals ni valid_signals',
   not (has_function_privilege('anon', 'public.set_live_signals(uuid, jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'private.valid_signals(jsonb)', 'EXECUTE'))),
  (5, 'authenticated puede ejecutar set_live_signals',
   has_function_privilege('authenticated', 'public.set_live_signals(uuid, jsonb)', 'EXECUTE')),
  (6, 'set_live_signals es security definer',
   (select prosecdef from pg_proc where oid = 'public.set_live_signals(uuid, jsonb)'::regprocedure)),
  (7, 'Una lista mal formada no pasa el check',
   not private.valid_signals('[{"text": "", "color": "#ffffff"}]')
   and not private.valid_signals('[{"text": "Ya", "color": "red"}]')
   and private.valid_signals('[{"text": "Final", "color": "#FFAF3A", "vibrate": true}]')
   and private.valid_signals(null))
) as t(n, chequeo, ok)
order by n;

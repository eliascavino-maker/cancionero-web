-- Verificación 8. Pegala en el SQL Editor después de 20261105000008_importar_link.sql.
-- Todas las filas tienen que dar ok = true.
select n, chequeo, ok from (values
  (1, 'Existe private.url_imports con user_id, host y created_at',
   (select count(*) = 3 from information_schema.columns
     where table_schema = 'private' and table_name = 'url_imports'
       and column_name in ('user_id', 'host', 'created_at'))),
  (2, 'Nadie de la app lee ni escribe url_imports directo',
   not (has_table_privilege('anon', 'private.url_imports', 'SELECT')
     or has_table_privilege('authenticated', 'private.url_imports', 'SELECT')
     or has_table_privilege('authenticated', 'private.url_imports', 'INSERT')
     or has_table_privilege('authenticated', 'private.url_imports', 'DELETE'))),
  (3, 'url_imports tiene RLS activado',
   (select relrowsecurity from pg_class where oid = 'private.url_imports'::regclass)),
  (4, 'claim_import: authenticated sí, anon no',
   has_function_privilege('authenticated', 'public.claim_import(text)', 'EXECUTE')
   and not has_function_privilege('anon', 'public.claim_import(text)', 'EXECUTE')),
  (5, 'claim_import es security definer con search_path fijo',
   (select prosecdef and proconfig @> array['search_path=""']
      from pg_proc where oid = 'public.claim_import(text)'::regprocedure)),
  (6, 'Índice por usuario y fecha',
   exists (select 1 from pg_indexes
     where schemaname = 'private' and tablename = 'url_imports' and indexname = 'url_imports_by_user'))
) as t(n, chequeo, ok)
order by n;

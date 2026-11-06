-- Verificación 9. Pegala en el SQL Editor después de 20261105000009_logo.sql.
-- Todas las filas tienen que dar ok = true.
select n, chequeo, ok from (values
  (1, 'bands tiene logo_path (text) con su check',
   exists (select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'bands' and column_name = 'logo_path' and data_type = 'text')
   and exists (select 1 from pg_constraint where conrelid = 'public.bands'::regclass and conname = 'bands_logo_path')),
  (2, 'Bucket band-logos privado, hasta 512 KB, solo PNG, JPG y WebP',
   exists (select 1 from storage.buckets
     where id = 'band-logos' and not public and file_size_limit = 524288
       and allowed_mime_types @> array['image/png', 'image/jpeg', 'image/webp']
       and array_length(allowed_mime_types, 1) = 3)),
  (3, 'Las 4 políticas de band-logos en storage.objects',
   (select count(*) = 4 from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname in ('band_logos_read', 'band_logos_insert', 'band_logos_update', 'band_logos_delete'))),
  (4, 'Ninguna política de band-logos es para anon',
   not exists (select 1 from pg_policies
     where schemaname = 'storage' and tablename = 'objects' and policyname like 'band_logos_%'
       and not (roles = array['authenticated']::name[]))),
  (5, 'bands: authenticated sigue solo leyendo; anon nada',
   (select coalesce(array_agg(grantee || ':' || privilege_type order by grantee, privilege_type), '{}')
      from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'bands' and grantee in ('anon', 'authenticated', 'PUBLIC'))
   = '{authenticated:SELECT}'),
  (6, 'set_band_logo: authenticated sí, anon no; security definer',
   has_function_privilege('authenticated', 'public.set_band_logo(uuid, text)', 'EXECUTE')
   and not has_function_privilege('anon', 'public.set_band_logo(uuid, text)', 'EXECUTE')
   and (select prosecdef from pg_proc where oid = 'public.set_band_logo(uuid, text)'::regprocedure)),
  (7, 'logo_band lee la carpeta de la banda y nada más',
   private.logo_band('5f2b8c1e-0000-4000-8000-000000000001/logo-1.webp') = '5f2b8c1e-0000-4000-8000-000000000001'
   and private.logo_band('../logo.png') is null
   and private.logo_band('5f2b8c1e-0000-4000-8000-000000000001/a/b.png') is null)
) as t(n, chequeo, ok)
order by n;

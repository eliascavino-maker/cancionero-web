-- Verificación 1/4. Pegala en el SQL Editor después de 20261104000001_bandas.sql.
-- Todas las filas tienen que dar ok = true.
select n, chequeo, ok from (values
  (1, 'Las 4 tablas existen y tienen RLS activo',
   (select count(*) = 4 from pg_tables
     where schemaname = 'public' and rowsecurity
       and tablename in ('bands', 'musicians', 'band_members', 'band_invites'))),
  (2, 'anon no tiene ningún permiso en esas tablas',
   not exists (select 1 from information_schema.role_table_grants
     where table_schema = 'public' and grantee = 'anon'
       and table_name in ('bands', 'musicians', 'band_members', 'band_invites'))),
  (3, 'authenticated solo puede leer bands',
   (select array_agg(privilege_type::text order by privilege_type) = '{SELECT}'
      from information_schema.role_table_grants
     where table_schema = 'public' and grantee = 'authenticated' and table_name = 'bands')),
  (4, 'band_members: authenticated solo edita musician_id, display_name y prefs',
   (select array_agg(column_name::text order by column_name) = '{display_name,musician_id,prefs}'
      from information_schema.column_privileges
     where table_schema = 'public' and table_name = 'band_members'
       and grantee = 'authenticated' and privilege_type = 'UPDATE')
   and not has_table_privilege('authenticated', 'public.band_members', 'INSERT')
   and not has_table_privilege('authenticated', 'public.band_members', 'DELETE')),
  (5, 'band_invites: authenticated no puede crearlas directo',
   not has_table_privilege('authenticated', 'public.band_invites', 'INSERT')),
  (6, 'Hay 9 políticas RLS',
   (select count(*) = 9 from pg_policies
     where schemaname = 'public'
       and tablename in ('bands', 'musicians', 'band_members', 'band_invites'))),
  (7, 'anon no puede ejecutar ninguna RPC',
   not (has_function_privilege('anon', 'public.create_band(text, text, jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'public.create_invite(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.accept_invite(text, text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.remove_member(uuid, uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.leave_band(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.delete_band(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.new_guest_code(uuid)', 'EXECUTE'))),
  (8, 'authenticated puede ejecutar las 7 RPC',
   has_function_privilege('authenticated', 'public.create_band(text, text, jsonb)', 'EXECUTE')
   and has_function_privilege('authenticated', 'public.create_invite(uuid)', 'EXECUTE')
   and has_function_privilege('authenticated', 'public.accept_invite(text, text)', 'EXECUTE')
   and has_function_privilege('authenticated', 'public.remove_member(uuid, uuid)', 'EXECUTE')
   and has_function_privilege('authenticated', 'public.leave_band(uuid)', 'EXECUTE')
   and has_function_privilege('authenticated', 'public.delete_band(uuid)', 'EXECUTE')
   and has_function_privilege('authenticated', 'public.new_guest_code(uuid)', 'EXECUTE')),
  (9, 'El schema private está cerrado para anon',
   not has_schema_privilege('anon', 'private', 'USAGE')
   and not has_function_privilege('anon', 'private.is_member(uuid)', 'EXECUTE'))
) as t(n, chequeo, ok)
order by n;

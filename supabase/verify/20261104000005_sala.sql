-- Verificación 5/5. Pegala en el SQL Editor después de 20261104000005_sala.sql.
-- Todas las filas tienen que dar ok = true.
select n, chequeo, ok from (values
  (1, 'Ya no hay código de invitados',
   not exists (select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'bands' and column_name = 'guest_code')
   and to_regprocedure('public.new_guest_code(uuid)') is null),
  (2, 'live_sessions tiene RLS',
   (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'live_sessions')),
  (3, 'live_sessions: authenticated solo lee; anon nada',
   (select coalesce(array_agg(grantee || ':' || privilege_type order by grantee, privilege_type), '{}')
      from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'live_sessions' and grantee in ('anon', 'authenticated', 'PUBLIC'))
   = '{authenticated:SELECT}'),
  (4, 'Hay 1 política en live_sessions',
   (select count(*) = 1 from pg_policies where schemaname = 'public' and tablename = 'live_sessions')),
  (5, 'Hay 2 políticas en realtime.messages para la sala, solo authenticated',
   (select count(*) = 2 and bool_and(roles = '{authenticated}') from pg_policies
     where schemaname = 'realtime' and tablename = 'messages'
       and policyname in ('miembros escuchan la sala y la sincronización', 'miembros hablan en la sala'))),
  (6, 'anon no puede ejecutar las RPC de la sala',
   not (has_function_privilege('anon', 'public.open_live(uuid, uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.close_live(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.take_lead(uuid, uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.leave_lead(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'private.topic_band(text)', 'EXECUTE'))),
  (7, 'authenticated puede ejecutar las 4 RPC de la sala',
   has_function_privilege('authenticated', 'public.open_live(uuid, uuid)', 'EXECUTE')
   and has_function_privilege('authenticated', 'public.close_live(uuid)', 'EXECUTE')
   and has_function_privilege('authenticated', 'public.take_lead(uuid, uuid)', 'EXECUTE')
   and has_function_privilege('authenticated', 'public.leave_lead(uuid)', 'EXECUTE')),
  (8, 'live_sessions está en la publicación de Realtime',
   exists (select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'live_sessions')),
  (9, 'Quien sale de la banda deja de dirigir (trigger)',
   exists (select 1 from pg_trigger where tgname = 'band_members_drop_leader' and not tgisinternal))
) as t(n, chequeo, ok)
order by n;

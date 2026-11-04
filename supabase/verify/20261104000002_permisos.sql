-- Verificación 2/4. Pegala en el SQL Editor después de 20261104000002_permisos.sql.
-- Después volvé a correr la verificación 1/4: también tiene que dar todo true.
-- Todas las filas tienen que dar ok = true.
select n, chequeo, ok from (values
  (1, 'anon no tiene ningún privilegio en ninguna tabla de public',
   not exists (select 1 from information_schema.role_table_grants
     where table_schema = 'public' and grantee = 'anon')),
  (2, 'authenticated tiene exactamente lo que dan las migraciones en las 4 tablas',
   (select coalesce(array_agg(table_name || ':' || privilege_type order by table_name, privilege_type), '{}')
      from information_schema.role_table_grants
     where table_schema = 'public' and grantee = 'authenticated'
       and table_name in ('bands', 'musicians', 'band_members', 'band_invites'))
   = '{band_invites:DELETE,band_invites:SELECT,band_members:SELECT,bands:SELECT,musicians:DELETE,musicians:INSERT,musicians:SELECT,musicians:UPDATE}'),
  (3, 'Las tablas nuevas no reciben nada solas (anon, authenticated, PUBLIC)',
   not exists (select 1 from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a
     where d.defaclrole = 'postgres'::regrole and d.defaclnamespace in (0, 'public'::regnamespace)
       and d.defaclobjtype = 'r'
       and (a.grantee = 0 or a.grantee in ('anon'::regrole, 'authenticated'::regrole)))),
  (4, 'Las secuencias nuevas no reciben nada solas',
   not exists (select 1 from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a
     where d.defaclrole = 'postgres'::regrole and d.defaclnamespace in (0, 'public'::regnamespace)
       and d.defaclobjtype = 'S'
       and (a.grantee = 0 or a.grantee in ('anon'::regrole, 'authenticated'::regrole)))),
  (5, 'Las funciones nuevas no se dan solas a anon ni authenticated',
   not exists (select 1 from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a
     where d.defaclrole = 'postgres'::regrole and d.defaclnamespace in (0, 'public'::regnamespace)
       and d.defaclobjtype = 'f'
       and a.grantee in ('anon'::regrole, 'authenticated'::regrole)))
) as t(n, chequeo, ok)
order by n;

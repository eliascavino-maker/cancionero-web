-- Diagnóstico: qué privilegios tienen anon, authenticated y PUBLIC, y cuáles sobran.
-- No cambia nada. Pegala en el SQL Editor cuando quieras.
--
--   tipo = 'tabla'       privilegios sobre las tablas de la app (information_schema.role_table_grants)
--   tipo = 'por defecto' lo que reciben solas las tablas, secuencias y funciones nuevas
--                        que cree postgres en public o en todos los schemas (pg_default_acl)
--
-- sobra = true: no lo da ninguna migración y hay que sacarlo.

with esperado (tabla, rol, privilegio) as (values
  ('bands',         'authenticated', 'SELECT'),
  ('musicians',     'authenticated', 'SELECT'),
  ('musicians',     'authenticated', 'INSERT'),
  ('musicians',     'authenticated', 'UPDATE'),
  ('musicians',     'authenticated', 'DELETE'),
  ('band_members',  'authenticated', 'SELECT'),
  ('band_invites',  'authenticated', 'SELECT'),
  ('band_invites',  'authenticated', 'DELETE'),
  ('songs',         'authenticated', 'SELECT'),
  ('songs',         'authenticated', 'INSERT'),
  ('songs',         'authenticated', 'UPDATE'),
  ('setlists',      'authenticated', 'SELECT'),
  ('setlists',      'authenticated', 'INSERT'),
  ('setlists',      'authenticated', 'UPDATE'),
  ('setlist_items', 'authenticated', 'SELECT'),
  ('setlist_items', 'authenticated', 'INSERT'),
  ('setlist_items', 'authenticated', 'UPDATE'),
  ('revisions',     'authenticated', 'SELECT')
),
tablas as (
  select 'tabla' as tipo, g.table_name::text as objeto, g.grantee::text as rol, g.privilege_type::text as privilegio
  from information_schema.role_table_grants g
  where g.table_schema = 'public' and g.grantee in ('anon', 'authenticated', 'PUBLIC')
),
por_defecto as (
  select 'por defecto' as tipo,
         case d.defaclobjtype when 'r' then 'tablas nuevas' when 'S' then 'secuencias nuevas'
                              when 'f' then 'funciones nuevas' else d.defaclobjtype::text end
           || case when d.defaclnamespace = 0 then ' (todos los schemas)' else '' end as objeto,
         case a.grantee when 0 then 'PUBLIC' else a.grantee::regrole::text end as rol,
         a.privilege_type as privilegio
  from pg_default_acl d
  cross join lateral aclexplode(d.defaclacl) a
  where d.defaclrole = 'postgres'::regrole
    and d.defaclnamespace in (0, 'public'::regnamespace)
    and d.defaclobjtype in ('r', 'S', 'f')
    and (a.grantee = 0 or a.grantee in ('anon'::regrole, 'authenticated'::regrole))
)
select t.tipo, t.objeto, t.rol, t.privilegio,
       (t.tipo = 'por defecto' or e.tabla is null) as sobra
from (select * from tablas union all select * from por_defecto) t
left join esperado e on t.tipo = 'tabla' and e.tabla = t.objeto and e.rol = t.rol and e.privilegio = t.privilegio
order by sobra desc, tipo, objeto, rol, privilegio;

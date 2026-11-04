// @vitest-environment node
/**
 * Aplica las migraciones en un Postgres local (PGlite) con lo mínimo de
 * Supabase (roles, auth.uid(), auth.jwt(), publicación de Realtime) y prueba
 * los permisos como lo haría cada usuario.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const ROOT = join(process.cwd(), 'supabase');
const names = (dir: string) =>
  readdirSync(join(ROOT, dir))
    .filter((f) => f.endsWith('.sql'))
    .sort();
const read = (dir: string, name: string) => readFileSync(join(ROOT, dir, name), 'utf8');
const files = (dir: string) => names(dir).map((f) => read(dir, f));

const SUPABASE_STUB = `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.jwt() returns jsonb language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on all functions in schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  create publication supabase_realtime;
`;

/** Lo que Supabase da solo a lo que se crea en public. */
const DEFAULTS_ALL = `
  alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;
`;

/**
 * Con "exponer automáticamente nuevas tablas" apagado: se va leer y escribir,
 * pero queda el resto (TRUNCATE, REFERENCES, TRIGGER, MAINTAIN). Reproduce lo
 * que dio el proyecto con la migración 1: chequeos 2 y 3 en false, el resto true.
 */
const DEFAULTS_NOT_EXPOSED = `${DEFAULTS_ALL}
  alter default privileges for role postgres in schema public
    revoke select, insert, update, delete on tables from anon, authenticated;
`;

async function freshDb(defaults: string): Promise<PGlite> {
  const pg = new PGlite();
  await pg.exec(SUPABASE_STUB);
  await pg.exec(defaults);
  return pg;
}

const failing = async (pg: PGlite, verify: string) =>
  (await pg.query<{ chequeo: string; ok: boolean }>(read('verify', verify))).rows
    .filter((r) => !r.ok)
    .map((r) => r.chequeo);

const A = '00000000-0000-4000-8000-00000000000a'; // owner
const B = '00000000-0000-4000-8000-00000000000b'; // miembro
const C = '00000000-0000-4000-8000-00000000000c'; // sin banda
const G = '00000000-0000-4000-8000-00000000000d'; // invitado anónimo

let db: PGlite;

/** Corre `sql` como ese usuario, igual que una llamada desde la app. */
async function as<T = Record<string, unknown>>(
  user: string | null,
  sql: string,
  params: unknown[] = [],
  opts: { anonymous?: boolean } = {},
): Promise<T[]> {
  const claims = user ? JSON.stringify({ sub: user, role: 'authenticated', is_anonymous: !!opts.anonymous }) : '';
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [claims]);
  await db.exec(`set role ${user ? 'authenticated' : 'anon'}`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec('reset role');
  }
}

const one = async <T>(p: Promise<T[]>) => (await p)[0];

const MUSICIANS = JSON.stringify([
  { name: 'Sergio', sings: true, instrument: 'Guitarra', color: '#38bdf8' },
  { name: 'Elias', sings: false, instrument: 'Piano', color: '#fb923c' },
]);

let band: string;

beforeAll(async () => {
  db = await freshDb(DEFAULTS_NOT_EXPOSED);
  await db.exec(`insert into auth.users (id) values ('${A}'), ('${B}'), ('${C}'), ('${G}')`);
  for (const sql of files('migrations')) await db.exec(sql);

  band = (await one(as<{ b: string }>(A, `select public.create_band('Encontra', 'Elias', $1) as b`, [MUSICIANS]))).b;
  const code = (await one(as<{ c: string }>(A, `select public.create_invite($1) as c`, [band]))).c;
  await as(B, `select public.accept_invite($1, 'Sergio')`, [code.toLowerCase()]);
}, 60_000);

const newSong = (id: string, title = 'Faro') =>
  as(B, `insert into public.songs (id, band_id, title, content) values ($1, $2, $3, '{title: x}') returning *`, [
    id,
    band,
    title,
  ]);

describe('privilegios por defecto de Supabase', () => {
  const [m1, m2] = names('migrations');

  it('reproduce lo que pasó: después de la migración 1 sobran privilegios', async () => {
    const pg = await freshDb(DEFAULTS_NOT_EXPOSED);
    await pg.exec(read('migrations', m1));
    expect(await failing(pg, m1)).toEqual([
      'anon no tiene ningún permiso en esas tablas',
      'authenticated solo puede leer bands',
    ]);
    const extra = (await pg.query<{ objeto: string; rol: string; privilegio: string }>(read('diagnostics', 'privilegios.sql')))
      .rows.filter((r) => (r as unknown as { sobra: boolean }).sobra);
    expect(extra).toContainEqual(expect.objectContaining({ objeto: 'bands', rol: 'anon', privilegio: 'TRUNCATE' }));
    expect(extra).toContainEqual(expect.objectContaining({ objeto: 'tablas nuevas', rol: 'anon' }));
  }, 30_000);

  for (const [label, defaults] of [
    ['exponer tablas apagado', DEFAULTS_NOT_EXPOSED],
    ['exponer tablas prendido', DEFAULTS_ALL],
  ] as const) {
    it(`la migración 2 lo corrige y no vuelve a pasar (${label})`, async () => {
      const pg = await freshDb(defaults);
      await pg.exec(read('migrations', m1));
      await pg.exec(read('migrations', m2));
      expect(await failing(pg, m1)).toEqual([]);
      expect(await failing(pg, m2)).toEqual([]);
      for (const m of names('migrations').slice(2)) await pg.exec(read('migrations', m));
      for (const v of names('verify')) expect(await failing(pg, v)).toEqual([]);
      const extra = (await pg.query<{ sobra: boolean }>(read('diagnostics', 'privilegios.sql'))).rows.filter((r) => r.sobra);
      expect(extra).toEqual([]);
      // Una tabla cualquiera creada después tampoco recibe nada.
      await pg.exec('create table public.nueva (id int)');
      const grants = await pg.query(
        `select grantee, privilege_type from information_schema.role_table_grants
          where table_name = 'nueva' and grantee in ('anon', 'authenticated', 'PUBLIC')`,
      );
      expect(grants.rows).toEqual([]);
      // Una función nueva: después de su REVOKE ... FROM PUBLIC (como hace cada
      // migración) nadie de afuera la ejecuta, porque no queda nada por defecto.
      await pg.exec('create function public.nueva_fn() returns int language sql as $$ select 1 $$');
      await pg.exec('revoke execute on function public.nueva_fn() from public');
      const exec = await pg.query<{ anon: boolean; auth: boolean }>(
        `select has_function_privilege('anon', 'public.nueva_fn()', 'EXECUTE') as anon,
                has_function_privilege('authenticated', 'public.nueva_fn()', 'EXECUTE') as auth`,
      );
      expect(exec.rows[0]).toEqual({ anon: false, auth: false });
    }, 30_000);
  }
});

describe('verificación', () => {
  it('todas las consultas de supabase/verify dan ok', async () => {
    for (const sql of files('verify')) {
      const rows = (await db.query<{ chequeo: string; ok: boolean }>(sql)).rows;
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.filter((r) => !r.ok).map((r) => r.chequeo)).toEqual([]);
    }
  });
});

describe('bandas', () => {
  it('anon no puede leer ni llamar RPC', async () => {
    await expect(as(null, 'select * from public.bands')).rejects.toThrow(/permission denied/);
    await expect(as(null, `select public.create_band('x')`)).rejects.toThrow(/permission denied/);
    await expect(as(null, 'select * from public.songs')).rejects.toThrow(/permission denied/);
  });

  it('crear la banda deja owner, músicos en orden y código de invitados', async () => {
    const members = await as<{ user_id: string; role: string }>(A, 'select user_id, role from public.band_members order by role desc');
    expect(members).toEqual([
      { user_id: A, role: 'owner' },
      { user_id: B, role: 'member' },
    ]);
    const musicians = await as<{ name: string }>(B, 'select name from public.musicians order by position');
    expect(musicians.map((m) => m.name)).toEqual(['Sergio', 'Elias']);
    const b = await one(as<{ guest_code: string }>(B, 'select guest_code from public.bands'));
    expect(b.guest_code).toMatch(/^[A-Z2-9]{8}$/);
  });

  it('quien no es miembro no ve nada', async () => {
    expect(await as(C, 'select * from public.bands')).toEqual([]);
    expect(await as(C, 'select * from public.band_members')).toEqual([]);
    await expect(as(C, `select public.create_invite($1)`, [band])).rejects.toThrow(/Solo el owner/);
  });

  it('solo el owner invita, y cada invitación sirve una vez', async () => {
    await expect(as(B, `select public.create_invite($1)`, [band])).rejects.toThrow(/Solo el owner/);
    const code = (await one(as<{ c: string }>(A, `select public.create_invite($1) as c`, [band]))).c;
    await as(C, `select public.accept_invite($1)`, [code]);
    await expect(as(G, `select public.accept_invite($1)`, [code], { anonymous: true })).rejects.toThrow(/Necesitás una cuenta/);
    await db.exec(`insert into auth.users (id) values ('00000000-0000-4000-8000-0000000000ee')`);
    await expect(
      as('00000000-0000-4000-8000-0000000000ee', `select public.accept_invite($1)`, [code]),
    ).rejects.toThrow(/ya se usó/);
    // La misma cuenta puede volver a usarla sin error.
    await as(C, `select public.accept_invite($1)`, [code]);
    await as(A, `select public.remove_member($1, $2)`, [band, C]);
    expect(await as(C, 'select * from public.bands')).toEqual([]);
  });

  it('una invitación vencida no sirve', async () => {
    const code = (await one(as<{ c: string }>(A, `select public.create_invite($1) as c`, [band]))).c;
    await db.query(`update public.band_invites set expires_at = now() - interval '1 minute' where code = $1`, [code]);
    await expect(as(C, `select public.accept_invite($1)`, [code])).rejects.toThrow(/venció/);
  });

  it('los anónimos no crean bandas', async () => {
    await expect(as(G, `select public.create_band('x')`, [], { anonymous: true })).rejects.toThrow(/Necesitás una cuenta/);
  });

  it('un miembro edita su fila pero no su rol ni la de otro', async () => {
    const sergio = (await one(as<{ id: string }>(B, `select id from public.musicians where name = 'Sergio'`))).id;
    await as(B, `update public.band_members set musician_id = $1, prefs = '{"view":"chords"}' where user_id = $2`, [sergio, B]);
    expect((await one(as<{ musician_id: string }>(B, `select musician_id from public.band_members where user_id = $1`, [B]))).musician_id).toBe(sergio);
    await expect(as(B, `update public.band_members set role = 'owner' where user_id = $1`, [B])).rejects.toThrow(/permission denied/);
    const changed = await as(B, `update public.band_members set display_name = 'x' where user_id = $1 returning *`, [A]);
    expect(changed).toEqual([]);
  });

  it('no se puede elegir un músico de otra banda', async () => {
    const other = (await one(as<{ b: string }>(C, `select public.create_band('Otra', '', $1) as b`, [MUSICIANS]))).b;
    const foreign = (await one(as<{ id: string }>(C, `select id from public.musicians where band_id = $1 limit 1`, [other]))).id;
    await expect(
      as(B, `update public.band_members set musician_id = $1 where user_id = $2`, [foreign, B]),
    ).rejects.toThrow(/foreign key/);
  });

  it('solo el owner saca miembros, y el owner no puede irse', async () => {
    await expect(as(B, `select public.remove_member($1, $2)`, [band, A])).rejects.toThrow(/Solo el owner/);
    await expect(as(A, `select public.leave_band($1)`, [band])).rejects.toThrow(/no puede dejar/);
    await expect(as(A, `select public.remove_member($1, $2)`, [band, A])).rejects.toThrow(/a sí mismo/);
  });
});

describe('canciones y setlists', () => {
  const S1 = '10000000-0000-4000-8000-000000000001';

  it('un miembro crea y edita; la hora y el autor los pone el servidor', async () => {
    const [song] = await newSong(S1);
    expect(song.updated_by).toBe(B);
    const later = await one(
      as<{ updated_at: Date; created_at: Date }>(
        B,
        `update public.songs set title = 'Faro 2', created_at = '2000-01-01', updated_at = '2000-01-01' where id = $1 returning *`,
        [S1],
      ),
    );
    expect(later.created_at.getFullYear()).toBeGreaterThan(2000);
    expect(later.updated_at.getFullYear()).toBeGreaterThan(2000);
  });

  it('nadie puede hacer DELETE; borrar una canción es solo del owner', async () => {
    await expect(as(A, `delete from public.songs where id = $1`, [S1])).rejects.toThrow(/permission denied/);
    await expect(as(B, `update public.songs set deleted_at = now() where id = $1`, [S1])).rejects.toThrow(/Solo el owner/);
    await as(A, `update public.songs set deleted_at = now() where id = $1`, [S1]);
    await expect(as(B, `update public.songs set deleted_at = null where id = $1`, [S1])).rejects.toThrow(/Solo el owner/);
    await as(A, `update public.songs set deleted_at = null where id = $1`, [S1]);
  });

  it('nada se muda de banda ni se crea en una banda ajena', async () => {
    await expect(
      as(C, `insert into public.songs (id, band_id, title, content) values (gen_random_uuid(), $1, 'x', 'x')`, [band]),
    ).rejects.toThrow(/row-level security/);
    const other = (await one(as<{ id: string }>(C, `select id from public.bands limit 1`))).id;
    await expect(as(B, `update public.songs set band_id = $1 where id = $2`, [other, S1])).rejects.toThrow();
    expect(await as(C, `select * from public.songs`)).toEqual([]);
  });

  it('cualquier miembro borra un setlist', async () => {
    const L = '20000000-0000-4000-8000-000000000001';
    await as(B, `insert into public.setlists (id, band_id, name) values ($1, $2, 'Peña')`, [L, band]);
    await as(B, `update public.setlists set deleted_at = now() where id = $1`, [L]);
  });
});

describe('historial', () => {
  const S = '30000000-0000-4000-8000-000000000001';
  const revs = (id: string) =>
    as<{ action: string; changed_by: string; data: { title: string } }>(
      A,
      `select action, changed_by, data from public.revisions where row_id = $1 order by changed_at, id`,
      [id],
    );

  it('guarda crear, editar, borrar y restaurar, y junta ediciones seguidas', async () => {
    await newSong(S, 'v1');
    await as(B, `update public.songs set title = 'v2' where id = $1`, [S]);
    await as(B, `update public.songs set title = 'v3' where id = $1`, [S]);
    await as(A, `update public.songs set title = 'v4' where id = $1`, [S]);
    await as(A, `update public.songs set title = 'v4' where id = $1`, [S]); // sin cambios
    await as(A, `update public.songs set deleted_at = now() where id = $1`, [S]);
    await as(A, `update public.songs set deleted_at = null where id = $1`, [S]);
    const r = await revs(S);
    expect(r.map((x) => [x.action, x.data.title, x.changed_by])).toEqual([
      ['create', 'v1', B],
      ['edit', 'v3', B],
      ['edit', 'v4', A],
      ['delete', 'v4', A],
      ['restore', 'v4', A],
    ]);
  });

  it('pasados 10 minutos, una edición nueva es otra revisión', async () => {
    await db.query(`update public.revisions set changed_at = now() - interval '11 minutes' where row_id = $1`, [S]);
    await as(B, `update public.songs set title = 'v5' where id = $1`, [S]);
    await db.query(`update public.revisions set changed_at = now() - interval '11 minutes' where row_id = $1`, [S]);
    await as(B, `update public.songs set title = 'v6' where id = $1`, [S]);
    expect((await revs(S)).slice(-2).map((x) => x.data.title)).toEqual(['v5', 'v6']);
  });

  it('guarda como mucho 30 por elemento', async () => {
    for (let i = 0; i < 40; i++) {
      await db.query(`update public.revisions set changed_at = changed_at - interval '11 minutes' where row_id = $1`, [S]);
      await as(B, `update public.songs set title = $2 where id = $1`, [S, `n${i}`]);
    }
    const r = await revs(S);
    expect(r).toHaveLength(30);
    expect(r.at(-1)!.data.title).toBe('n39');
  });

  it('borra lo de más de 90 días pero deja la última de cada elemento', async () => {
    const T = '30000000-0000-4000-8000-000000000002';
    await newSong(T, 'viejo');
    await db.query(`update public.revisions set changed_at = now() - interval '100 days' where row_id in ($1, $2)`, [S, T]);
    await as(B, `update public.songs set title = 'hoy' where id = $1`, [S]);
    expect((await revs(S)).map((x) => x.data.title)).toEqual(['hoy']);
    expect((await revs(T)).map((x) => x.data.title)).toEqual(['viejo']);
  });

  it('nadie escribe en el historial a mano y quien no es miembro no lo ve', async () => {
    await expect(
      as(A, `insert into public.revisions (band_id, table_name, row_id, action, data) values ($1, 'songs', $2, 'edit', '{}')`, [band, S]),
    ).rejects.toThrow(/permission denied/);
    await expect(as(A, `delete from public.revisions`)).rejects.toThrow(/permission denied/);
    expect(await as(C, `select * from public.revisions where band_id = $1`, [band])).toEqual([]);
  });

  it('restore_setlist deja el setlist como estaba', async () => {
    const L = '40000000-0000-4000-8000-000000000001';
    const [i1, i2, i3] = ['1', '2', '3'].map((n) => `40000000-0000-4000-8000-00000000010${n}`);
    const song = '40000000-0000-4000-8000-000000000201';
    await newSong(song, 'Cusco');
    await as(B, `insert into public.setlists (id, band_id, name) values ($1, $2, 'Peña')`, [L, band]);
    await as(B, `insert into public.setlist_items (id, band_id, setlist_id, song_id, position) values ($1, $3, $4, $5, 1), ($2, $3, $4, $5, 2)`, [i1, i2, band, L, song]);
    // Todo lo anterior pasó "hace una hora".
    await db.query(`update public.revisions set changed_at = changed_at - interval '1 hour' where row_id in ($1, $2, $3)`, [L, i1, i2]);
    // Sin triggers: si no, stamp() vuelve a poner el created_at original.
    await db.exec(`set session_replication_role = replica`);
    await db.query(`update public.setlist_items set created_at = created_at - interval '1 hour' where setlist_id = $1`, [L]);
    await db.exec(`set session_replication_role = origin`);
    const before = (await one(db.query<{ t: string }>(`select (now() - interval '30 minutes')::text as t`).then((r) => r.rows))).t;

    // Alguien lo rompe: renombra, cambia el tono, saca una y agrega otra.
    await as(B, `update public.setlists set name = 'roto' where id = $1`, [L]);
    await as(B, `update public.setlist_items set transpose = 3, position = 5 where id = $1`, [i1]);
    await as(B, `update public.setlist_items set deleted_at = now() where id = $1`, [i2]);
    await as(B, `insert into public.setlist_items (id, band_id, setlist_id, song_id, position) values ($1, $2, $3, $4, 3)`, [i3, band, L, song]);

    await as(B, `select public.restore_setlist($1, $2)`, [L, before]);

    expect((await one(as<{ name: string }>(B, `select name from public.setlists where id = $1`, [L]))).name).toBe('Peña');
    const items = await as<{ id: string; position: number; transpose: number; deleted: boolean }>(
      B,
      `select id, position, transpose, deleted_at is not null as deleted from public.setlist_items where setlist_id = $1 order by id`,
      [L],
    );
    expect(items).toEqual([
      { id: i1, position: 1, transpose: 0, deleted: false },
      { id: i2, position: 2, transpose: 0, deleted: false },
      { id: i3, position: 3, transpose: 0, deleted: true },
    ]);
    await expect(as(C, `select public.restore_setlist($1, now())`, [L])).rejects.toThrow(/No existe/);
  });
});

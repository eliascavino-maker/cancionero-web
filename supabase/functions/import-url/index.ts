// Edge Function import-url: baja una página de acordes y devuelve el título,
// el artista y el texto con los acordes arriba de la letra. La app lo pasa
// al editor de «Pegar letra»: nada se guarda sin que la persona lo vea.
//
// Un solo archivo, sin imports, para poder pegarlo tal cual en el Dashboard
// de Supabase (Edge Functions → Deploy a new function → nombre: import-url).
//
// Seguridad:
//   · Pide el JWT de la persona (verify_jwt, como viene por defecto) y antes
//     de bajar nada llama a public.claim_import (migración 8): solo miembros
//     de una banda, 20 por hora y 100 por día.
//   · Solo https, sin usuario:clave, sin IPs, sin localhost ni nombres
//     internos; si el nombre resuelve a una IP privada, no se baja.
//   · Redirecciones solo dentro del mismo sitio, hasta 3.
//   · Hasta 1 MB y 8 segundos. Solo HTML o texto. Lo que se baja nunca se
//     ejecuta: se lee como texto.

export interface Imported {
  title: string;
  artist: string;
  text: string;
}

export class ImportError extends Error {
  constructor(
    message: string,
    readonly status = 422,
  ) {
    super(message);
  }
}

const MAX_BYTES = 1_000_000;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;
const MAX_TEXT = 100_000;
const USER_AGENT = 'Mozilla/5.0 (compatible; Cancionero/1.0; importa una canción a pedido de quien la toca)';

// ------------------------------------------------------------------ direcciones

const INTERNAL_NAMES = /(^|\.)(localhost|local|internal|intranet|lan|home|corp|arpa|test|invalid|example|supabase\.co|supabase\.in)$/i;

/** La dirección, si se puede bajar. Acepta http y la pasa a https. */
export function checkUrl(raw: string): URL {
  const text = raw.trim();
  if (!text || text.length > 2000) throw new ImportError('Pegá la dirección completa de la página.');
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
  } catch {
    throw new ImportError('Esa dirección no es válida.');
  }
  if (url.protocol === 'http:') url.protocol = 'https:';
  if (url.protocol !== 'https:') throw new ImportError('Solo se pueden traer páginas web (https).');
  if (url.username || url.password) throw new ImportError('Esa dirección no es válida.');
  if (url.port && url.port !== '443') throw new ImportError('Esa dirección no es válida.');
  const host = url.hostname.toLowerCase();
  if (
    host.startsWith('[') ||
    host.includes(':') ||
    /^[\d.]+$/.test(host) ||
    /^0x/i.test(host) ||
    !host.includes('.') ||
    INTERNAL_NAMES.test(host)
  ) {
    throw new ImportError('Esa dirección no es de una página pública.');
  }
  url.hash = '';
  return url;
}

const base = (host: string) => host.toLowerCase().replace(/^(www|m|mobile)\./, '');

/** Una redirección que se queda en el mismo sitio (con o sin www, m., subdominios). */
export function sameSite(from: URL, to: URL): boolean {
  const a = base(from.hostname);
  const b = base(to.hostname);
  return a === b || b.endsWith(`.${a}`) || a.endsWith(`.${b}`);
}

/** IPs que no son de internet: privadas, locales, de enlace, reservadas. */
export function isPrivateIp(ip: string): boolean {
  const v4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(ip.replace(/^::ffff:/i, ''));
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  return v6 === '::' || v6 === '::1' || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || /^ff/.test(v6);
}

// --------------------------------------------------------------------- texto

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ntilde: 'ñ', Ntilde: 'Ñ',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', uuml: 'ü',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Uuml: 'Ü',
  ccedil: 'ç', atilde: 'ã', otilde: 'õ', acirc: 'â', ecirc: 'ê', ocirc: 'ô', agrave: 'à',
  iexcl: '¡', iquest: '¿', hellip: '…', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return NAMED[e] ?? m;
  });
}

/** HTML a texto: los saltos de línea se respetan, las etiquetas se van. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h\d)>/gi, '\n')
      .replace(/<[^>]*>/g, ''),
  )
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const meta = (html: string, name: string) => {
  const tag = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, 'i').exec(html)?.[0];
  const content = tag && /content=["']([^"']*)["']/i.exec(tag)?.[1];
  return content ? decodeEntities(content).trim() : '';
};

const SITE_WORDS = /\s*[([]?\b(acordes?|chords?|cifras?|cifra club|tabs?|tablatura|letra|lyrics|ver\.? \d+)\b[)\]]?\s*/gi;

/** «Song - Artist - Cifra Club», «SONG CHORDS by Artist @ Ultimate-Guitar.Com», «Song (acordes), Artist». */
export function splitTitle(raw: string): { title: string; artist: string } {
  let t = raw.replace(/\s*[|@·]\s*[^|@·]*$/, '').trim();
  const by = /^(.*?)\s+(?:chords?|tabs?|acordes|ukulele chords)\s+by\s+(.+)$/i.exec(t);
  if (by) return { title: clean(by[1]), artist: clean(by[2]) };
  const dash = /\s+[-–—]\s+/;
  const parts = t.split(dash.test(t) ? dash : /,\s+/).map(clean).filter(Boolean);
  if (parts.length > 2 && /cifra|acordes|chords|guitar|cuerda/i.test(parts.at(-1)!)) parts.pop();
  t = parts[0] ?? '';
  return { title: t, artist: parts[1] ?? '' };
}

const clean = (s: string) => s.replace(SITE_WORDS, ' ').replace(/\s+/g, ' ').trim();

/** Ultimate Guitar: la canción viene en un JSON dentro de la página. */
function fromUltimateGuitar(html: string): Imported | null {
  const m = /class="js-store"[^>]*data-content="([^"]*)"/.exec(html);
  if (!m) return null;
  try {
    const store = JSON.parse(decodeEntities(m[1]));
    const data = store?.store?.page?.data;
    const content: unknown = data?.tab_view?.wiki_tab?.content;
    if (typeof content !== 'string' || !content.trim()) return null;
    const text = content
      .replace(/\[\/?(ch|tab)\]/g, '')
      .replace(/\r\n?/g, '\n')
      .trim();
    return { title: String(data?.tab?.song_name ?? ''), artist: String(data?.tab?.artist_name ?? ''), text };
  } catch {
    return null;
  }
}

/**
 * Lo que interesa de la página: la canción en el `<pre>` más largo (así la
 * muestran LaCuerda, Cifra Club, AcordesWeb y casi todos), o el JSON de
 * Ultimate Guitar. Null si no hay nada que parezca una canción.
 */
export function extractSong(body: string, contentType: string): Imported | null {
  if (/^text\/plain/i.test(contentType)) {
    const text = body.replace(/\r\n?/g, '\n').trim();
    return text ? { title: '', artist: '', text: text.slice(0, MAX_TEXT) } : null;
  }
  const ug = fromUltimateGuitar(body);
  if (ug) return { ...ug, text: ug.text.slice(0, MAX_TEXT) };

  const blocks = [...body.matchAll(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi)].map((m) => htmlToText(m[1]));
  const text = blocks.sort((a, b) => b.length - a.length)[0];
  if (!text || text.split('\n').length < 3) return null;
  const named = splitTitle(meta(body, 'og:title') || htmlToText(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(body)?.[1] ?? ''));
  return { ...named, text: text.slice(0, MAX_TEXT) };
}

// ---------------------------------------------------------------------- red

type DenoLike = {
  env: { get(name: string): string | undefined };
  resolveDns?: (host: string, type: 'A' | 'AAAA') => Promise<string[]>;
  serve(handler: (req: Request) => Response | Promise<Response>): unknown;
};
const deno = (globalThis as { Deno?: DenoLike }).Deno;

async function resolvesPrivate(host: string): Promise<boolean> {
  if (!deno?.resolveDns) return false;
  for (const type of ['A', 'AAAA'] as const) {
    try {
      if ((await deno.resolveDns(host, type)).some(isPrivateIp)) return true;
    } catch {
      // Sin registros de ese tipo.
    }
  }
  return false;
}

function charsetOf(contentType: string, head: Uint8Array): string {
  const declared =
    /charset=["']?([\w-]+)/i.exec(contentType)?.[1] ??
    /<meta[^>]+charset=["']?([\w-]+)/i.exec(new TextDecoder('latin1').decode(head.slice(0, 4096)))?.[1];
  try {
    return new TextDecoder(declared ?? 'utf-8').encoding;
  } catch {
    return 'utf-8';
  }
}

async function readLimited(res: Response): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new ImportError('La página es demasiado grande.');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

async function download(start: URL): Promise<{ body: string; contentType: string }> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (await resolvesPrivate(url.hostname)) throw new ImportError('Esa dirección no es de una página pública.');
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'user-agent': USER_AGENT, accept: 'text/html,text/plain;q=0.9', 'accept-language': 'es,en;q=0.8,pt;q=0.6' },
      });
    } catch {
      throw new ImportError('No se pudo abrir la página (no respondió a tiempo).', 504);
    }
    if (res.status >= 300 && res.status < 400) {
      const next = checkUrl(new URL(res.headers.get('location') ?? '', url).href);
      if (!sameSite(start, next)) throw new ImportError('La página manda a otro sitio: abrila y pegá el texto.');
      url = next;
      continue;
    }
    if (!res.ok) throw new ImportError(`La página no se pudo abrir (respondió ${res.status}).`, 502);
    const contentType = res.headers.get('content-type') ?? '';
    if (!/^text\/(html|plain)|application\/xhtml/i.test(contentType)) throw new ImportError('Eso no es una página de texto.');
    const bytes = await readLimited(res);
    return { body: new TextDecoder(charsetOf(contentType, bytes)).decode(bytes), contentType };
  }
  throw new ImportError('La página redirige demasiadas veces.');
}

// ------------------------------------------------------------------ servidor

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json; charset=utf-8' } });

/** Pide permiso a la base con el JWT de quien llama: solo miembros, con límite. */
async function claim(req: Request, host: string): Promise<void> {
  const env = deno!.env;
  const res = await fetch(`${env.get('SUPABASE_URL')}/rest/v1/rpc/claim_import`, {
    method: 'POST',
    headers: {
      apikey: req.headers.get('apikey') ?? env.get('SUPABASE_ANON_KEY') ?? '',
      authorization: req.headers.get('authorization') ?? '',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ host }),
  });
  if (res.ok) return;
  const err = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
  if (err.code === '54000') throw new ImportError(err.message ?? 'Llegaste al límite de importaciones.', 429);
  if (err.code === '42501' || res.status === 401 || res.status === 403) {
    throw new ImportError(err.message ?? 'Importar desde un link es para los miembros de una banda.', 403);
  }
  throw new ImportError('No se pudo importar ahora. Probá de nuevo o pegá el texto.', 503);
}

export async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply(405, { error: 'Usá POST.' });
  try {
    const { url: raw } = (await req.json().catch(() => ({}))) as { url?: unknown };
    const url = checkUrl(typeof raw === 'string' ? raw : '');
    await claim(req, url.hostname);
    const page = await download(url);
    const song = extractSong(page.body, page.contentType);
    if (!song) throw new ImportError('No encontré la canción en esa página. Copiala de ahí y pegala.');
    return reply(200, song);
  } catch (e) {
    if (e instanceof ImportError) return reply(e.status, { error: e.message });
    return reply(500, { error: 'No se pudo importar ahora. Probá de nuevo o pegá el texto.' });
  }
}

if (deno) deno.serve(handle);

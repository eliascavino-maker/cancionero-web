// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkUrl, extractSong, isPrivateIp, sameSite, splitTitle } from '../functions/import-url/index';

describe('direcciones', () => {
  it('acepta páginas públicas y pasa http a https', () => {
    expect(checkUrl('https://acordes.lacuerda.net/x/y.shtml#arriba').href).toBe('https://acordes.lacuerda.net/x/y.shtml');
    expect(checkUrl('http://www.cifraclub.com.br/a/b/').protocol).toBe('https:');
    expect(checkUrl('  tabs.ultimate-guitar.com/tab/x  ').hostname).toBe('tabs.ultimate-guitar.com');
  });

  it.each([
    'ftp://example.org/x',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'https://127.0.0.1/',
    'https://2130706433/',
    'https://0x7f.0.0.1/',
    'https://[::1]/',
    'https://localhost/',
    'https://intranet/',
    'https://printer.local/',
    'https://metadata.google.internal/',
    'https://abc.supabase.co/rest/v1/',
    'https://user:pass@example.org/',
    'https://example.org:8080/',
    '',
  ])('rechaza %s', (raw) => expect(() => checkUrl(raw)).toThrow());

  it('las redirecciones se quedan en el sitio', () => {
    const from = new URL('https://www.cifraclub.com.br/a/');
    expect(sameSite(from, new URL('https://m.cifraclub.com.br/a/'))).toBe(true);
    expect(sameSite(from, new URL('https://cifraclub.com.br/b/'))).toBe(true);
    expect(sameSite(from, new URL('https://evil.com/cifraclub.com.br'))).toBe(false);
    expect(sameSite(from, new URL('https://cifraclub.com.br.evil.com/'))).toBe(false);
  });

  it('IPs privadas', () => {
    for (const ip of ['10.1.2.3', '127.0.0.1', '169.254.169.254', '172.20.0.1', '192.168.0.10', '100.64.1.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1'])
      expect(isPrivateIp(ip), ip).toBe(true);
    for (const ip of ['8.8.8.8', '104.16.1.1', '172.32.0.1', '2606:4700::1111']) expect(isPrivateIp(ip), ip).toBe(false);
  });
});

describe('título y artista', () => {
  it.each([
    ['Cusco - Encontra - Cifra Club', 'Cusco', 'Encontra'],
    ['WONDERWALL CHORDS by Oasis @ Ultimate-Guitar.Com', 'WONDERWALL', 'Oasis'],
    ['Stand by Me Chords by Ben E. King', 'Stand by Me', 'Ben E. King'],
    ['Zamba de mi esperanza (acordes), Luis Morales', 'Zamba de mi esperanza', 'Luis Morales'],
    ['Hola, mundo - Artista | LaCuerda.net', 'Hola, mundo', 'Artista'],
    ['Solo el título', 'Solo el título', ''],
  ])('%s', (raw, title, artist) => expect(splitTitle(raw)).toEqual({ title, artist }));
});

describe('extraer la canción', () => {
  it('toma el <pre> más largo, con acordes en negrita y entidades', () => {
    const html = `<html><head><meta property="og:title" content="Cusco - Encontra - Cifra Club">
      <title>otro</title></head><body><pre>corto</pre>
      <pre class="cifra"><b>G</b>      <b>D</b>\nHola a&ntilde;o &amp; mundo<br><b>Em</b>\nOtra l&iacute;nea\n</pre>
      <script>alert(1)</script></body></html>`;
    expect(extractSong(html, 'text/html; charset=utf-8')).toEqual({
      title: 'Cusco',
      artist: 'Encontra',
      text: 'G      D\nHola año & mundo\nEm\nOtra línea',
    });
  });

  it('Ultimate Guitar: el JSON de la página', () => {
    const store = {
      store: {
        page: {
          data: {
            tab: { song_name: 'Wonderwall', artist_name: 'Oasis' },
            tab_view: { wiki_tab: { content: '[Verse 1]\r\n[tab][ch]Em7[/ch]   [ch]G[/ch]\r\nToday is gonna be[/tab]' } },
          },
        },
      },
    };
    const attr = JSON.stringify(store).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const html = `<div class="js-store" data-content="${attr}"></div>`;
    expect(extractSong(html, 'text/html')).toEqual({
      title: 'Wonderwall',
      artist: 'Oasis',
      text: '[Verse 1]\nEm7   G\nToday is gonna be',
    });
  });

  it('texto plano o ChordPro, tal cual', () => {
    expect(extractSong('{title: X}\r\n[G]la\r\n', 'text/plain')).toEqual({ title: '', artist: '', text: '{title: X}\n[G]la' });
  });

  it('sin canción: null', () => {
    expect(extractSong('<html><body><p>Hola</p></body></html>', 'text/html')).toBeNull();
    expect(extractSong('<pre>una línea</pre>', 'text/html')).toBeNull();
  });
});

describe('la función entera', () => {
  const page = '<title>Cusco - Encontra</title><pre>G  D\nHola\nEm\nChau</pre>';
  type Call = { url: string; init?: RequestInit };

  async function setup(answers: (call: Call) => Response) {
    const calls: Call[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: URL | string, init?: RequestInit) => {
        const call = { url: String(url), init };
        calls.push(call);
        return answers(call);
      }),
    );
    const env: Record<string, string> = { SUPABASE_URL: 'https://p.supabase.co', SUPABASE_ANON_KEY: 'anon' };
    vi.stubGlobal('Deno', { env: { get: (k: string) => env[k] }, serve: vi.fn(), resolveDns: async () => ['104.16.1.1'] });
    vi.resetModules();
    const { handle } = await import('../functions/import-url/index');
    const ask = async (url: string) => {
      const res = await handle(
        new Request('https://p.supabase.co/functions/v1/import-url', {
          method: 'POST',
          headers: { authorization: 'Bearer jwt', apikey: 'anon', 'content-type': 'application/json' },
          body: JSON.stringify({ url }),
        }),
      );
      return { status: res.status, body: await res.json() };
    };
    return { calls, ask };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const ok = (body = '') => new Response(body, { status: 200 });
  const html = (body: string, headers: Record<string, string> = {}) =>
    new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', ...headers } });

  it('pide permiso con el JWT de quien llama y después baja la página', async () => {
    const { calls, ask } = await setup((c) => (c.url.includes('/rpc/') ? ok() : html(page)));
    expect(await ask('lacuerda.net/cusco')).toEqual({
      status: 200,
      body: { title: 'Cusco', artist: 'Encontra', text: 'G  D\nHola\nEm\nChau' },
    });
    expect(calls[0].url).toBe('https://p.supabase.co/rest/v1/rpc/claim_import');
    expect(calls[0].init?.headers).toMatchObject({ authorization: 'Bearer jwt' });
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ host: 'lacuerda.net' });
    expect(calls[1].url).toBe('https://lacuerda.net/cusco');
    expect(calls[1].init?.redirect).toBe('manual');
  });

  it('sin permiso o con el límite: no baja nada y dice por qué', async () => {
    const denied = await setup(() =>
      new Response(JSON.stringify({ code: '42501', message: 'Importar desde un link es para los miembros de una banda' }), { status: 403 }),
    );
    expect(await denied.ask('lacuerda.net/x')).toEqual({
      status: 403,
      body: { error: 'Importar desde un link es para los miembros de una banda' },
    });
    expect(denied.calls).toHaveLength(1);

    const limit = await setup(() => new Response(JSON.stringify({ code: '54000', message: 'Llegaste al límite' }), { status: 400 }));
    expect(await limit.ask('lacuerda.net/x')).toMatchObject({ status: 429, body: { error: 'Llegaste al límite' } });
  });

  it('una dirección mala no gasta el permiso', async () => {
    const { calls, ask } = await setup(() => ok());
    expect((await ask('https://localhost/x')).status).toBe(422);
    expect(calls).toHaveLength(0);
  });

  it('sigue redirecciones del mismo sitio, no de otro', async () => {
    const same = await setup((c) =>
      c.url.includes('/rpc/')
        ? ok()
        : c.url === 'https://cifraclub.com.br/a'
          ? new Response(null, { status: 301, headers: { location: 'https://www.cifraclub.com.br/a/' } })
          : html(page),
    );
    expect((await same.ask('https://cifraclub.com.br/a')).status).toBe(200);

    const other = await setup((c) =>
      c.url.includes('/rpc/') ? ok() : new Response(null, { status: 302, headers: { location: 'https://169.254.169.254/' } }),
    );
    expect((await other.ask('https://cifraclub.com.br/a')).status).toBe(422);
  });

  it('un nombre que resuelve a una IP privada no se baja', async () => {
    const { calls, ask } = await setup((c) => (c.url.includes('/rpc/') ? ok() : html(page)));
    (globalThis as unknown as { Deno: { resolveDns: unknown } }).Deno.resolveDns = async () => ['10.0.0.5'];
    expect((await ask('https://trampa.example.org/')).status).toBe(422);
    expect(calls.filter((c) => !c.url.includes('/rpc/'))).toHaveLength(0);
  });

  it('páginas muy grandes, que no son texto, o sin canción', async () => {
    const big = await setup((c) => (c.url.includes('/rpc/') ? ok() : html('x'.repeat(1_100_000))));
    expect(await big.ask('lacuerda.net/x')).toMatchObject({ status: 422, body: { error: /demasiado grande/ } });

    const image = await setup((c) => (c.url.includes('/rpc/') ? ok() : new Response('x', { headers: { 'content-type': 'image/png' } })));
    expect((await image.ask('lacuerda.net/x')).status).toBe(422);

    const empty = await setup((c) => (c.url.includes('/rpc/') ? ok() : html('<p>nada</p>')));
    expect(await empty.ask('lacuerda.net/x')).toMatchObject({ status: 422, body: { error: /No encontré la canción/ } });
  });

  it('respeta el charset de la página (latin1)', async () => {
    const bytes = new Uint8Array([...new TextEncoder().encode('<pre>G\nA'), 0xf1, ...new TextEncoder().encode('o\nD\n</pre>')]);
    const { ask } = await setup((c) =>
      c.url.includes('/rpc/') ? ok() : new Response(bytes, { headers: { 'content-type': 'text/html; charset=ISO-8859-1' } }),
    );
    expect((await ask('lacuerda.net/x')).body.text).toBe('G\nAño\nD');
  });
});

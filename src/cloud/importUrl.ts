import type { SupabaseClient } from '@supabase/supabase-js';

export interface ImportedSong {
  title: string;
  artist: string;
  text: string;
}

/** Why a link could not be read; the editor shows it and offers to paste. */
export class ImportUrlError extends Error {}

/** What the Edge Function `import-url` answers when it fails: `{ error }`. */
async function messageOf(error: unknown): Promise<string> {
  const response = (error as { context?: unknown }).context;
  if (response instanceof Response) {
    if (response.status === 404) return 'La función para importar todavía no está instalada en Supabase.';
    const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
    if (typeof body?.error === 'string') return body.error;
  }
  const name = (error as { name?: string }).name;
  if (name === 'FunctionsFetchError' || name === 'FunctionsRelayError') return 'Sin conexión con el servidor.';
  return 'No se pudo importar ahora.';
}

/** Brings a song from a chord page, through the Edge Function `import-url`. */
export async function importFromUrl(client: SupabaseClient, url: string): Promise<ImportedSong> {
  let result: { data: unknown; error: unknown };
  try {
    result = await client.functions.invoke('import-url', { body: { url } });
  } catch (e) {
    throw new ImportUrlError(await messageOf(e));
  }
  if (result.error) throw new ImportUrlError(await messageOf(result.error));
  const data = result.data as Partial<ImportedSong> | null;
  if (!data || typeof data.text !== 'string' || !data.text.trim()) throw new ImportUrlError('La página no trajo ninguna canción.');
  return { title: String(data.title ?? '').slice(0, 200), artist: String(data.artist ?? '').slice(0, 200), text: data.text };
}

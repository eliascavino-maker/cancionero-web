import type { SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { useCloud } from './CloudProvider';

export const LOGO_BUCKET = 'band-logos';
/** What the bucket takes (migración 9). */
export const MAX_LOGO_BYTES = 512 * 1024;
const MAX_SIDE = 512;
const CACHE = 'cancionero.logo';

/**
 * The picture, at most 512 px a side, as WebP (PNG where the browser can't
 * write WebP). Redrawing it also leaves out anything that isn't the image.
 */
export async function shrinkLogo(file: Blob): Promise<Blob> {
  if (!/^image\/(png|jpeg|webp|gif|heic|heif)$/.test(file.type)) throw new Error('Elegí una imagen PNG, JPG o WebP.');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('No se pudo leer la imagen.');
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/webp', 0.9));
  if (!blob) throw new Error('No se pudo preparar la imagen.');
  if (blob.size > MAX_LOGO_BYTES) throw new Error('La imagen quedó demasiado pesada. Probá con otra más simple.');
  return blob;
}

/** `<band>/logo-<time>.webp`: a new name each time, so nobody keeps an old one. */
export function logoPath(bandId: string, type: string, now = Date.now()): string {
  const ext = type === 'image/png' ? 'png' : type === 'image/jpeg' ? 'jpg' : 'webp';
  return `${bandId}/logo-${now}.${ext}`;
}

/** Uploads the logo, makes it the band's, and deletes the one before. Owner only. */
export async function setLogo(client: SupabaseClient, bandId: string, old: string | null | undefined, image: Blob) {
  const path = logoPath(bandId, image.type);
  const up = await client.storage.from(LOGO_BUCKET).upload(path, image, { contentType: image.type, upsert: false });
  if (up.error) throw new Error(/bucket not found/i.test(up.error.message) ? 'Falta la migración 9 en Supabase.' : up.error.message);
  const { error } = await client.rpc('set_band_logo', { band: bandId, path });
  if (error) {
    await client.storage.from(LOGO_BUCKET).remove([path]);
    throw new Error(error.message);
  }
  if (old) await client.storage.from(LOGO_BUCKET).remove([old]);
}

/** Takes the logo off the band and deletes it. Owner only. */
export async function removeLogo(client: SupabaseClient, bandId: string, path: string) {
  const { error } = await client.rpc('set_band_logo', { band: bandId, path: null });
  if (error) throw new Error(error.message);
  await client.storage.from(LOGO_BUCKET).remove([path]);
}

interface Cached {
  path: string;
  data: string;
}

function readCache(): Cached | null {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE) ?? 'null') as Cached | null;
    return c && typeof c.path === 'string' && typeof c.data === 'string' ? c : null;
  } catch {
    return null;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => fail(r.error);
    r.readAsDataURL(blob);
  });
}

/**
 * The band's logo as a data URL, or null. Kept on the device, so it shows
 * offline and in a PDF; downloaded again only when the owner changes it.
 */
export function useBandLogo(): string | null {
  const cloud = useCloud();
  const path = cloud.band?.logoPath ?? null;
  const [logo, setLogo] = useState<string | null>(() => {
    const c = readCache();
    return c && c.path === path ? c.data : null;
  });

  useEffect(() => {
    const cached = readCache();
    if (!path) {
      setLogo(null);
      // Taken off (or a band without logo): forget it. Unknown yet (offline): keep it.
      if (cloud.band && cloud.band.logoPath === null) localStorage.removeItem(CACHE);
      return;
    }
    if (cached?.path === path) {
      setLogo(cached.data);
      return;
    }
    if (!cloud.client) return;
    let active = true;
    cloud.client.storage
      .from(LOGO_BUCKET)
      .download(path)
      .then(async ({ data }) => {
        if (!data || !active) return;
        const url = await blobToDataUrl(data);
        if (!/^data:image\/(png|jpeg|webp);/.test(url)) return;
        try {
          localStorage.setItem(CACHE, JSON.stringify({ path, data: url }));
        } catch {
          // Storage full: shown this time only.
        }
        if (active) setLogo(url);
      })
      .catch(() => {
        // Offline: next time.
      });
    return () => {
      active = false;
    };
  }, [path, cloud.client, cloud.band]);

  return path ? logo : null;
}

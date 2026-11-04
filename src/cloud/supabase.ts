import { type SupabaseClient, createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Connection to the band's server. null when the build has no Supabase
 * settings: then the app works only on this device, as before.
 */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          // Routes use #/..., and there are no login links to read from the URL.
          detectSessionInUrl: false,
          storageKey: 'cancionero.auth',
        },
      })
    : null;

// Supabase client — lazily initialized. Works when env vars are present; no-op otherwise.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabase = !!(url && anon);

// PKCE flow is required for reliable mobile OAuth. `detectSessionInUrl` is true
// by default but we set it explicitly so Supabase picks up the `?code=` param
// on the /auth/callback route and finishes the exchange automatically.
export const supabase = hasSupabase
  ? createClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storageKey: 'flickpick.supabase.auth',
      },
    })
  : null;

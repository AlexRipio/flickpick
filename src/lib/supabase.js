// Supabase client — lazily initialized. Works when env vars are present; no-op otherwise.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabase = !!(url && anon);

export const supabase = hasSupabase
  ? createClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'flickpick.supabase.auth',
      },
    })
  : null;

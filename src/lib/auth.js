// Unified auth layer for FlickPick.
// - If Supabase env vars are set → uses Supabase Auth (real DB, works across devices).
// - Otherwise → falls back to a local, password-hashed account registry in localStorage so
//   signup/signin still *validate* (wrong password fails) and Google sign-in at least
//   returns a stable demo profile. This keeps the app usable out-of-the-box.

import { supabase, hasSupabase } from './supabase';

const LOCAL_USERS_KEY = 'flickpick.users.v1';

function readLocalUsers() {
  try { return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || '{}'); } catch { return {}; }
}
function writeLocalUsers(map) {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(map));
}

async function hash(input) {
  // SHA-256 via SubtleCrypto — real validation, not plain-text comparison.
  const buf = new TextEncoder().encode(String(input));
  const out = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(out)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function profileFromSupabaseUser(u) {
  if (!u) return null;
  const meta = u.user_metadata || {};
  return {
    id: u.id,
    name: meta.name || meta.full_name || (u.email || '').split('@')[0] || 'Cinéfilo',
    email: u.email || meta.email || '',
    avatarUrl: meta.avatar_url || null,
    provider: u.app_metadata?.provider || 'email',
  };
}

// ──────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────

export async function signUpWithEmail({ name, email, password }) {
  if (!email || !password || password.length < 6) throw new Error('Email y contraseña (mín. 6 caracteres) son obligatorios.');
  const cleanName = (name || '').trim() || (email.split('@')[0] || 'Cinéfilo');

  if (hasSupabase) {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name: cleanName } },
    });
    if (error) throw new Error(error.message);
    return { profile: profileFromSupabaseUser(data.user), needsConfirm: !data.session };
  }

  // Local fallback: reject duplicate email, hash password.
  const users = readLocalUsers();
  if (users[email]) throw new Error('Ya existe una cuenta con ese email. Inicia sesión.');
  const passHash = await hash(password);
  const id = 'u-' + crypto.randomUUID().slice(0, 8);
  users[email] = { id, name: cleanName, email, passHash, createdAt: Date.now() };
  writeLocalUsers(users);
  return { profile: { id, name: cleanName, email, provider: 'email' }, needsConfirm: false };
}

export async function signInWithEmail({ email, password }) {
  if (!email || !password) throw new Error('Introduce email y contraseña.');

  if (hasSupabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return { profile: profileFromSupabaseUser(data.user) };
  }

  const users = readLocalUsers();
  const account = users[email];
  if (!account) throw new Error('No existe cuenta con ese email. Regístrate.');
  const passHash = await hash(password);
  if (passHash !== account.passHash) throw new Error('Contraseña incorrecta.');
  return { profile: { id: account.id, name: account.name, email: account.email, provider: 'email' } };
}

export async function signInWithGoogle() {
  if (hasSupabase) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/home` },
    });
    if (error) throw new Error(error.message);
    // Redirect happens — nothing else to do here.
    return { profile: null, redirecting: true };
  }
  // Local fallback: create/reuse a stable demo Google account.
  const users = readLocalUsers();
  const email = 'google-demo@flickpick.app';
  if (!users[email]) {
    users[email] = {
      id: 'u-google-' + crypto.randomUUID().slice(0, 6),
      name: 'Cinéfilo Google',
      email,
      passHash: null,
      provider: 'google',
      createdAt: Date.now(),
    };
    writeLocalUsers(users);
  }
  const a = users[email];
  return { profile: { id: a.id, name: a.name, email: a.email, provider: 'google' } };
}

export async function signOut() {
  if (hasSupabase) await supabase.auth.signOut();
}

export async function getCurrentProfile() {
  if (hasSupabase) {
    const { data } = await supabase.auth.getUser();
    return profileFromSupabaseUser(data?.user || null);
  }
  return null;
}

export function onAuthChange(callback) {
  if (!hasSupabase) return () => {};
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(profileFromSupabaseUser(session?.user || null));
  });
  return () => subscription.unsubscribe();
}

export { hasSupabase };

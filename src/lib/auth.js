/**
 * Unified auth layer for FlickPick.
 * Email/Password + Google OAuth via FlickPick backend API.
 */

import {
  getToken, setToken,
  apiRegister, apiLogin, apiVerifyEmail,
  apiGetMe, apiLogout, apiGoogleAuth,
} from './api';

export const hasSupabase = false;

// ── Auth state listeners ─────────────────────────────────────────────
const authListeners = new Set();
let _currentProfile = undefined;

function notifyListeners(profile) {
  _currentProfile = profile;
  authListeners.forEach(fn => { try { fn(profile); } catch {} });
}

function profileFromApiUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name || user.email?.split('@')[0] || 'Cinefilo',
    email: user.email || '',
    avatarUrl: user.avatar_url || null,
    provider: user.provider || 'email',
  };
}

// ── Initialize on page load ──────────────────────────────────────────
let _initialized = false;
async function initAuth() {
  if (_initialized) return;
  _initialized = true;
  const token = getToken();
  if (!token) { notifyListeners(null); return; }
  try {
    const user = await apiGetMe();
    notifyListeners(profileFromApiUser(user));
  } catch {
    setToken(null);
    notifyListeners(null);
  }
}
initAuth();

// ── Email/Password ───────────────────────────────────────────────────

export async function registerWithEmail(email, password, name) {
  if (!email || !email.includes('@')) throw new Error('Email invalido.');
  if (!password || password.length < 6) throw new Error('La contrasena debe tener al menos 6 caracteres.');
  return apiRegister(email, password, name);
}

export async function loginWithEmail(email, password) {
  if (!email || !email.includes('@')) throw new Error('Email invalido.');
  if (!password) throw new Error('Contrasena obligatoria.');
  const data = await apiLogin(email, password);
  if (data?.user) {
    const profile = profileFromApiUser(data.user);
    notifyListeners(profile);
    return { profile };
  }
  return data;
}

export async function verifyEmail(email, token) {
  if (!email || !token) throw new Error('Faltan datos de verificacion.');
  const data = await apiVerifyEmail(email, token);
  if (data?.user) {
    const profile = profileFromApiUser(data.user);
    notifyListeners(profile);
    return { profile };
  }
  return data;
}

// ── Google OAuth ─────────────────────────────────────────────────────

export async function processGoogleUserInfo(userInfo) {
  if (!userInfo?.sub || !userInfo?.email) {
    throw new Error('Datos de Google incompletos.');
  }
  const data = await apiGoogleAuth(userInfo.sub, userInfo.email, userInfo.name, userInfo.picture);
  if (!data?.token || !data?.user) throw new Error('No se pudo autenticar con Google.');

  setToken(data.token);
  const profile = profileFromApiUser(data.user);
  notifyListeners(profile);
  return { profile };
}

export async function processGoogleCredential(credential) {
  try {
    const decoded = JSON.parse(atob(credential.split('.')[1]));
    const data = await apiGoogleAuth(decoded.sub, decoded.email, decoded.name, decoded.picture);
    if (!data?.token || !data?.user) throw new Error('No se pudo autenticar con Google.');
    setToken(data.token);
    const profile = profileFromApiUser(data.user);
    notifyListeners(profile);
    return { profile };
  } catch {
    throw new Error('No se pudo procesar la respuesta de Google.');
  }
}

// ── Session ──────────────────────────────────────────────────────────

export async function signOut() {
  await apiLogout();
  notifyListeners(null);
}

export async function getCurrentProfile() {
  if (_currentProfile) return _currentProfile;
  const token = getToken();
  if (!token) return null;
  try {
    const user = await apiGetMe();
    return profileFromApiUser(user);
  } catch { return null; }
}

export function onAuthChange(callback) {
  authListeners.add(callback);
  if (_currentProfile !== undefined) {
    try { callback(_currentProfile); } catch {}
  }
  return () => authListeners.delete(callback);
}

export { getToken, setToken };

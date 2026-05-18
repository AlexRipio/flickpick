// Helpers + global capture for the PWA install prompt.
// Captures `beforeinstallprompt` early (before any React mounts) so the
// event isn't lost when the user reaches Profile or any install button.

let deferredPrompt = null;
const listeners = new Set();

function emit() {
  for (const l of listeners) {
    try { l(deferredPrompt); } catch {}
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    emit();
    // Fire-and-forget tracking ping the moment the install completes
    // (Android Chrome / desktop only — iOS doesn't expose this event).
    try { trackInstall({ trigger: 'appinstalled' }); } catch {}
  });
}

// ── Install tracking (analytics) ─────────────────────────────────────
const INSTALL_ID_KEY = 'flickpick.install_id.v1';

function getOrCreateInstallId() {
  try {
    let id = localStorage.getItem(INSTALL_ID_KEY);
    if (id) return id;
    id = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'i-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(INSTALL_ID_KEY, id);
    return id;
  } catch { return null; }
}

export async function trackInstall(meta = {}) {
  try {
    const install_id = getOrCreateInstallId();
    if (!install_id) return;
    const platform = detectPlatform();
    const body = JSON.stringify({
      install_id,
      platform: platform.os,
      browser:  platform.browser,
      user_agent: navigator.userAgent || '',
      ...meta,
    });
    const baseUrl = (typeof window !== 'undefined' ? window.location.origin : '') + '/api/events/install';
    const apiUrl = baseUrl.includes('flickpick.mov') ? baseUrl : 'https://flickpick.mov/api/events/install';
    let token = null;
    try { token = localStorage.getItem('flickpick.jwt.v1'); } catch {}
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    fetch(apiUrl, { method: 'POST', headers, body, keepalive: true }).catch(() => {});
  } catch {}
}

/**
 * Call once at app startup. If the user is running in standalone mode
 * (PWA installed) we record/refresh the install.
 *   - First standalone launch creates the row.
 *   - Subsequent launches just bump last_seen_at (deduped by install_id).
 * No-op when running in regular browser tab.
 */
export function pingInstallIfStandalone() {
  if (!isStandalone()) return;
  trackInstall({ trigger: 'standalone-launch' });
}

export function getDeferredPrompt() {
  return deferredPrompt;
}

export function onDeferredPromptChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export async function triggerInstall() {
  if (!deferredPrompt) return { ok: false, reason: 'no-prompt' };
  try {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    emit();
    return { ok: outcome === 'accepted', outcome };
  } catch (e) {
    return { ok: false, reason: e?.message || 'error' };
  }
}

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  if (window.navigator.standalone === true) return true; // iOS Safari
  return false;
}

export function detectPlatform() {
  if (typeof navigator === 'undefined') return { os: 'unknown', browser: 'unknown' };
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isMac = /Macintosh/.test(ua) && !isIOS;
  const isWin = /Windows/.test(ua);

  // iOS WebView/non-Safari detection
  // Safari iOS: contains "Safari" but NOT "CriOS" (Chrome), "FxiOS" (Firefox), "EdgiOS" (Edge), "OPiOS" (Opera).
  const isCriOS = /CriOS/.test(ua);
  const isFxiOS = /FxiOS/.test(ua);
  const isEdgiOS = /EdgiOS/.test(ua);
  const isOpiOS = /OPiOS|OPT\//.test(ua);
  const isSafariOnly = /Safari/.test(ua) && !isCriOS && !isFxiOS && !isEdgiOS && !isOpiOS;

  // Android browser
  const isChrome = /Chrome/.test(ua) && !/Edg|OPR/.test(ua);
  const isEdge = /Edg\//.test(ua);
  const isSamsung = /SamsungBrowser/.test(ua);

  let os = 'desktop';
  if (isIOS) os = 'ios';
  else if (isAndroid) os = 'android';
  else if (isMac) os = 'mac';
  else if (isWin) os = 'windows';

  let browser = 'other';
  if (isIOS) {
    if (isCriOS) browser = 'chrome-ios';
    else if (isFxiOS) browser = 'firefox-ios';
    else if (isEdgiOS) browser = 'edge-ios';
    else if (isOpiOS) browser = 'opera-ios';
    else if (isSafariOnly) browser = 'safari';
    else browser = 'webview-ios';
  } else if (isEdge) browser = 'edge';
  else if (isChrome) browser = 'chrome';
  else if (isSamsung) browser = 'samsung';
  else if (/Firefox/.test(ua)) browser = 'firefox';
  else if (/Safari/.test(ua) && isMac) browser = 'safari';

  return { os, browser, isIOS, isAndroid };
}

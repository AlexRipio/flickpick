/**
 * Cookie consent state — single localStorage key holds the user's choice
 * for analytics. Technical cookies are always allowed (legitimate interest)
 * and don't go through this gate.
 */
const KEY = 'flickpick.consent.v1';

const listeners = new Set();
function notify() { listeners.forEach(fn => { try { fn(getConsent()); } catch {} }); }

export function getConsent() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}

export function hasDecided() {
  return getConsent() !== null;
}

export function analyticsAllowed() {
  return getConsent()?.analytics === true;
}

export function setConsent({ analytics }) {
  const value = { analytics: !!analytics, timestamp: Date.now() };
  localStorage.setItem(KEY, JSON.stringify(value));
  notify();
  try {
    import('@/lib/userSync').then(({ userSync }) => userSync.consent(JSON.stringify(value))).catch(() => {});
  } catch {}
  return value;
}

export function resetConsent() {
  localStorage.removeItem(KEY);
  notify();
}

export function onConsentChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

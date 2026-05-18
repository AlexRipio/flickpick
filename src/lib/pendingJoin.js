/**
 * Persists the joinCode a user was trying to access before being
 * sent to the auth flow (signin/signup/Google). After successful
 * login any screen can `consumePendingJoin()` and redirect to
 * `/g/<code>` so the user lands exactly where they intended.
 *
 * Stored in sessionStorage (per-tab) with a localStorage fallback
 * so the value survives a full page reload from the OAuth popup.
 */

const KEY = 'flickpick.pending.join.v1';
const TTL_MS = 30 * 60 * 1000; // 30 min

function readEntry() {
  try {
    const raw = sessionStorage.getItem(KEY) || localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.code) return null;
    if (parsed.exp && Date.now() > parsed.exp) {
      clearPendingJoin();
      return null;
    }
    return parsed;
  } catch { return null; }
}

export function setPendingJoin(code) {
  if (!code) return;
  const entry = JSON.stringify({ code: String(code).toUpperCase(), exp: Date.now() + TTL_MS });
  try { sessionStorage.setItem(KEY, entry); } catch {}
  try { localStorage.setItem(KEY, entry); } catch {}
}

export function getPendingJoin() {
  return readEntry()?.code || null;
}

export function consumePendingJoin() {
  const code = readEntry()?.code || null;
  clearPendingJoin();
  return code;
}

export function clearPendingJoin() {
  try { sessionStorage.removeItem(KEY); } catch {}
  try { localStorage.removeItem(KEY); } catch {}
}

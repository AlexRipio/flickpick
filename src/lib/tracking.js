/**
 * Tracking — captura pageviews + clicks y los envía batched al backend.
 * Fire-and-forget: nunca bloquea ni rompe la UI si falla.
 */
const API_BASE = import.meta.env.VITE_API_BASE || 'https://flickpick.mov/api';
const SESSION_KEY = (() => {
  try {
    let k = sessionStorage.getItem('fp.tk');
    if (!k) {
      k = (Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 24);
      sessionStorage.setItem('fp.tk', k);
    }
    return k;
  } catch { return null; }
})();

function getToken() {
  try { return localStorage.getItem('flickpick.jwt.v1'); } catch { return null; }
}

function postSilent(path, body) {
  try {
    const tok = getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (tok) headers.Authorization = `Bearer ${tok}`;
    const data = JSON.stringify(body);
    if (navigator.sendBeacon && !tok) {
      const blob = new Blob([data], { type: 'application/json' });
      navigator.sendBeacon(`${API_BASE}${path}`, blob);
      return;
    }
    fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: data, keepalive: true }).catch(() => {});
  } catch {}
}

let currentPath = null;
let currentEntered = 0;
let currentScrollMax = 0;
let viewportW = window.innerWidth;
let viewportH = window.innerHeight;

function updateViewport() {
  viewportW = window.innerWidth;
  viewportH = window.innerHeight;
}
window.addEventListener('resize', updateViewport, { passive: true });

function flushPageView() {
  if (!currentPath) return;
  const dur = Date.now() - currentEntered;
  if (dur < 200) return; // ignore extremely brief
  postSilent('/events/pageview', {
    path: currentPath,
    viewport_w: viewportW,
    viewport_h: viewportH,
    duration_ms: dur,
    scroll_max: currentScrollMax,
    referrer: document.referrer || null,
    session_key: SESSION_KEY,
  });
}

export function trackPageView(path) {
  if (currentPath) flushPageView();
  currentPath = path || window.location.pathname;
  currentEntered = Date.now();
  currentScrollMax = 0;
}

window.addEventListener('beforeunload', flushPageView);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushPageView();
});

window.addEventListener('scroll', () => {
  const doc = document.documentElement;
  const scrolled = doc.scrollTop + window.innerHeight;
  const total = doc.scrollHeight;
  if (total > 0) {
    const pct = Math.min(100, Math.round((scrolled / total) * 100));
    if (pct > currentScrollMax) currentScrollMax = pct;
  }
}, { passive: true });

// ─── Click tracking (batched) ────────────────────────────────────────────
const clickQueue = [];
let flushTimer = null;

function flushClicks() {
  if (clickQueue.length === 0) return;
  const batch = clickQueue.splice(0, clickQueue.length);
  postSilent('/events/click', batch);
}
function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => { flushTimer = null; flushClicks(); }, 4000);
}

window.addEventListener('beforeunload', flushClicks);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushClicks();
});

function getTargetInfo(el) {
  if (!el) return {};
  const tag = el.tagName || null;
  const id = el.id ? el.id.slice(0, 100) : null;
  let label = el.getAttribute?.('aria-label') || null;
  if (!label && el.textContent) label = el.textContent.trim().slice(0, 80);
  if (!label && el.getAttribute?.('alt')) label = el.getAttribute('alt');
  if (!label && el.getAttribute?.('title')) label = el.getAttribute('title');
  // Walk up to nearest button/a if click landed on inner span/svg
  let walker = el;
  for (let i = 0; i < 4 && walker; i++) {
    if (walker.tagName === 'BUTTON' || walker.tagName === 'A') {
      const lbl = walker.getAttribute?.('aria-label') || walker.textContent?.trim().slice(0, 80);
      if (lbl) label = lbl;
      return { tag: walker.tagName, id: walker.id || id, label };
    }
    walker = walker.parentElement;
  }
  return { tag, id, label };
}

document.addEventListener('click', (e) => {
  try {
    if (!e || !e.target) return;
    const info = getTargetInfo(e.target);
    const x = (e.clientX / viewportW) * 100;
    const y = (e.clientY / viewportH) * 100;
    if (!isFinite(x) || !isFinite(y)) return;
    clickQueue.push({
      path: window.location.pathname,
      viewport_w: viewportW,
      viewport_h: viewportH,
      x_pct: Math.round(x * 100) / 100,
      y_pct: Math.round(y * 100) / 100,
      target_tag: info.tag || null,
      target_label: info.label || null,
      target_id: info.id || null,
      session_key: SESSION_KEY,
    });
    if (clickQueue.length >= 20) flushClicks();
    else scheduleFlush();
  } catch {}
}, { passive: true, capture: true });

// Track route changes for SPAs (react-router pushState)
const _push = history.pushState;
const _replace = history.replaceState;
history.pushState = function (...args) {
  _push.apply(this, args);
  setTimeout(() => trackPageView(window.location.pathname), 0);
};
history.replaceState = function (...args) {
  _replace.apply(this, args);
  setTimeout(() => trackPageView(window.location.pathname), 0);
};
window.addEventListener('popstate', () => trackPageView(window.location.pathname));

// Initial pageview
if (typeof window !== 'undefined') {
  setTimeout(() => trackPageView(window.location.pathname), 100);
}

/**
 * Network quality monitor — observa el estado de conexión y la latencia
 * real de las peticiones HTTP, sin romper nunca la app si algo falla.
 *
 * Estados: 'good' | 'slow' | 'offline' | 'unknown'
 *
 * Estrategia (defensiva):
 *  • navigator.onLine = false → 'offline' inmediato.
 *  • navigator.connection.effectiveType in {2g, slow-2g} → 'slow'.
 *  • Wrap de window.fetch para medir latencia real. Mantenemos una
 *    ventana móvil de 8 muestras. Si la mediana > 2.5 s y al menos
 *    3 muestras → 'slow'. Si 3 fetches consecutivos fallan → 'offline'.
 *  • Debounce a 'slow' (1.2 s) para no parpadear en hipos puntuales.
 *
 * Todo está envuelto en try/catch — si por alguna razón falla, queda
 * en 'unknown' y el indicador no aparece. La app sigue funcionando.
 */

const samples = [];                 // recent latencies in ms
const MAX_SAMPLES = 8;
let consecutiveFailures = 0;
let listeners = new Set();
let cached = { quality: 'unknown', online: true };
let pendingSlowTimer = null;
// Cooldown: una vez que decimos "slow" mantenemos el estado al menos
// COOLDOWN_MS antes de volver a "good", aunque las muestras mejoren —
// así el indicador no aparece y desaparece cada pocos segundos.
let slowSince = 0;
const COOLDOWN_MS = 8000;

function safeNavigator() {
  return typeof navigator !== 'undefined' ? navigator : null;
}

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function computeQuality() {
  const nav = safeNavigator();
  if (!nav) return 'unknown';
  if (nav.onLine === false) return 'offline';
  if (consecutiveFailures >= 3) return 'offline';
  // Connection API hint (Chromium browsers).
  const eff = nav.connection?.effectiveType;
  if (eff === 'slow-2g' || eff === '2g') return 'slow';
  // Measured latency window.
  if (samples.length >= 3) {
    const med = median(samples);
    if (med > 2500) return 'slow';
  }
  return 'good';
}

let cooldownCheckTimer = null;
function setQuality(next) {
  const nav = safeNavigator();
  // Honor cooldown: si seguimos dentro del cooldown desde que entramos
  // a "slow", no salimos a "good" todavía. Programamos un re-check al
  // final del cooldown para no quedarnos atrapados ahí.
  if (cached.quality === 'slow' && next === 'good' && slowSince > 0) {
    const elapsed = Date.now() - slowSince;
    if (elapsed < COOLDOWN_MS) {
      if (!cooldownCheckTimer) {
        cooldownCheckTimer = setTimeout(() => {
          cooldownCheckTimer = null;
          recompute();
        }, COOLDOWN_MS - elapsed + 50);
      }
      return;
    }
  }
  if (next === 'slow') slowSince = Date.now();
  if (next !== 'slow') {
    slowSince = 0;
    if (cooldownCheckTimer) { clearTimeout(cooldownCheckTimer); cooldownCheckTimer = null; }
  }
  const status = { quality: next, online: nav ? nav.onLine !== false : true };
  if (status.quality === cached.quality && status.online === cached.online) return;
  cached = status;
  for (const fn of listeners) {
    try { fn(cached); } catch {}
  }
}

function recompute() {
  try {
    const next = computeQuality();
    // Debounce only for transitions INTO 'slow' so transient hiccups
    // don't flicker the banner. Other transitions are immediate.
    if (next === 'slow' && cached.quality === 'good') {
      if (pendingSlowTimer) clearTimeout(pendingSlowTimer);
      pendingSlowTimer = setTimeout(() => {
        pendingSlowTimer = null;
        // Re-evaluate after the debounce — connection may have recovered.
        const verified = computeQuality();
        setQuality(verified);
      }, 1200);
    } else {
      if (pendingSlowTimer) { clearTimeout(pendingSlowTimer); pendingSlowTimer = null; }
      setQuality(next);
    }
  } catch {
    // Never let monitoring break the app.
  }
}

// Anything over this threshold is treated as an artefact (the page was
// frozen by a permission prompt, a native dialog, or backgrounded mid-
// request) — not actual network slowness. Without this guard a 5-second
// "Allow notifications?" prompt inflates latency samples and trips the
// "Conexión lenta" banner for the next 8s of cooldown, even on fibre.
const ARTEFACT_LATENCY_MS = 8000;

function recordLatency(ms) {
  if (!Number.isFinite(ms) || ms < 0) return;
  if (ms > ARTEFACT_LATENCY_MS) return;
  samples.push(ms);
  if (samples.length > MAX_SAMPLES) samples.shift();
  recompute();
}

// ── Public API ─────────────────────────────────────────────────────
export function getNetworkStatus() { return cached; }

export function subscribeNetwork(fn) {
  listeners.add(fn);
  try { fn(cached); } catch {}
  return () => listeners.delete(fn);
}

// ── Install (client only) ──────────────────────────────────────────
let installed = false;
export function installNetworkMonitor() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  // Wrap fetch defensively.
  try {
    const orig = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const start = performance.now();
      try {
        const r = await orig(...args);
        recordLatency(performance.now() - start);
        consecutiveFailures = 0;
        recompute();
        return r;
      } catch (err) {
        consecutiveFailures += 1;
        recordLatency(performance.now() - start);
        recompute();
        throw err;
      }
    };
  } catch { /* keep app running even if wrap fails */ }

  // Native online/offline events.
  try {
    window.addEventListener('online', recompute);
    window.addEventListener('offline', recompute);
  } catch {}

  // Connection API change (when supported).
  try {
    const conn = navigator.connection;
    if (conn?.addEventListener) conn.addEventListener('change', recompute);
  } catch {}

  // When the tab returns to foreground, throw away stale latency samples
  // and exit "slow" right away. Permission prompts, native dialogs and
  // backgrounding all pause the JS event loop; any in-flight fetch
  // recorded during that pause has a wall-clock latency that has nothing
  // to do with network quality. Resetting on resume snaps the indicator
  // back to "good" instead of waiting out the 8s cooldown.
  try {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      samples.length = 0;
      consecutiveFailures = 0;
      slowSince = 0;
      if (pendingSlowTimer) { clearTimeout(pendingSlowTimer); pendingSlowTimer = null; }
      if (cooldownCheckTimer) { clearTimeout(cooldownCheckTimer); cooldownCheckTimer = null; }
      // Force a re-evaluation that bypasses the cooldown gate above.
      cached = { ...cached, quality: 'good' };
      recompute();
    });
  } catch {}

  // Seed initial state.
  recompute();
}

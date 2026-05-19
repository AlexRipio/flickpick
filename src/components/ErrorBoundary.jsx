import React from 'react';

/**
 * Top-level Error Boundary.
 *
 * React Error Boundaries are the only way to catch render-time
 * exceptions before they unmount the entire React subtree. Without
 * one, a stray `room.members.map` on an undefined value leaves the
 * user staring at the AmbientBackdrop with no UI on top — the exact
 * "se ve solo el fondo" report from production.
 *
 * What this does:
 *   - Catches errors from any descendant render/lifecycle hook.
 *   - Shows a legible fallback with two actions:
 *       · "Volver al inicio" → soft reset to '/' (preserves SW state).
 *       · "Recargar app"     → hard refresh + clears SW caches, the
 *                              equivalent of reinstalling the PWA.
 *   - Logs to console + (best-effort) POSTs to the backend so we can
 *     spot recurring crashes in admin logs.
 */

async function reportToBackend(error, info) {
  try {
    const payload = {
      message: error?.message || String(error),
      stack: (error?.stack || '').slice(0, 4000),
      componentStack: (info?.componentStack || '').slice(0, 2000),
      url: typeof window !== 'undefined' ? window.location.href : '',
      ua:  typeof navigator !== 'undefined' ? navigator.userAgent : '',
      ts:  new Date().toISOString(),
    };
    // Optional endpoint — fail silent if the backend doesn't implement it.
    await fetch('/api/events/crash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {}
}

async function hardReload() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister().catch(() => {})));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k).catch(() => {})));
    }
  } catch {}
  // Force the browser to re-fetch everything from the network on reload.
  try { window.location.replace(window.location.pathname + '?_r=' + Date.now()); }
  catch { window.location.reload(); }
}

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] caught:', error, info);
    reportToBackend(error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#07050E',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        fontFamily: '"Space Grotesk", system-ui, -apple-system, sans-serif',
        color: '#fff',
      }}>
        <div style={{
          maxWidth: 420, width: '100%', textAlign: 'center',
        }}>
          <div style={{ fontSize: 54, marginBottom: 18, lineHeight: 1 }}>🛠</div>
          <div style={{
            fontSize: 22, fontWeight: 800, marginBottom: 10, letterSpacing: -0.5,
          }}>Algo se ha roto</div>
          <div style={{
            fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55,
            marginBottom: 26,
          }}>
            La app encontró un problema cargando esta vista. Puedes volver al inicio o recargar la app por completo (limpia caché y vuelve a empezar).
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={() => {
                try { window.location.assign('/'); }
                catch { window.location.href = '/'; }
              }}
              style={{
                height: 52, borderRadius: 999, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #FF6B4A, #FF3B6B)',
                color: '#fff', fontWeight: 800, fontSize: 15,
                boxShadow: '0 10px 24px rgba(255,59,107,0.35)',
              }}
            >
              Volver al inicio
            </button>
            <button
              onClick={hardReload}
              style={{
                height: 48, borderRadius: 999, cursor: 'pointer',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#fff', fontWeight: 700, fontSize: 14,
              }}
            >
              Recargar app (vacía caché)
            </button>
          </div>
          {this.state.error?.message && (
            <details style={{
              marginTop: 22, textAlign: 'left',
              fontSize: 11, color: 'rgba(255,255,255,0.4)',
            }}>
              <summary style={{ cursor: 'pointer', userSelect: 'none' }}>Detalles técnicos</summary>
              <pre style={{
                marginTop: 8, padding: 10, borderRadius: 8,
                background: 'rgba(255,255,255,0.04)', overflow: 'auto',
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: 11, lineHeight: 1.4, maxHeight: 160,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>{String(this.state.error?.message || this.state.error)}</pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}

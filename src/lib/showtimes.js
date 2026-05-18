/**
 * openShowtimes(title) — abre la búsqueda de Google "sesiones cerca de mí"
 * para la peli. NO pedimos geolocalización; Google la deduce por IP/cuenta.
 *
 * Para evitar perder al usuario en PWA iOS (donde `window.open` a veces
 * navega DENTRO del standalone en lugar de abrir Safari), disparamos la
 * apertura vía un <a target="_blank" rel="noopener noreferrer"> y lo
 * pulsamos sintéticamente. Las navegaciones iniciadas por anchor se
 * respetan como contexto nuevo en todos los navegadores y PWAs:
 *   - PWA standalone iOS/Android → abre en el navegador del sistema
 *   - Browser tab               → abre nueva pestaña
 *   - Desktop                    → abre nueva ventana/pestaña
 *
 * Si por la razón que sea el click de anchor no funciona (ej. extensión
 * agresiva), caemos a window.open + clipboard como red de seguridad.
 */
export function openShowtimes(title) {
  const q = `${title || ''} sesiones cerca de mí`;
  const url = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  try {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.position = 'fixed';
    a.style.opacity = '0';
    a.style.pointerEvents = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  } catch { /* fall through */ }
  try {
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (w) return;
  } catch {}
  // Último recurso: copia el enlace para que el usuario lo pegue.
  try { navigator.clipboard?.writeText(url); } catch {}
}

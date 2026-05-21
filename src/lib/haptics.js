// Native haptics for the Capacitor app. No-ops on the web.
// Per-button customization: add a `data-haptic` attribute to any element:
//   data-haptic="light" | "medium" | "heavy" | "selection" | "success"
//                | "warning" | "error" | "off"
// Any button/link without the attribute gets a light tap by default.
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

const isNative = !!(Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());

export function impact(style = 'light') {
  if (!isNative) return;
  const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
  Haptics.impact({ style: map[style] || ImpactStyle.Light }).catch(() => {});
}

export function notify(type = 'success') {
  if (!isNative) return;
  const map = { success: NotificationType.Success, warning: NotificationType.Warning, error: NotificationType.Error };
  Haptics.notification({ type: map[type] || NotificationType.Success }).catch(() => {});
}

export function selection() {
  if (!isNative) return;
  Haptics.selectionStart().then(() => Haptics.selectionChanged()).then(() => Haptics.selectionEnd()).catch(() => {});
}

/** Resolve the right feedback for a data-haptic token. */
function fire(token) {
  switch (token) {
    case 'off': return;
    case 'selection': return selection();
    case 'medium':
    case 'heavy':
    case 'light': return impact(token);
    case 'success':
    case 'warning':
    case 'error': return notify(token);
    // Default for any button/link: a dry, sharp "clop" — the medium impact
    // reads as a quality click (sharper onset than selection's soft tick).
    default: return impact('medium');
  }
}

let installed = false;
/** Delegated tap haptics on every actionable element. Call once at startup. */
export function installGlobalHaptics() {
  if (!isNative || installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener(
    'pointerdown',
    (e) => {
      const t = e.target;
      const el = t && t.closest ? t.closest('button, a, [role="button"], [data-haptic]') : null;
      if (!el) return;
      fire(el.getAttribute('data-haptic') || 'light');
    },
    { capture: true, passive: true },
  );
}

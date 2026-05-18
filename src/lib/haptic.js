// Haptic feedback wrapper around the Vibration API.
// - Silent no-op on iOS (no Vibration API in Safari/WKWebView).
// - Silent no-op when the user has opted out via Profile toggle.
// - Throttled to avoid bursting the queue on rapid swipes.
//
// Usage: import haptic from '@/lib/haptic'; haptic.light();

const STORAGE_KEY = 'flickpick.haptic.v1';
const THROTTLE_MS = 30;

let lastFire = 0;

function supported() {
  if (typeof navigator === 'undefined') return false;
  return typeof navigator.vibrate === 'function';
}

export function isHapticSupported() {
  return supported();
}

export function isHapticEnabled() {
  if (!supported()) return false;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === null ? true : v === '1';
  } catch {
    return true;
  }
}

export function setHapticEnabled(on) {
  try { localStorage.setItem(STORAGE_KEY, on ? '1' : '0'); } catch {}
  // Cross-device sync (lazy import avoids cycles in tests)
  try {
    import('@/lib/userSync').then(({ userSync }) => userSync.haptic(on)).catch(() => {});
  } catch {}
}

function fire(pattern) {
  if (!isHapticEnabled()) return;
  const now = Date.now();
  if (now - lastFire < THROTTLE_MS) return;
  lastFire = now;
  try { navigator.vibrate(pattern); } catch {}
}

const haptic = {
  // Subtle confirmation — UI taps, swipe commits, toggles.
  light: () => fire(10),
  // Medium — primary CTA presses, sheet opens.
  medium: () => fire(20),
  // Heavier — destructive actions, errors.
  heavy: () => fire(35),
  // Success burst — short positive double-tap.
  success: () => fire([15, 50, 25]),
  // Match — the moment of truth: triple ping + final pulse.
  match: () => fire([18, 60, 18, 60, 40]),
  // Error — long single buzz.
  error: () => fire([60, 30, 60]),
  // Cancel any active vibration immediately.
  stop: () => { try { navigator.vibrate?.(0); } catch {} },
};

export default haptic;

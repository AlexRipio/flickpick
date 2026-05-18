/**
 * Web Push subscribe / unsubscribe helpers.
 * UI in Profile invokes these. SW handles the actual `push` event
 * (see public/push-handler.js).
 */

import { apiFetch } from '@/lib/api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) out[i] = rawData.charCodeAt(i);
  return out;
}

export function pushSupported() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

export async function getPushPermission() {
  if (!pushSupported()) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

export async function isPushSubscribed() {
  if (!pushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch { return false; }
}

export async function subscribePush() {
  if (!pushSupported()) throw new Error('Tu navegador no soporta notificaciones push.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Permiso denegado.');
  const reg = await navigator.serviceWorker.ready;

  // Get the public VAPID key from backend.
  const { publicKey } = await apiFetch('/push/vapid-public-key');
  if (!publicKey) throw new Error('Push no configurado en servidor.');

  // Reuse existing subscription if any (idempotent).
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  // POST to backend (idempotent — ON CONFLICT DO UPDATE).
  await apiFetch('/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({
      endpoint: sub.endpoint,
      keys: {
        p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))),
        auth:   btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))),
      },
      userAgent: navigator.userAgent || '',
    }),
  });
  return true;
}

export async function unsubscribePush() {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    try { await apiFetch('/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint: sub.endpoint }) }); } catch {}
    await sub.unsubscribe();
  } catch {}
}

export async function sendTestPush() {
  return apiFetch('/push/test', { method: 'POST' });
}

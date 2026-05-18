// Auto-update — silent service-worker refresh.
//
// vite-plugin-pwa is configured with `registerType: 'autoUpdate'`
// (skipWaiting + clientsClaim), so a fresh SW activates as soon as it
// finishes downloading. But the *page* still runs the old JS bundle
// until it reloads. This module triggers that reload silently so users
// see new versions without having to clear data or reinstall the PWA.
//
// Strategy:
//   1. controllerchange → window.location.reload() (URL preserved).
//   2. While the tab is foreground, poll /sw.js every 60s so the
//      browser picks up new releases even if the user never navigates.
//   3. Also poll once on every visibility-change → visible (great for
//      installed PWAs that sit minimized for hours).

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  navigator.serviceWorker.ready
    .then((registration) => {
      const tryUpdate = () => {
        if (document.visibilityState !== 'visible') return;
        registration.update().catch(() => {});
      };
      // Periodic foreground poll.
      setInterval(tryUpdate, 60_000);
      // Immediate poll whenever the user comes back to the app.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') tryUpdate();
      });
    })
    .catch(() => {});
}

// FlickPick — App version & release notes
//
// Cuando salga una feature grande (no bug fix), bumpea APP_VERSION
// y añade una entry nueva al principio del array RELEASE_NOTES.
// El UpdatesModal compara la versión guardada en localStorage con la
// actual y se muestra automáticamente cuando hay una nueva.

export const APP_VERSION = '1.0.1';

const STORAGE_KEY = 'flickpick.updates.lastSeen';
const STORAGE_KEY_PREFIX = 'flickpick.updates.lastSeen.';

// Cada entrada describe UNA versión. La última publicada va arriba.
// Solo se muestra al usuario la entrada cuya version === APP_VERSION.
export const RELEASE_NOTES = [
  {
    version: '1.0.1',
    releaseLabel: 'Mayo 2026',
    headline: 'Tu cine, tus reglas',
    subline: 'Hemos añadido lo que faltaba para cerrar la guerra del mando: cartelera real cerca de ti y un Top 10 a tu medida.',
    features: [
      {
        id: 'cinemas',
        icon: 'popcorn',
        tint: '#FFB547',
        title: 'En cines cerca de ti',
        body: 'Al crear una sala, elige "En cines" y tu ubicación te sugiere el cine más cercano. Swipea la cartelera real del día y mira los horarios disponibles. Solo en España (23 ciudades).',
        badge: 'BETA',
      },
      {
        id: 'top10',
        icon: 'reorder',
        tint: '#FF3B6B',
        title: 'Top 10 a tu medida',
        body: 'Arrastra y reordena el Top 10 de cada plataforma. Tus prioridades, no las del algoritmo.',
        badge: 'NUEVO',
      },
    ],
    footnote: 'También: rendimiento de salas mejorado, fix de sincronización al unirse por código y soporte responsive en iPhone con Dynamic Island.',
    ctaCopy: 'Empezar a flickear',
    secondaryCopy: 'Quizás luego',
  },
];

export function getCurrentReleaseNotes() {
  return RELEASE_NOTES.find(n => n.version === APP_VERSION) || null;
}

// semver-lite: "1.10.0" > "1.2.5" → true
// Si b (lastSeen) está vacío → true (nunca lo vio, hay que mostrarlo).
// Si a (APP_VERSION) está vacío → false (no debería pasar).
function semverGt(a, b) {
  if (!a) return false;
  if (!b) return true;
  const pa = String(a).split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

// Per-profile persistence: cada cuenta lleva su propio "lastSeen" para que
// si varios usuarios comparten navegador, cada uno vea las novedades una vez.
// Si no hay profileId, fallback a la clave global (legacy).
export function shouldShowUpdates(profileId) {
  try {
    const key = profileId ? STORAGE_KEY_PREFIX + profileId : STORAGE_KEY;
    const last = localStorage.getItem(key);
    return semverGt(APP_VERSION, last);
  } catch { return false; }
}

export function markUpdatesSeen(profileId) {
  try {
    const key = profileId ? STORAGE_KEY_PREFIX + profileId : STORAGE_KEY;
    localStorage.setItem(key, APP_VERSION);
  } catch {}
  // Cross-device sync
  try {
    import('@/lib/userSync').then(({ userSync }) => userSync.updatesLastSeen(APP_VERSION)).catch(() => {});
  } catch {}
}

export function resetUpdatesSeen(profileId) {
  try {
    const key = profileId ? STORAGE_KEY_PREFIX + profileId : STORAGE_KEY;
    localStorage.removeItem(key);
  } catch {}
}

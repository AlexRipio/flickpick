/**
 * Vibes (mood) → TMDB genre id mapping.
 * Used in CreateRoomScreen + MovieSwiper to filter the swipe pool by mood.
 *
 * Keep at ≤8 vibes. Each vibe maps to 1-3 TMDB genres.
 */
/**
 * Cada vibe define géneros TMDB ESTRICTOS:
 *  - core:   debe tener AL MENOS UNO. Es la firma del estilo.
 *  - exclude (opcional): si la peli tiene cualquiera de éstos, NO encaja
 *    aunque cumpla un core (evita p.ej. que una acción etiquetada thriller
 *    aparezca en "sustos").
 */
/**
 * Vibes ESTRICTAS:
 *  - core:   géneros TMDB (al menos uno).
 *  - exclude: si la peli tiene cualquiera, NO encaja.
 *  - keyword (opcional): TMDB keyword id para discover paralelo.
 *  - anime (flag): identifica el vibe especial Anime.
 *
 * Anime se trata aparte: los anime NUNCA salen en las demás categorías.
 * "Animación" cubre solo animación occidental (Pixar, DreamWorks, etc.).
 */
export const VIBES = [
  { id: 'risas',     emoji: '😂',  label: 'Comedia',   core: [35],          exclude: [27] },
  { id: 'sustos',    emoji: '😱',  label: 'Terror',    core: [27],          exclude: [10751, 16, 35] },
  { id: 'romance',   emoji: '❤️',  label: 'Romance',   core: [10749],       exclude: [27] },
  { id: 'accion',    emoji: '💥',  label: 'Acción',    core: [28, 12],      exclude: [27, 10751, 99] },
  { id: 'mente',     emoji: '🧠',  label: 'Thriller',  core: [53],          exclude: [10751, 16, 35] },
  { id: 'familiar',  emoji: '👨‍👩‍👧', label: 'Familiar', core: [10751, 16],   exclude: [27, 53, 80] },
  { id: 'scifi',     emoji: '🚀',  label: 'Sci-Fi',    core: [878, 14],     exclude: [27] },
  { id: 'animacion', emoji: '✨',  label: 'Animación', core: [16],          exclude: [27] },
  { id: 'anime',     emoji: '🌸',  label: 'Anime',     core: [],            exclude: [], keyword: 210024, anime: true },
  { id: 'drama',     emoji: '🎭',  label: 'Drama',     core: [18],          exclude: [27, 16] },
  { id: 'crimen',    emoji: '🕵️',  label: 'Crimen',    core: [80],          exclude: [10751, 16, 35] },
  { id: 'documental',emoji: '🎬',  label: 'Documental',core: [99],          exclude: [] },
];

const ANIME_KEYWORD = 210024;
const ANIMATION_GENRE = 16;

/** True si la peli es anime: idioma original japonés + animación,
 *  o trae el keyword anime de TMDB. */
export function isAnime(movie) {
  if (!movie) return false;
  const ids = movie.genre_ids || [];
  if (movie.original_language === 'ja' && ids.includes(ANIMATION_GENRE)) return true;
  // Algunos endpoints incluyen keyword_ids; otros no.
  if (Array.isArray(movie.keyword_ids) && movie.keyword_ids.includes(ANIME_KEYWORD)) return true;
  return false;
}

export const MAX_VIBES = 3;

/** Géneros CORE para discover (anime no aporta género — va por keyword). */
export function vibeCoreGenres(vibeIds = []) {
  const set = new Set();
  for (const v of VIBES) {
    if (!vibeIds.includes(v.id) || v.anime) continue;
    v.core.forEach(g => set.add(g));
  }
  return [...set];
}

/** Géneros a excluir en discover. */
export function vibeExcludeGenres(vibeIds = []) {
  const set = new Set();
  for (const v of VIBES) if (vibeIds.includes(v.id)) (v.exclude || []).forEach(g => set.add(g));
  return [...set];
}

/** Keywords para discover paralelo (anime → 210024). */
export function vibeKeywordIds(vibeIds = []) {
  const set = new Set();
  for (const v of VIBES) if (vibeIds.includes(v.id) && v.keyword) set.add(v.keyword);
  return [...set];
}

/**
 * Matcher estricto. Reglas:
 *   - Si NO se pidió 'anime', cualquier peli que sea anime se descarta
 *     (incluso si encaja con "Animación" u otra vibe).
 *   - Si SÍ se pidió 'anime' y la peli es anime → match directo.
 *   - Para no-anime, debe satisfacer el core de al menos una vibe NO-anime
 *     y no caer en su exclude.
 *   - "Animación" exige género 16 Y que no sea anime.
 */
export function movieMatchesVibes(movie, vibeIds = []) {
  if (!vibeIds.length) return true;
  const ids = movie?.genre_ids || [];
  if (!ids.length) return false;

  const wantAnime = vibeIds.includes('anime');
  const isA = isAnime(movie);

  if (!wantAnime && isA) return false;
  if (wantAnime && isA)  return true;

  const excluded = new Set(vibeExcludeGenres(vibeIds));
  if (ids.some(g => excluded.has(g))) return false;

  for (const v of VIBES) {
    if (!vibeIds.includes(v.id) || v.anime) continue;
    if (v.id === 'animacion') {
      if (ids.includes(ANIMATION_GENRE) && !isA) return true;
      continue;
    }
    if (ids.some(g => v.core.includes(g))) return true;
  }
  return false;
}

export function vibeLabels(vibeIds = []) {
  return VIBES.filter(v => vibeIds.includes(v.id)).map(v => v.label);
}

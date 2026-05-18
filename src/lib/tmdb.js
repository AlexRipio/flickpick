// Calls go through our backend proxy (api.js conventions). The backend adds
// the TMDB API key server-side so it never ships in the bundle.
const BASE = (import.meta.env.VITE_API_URL || 'https://flickpick.mov/api') + '/tmdb';
const LANG = "es-ES";
const REGION = "ES";

export const PROVIDERS = {
  netflix:  { id: 8,    name: "Netflix" },
  prime:    { id: 119,  name: "Prime Video" },
  max:      { id: 1899, name: "Max" },
  disney:   { id: 337,  name: "Disney+" },
  apple:    { id: 350,  name: "Apple TV+" },
  // Secundarias (ES) — logos verificados en Top10Sections
  movistar: { id: 2241, name: "Movistar+" },
  filmin:   { id: 63,   name: "Filmin" },
};

const memo = new Map();
async function tmdb(path, params = {}) {
  const qs = new URLSearchParams({ language: LANG, ...params }).toString();
  const key = `${path}?${qs}`;
  if (memo.has(key)) return memo.get(key);
  const res = await fetch(`${BASE}${path}?${qs}`);
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${path}`);
  const json = await res.json();
  memo.set(key, json);
  return json;
}

let GENRES_CACHE = null;
export async function getGenres() {
  if (GENRES_CACHE) return GENRES_CACHE;
  const j = await tmdb("/genre/movie/list");
  GENRES_CACHE = Object.fromEntries((j.genres || []).map(g => [g.id, g.name]));
  return GENRES_CACHE;
}

export async function discoverMovies({ providerIds = [], genreIds = [], excludeGenreIds = [], keywordIds = [], yearFrom, yearTo, page = 1, sortBy = "popularity.desc", excludeIds = new Set() } = {}) {
  const params = {
    region: REGION,
    watch_region: REGION,
    sort_by: sortBy,
    include_adult: "false",
    "vote_count.gte": "50",
    page: String(page),
  };
  if (providerIds.length) {
    params.with_watch_providers = providerIds.join("|");
    params.with_watch_monetization_types = "flatrate|ads|free";
  }
  if (genreIds.length)        params.with_genres        = genreIds.join("|");
  if (excludeGenreIds.length) params.without_genres     = excludeGenreIds.join(",");
  if (keywordIds.length)      params.with_keywords      = keywordIds.join("|");
  if (yearFrom) params["primary_release_date.gte"] = `${yearFrom}-01-01`;
  if (yearTo) params["primary_release_date.lte"] = `${yearTo}-12-31`;
  const j = await tmdb("/discover/movie", params);
  return (j.results || []).filter(m => m.poster_path && !excludeIds.has(m.id));
}

export async function getTrending({ timeWindow = "week", page = 1, excludeIds = new Set() } = {}) {
  const j = await tmdb(`/trending/movie/${timeWindow}`, { page: String(page) });
  return (j.results || []).filter(m => m.poster_path && !excludeIds.has(m.id));
}

export async function getNowPlaying({ page = 1, excludeIds = new Set() } = {}) {
  // Usamos discover/movie en lugar de /now_playing porque este último a veces
  // incluye películas con un registro teatral mínimo aunque ya estén en streaming.
  // Doble filtro: with_release_type=3|2 (estreno teatral) + without_watch_monetization_types=flatrate
  // (excluye las que están en Netflix, Prime, etc. en España).
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const from = new Date(today);
  from.setDate(from.getDate() - 75); // ventana de 75 días para largometrajes en cartel
  const fromStr = from.toISOString().slice(0, 10);
  const j = await tmdb("/discover/movie", {
    sort_by: 'popularity.desc',
    include_adult: 'false',
    region: REGION,
    watch_region: REGION,
    'with_release_type': '3|2',
    'primary_release_date.gte': fromStr,
    'primary_release_date.lte': todayStr,
    without_watch_monetization_types: 'flatrate',
    page: String(page),
  });
  return (j.results || []).filter(m => m.poster_path && !excludeIds.has(m.id));
}

export async function getUpcoming({ page = 1, excludeIds = new Set() } = {}) {
  const j = await tmdb("/movie/upcoming", { region: REGION, page: String(page) });
  return (j.results || []).filter(m => m.poster_path && !excludeIds.has(m.id));
}

// Generic discover wrapper driven by the FiltersSheet. Combines genre,
// year range, original language, minimum rating, platform and sort order
// into a single TMDB request. `dateBoundary` is { gte?, lte? } in
// YYYY-MM-DD; used by callers to restrict to released-only / upcoming-only.
export async function discoverWithFilters({
  mediaType = 'movie', page = 1,
  genres = [], yearFrom = null, yearTo = null,
  language = null, minRating = 0,
  platformId = null,
  sortBy = 'popularity.desc',
  dateBoundary = {},
  cinemaOnly = false,
  excludeIds = new Set(),
} = {}) {
  const params = {
    sort_by: sortBy, include_adult: 'false',
    page: String(page),
  };
  if (cinemaOnly) {
    params.region = REGION;
    params.with_release_type = '3|2';
  }
  if (genres.length) params.with_genres = genres.join(',');
  if (language) params.with_original_language = language;
  if (minRating > 0) {
    params['vote_average.gte'] = String(minRating);
    params['vote_count.gte'] = '50';
  } else {
    params['vote_count.gte'] = mediaType === 'tv' ? '20' : '40';
  }
  if (platformId) {
    params.watch_region = REGION;
    params.with_watch_providers = String(platformId);
    params.with_watch_monetization_types = 'flatrate|ads|free';
  }
  const dateField = mediaType === 'movie' ? 'primary_release_date' : 'first_air_date';
  if (yearFrom) params[`${dateField}.gte`] = `${yearFrom}-01-01`;
  if (yearTo)   params[`${dateField}.lte`] = `${yearTo}-12-31`;
  if (dateBoundary.gte) params[`${dateField}.gte`] = dateBoundary.gte;
  if (dateBoundary.lte) params[`${dateField}.lte`] = dateBoundary.lte;
  const j = await tmdb(`/discover/${mediaType}`, params);
  return (j.results || []).filter(m => m.poster_path && !excludeIds.has(m.id));
}

// Cinema releases from today up to a given end-date (YYYY-MM-DD).
// Used for Cartelera/Próximamente to scope the list to the current year.
export async function getCinemaUpcomingRange({ page = 1, fromDate, toDate, excludeIds = new Set() } = {}) {
  const params = {
    region: REGION, watch_region: REGION,
    sort_by: 'popularity.desc',
    'with_release_type': '3|2',
    // Excluir películas ya disponibles en streaming flatrate (Netflix, Disney+...).
    // Sin esta línea TMDB devuelve cualquier peli con release_type cine,
    // incluyendo las que ya están en plataformas. (Bug "streaming en En cines")
    without_watch_monetization_types: 'flatrate',
    include_adult: 'false',
    page: String(page),
  };
  if (fromDate) params['primary_release_date.gte'] = fromDate;
  if (toDate)   params['primary_release_date.lte'] = toDate;
  const j = await tmdb('/discover/movie', params);
  return (j.results || []).filter(m => m.poster_path && !excludeIds.has(m.id));
}

// Returns the air date (YYYY-MM-DD) of the *latest* season of a TV show —
// not the show's first-air date. Useful for "last season released" labelling.
// Skips season 0 (specials). Falls back to last_air_date or first_air_date.
export async function getLatestSeasonAirDate(tvId) {
  try {
    const j = await tmdb(`/tv/${tvId}`, {});
    const seasons = (j.seasons || []).filter(s => s && s.season_number > 0 && s.air_date);
    if (seasons.length) {
      seasons.sort((a, b) => b.season_number - a.season_number);
      return seasons[0].air_date.slice(0, 10);
    }
    if (j.next_episode_to_air?.air_date) return j.next_episode_to_air.air_date.slice(0, 10);
    if (j.last_air_date) return j.last_air_date.slice(0, 10);
    if (j.first_air_date) return j.first_air_date.slice(0, 10);
    return null;
  } catch { return null; }
}

// TMDB has no /tv/upcoming. Approximate via discover/tv ordered by popularity
// with first_air_date in the future. Returns shows that haven't premiered yet.
// Top of what's actually streaming on platforms in the user's region —
// sorted by popularity, restricted to flatrate/ads/free monetization.
// Works for both movies (mediaType='movie') and TV (mediaType='tv').
export async function discoverPopularOnPlatforms({ mediaType = 'movie', page = 1, excludeIds = new Set(), genreIds = [] } = {}) {
  const params = {
    sort_by: 'popularity.desc', include_adult: 'false',
    watch_region: REGION, region: REGION,
    with_watch_monetization_types: 'flatrate|ads|free',
    'vote_count.gte': mediaType === 'tv' ? '20' : '50',
    page: String(page),
  };
  if (genreIds.length) params.with_genres = genreIds.join(',');
  const j = await tmdb(`/discover/${mediaType}`, params);
  return (j.results || []).filter(m => m.poster_path && !excludeIds.has(m.id));
}

// Upcoming titles — premieres in the future — sorted by critic score.
// vote_count.gte filter keeps only items with enough early reviews so
// 0.0 placeholders don't dominate the top of the list.
// Upcoming titles — premieres in the future. Returns popularity-sorted
// raw results so the caller has enough volume; final ranking by critic
// score is applied client-side. No vote_count filter so freshly-announced
// titles aren't excluded — there are typically too few rated upcomings to
// reach 50 otherwise.
export async function discoverUpcoming({ mediaType = 'movie', page = 1, excludeIds = new Set(), genreIds = [], digitalOnly = false } = {}) {
  const today = new Date();
  const ymd = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const dateField = mediaType === 'movie' ? 'primary_release_date' : 'first_air_date';
  const params = {
    sort_by: 'popularity.desc', include_adult: 'false',
    [`${dateField}.gte`]: ymd,
    page: String(page),
  };
  if (genreIds.length) params.with_genres = genreIds.join(',');
  if (digitalOnly) {
    // Bias toward titles already tagged with a streaming platform release
    // in the user's region (Netflix Originals, Prime Originals, etc.).
    params.watch_region = REGION;
    params.with_watch_monetization_types = 'flatrate|ads|free';
  }
  const j = await tmdb(`/discover/${mediaType}`, params);
  return (j.results || []).filter(m => m.poster_path && !excludeIds.has(m.id));
}

export async function getUpcomingTV({ page = 1, excludeIds = new Set() } = {}) {
  const today = new Date();
  const ymd = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const params = {
    sort_by: 'popularity.desc', include_adult: 'false',
    'vote_count.gte': '0', page: String(page),
    'first_air_date.gte': ymd,
  };
  const j = await tmdb('/discover/tv', params);
  return (j.results || []).filter(m => m.poster_path && !excludeIds.has(m.id));
}

export async function getSimilar(movieId, { page = 1, excludeIds = new Set() } = {}) {
  const j = await tmdb(`/movie/${movieId}/recommendations`, { page: String(page) });
  return (j.results || []).filter(m => m.poster_path && !excludeIds.has(m.id));
}

export async function getMovieDetails(movieId) {
  return tmdb(`/movie/${movieId}`, { append_to_response: "watch/providers,credits,keywords" });
}

export async function getTVDetails(tvId) {
  return tmdb(`/tv/${tvId}`, { append_to_response: "watch/providers,credits,keywords" });
}

export async function getDetails(id, mediaType = 'movie') {
  return mediaType === 'tv' ? getTVDetails(id) : getMovieDetails(id);
}

// Maps TMDB-provider variants (ad-supported tiers, channel resellers) to a
// canonical name so the UI only shows one logo per actual platform.
const PROVIDER_CANONICAL = {
  'Netflix Standard With Ads': 'Netflix',
  'Netflix basic with Ads': 'Netflix',
  'Amazon Video': 'Amazon Prime Video',
  'Prime Video': 'Amazon Prime Video',
  'Prime Video with Ads': 'Amazon Prime Video',
  'HBO Max Amazon Channel': 'Max',
  'HBO Max': 'Max',
  'Apple TV Amazon Channel': 'Apple TV',
  'Apple TV Plus Amazon Channel': 'Apple TV',
  'Apple TV Plus': 'Apple TV',
  'Apple TV+': 'Apple TV',
  'Movistar Plus+ Ficción Total': 'Movistar Plus+',
  'Disney Plus': 'Disney+',
};

// Patterns that mark an entry as a "secondary tier" (ad-supported variant
// or third-party reseller channel). We never want these in the UI — the
// user only cares about the main app for the platform.
const VARIANT_PATTERNS = [
  /with ads/i,
  /standard with ads/i,
  /basic with ads/i,
  /\bamazon channel\b/i,
  /\bapple tv channel\b/i,
  /\broku channel\b/i,
  /\bvia\b/i,
];

function isVariant(name) {
  return VARIANT_PATTERNS.some(rx => rx.test(name || ''));
}

export function dedupeProviders(list) {
  // 1) Drop variant tiers / reseller channels outright.
  const cleaned = (list || []).filter(p => !isVariant(p.provider_name));
  // 2) Collapse remaining entries by canonical name, preferring the entry
  //    whose own name already matches the canonical platform.
  const byCanon = new Map();
  for (const p of cleaned) {
    const canon = PROVIDER_CANONICAL[p.provider_name] || p.provider_name;
    const isCanonical = p.provider_name === canon;
    const existing = byCanon.get(canon);
    if (!existing || (isCanonical && !existing.isCanonical)) {
      byCanon.set(canon, { entry: p, isCanonical });
    }
  }
  return Array.from(byCanon.values()).map(v => ({
    ...v.entry,
    provider_name: PROVIDER_CANONICAL[v.entry.provider_name] || v.entry.provider_name,
  }));
}

// Returns the broadcast networks of a TV show as provider-shaped entries.
// Used as a fallback for upcoming series where TMDB hasn't yet populated
// /watch/providers but the network is already announced (Netflix Originals,
// HBO, Disney+ Originals, etc.). Network names are mapped to their canonical
// platform so logos match the rest of the UI.
const NETWORK_TO_PLATFORM = {
  'Netflix': { name: 'Netflix' },
  'HBO': { name: 'Max' },
  'HBO Max': { name: 'Max' },
  'Max': { name: 'Max' },
  'Disney+': { name: 'Disney+' },
  'Disney Plus': { name: 'Disney+' },
  'Apple TV+': { name: 'Apple TV' },
  'Apple TV Plus': { name: 'Apple TV' },
  'Amazon': { name: 'Amazon Prime Video' },
  'Prime Video': { name: 'Amazon Prime Video' },
  'Amazon Prime Video': { name: 'Amazon Prime Video' },
  'Movistar Plus+': { name: 'Movistar Plus+' },
  'Movistar+': { name: 'Movistar Plus+' },
  'SkyShowtime': { name: 'SkyShowtime' },
  'Paramount+': { name: 'Paramount+' },
  'Paramount Plus': { name: 'Paramount+' },
  'Filmin': { name: 'Filmin' },
  'Atresplayer': { name: 'Atresplayer' },
  'Pluto TV': { name: 'Pluto TV' },
};

// Production-company → streaming-platform mapping. Used as a fallback for
// upcoming films where /watch/providers is still empty: when the producer
// is a streaming studio's first-party label, we surface that platform's
// logo as the destination. Only includes companies whose presence
// unambiguously implies a platform release (no "Walt Disney Pictures" —
// that one ships theatrical too).
const COMPANY_TO_PLATFORM = {
  // Netflix
  'Netflix': { name: 'Netflix', logo: '/wwemzKWzjKYJFfCeiB57q3r4Bcm.svg' },
  'Netflix Studios': { name: 'Netflix', logo: '/wwemzKWzjKYJFfCeiB57q3r4Bcm.svg' },
  'Netflix International Pictures': { name: 'Netflix', logo: '/wwemzKWzjKYJFfCeiB57q3r4Bcm.svg' },
  'Netflix Animation': { name: 'Netflix', logo: '/wwemzKWzjKYJFfCeiB57q3r4Bcm.svg' },
  // Amazon
  'Amazon Studios': { name: 'Amazon Prime Video', logo: '/emthp39XA2YScoYL1p0sdbAH2WA.jpg' },
  'Amazon MGM Studios': { name: 'Amazon Prime Video', logo: '/emthp39XA2YScoYL1p0sdbAH2WA.jpg' },
  'Prime Video': { name: 'Amazon Prime Video', logo: '/emthp39XA2YScoYL1p0sdbAH2WA.jpg' },
  // Apple
  'Apple Studios': { name: 'Apple TV', logo: '/peURlLlr8jggOwK53fJ5wdQl05y.jpg' },
  'Apple Original Films': { name: 'Apple TV', logo: '/peURlLlr8jggOwK53fJ5wdQl05y.jpg' },
  'Apple TV+': { name: 'Apple TV', logo: '/peURlLlr8jggOwK53fJ5wdQl05y.jpg' },
  // Hulu / Max / Paramount+ / Disney+ (originals only)
  'Hulu Originals': { name: 'Hulu', logo: '/giwM8XX4V2AQb9vsoN7yti82tKK.jpg' },
  'HBO Max': { name: 'Max', logo: '/Ajqyt5aNxNGjmF9uOfxArGrdf3X.jpg' },
  'Max Originals': { name: 'Max', logo: '/Ajqyt5aNxNGjmF9uOfxArGrdf3X.jpg' },
  'Paramount+': { name: 'Paramount+', logo: '/h5DcR0J2EESLitnhR8xLG1QymTE.jpg' },
};

// Returns provider-shaped entries derived from a movie's production
// companies, or [] when nothing matches.
export async function getStreamingFromCompanies(id) {
  try {
    const j = await tmdb(`/movie/${id}`, {});
    const companies = j.production_companies || [];
    const seen = new Set();
    const out = [];
    for (const c of companies) {
      const m = COMPANY_TO_PLATFORM[c.name];
      if (!m || seen.has(m.name)) continue;
      seen.add(m.name);
      out.push({
        provider_id: `company-${c.id}`,
        provider_name: m.name,
        logo_path: m.logo,
      });
    }
    return out;
  } catch { return []; }
}

export async function getTVNetworks(id) {
  try {
    const j = await tmdb(`/tv/${id}`, {});
    const out = [];
    const seenName = new Set();
    for (const n of (j.networks || [])) {
      if (!n.logo_path) continue;
      const canon = NETWORK_TO_PLATFORM[n.name]?.name || n.name;
      if (seenName.has(canon)) continue;
      seenName.add(canon);
      out.push({
        provider_id: `network-${n.id}`,
        provider_name: canon,
        logo_path: n.logo_path,
      });
    }
    return out;
  } catch { return []; }
}

// Lightweight watch/providers fetch per item (ES → US fallback).
// Returns a deduped `flatrate` array — variant tiers like "Netflix With Ads"
// or reseller channels like "Apple TV Amazon Channel" are collapsed into the
// main platform so each logo appears at most once. For TV shows that have
// no flatrate entry yet (typical for unannounced or upcoming seasons),
// falls back to the show's broadcast networks.
export async function getWatchProvidersFlatrate(id, mediaType = 'movie') {
  try {
    const j = await tmdb(`/${mediaType}/${id}/watch/providers`, {});
    const r = j.results?.ES || j.results?.US || null;
    let list = dedupeProviders(r?.flatrate || []);
    // Movies: when no flatrate is registered yet (typical for upcoming
    // streaming originals), look at the production_companies — a clear
    // first-party label like "Netflix Studios" or "Amazon MGM Studios"
    // is a strong signal of where the film will premiere.
    if (mediaType === 'movie' && list.length === 0) {
      list = await getStreamingFromCompanies(id);
    }
    return list;
  } catch {
    return [];
  }
}

// Resolve the device's region from the browser locale (e.g. "es-ES" → "ES").
// Falls back to "ES" since the app targets Spain primarily.
export function userRegion() {
  try {
    const langs = (navigator.languages && navigator.languages.length)
      ? navigator.languages
      : [navigator.language || 'es-ES'];
    for (const l of langs) {
      const m = l && l.match(/-([A-Z]{2})/i);
      if (m) return m[1].toUpperCase();
    }
    return 'ES';
  } catch { return 'ES'; }
}

// Region-specific theatrical release date (YYYY-MM-DD) or null.
// Strict preference: type 3 (theatrical wide) → type 2 (theatrical limited).
// Premieres (type 1) and digital/physical releases are skipped because they
// don't reflect the actual cinema release the user asks about. If the
// requested region has no entry at all we return null and let the caller
// fall back to the movie's global release_date.
export async function getReleaseDateForRegion(id, region = 'ES') {
  try {
    const j = await tmdb(`/movie/${id}/release_dates`, {});
    const entry = (j.results || []).find(r => r.iso_3166_1 === region);
    const list = entry?.release_dates || [];
    const pick = (typeWanted) => {
      const matches = list
        .filter(r => r.type === typeWanted && r.release_date)
        .map(r => r.release_date.slice(0, 10))
        .sort();
      return matches[0] || null;
    };
    return pick(3) || pick(2) || null;
  } catch {
    return null;
  }
}

export function posterUrl(path, size = "w780") {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

export function platformIdsFromKeys(keys = []) {
  return keys.filter(k => PROVIDERS[k]).map(k => PROVIDERS[k].id);
}

export async function getMoviesByGenre({ genreIds = [], page = 1, excludeIds = new Set() } = {}) {
  if (!genreIds.length) return getTrending({ page, excludeIds });
  const params = {
    sort_by: 'popularity.desc', include_adult: 'false',
    'vote_count.gte': '80', page: String(page),
    with_genres: genreIds.join(','),
  };
  const j = await tmdb('/discover/movie', params);
  return (j.results || []).filter(m => m.poster_path && !excludeIds.has(m.id));
}

export async function getTVByGenre({ genreIds = [], page = 1, excludeIds = new Set() } = {}) {
  if (!genreIds.length) return getTrendingTV({ page, excludeIds });
  const params = {
    sort_by: 'popularity.desc', include_adult: 'false',
    'vote_count.gte': '20', page: String(page),
    with_genres: genreIds.join(','),
  };
  const j = await tmdb('/discover/tv', params);
  return (j.results || []).filter(m => m.poster_path && !excludeIds.has(m.id));
}

export function backdropUrl(path, size = 'w780') {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

export async function getTrendingTV({ timeWindow = "week", page = 1, excludeIds = new Set() } = {}) {
  const j = await tmdb(`/trending/tv/${timeWindow}`, { page: String(page) });
  return (j.results || []).filter(m => m.poster_path && !excludeIds.has(m.id));
}

export async function discoverTV({ providerIds = [], genreIds = [], excludeGenreIds = [], keywordIds = [], yearFrom, yearTo, page = 1, excludeIds = new Set() } = {}) {
  const params = {
    region: REGION, watch_region: REGION,
    sort_by: 'popularity.desc', include_adult: 'false',
    'vote_count.gte': '20', page: String(page),
  };
  if (providerIds.length) { params.with_watch_providers = providerIds.join('|'); params.with_watch_monetization_types = 'flatrate|ads|free'; }
  if (genreIds.length)        params.with_genres    = genreIds.join('|');
  if (excludeGenreIds.length) params.without_genres = excludeGenreIds.join(',');
  if (keywordIds.length)      params.with_keywords  = keywordIds.join('|');
  if (yearFrom) params['first_air_date.gte'] = `${yearFrom}-01-01`;
  if (yearTo) params['first_air_date.lte'] = `${yearTo}-12-31`;
  const j = await tmdb('/discover/tv', params);
  return (j.results || []).filter(m => m.poster_path && !excludeIds.has(m.id));
}

// Levenshtein edit distance — used to rank fuzzy matches when the user's
// query has typos. O(n·m) but our strings are short, so it's negligible.
function editDistance(a, b) {
  if (!a) return b ? b.length : 0;
  if (!b) return a.length;
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i].concat(new Array(n).fill(0)));
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[m][n];
}

// 0..1 similarity ratio. 1 = identical.
function titleSimilarity(query, title) {
  const a = (query || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const b = (title || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!a || !b) return 0;
  if (b.includes(a) || a.includes(b)) return 0.95;
  const dist = editDistance(a, b);
  const max = Math.max(a.length, b.length);
  return max === 0 ? 1 : 1 - dist / max;
}

// Fuzzy search across movies and TV (TMDB's /search/multi). Returns up to
// `limit` results. Cascades fallbacks when the initial search comes back
// empty so typos and partial titles still hit something:
//   1. exact query in es-ES
//   2. exact query in en-US
//   3. accent-stripped, special-char-stripped query
//   4. first half of the words (handles "The Bear Series 1" → "The Bear")
//   5. searches each individual word (catches typos in one word only)
// When multiple candidates come back, ranks by Levenshtein similarity to
// the original query so the closest visual match wins, with popularity
// as the tie-breaker.
export async function searchTitle(query, { limit = 5, includeTV = true } = {}) {
  const original = (query || '').trim();
  if (!original) return [];

  const fetchOne = async (q, lang) => {
    if (!q) return [];
    try {
      const params = { query: q, include_adult: 'false', page: '1' };
      const r = await fetch(`${BASE}/search/multi?${new URLSearchParams({ language: lang, ...params }).toString()}`);
      if (!r.ok) return [];
      const j = await r.json();
      return (j.results || []).filter(m =>
        (m.media_type === 'movie' || (includeTV && m.media_type === 'tv'))
        && m.poster_path
      );
    } catch { return []; }
  };

  const tryBoth = async (q) => {
    const es = await fetchOne(q, 'es-ES');
    if (es.length) return es;
    return fetchOne(q, 'en-US');
  };

  // 1. Direct query (ES → EN).
  let results = await tryBoth(original);

  // 2. Strip accents/special chars when nothing came back.
  const stripped = original
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (results.length === 0 && stripped && stripped !== original) {
    results = await tryBoth(stripped);
  }

  // 3. Progressive truncation of the WHOLE query — catches typos in the
  //    last few characters: "Severans" → "Severan" → "Severa" hits
  //    "Severance"; "Interstelar" → "Interstela" → "Interstel" hits
  //    "Interstellar". TMDB does prefix-style matching on token starts.
  if (results.length === 0) {
    const base = stripped || original;
    for (let trim = 1; trim <= 4 && results.length === 0; trim++) {
      const truncated = base.slice(0, base.length - trim);
      if (truncated.length >= 4) {
        results = await tryBoth(truncated);
      }
    }
  }

  // 4. First half of the words — drops trailing noise like
  //    "Dune Parte 2 4K HDR Blu-ray" → "Dune Parte".
  if (results.length === 0) {
    const words = original.split(/\s+/).filter(w => w.length > 1);
    if (words.length >= 3) {
      const half = words.slice(0, Math.ceil(words.length / 2)).join(' ');
      results = await tryBoth(half);
    }
  }

  // 5. Word-by-word with truncation — catches typos in a single word
  //    by searching each long word, also trying shorter prefixes for
  //    the typo cases the multi search wouldn't catch on its own.
  if (results.length === 0) {
    const words = original.split(/\s+/)
      .filter(w => w.length >= 3)
      .sort((a, b) => b.length - a.length);
    outer: for (const w of words.slice(0, 3)) {
      for (let trim = 0; trim <= 3; trim++) {
        const candidate = w.slice(0, w.length - trim);
        if (candidate.length < 4) break;
        const partial = await tryBoth(candidate);
        if (partial.length) { results = partial; break outer; }
      }
    }
  }

  // Rank by similarity to the original query, popularity as tie-breaker.
  return results
    .map(r => ({ ...r, _sim: titleSimilarity(original, r.title || r.name || '') }))
    .sort((a, b) => (b._sim - a._sim) || ((b.popularity || 0) - (a.popularity || 0)))
    .slice(0, limit);
}

// Build a deep search URL on the actual streaming platform for a given
// title. Returns null when we have no platform-specific URL — callers must
// then render the logo as a non-clickable badge. Never falls back to TMDB,
// Google or any external search.
export function providerSearchUrl(providerName, title) {
  const t = encodeURIComponent(title || '');
  const map = {
    'Netflix': `https://www.netflix.com/search?q=${t}`,
    'Netflix Standard With Ads': `https://www.netflix.com/search?q=${t}`,
    'Disney Plus': `https://www.disneyplus.com/search?q=${t}`,
    'Disney+': `https://www.disneyplus.com/search?q=${t}`,
    'Amazon Prime Video': `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${t}`,
    'Prime Video': `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${t}`,
    'Amazon Video': `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${t}`,
    'HBO Max': `https://play.max.com/search?q=${t}`,
    'Max': `https://play.max.com/search?q=${t}`,
    'Apple TV': `https://tv.apple.com/es/search?term=${t}`,
    'Apple TV Plus': `https://tv.apple.com/es/search?term=${t}`,
    'Apple TV+': `https://tv.apple.com/es/search?term=${t}`,
    'Movistar Plus+': `https://ver.movistarplus.es/buscador/?q=${t}`,
    'Movistar Plus+ Ficción Total': `https://ver.movistarplus.es/buscador/?q=${t}`,
    'Filmin': `https://www.filmin.es/buscador?q=${t}`,
    'SkyShowtime': `https://www.skyshowtime.com/es/search?q=${t}`,
    'Rakuten TV': `https://rakuten.tv/es/search?q=${t}`,
    'YouTube': `https://www.youtube.com/results?search_query=${t}`,
    'Crunchyroll': `https://www.crunchyroll.com/es/search?q=${t}`,
    'MGM+': `https://www.mgmplus.com/search/${t}`,
    'Paramount Plus': `https://www.paramountplus.com/es/shows/search/?searchText=${t}`,
    'Paramount+': `https://www.paramountplus.com/es/shows/search/?searchText=${t}`,
    'Atresplayer': `https://www.atresplayer.com/buscador/?q=${t}`,
    'Pluto TV': `https://pluto.tv/es/search/details?q=${t}`,
  };
  return map[providerName] || null;
}

// ── Direct watch URLs per provider ID (search pages, not deep-links) ──────────
export const PROVIDER_WATCH_URLS = {
  8:    (t) => `https://www.netflix.com/search?q=${encodeURIComponent(t)}`,
  9:    (t) => `https://www.primevideo.com/search?phrase=${encodeURIComponent(t)}`,
  10:   (t) => `https://www.primevideo.com/search?phrase=${encodeURIComponent(t)}`,
  119:  (t) => `https://www.primevideo.com/search?phrase=${encodeURIComponent(t)}`,
  1899: (t) => `https://www.max.com/es/es/search?q=${encodeURIComponent(t)}`,
  384:  (t) => `https://www.max.com/es/es/search?q=${encodeURIComponent(t)}`,
  337:  (t) => `https://www.disneyplus.com/es-es/search`,
  350:  (t) => `https://tv.apple.com/es/search?term=${encodeURIComponent(t)}`,
  2:    (t) => `https://tv.apple.com/es/search?term=${encodeURIComponent(t)}`,
  283:  (t) => `https://www.crunchyroll.com/es/search?q=${encodeURIComponent(t)}`,
  188:  (t) => `https://www.youtube.com/results?search_query=${encodeURIComponent(t)}`,
  387:  (t) => `https://www.peacocktv.com/search?q=${encodeURIComponent(t)}`,
};

// Returns the first YouTube trailer key for a movie or TV show.
// Tries Spanish first, falls back to English.
export async function getMovieVideoKey(movieId, mediaType = 'movie') {
  const path = `/${mediaType}/${movieId}/videos`;
  try {
    const esData = await tmdb(path, {});
    let trailer = (esData.results || []).find(v => v.type === 'Trailer' && v.site === 'YouTube');
    if (!trailer) {
      const enData = await tmdb(path, { language: 'en-US' });
      const vids = enData.results || [];
      trailer = vids.find(v => v.type === 'Trailer' && v.site === 'YouTube')
             || vids.find(v => v.site === 'YouTube');
    }
    return trailer?.key || null;
  } catch {
    return null;
  }
}

export async function fetchPoolForRoom({ platformKeys = [], genreIds = [], excludeGenreIds = [], keywordIds = [], yearFrom, yearTo, includeCartelera = false, pages = 3, excludeIds = new Set(), mediaType = 'movie' }) {
  const providerIds = platformIdsFromKeys(platformKeys);
  const hasFilters  = providerIds.length > 0 || includeCartelera;
  const results = [];
  const seen = new Set(excludeIds);

  const push = (movies) => {
    for (const m of movies) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        results.push(m);
      }
    }
  };

  // ─── TV ─────────────────────────────────────────────────────────────────
  if (mediaType === 'tv') {
    if (providerIds.length || genreIds.length || keywordIds.length) {
      const pagesToFetch = Array.from({ length: pages }, (_, i) => i + 1);
      // Discover por género (si lo hay)
      if (genreIds.length) {
        const discovered = await Promise.all(
          pagesToFetch.map(p => discoverTV({ providerIds, genreIds, excludeGenreIds, yearFrom, yearTo, page: p, excludeIds: seen }).catch(() => []))
        );
        discovered.forEach(push);
      }
      // Discover paralelo por keyword (anime)
      if (keywordIds.length) {
        const animeDiscovered = await Promise.all(
          pagesToFetch.map(p => discoverTV({ providerIds, keywordIds, yearFrom, yearTo, page: p, excludeIds: seen }).catch(() => []))
        );
        animeDiscovered.forEach(push);
      }
      // Si hay providers pero ningún género/keyword → discover normal
      if (!genreIds.length && !keywordIds.length) {
        const discovered = await Promise.all(
          pagesToFetch.map(p => discoverTV({ providerIds, yearFrom, yearTo, page: p, excludeIds: seen }).catch(() => []))
        );
        discovered.forEach(push);
      }
    } else {
      const trendingPages = await Promise.all([1, 2].map(p => getTrendingTV({ page: p, excludeIds: seen }).catch(() => [])));
      trendingPages.forEach(push);
    }
    return filterByYear(results, yearFrom, yearTo, m => m.first_air_date);
  }

  // ─── MOVIES ─────────────────────────────────────────────────────────────
  if (!hasFilters && !genreIds.length && !keywordIds.length) {
    const trendingPages = await Promise.all([1, 2].map(p => getTrending({ page: p, excludeIds: seen }).catch(() => [])));
    trendingPages.forEach(push);
    return filterByYear(results, yearFrom, yearTo, m => m.release_date);
  }

  if (includeCartelera) {
    const np = await Promise.all([1, 2, 3].map(p => getNowPlaying({ page: p, excludeIds: seen }).catch(() => [])));
    np.forEach(push);
  }

  const pagesToFetch = Array.from({ length: pages }, (_, i) => i + 1);

  // Si es cartelera pura (sin providers de streaming), NO hacer discover:
  // el pool ya está formado por now_playing ES, y el filtro de género/vibe
  // se aplica client-side via movieMatchesVibes en MovieSwiper.
  // Si mezclamos discover aquí entran pelis de streaming que no están en cines.
  const pureCartelera = includeCartelera && providerIds.length === 0;

  if (!pureCartelera && (genreIds.length || (providerIds.length && !keywordIds.length))) {
    const discovered = await Promise.all(
      pagesToFetch.map(p => discoverMovies({ providerIds, genreIds, excludeGenreIds, yearFrom, yearTo, page: p, excludeIds: seen }).catch(() => []))
    );
    discovered.forEach(push);
  }

  if (!pureCartelera && keywordIds.length) {
    const animeDiscovered = await Promise.all(
      pagesToFetch.map(p => discoverMovies({ providerIds, keywordIds, yearFrom, yearTo, page: p, excludeIds: seen }).catch(() => []))
    );
    animeDiscovered.forEach(push);
  }

  return filterByYear(results, yearFrom, yearTo, m => m.release_date);
}

function filterByYear(list, yearFrom, yearTo, dateAccessor) {
  if (!yearFrom && !yearTo) return list;
  return list.filter(m => {
    const d = dateAccessor(m);
    if (!d) return true;
    const y = Number(d.slice(0, 4));
    if (yearFrom && y < yearFrom) return false;
    if (yearTo && y > yearTo) return false;
    return true;
  });
}

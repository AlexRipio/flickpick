const API_KEY = import.meta.env.VITE_TMDB_API_KEY || "6caa524e9b240eac40bddccbdb011db6";
const BASE = "https://api.themoviedb.org/3";
const LANG = "es-ES";
const REGION = "ES";

export const PROVIDERS = {
  netflix: { id: 8, name: "Netflix" },
  prime: { id: 119, name: "Prime Video" },
  max: { id: 1899, name: "Max" },
  disney: { id: 337, name: "Disney+" },
  apple: { id: 350, name: "Apple TV+" },
};

const memo = new Map();
async function tmdb(path, params = {}) {
  const qs = new URLSearchParams({ api_key: API_KEY, language: LANG, ...params }).toString();
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

export async function discoverMovies({ providerIds = [], yearFrom, yearTo, page = 1, sortBy = "popularity.desc", excludeIds = new Set() } = {}) {
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
  const j = await tmdb("/movie/now_playing", { region: REGION, page: String(page) });
  return (j.results || []).filter(m => m.poster_path && !excludeIds.has(m.id));
}

export async function getSimilar(movieId, { page = 1, excludeIds = new Set() } = {}) {
  const j = await tmdb(`/movie/${movieId}/recommendations`, { page: String(page) });
  return (j.results || []).filter(m => m.poster_path && !excludeIds.has(m.id));
}

export async function getMovieDetails(movieId) {
  return tmdb(`/movie/${movieId}`, { append_to_response: "watch/providers,credits,keywords" });
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

export async function discoverTV({ providerIds = [], yearFrom, yearTo, page = 1, excludeIds = new Set() } = {}) {
  const params = {
    region: REGION, watch_region: REGION,
    sort_by: 'popularity.desc', include_adult: 'false',
    'vote_count.gte': '20', page: String(page),
  };
  if (providerIds.length) { params.with_watch_providers = providerIds.join('|'); params.with_watch_monetization_types = 'flatrate|ads|free'; }
  if (yearFrom) params['first_air_date.gte'] = `${yearFrom}-01-01`;
  if (yearTo) params['first_air_date.lte'] = `${yearTo}-12-31`;
  const j = await tmdb('/discover/tv', params);
  return (j.results || []).filter(m => m.poster_path && !excludeIds.has(m.id));
}

export async function fetchPoolForRoom({ platformKeys = [], yearFrom, yearTo, includeCartelera = false, pages = 3, excludeIds = new Set(), mediaType = 'movie' }) {
  const providerIds = platformIdsFromKeys(platformKeys);
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

  if (mediaType === 'tv') {
    const trendingPages = await Promise.all([1, 2].map(p => getTrendingTV({ page: p, excludeIds: seen }).catch(() => [])));
    trendingPages.forEach(push);

    if (providerIds.length) {
      const pagesToFetch = [];
      for (let p = 1; p <= pages; p++) pagesToFetch.push(p);
      const discovered = await Promise.all(
        pagesToFetch.map(p => discoverTV({ providerIds, yearFrom, yearTo, page: p, excludeIds: seen }).catch(() => []))
      );
      discovered.forEach(push);
    }

    if (yearFrom || yearTo) {
      const year = (m) => m.first_air_date ? Number(m.first_air_date.slice(0, 4)) : null;
      return results.filter(m => {
        const y = year(m);
        if (y == null) return true;
        if (yearFrom && y < yearFrom) return false;
        if (yearTo && y > yearTo) return false;
        return true;
      });
    }
    return results;
  }

  const trendingPages = await Promise.all([1, 2].map(p => getTrending({ page: p, excludeIds: seen }).catch(() => [])));
  trendingPages.forEach(push);

  if (includeCartelera) {
    const np = await Promise.all([1, 2].map(p => getNowPlaying({ page: p, excludeIds: seen }).catch(() => [])));
    np.forEach(push);
  }

  if (providerIds.length) {
    const pagesToFetch = [];
    for (let p = 1; p <= pages; p++) pagesToFetch.push(p);
    const discovered = await Promise.all(
      pagesToFetch.map(p => discoverMovies({ providerIds, yearFrom, yearTo, page: p, excludeIds: seen }).catch(() => []))
    );
    discovered.forEach(push);
  }

  if (yearFrom || yearTo) {
    const year = (m) => m.release_date ? Number(m.release_date.slice(0, 4)) : null;
    return results.filter(m => {
      const y = year(m);
      if (y == null) return true;
      if (yearFrom && y < yearFrom) return false;
      if (yearTo && y > yearTo) return false;
      return true;
    });
  }
  return results;
}

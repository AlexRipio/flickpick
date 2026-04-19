/**
 * Matchmaking engine.
 *
 * Each user has a taste vector built from their likes and skips:
 *   genres: { [genreId]: weight }
 *   avgRating: running mean of vote_average of liked titles
 *   avgYear: running mean of release_year of liked titles
 *
 * A candidate movie is scored against the lobby's blended taste by
 * summing matching genre weights, plus quality and recency bonuses.
 * The swiper feeds candidates in descending score so users see the
 * most personally-relevant titles first — and the lobby's blended
 * vector means everyone converges toward shared taste.
 */

const LIKE_W = 1.0;
const SKIP_W = -0.4;
const RATING_W = 0.25;
const RECENCY_W = 0.15;

export function emptyTaste() {
  return { genres: {}, likes: 0, skips: 0, ratingSum: 0, ratingN: 0, yearSum: 0, yearN: 0 };
}

export function updateTaste(taste, movie, vote) {
  const t = taste ? { ...taste, genres: { ...taste.genres } } : emptyTaste();
  const w = vote === "like" ? LIKE_W : SKIP_W;
  const ids = movie.genre_ids || (movie.genres || []).map(g => g.id) || [];
  for (const gid of ids) t.genres[gid] = (t.genres[gid] || 0) + w;
  if (vote === "like") {
    t.likes += 1;
    if (movie.vote_average) { t.ratingSum += movie.vote_average; t.ratingN += 1; }
    if (movie.release_date) {
      const y = Number(movie.release_date.slice(0, 4));
      if (!Number.isNaN(y)) { t.yearSum += y; t.yearN += 1; }
    }
  } else {
    t.skips += 1;
  }
  return t;
}

export function blendTastes(tastes) {
  const out = emptyTaste();
  for (const t of tastes) {
    if (!t) continue;
    for (const [gid, w] of Object.entries(t.genres)) out.genres[gid] = (out.genres[gid] || 0) + w;
    out.likes += t.likes;
    out.skips += t.skips;
    out.ratingSum += t.ratingSum;
    out.ratingN += t.ratingN;
    out.yearSum += t.yearSum;
    out.yearN += t.yearN;
  }
  return out;
}

export function scoreMovie(movie, taste) {
  if (!taste || taste.likes + taste.skips < 1) {
    // Cold start: rank on popularity + rating so the first swipes still feel curated.
    return (movie.popularity || 0) * 0.01 + (movie.vote_average || 0);
  }
  const ids = movie.genre_ids || (movie.genres || []).map(g => g.id) || [];
  let genreScore = 0;
  for (const gid of ids) genreScore += taste.genres[gid] || 0;

  const avgRating = taste.ratingN > 0 ? taste.ratingSum / taste.ratingN : 7;
  const ratingGap = Math.abs((movie.vote_average || 0) - avgRating);
  const ratingScore = Math.max(0, 2 - ratingGap) * RATING_W;

  const avgYear = taste.yearN > 0 ? taste.yearSum / taste.yearN : 2015;
  const yearGap = movie.release_date ? Math.abs(Number(movie.release_date.slice(0, 4)) - avgYear) : 20;
  const recencyScore = Math.max(0, 10 - yearGap) * RECENCY_W;

  const popBoost = Math.log10((movie.popularity || 1) + 1) * 0.3;

  return genreScore + ratingScore + recencyScore + popBoost;
}

export function rankPool(pool, taste, votedIds = new Set()) {
  const scored = pool
    .filter(m => !votedIds.has(m.id))
    .map(m => ({ movie: m, score: scoreMovie(m, taste) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.movie);
}

export function topGenres(taste, n = 3) {
  return Object.entries(taste?.genres || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([id]) => Number(id));
}

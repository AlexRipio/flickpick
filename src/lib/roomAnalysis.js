/**
 * roomAnalysis.js
 * Computes "FlickPick Wrapped" analytics from a closed (or live) room.
 */

export const GENRE_NAMES = {
  28: 'Acción', 12: 'Aventura', 16: 'Animación', 35: 'Comedia',
  80: 'Crimen', 99: 'Documental', 18: 'Drama', 10751: 'Familia',
  14: 'Fantasía', 36: 'Historia', 27: 'Terror', 10402: 'Música',
  9648: 'Misterio', 10749: 'Romance', 878: 'Ciencia Ficción',
  53: 'Thriller', 10752: 'Bélica', 37: 'Western',
  10759: 'Acción y Aventura', 10762: 'Infantil', 10763: 'Noticias',
  10764: 'Reality', 10765: 'Sci-Fi y Fantasía', 10768: 'War y Política',
};

export const GENRE_EMOJIS = {
  28: '💥', 12: '🗺️', 16: '✨', 35: '😂', 80: '🔫', 99: '🎤',
  18: '🎭', 10751: '👨‍👩‍👧', 14: '🧙', 36: '📜', 27: '👻', 10402: '🎵',
  9648: '🔍', 10749: '❤️', 878: '🚀', 53: '😰', 10752: '⚔️', 37: '🤠',
  10759: '🎯', 10762: '🧸', 10765: '🌌',
};

const PERSONALITY_TYPES = [
  {
    minRate: 0.65, id: 'cinephile',
    label: 'Cinéfilo/a total', emoji: '🎬',
    desc: 'Le das like a casi todo. La pantalla es tu hogar.',
    color: '#FF6B4A',
  },
  {
    minRate: 0.45, id: 'selective',
    label: 'Selectivo/a con estilo', emoji: '😎',
    desc: 'Sabes lo que quieres. Gusto impecable.',
    color: '#4EFFD6',
  },
  {
    minRate: 0.25, id: 'demanding',
    label: 'Difícil de convencer', emoji: '🧐',
    desc: 'Cuando algo te gusta, es porque realmente lo merece.',
    color: '#FFB547',
  },
  {
    minRate: 0, id: 'critic',
    label: 'Jurado de festival', emoji: '🏆',
    desc: 'Solo el cine de autor para tus ojos. Puro nivel.',
    color: '#8B5CF6',
  },
];

const COMPATIBILITY_TIERS = [
  { min: 70, label: 'Almas gemelas del cine',      emoji: '💞', color: '#FF3B6B', bg: 'linear-gradient(135deg,#FF6B4A,#FF3B6B)' },
  { min: 50, label: 'Dúo de pantalla',              emoji: '🍿', color: '#FF8C4A', bg: 'linear-gradient(135deg,#FF8C4A,#FFB547)' },
  { min: 30, label: 'Buen equipo de pantalla',      emoji: '🎯', color: '#FFB547', bg: 'linear-gradient(135deg,#FFB547,#4EFFD6)' },
  { min: 10, label: 'Gustos complementarios',       emoji: '🤝', color: '#4EFFD6', bg: 'linear-gradient(135deg,#4EFFD6,#8B5CF6)' },
  { min: 0,  label: 'La tensión cinematográfica os une', emoji: '⚡', color: '#8B5CF6', bg: 'linear-gradient(135deg,#6D28D9,#8B5CF6)' },
];

function getPersonality(likeRate) {
  return PERSONALITY_TYPES.find(p => likeRate >= p.minRate) || PERSONALITY_TYPES[PERSONALITY_TYPES.length - 1];
}

function getCompatTier(pct) {
  return COMPATIBILITY_TIERS.find(t => pct >= t.min) || COMPATIBILITY_TIERS[COMPATIBILITY_TIERS.length - 1];
}

export function computeRoomAnalysis(room) {
  if (!room?.members?.length) return null;

  const { members, votes = {}, matches = [] } = room;
  const matchMovies = matches.map(m => m.movie).filter(Boolean);

  // ── Per-member stats ─────────────────────────────────────────────────────
  const memberStats = members.map(member => {
    const mv = votes[member.id] || {};
    const totalVotes = Object.keys(mv).length;
    const likes = Object.values(mv).filter(v => v === 'like').length;
    const skips = totalVotes - likes;
    const likeRate = totalVotes > 0 ? likes / totalVotes : 0;
    const personality = getPersonality(likeRate);
    return { member, totalVotes, likes, skips, likeRate, personality };
  });

  // ── Compatibility ─────────────────────────────────────────────────────────
  // = (movies ALL members liked) / (movies ALL members voted on)
  const allIds = new Set(members.flatMap(m => Object.keys(votes[m.id] || {})));
  let bothVotedCount = 0;
  let bothLikedCount = 0;

  for (const id of allIds) {
    const allVoted = members.every(m => votes[m.id]?.[id] !== undefined);
    if (allVoted) {
      bothVotedCount++;
      if (members.every(m => votes[m.id]?.[id] === 'like')) bothLikedCount++;
    }
  }

  const compatibilityPct = bothVotedCount > 0
    ? Math.round((bothLikedCount / bothVotedCount) * 100)
    : matches.length > 0 ? Math.min(99, matches.length * 8) : 0;

  const compatTier = getCompatTier(compatibilityPct);

  // ── Genre analysis (from matched movies) ─────────────────────────────────
  const genreCount = {};
  matchMovies.forEach(movie => {
    (movie.genre_ids || []).forEach(gId => {
      genreCount[gId] = (genreCount[gId] || 0) + 1;
    });
  });
  const topGenres = Object.entries(genreCount)
    .map(([id, count]) => ({
      id: Number(id),
      name: GENRE_NAMES[id] || `Género ${id}`,
      emoji: GENRE_EMOJIS[id] || '🎬',
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // ── Best match (highest rated) ────────────────────────────────────────────
  const bestMatch = matchMovies
    .filter(m => m.vote_average > 0)
    .sort((a, b) => b.vote_average - a.vote_average)[0] || matchMovies[0] || null;

  // ── Hidden gem (lowest popularity among matches) ──────────────────────────
  const hiddenGem = matchMovies.length > 1
    ? matchMovies
        .filter(m => m.popularity > 0 && m !== bestMatch)
        .sort((a, b) => a.popularity - b.popularity)[0] || null
    : null;

  // ── Fun facts ─────────────────────────────────────────────────────────────
  const mostPicky = memberStats.length > 1
    ? memberStats.reduce((a, b) => a.likeRate < b.likeRate ? a : b)
    : null;
  const mostOpen = memberStats.length > 1
    ? memberStats.reduce((a, b) => a.likeRate > b.likeRate ? a : b)
    : null;

  const totalMoviesEvaluated = bothVotedCount || memberStats.reduce((s, m) => Math.max(s, m.totalVotes), 0);

  // ── "FlickPick says" headline ─────────────────────────────────────────────
  const headlines = [
    compatibilityPct >= 60 && '¡Perfectos para una maratón juntos! 🚀',
    compatibilityPct >= 40 && matches.length >= 5 && '¡Tienen para ver rato! 🎉',
    matches.length === 0 && 'Aún no hay matches. ¡Deslizad más! 💪',
    matches.length >= 10 && '¡Qué lista más épica! 🏆',
    mostPicky && `${mostPicky.member.name} es el/la más exigente del grupo 🧐`,
  ].find(Boolean) || '¡Buen gusto cinematográfico! 🎬';

  return {
    compatibilityPct,
    compatTier,
    memberStats,
    topGenres,
    bestMatch,
    hiddenGem,
    totalMatches: matches.length,
    totalMoviesEvaluated,
    bothVotedCount,
    mostPicky,
    mostOpen,
    headline: headlines,
  };
}

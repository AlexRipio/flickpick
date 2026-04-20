import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AmbientBackdrop, BackButton } from '@/components/fp/primitives';
import { Poster } from '@/components/fp/Poster';
import { FP } from '@/lib/fp';
import { getTrending } from '@/lib/tmdb';
import DetailSheet from '@/components/DetailSheet';

const TrendingScreen = () => {
  const navigate = useNavigate();
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [p1, p2] = await Promise.all([
          getTrending({ page: 1 }).catch(() => []),
          getTrending({ page: 2 }).catch(() => []),
        ]);
        const seen = new Set();
        const all = [];
        for (const m of [...p1, ...p2]) {
          if (!seen.has(m.id)) { seen.add(m.id); all.push(m); }
        }
        setMovies(all);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <AmbientBackdrop hue={200}/>

      <div style={{
        position: 'relative', zIndex: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', maxWidth: 520, width: '100%', margin: '0 auto',
      }}>
        <BackButton onClick={() => navigate('/home')}/>
        <div style={{ fontSize: 13, fontWeight: 600, color: FP.textDim }}>Tendencias</div>
        <div style={{ width: 42 }}/>
      </div>

      <div className="no-scrollbar" style={{
        position: 'relative', zIndex: 2, flex: 1, overflowY: 'auto',
        padding: '6px 24px 40px', maxWidth: 520, width: '100%', margin: '0 auto',
      }}>
        <h1 style={{
          fontFamily: '"Syne", "Space Grotesk", sans-serif',
          fontSize: 30, fontWeight: 800, color: FP.text,
          margin: '0 0 6px', letterSpacing: -0.8,
        }}>Tendencias</h1>
        <p style={{ fontSize: 14, color: FP.textDim, margin: '0 0 22px' }}>
          Lo más visto de la semana
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', paddingTop: 60, color: FP.textDim }}>
            <div style={{ fontSize: 44 }}>🎞️</div>
            <div style={{ marginTop: 10 }}>Cargando tendencias…</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {movies.map((m, i) => (
              <TrendingCard key={m.id} movie={m} rank={i + 1} onClick={() => setSelected(m)}/>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <DetailSheet
          movie={selected}
          onClose={() => setSelected(null)}
          onLike={() => setSelected(null)}
          onSkip={() => setSelected(null)}
        />
      )}
    </div>
  );
};

function TrendingCard({ movie, rank, onClick }) {
  const year = movie.release_date ? movie.release_date.slice(0, 4) : (movie.first_air_date ? movie.first_air_date.slice(0, 4) : '');
  return (
    <div onClick={onClick} style={{
      borderRadius: 18, overflow: 'hidden',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      cursor: 'pointer',
      transition: 'transform 0.14s',
    }}
      onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.97)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      {/* Poster */}
      <div style={{ position: 'relative', aspectRatio: '2/3' }}>
        <Poster movie={movie} showBadge={false}/>
        {/* Rank badge */}
        <div style={{
          position: 'absolute', top: 8, left: 8,
          width: 26, height: 26, borderRadius: 999,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 800, color: '#fff',
        }}>#{rank}</div>
        {/* Rating */}
        {movie.vote_average > 0 && (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            padding: '3px 7px', borderRadius: 999,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
            fontSize: 11, fontWeight: 700, color: '#FFB547',
          }}>★ {movie.vote_average.toFixed(1)}</div>
        )}
      </div>
      {/* Info */}
      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{
          fontFamily: '"Space Grotesk", system-ui',
          fontSize: 13, fontWeight: 700, color: FP.text,
          lineHeight: 1.2, marginBottom: 4,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{movie.title || movie.name}</div>
        {year && <div style={{ fontSize: 11, color: FP.textMuted, fontWeight: 600 }}>{year}</div>}
        {movie.overview && (
          <div style={{
            marginTop: 6, fontSize: 11, color: FP.textDim, lineHeight: 1.45,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{movie.overview}</div>
        )}
      </div>
    </div>
  );
}

export default TrendingScreen;

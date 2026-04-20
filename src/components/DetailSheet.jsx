import React, { useEffect, useState } from 'react';
import { Poster } from '@/components/fp/Poster';
import { FP } from '@/lib/fp';
import { getMovieDetails } from '@/lib/tmdb';

const DetailSheet = ({ movie, onClose, onLike, onSkip, likeLabel, skipLabel }) => {
  const [show, setShow] = useState(false);
  const [details, setDetails] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 20);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let cancel = false;
    if (movie?.id) {
      getMovieDetails(movie.id)
        .then(d => { if (!cancel) setDetails(d); })
        .catch(() => {});
    }
    return () => { cancel = true; };
  }, [movie?.id]);

  const close = () => {
    setShow(false);
    setTimeout(() => onClose?.(), 220);
  };

  if (!movie) return null;

  const year = movie.release_date ? movie.release_date.slice(0, 4) : '';
  const runtime = details?.runtime;
  const genres = (details?.genres || []).map(g => g.name);
  const providers = details?.['watch/providers']?.results?.ES
    || details?.['watch/providers']?.results?.US
    || null;
  const flatrate = providers?.flatrate || [];
  const link = providers?.link;

  return (
    <div
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 70,
        background: show ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0)',
        backdropFilter: show ? 'blur(10px)' : 'blur(0px)',
        WebkitBackdropFilter: show ? 'blur(10px)' : 'blur(0px)',
        transition: 'background 0.25s, backdrop-filter 0.25s',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520,
          maxHeight: '90vh',
          background: 'linear-gradient(180deg, #1a0f2e 0%, #0B0420 100%)',
          borderTopLeftRadius: 32, borderTopRightRadius: 32,
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 -30px 60px rgba(0,0,0,0.6)',
          overflow: 'hidden', position: 'relative',
          transform: show ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.32s cubic-bezier(.2,.8,.3,1)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* handle */}
        <div style={{
          position: 'absolute', top: 10, left: 0, right: 0,
          display: 'flex', justifyContent: 'center', zIndex: 3,
        }}>
          <div style={{ width: 44, height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.25)' }}/>
        </div>

        {/* scrollable content */}
        <div className="no-scrollbar" style={{ overflowY: 'auto', flex: 1 }}>
          {/* hero */}
          <div style={{ position: 'relative', width: '100%', height: 340, overflow: 'hidden' }}>
            <Poster movie={movie} showBadge={false} size="w780"/>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(180deg, transparent 50%, rgba(11,4,32,0.98) 100%)',
            }}/>
            <button onClick={close} style={{
              position: 'absolute', top: 22, right: 18, zIndex: 4,
              width: 36, height: 36, borderRadius: 999,
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(8px)',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M6 18L18 6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          <div style={{ padding: '8px 24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h2 style={{
                fontFamily: '"Space Grotesk", system-ui',
                fontSize: 28, fontWeight: 800, color: FP.text,
                margin: 0, letterSpacing: -0.8, lineHeight: 1.08,
              }}>{movie.title || movie.name}</h2>
              <div style={{
                display: 'flex', gap: 10, alignItems: 'center',
                marginTop: 8, color: FP.textDim, fontSize: 13, fontWeight: 600,
              }}>
                {year && <span>{year}</span>}
                {year && (runtime || movie.vote_average > 0) && <Dot/>}
                {runtime > 0 && <span>{Math.floor(runtime / 60)}h {runtime % 60}m</span>}
                {runtime > 0 && movie.vote_average > 0 && <Dot/>}
                {movie.vote_average > 0 && (
                  <span style={{ color: '#FFD166', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="#FFD166">
                      <path d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.5l7.1-.6z"/>
                    </svg>
                    {movie.vote_average.toFixed(1)}
                  </span>
                )}
              </div>
            </div>

            {genres.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {genres.map(g => (
                  <span key={g} style={{
                    padding: '5px 11px', borderRadius: 999,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    fontSize: 12, fontWeight: 600, color: FP.textDim,
                  }}>{g}</span>
                ))}
              </div>
            )}

            {movie.overview && (
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: FP.textDim,
                  letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8,
                }}>Sinopsis</div>
                <p style={{
                  fontSize: 14, color: FP.text, margin: 0, lineHeight: 1.55,
                  opacity: 0.9,
                }}>{movie.overview}</p>
              </div>
            )}

            {flatrate.length > 0 && (
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: FP.textDim,
                  letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8,
                }}>Dónde ver</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {flatrate.slice(0, 6).map(p => (
                    <div key={p.provider_id} style={{
                      width: 40, height: 40, borderRadius: 10, overflow: 'hidden',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}>
                      <img src={`https://image.tmdb.org/t/p/w92${p.logo_path}`} alt={p.provider_name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                    </div>
                  ))}
                  {link && (
                    <a href={link} target="_blank" rel="noreferrer" style={{
                      marginLeft: 'auto',
                      padding: '8px 14px', borderRadius: 999,
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#fff', fontSize: 12, fontWeight: 700,
                      textDecoration: 'none',
                    }}>Ver en TMDB ↗</a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* sticky bottom actions */}
        <div style={{
          display: 'flex', gap: 10, padding: '14px 20px 20px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(11,4,32,0.85)',
          backdropFilter: 'blur(10px)',
        }}>
          <button onClick={onSkip} style={{
            flex: 1, height: 52, borderRadius: 999,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
            fontFamily: '"Space Grotesk", system-ui',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M6 18L18 6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            {skipLabel || 'Paso'}
          </button>
          <button onClick={onLike} style={{
            flex: 1.4, height: 52, borderRadius: 999,
            background: FP.flame, border: 'none',
            color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
            fontFamily: '"Space Grotesk", system-ui',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: '0 8px 22px rgba(255,59,107,0.38)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"/>
            </svg>
            {likeLabel || 'Me gusta'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Dot = () => <span style={{ width: 3, height: 3, borderRadius: 999, background: 'rgba(255,255,255,0.3)' }}/>;

export default DetailSheet;

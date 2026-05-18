import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Poster } from '@/components/fp/Poster';
import { FP } from '@/lib/fp';
import { getDetails, getMovieVideoKey, getReleaseDateForRegion, userRegion, dedupeProviders } from '@/lib/tmdb';
import { openShowtimes } from '@/lib/showtimes';

const RELEASE_FMT = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
function getReleaseInfoSheet(rawDate) {
  if (!rawDate) return { kind: 'unknown', label: '' };
  const [y, m, d] = rawDate.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return { kind: 'unknown', label: '' };
  const release = new Date(y, m - 1, d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const label = RELEASE_FMT.format(release);
  return { kind: release > today ? 'upcoming' : 'released', label };
}

// Deep-link search URLs per provider name (best-effort, opens search by title)
const PROVIDER_DEEPLINK = {
  Netflix: (q) => `https://www.netflix.com/search?q=${q}`,
  'Netflix Standard With Ads': (q) => `https://www.netflix.com/search?q=${q}`,
  'Disney Plus': (q) => `https://www.disneyplus.com/search?q=${q}`,
  'Amazon Prime Video': (q) => `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${q}`,
  'Amazon Video': (q) => `https://www.amazon.es/s?k=${q}&i=instant-video`,
  'HBO Max': (q) => `https://play.max.com/search?q=${q}`,
  Max: (q) => `https://play.max.com/search?q=${q}`,
  'Apple TV': (q) => `https://tv.apple.com/search?term=${q}`,
  'Apple TV Plus': (q) => `https://tv.apple.com/search?term=${q}`,
  Movistar: (q) => `https://ver.movistarplus.es/buscador/?q=${q}`,
  'Movistar Plus+': (q) => `https://ver.movistarplus.es/buscador/?q=${q}`,
  Filmin: (q) => `https://www.filmin.es/buscador?q=${q}`,
  SkyShowtime: (q) => `https://www.skyshowtime.com/es/search?q=${q}`,
  'Rakuten TV': (q) => `https://rakuten.tv/es/search?q=${q}`,
  'Google Play Movies': (q) => `https://play.google.com/store/search?q=${q}&c=movies`,
  YouTube: (q) => `https://www.youtube.com/results?search_query=${q}+pelicula`,
  'MGM+': (q) => `https://www.mgmplus.com/search/${q}`,
  'Paramount Plus': (q) => `https://www.paramountplus.com/es/shows/search/?searchText=${q}`,
  'Paramount+': (q) => `https://www.paramountplus.com/es/shows/search/?searchText=${q}`,
  Atresplayer: (q) => `https://www.atresplayer.com/buscador/?q=${q}`,
  'Pluto TV': (q) => `https://pluto.tv/es/search/details?q=${q}`,
  Crunchyroll: (q) => `https://www.crunchyroll.com/es/search?q=${q}`,
};

function providerHref(providerName, title) {
  const builder = PROVIDER_DEEPLINK[providerName];
  if (builder && title) return builder(encodeURIComponent(title));
  // Unknown provider → no link. Logo renders non-clickable.
  return null;
}

const DetailSheet = ({ movie, onClose, onLike, onSkip, likeLabel, skipLabel, mediaType, cartelera = false }) => {
  const [show, setShow] = useState(false);
  const [details, setDetails] = useState(null);
  const [trailerKey, setTrailerKey] = useState(null);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const scrollRef = useRef(null);

  // Reset trailer when the sheet item changes so reopening with another
  // film doesn't leave the previous video playing.
  useEffect(() => { setTrailerOpen(false); }, [movie?.id]);

  // Scroll the sheet body to the top when trailer opens so the iframe
  // is fully visible regardless of where the user was scrolled.
  useEffect(() => {
    if (trailerOpen && scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [trailerOpen]);
  const [regionDate, setRegionDate] = useState(null);

  // Detect TV vs movie when caller doesn't pass it explicitly.
  const resolvedMediaType = mediaType
    || (movie && (movie.media_type === 'tv' || (!movie.title && (movie.name || movie.first_air_date))) ? 'tv' : 'movie');

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 20);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let cancel = false;
    if (movie?.id) {
      getDetails(movie.id, resolvedMediaType)
        .then(d => { if (!cancel) setDetails(d); })
        .catch(() => {});
      getMovieVideoKey(movie.id, resolvedMediaType)
        .then(k => { if (!cancel) setTrailerKey(k); })
        .catch(() => {});
      if (resolvedMediaType === 'movie') {
        getReleaseDateForRegion(movie.id, userRegion())
          .then(d => { if (!cancel) setRegionDate(d); })
          .catch(() => {});
      }
    }
    return () => { cancel = true; };
  }, [movie?.id, resolvedMediaType]);

  const close = () => {
    setShow(false);
    setTimeout(() => onClose?.(), 220);
  };

  if (!movie) return null;

  const dateStr = movie.release_date || movie.first_air_date || details?.release_date || details?.first_air_date || '';
  const year = dateStr ? dateStr.slice(0, 4) : '';
  const runtime = details?.runtime || details?.episode_run_time?.[0] || 0;
  const releaseInfo = getReleaseInfoSheet(regionDate || dateStr);
  const genres = (details?.genres || []).map(g => g.name);
  const providers = details?.['watch/providers']?.results?.ES
    || details?.['watch/providers']?.results?.US
    || null;
  const flatrate = dedupeProviders(providers?.flatrate || []);

  return createPortal(
    <div
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
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
        <div ref={scrollRef} className="no-scrollbar" style={{ overflowY: 'auto', flex: 1 }}>
          {/* hero — póster por defecto, sustituido por iframe del trailer
              cuando el usuario lo activa, con su propia X para cerrarlo */}
          <div style={{ position: 'relative', width: '100%', height: 340, overflow: 'hidden', background: '#000' }}>
            {trailerOpen && trailerKey ? (
              <>
                <iframe
                  src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  title="Tráiler"
                />
                <button
                  type="button"
                  onClick={() => setTrailerOpen(false)}
                  aria-label="Cerrar tráiler"
                  style={{
                    position: 'absolute', top: 14, right: 14, zIndex: 6,
                    width: 36, height: 36, borderRadius: 999,
                    background: 'rgba(0,0,0,0.70)',
                    border: '1px solid rgba(255,255,255,0.25)',
                    color: '#fff', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backdropFilter: 'blur(8px)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M6 6l12 12M6 18L18 6" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"/>
                  </svg>
                </button>
              </>
            ) : (
              <>
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
              </>
            )}
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

            {/* Release date badge (movies only) */}
            {releaseInfo.kind === 'upcoming' && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 9,
                padding: '10px 16px', borderRadius: 16,
                background: 'linear-gradient(135deg, rgba(78,255,170,0.22), rgba(78,255,170,0.10))',
                border: '1px solid rgba(78,255,170,0.55)',
                color: '#5BFFB0', alignSelf: 'flex-start',
                boxShadow: '0 4px 14px rgba(78,255,170,0.18)',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="5" width="18" height="16" rx="2" stroke="#5BFFB0" strokeWidth="2"/>
                  <path d="M3 9h18M8 3v4M16 3v4" stroke="#5BFFB0" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase' }}>Próximamente</span>
                  {releaseInfo.label && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(91,255,176,0.85)', marginTop: 2 }}>
                      {releaseInfo.label}
                    </span>
                  )}
                </div>
              </div>
            )}
            {releaseInfo.kind === 'released' && releaseInfo.label && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                fontSize: 13, color: FP.textDim, fontWeight: 600,
                fontFamily: '"Space Grotesk", system-ui',
                alignSelf: 'flex-start',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2"/>
                  <path d="M3 9h18" stroke="currentColor" strokeWidth="2"/>
                </svg>
                Estrenada · {releaseInfo.label}
              </div>
            )}

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

            {flatrate.length === 0 && releaseInfo.kind !== 'released' && (
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: FP.textDim,
                  letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8,
                }}>Dónde ver</div>
                {cartelera ? (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    padding: '7px 14px', borderRadius: 999,
                    background: 'rgba(255,107,74,0.16)',
                    border: '1px solid rgba(255,107,74,0.45)',
                    color: '#FFB199', fontSize: 13, fontWeight: 800,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M4 4h16v16H4z M4 9h16 M4 15h16 M9 4v16 M15 4v16" stroke="#FFB199" strokeWidth="1.6" strokeLinecap="round"/>
                    </svg>
                    En cines
                  </div>
                ) : (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    padding: '7px 14px', borderRadius: 999,
                    background: 'rgba(255,255,255,0.10)',
                    border: '1px solid rgba(255,255,255,0.18)',
                    color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 700,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/>
                      <path d="M9 9.5a3 3 0 116 0c0 1.5-1.5 2-2 3M12 17v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                    </svg>
                    Plataforma no confirmada
                  </div>
                )}
              </div>
            )}
            {flatrate.length > 0 && (
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: FP.textDim,
                  letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8,
                }}>Dónde ver</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {flatrate.slice(0, 6).map(p => {
                    const href = providerHref(p.provider_name, movie.title || movie.name);
                    const Tag = href ? 'a' : 'div';
                    return (
                      <Tag
                        key={p.provider_id}
                        {...(href ? { href, target: '_blank', rel: 'noreferrer', 'aria-label': `Buscar en ${p.provider_name}` } : {})}
                        title={`Buscar "${movie.title || movie.name}" en ${p.provider_name}`}
                        style={{
                          width: 40, height: 40, borderRadius: 10, overflow: 'hidden',
                          border: '1px solid rgba(255,255,255,0.1)',
                          cursor: href ? 'pointer' : 'default',
                          transition: 'transform 0.15s ease-out, box-shadow 0.15s',
                          display: 'block', textDecoration: 'none',
                        }}
                        onMouseEnter={(e) => { if (href) { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(255,59,107,0.25)'; } }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                      >
                        <img src={`https://image.tmdb.org/t/p/w92${p.logo_path}`} alt={p.provider_name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                      </Tag>
                    );
                  })}
                </div>
              </div>
            )}

            {trailerKey && (
              <button
                type="button"
                onClick={() => setTrailerOpen(o => !o)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  height: 52, borderRadius: 999, width: '100%',
                  background: trailerOpen ? 'rgba(255,107,74,0.18)' : 'rgba(255,255,255,0.06)',
                  border: trailerOpen ? '1px solid rgba(255,107,74,0.55)' : '1px solid rgba(255,255,255,0.14)',
                  color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  fontFamily: '"Space Grotesk", system-ui',
                  transition: 'background 0.2s, border-color 0.2s',
                }}
                onMouseEnter={(e) => { if (!trailerOpen) { e.currentTarget.style.background = 'rgba(255,107,74,0.14)'; e.currentTarget.style.borderColor = 'rgba(255,107,74,0.5)'; } }}
                onMouseLeave={(e) => { if (!trailerOpen) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'; } }}
              >
                {trailerOpen ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M6 6l12 12M6 18L18 6" stroke="#FF6B4A" strokeWidth="2.4" strokeLinecap="round"/>
                    </svg>
                    Cerrar tráiler
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#FF6B4A">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                    Ver trailer
                  </>
                )}
              </button>
            )}

            {/* Showtimes near me — visible for cinema-bound films
                (Cartelera context, or no streaming flatrate yet). Sits
                below the trailer button so it shows up after watching. */}
            {/* Solo en pelis explícitamente abiertas desde Cartelera —
                el flag `cartelera` se pasa cuando el origen sabe que la
                peli está en cines en España. No mostramos en upcoming
                ni en pelis sin plataforma genéricas. */}
            {resolvedMediaType === 'movie' && cartelera && (
              <button
                type="button"
                onClick={() => openShowtimes(movie.title || movie.name)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  height: 52, borderRadius: 999,
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.28), rgba(59,130,246,0.14))',
                  border: '1px solid rgba(96,165,250,0.55)',
                  color: '#93C5FD', fontWeight: 700, fontSize: 14,
                  fontFamily: '"Space Grotesk", system-ui',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(59,130,246,0.20)',
                  transition: 'transform 0.12s, box-shadow 0.2s',
                }}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 21s-7-7.5-7-12a7 7 0 1114 0c0 4.5-7 12-7 12z" stroke="#93C5FD" strokeWidth="2" strokeLinejoin="round"/>
                  <circle cx="12" cy="9" r="2.5" stroke="#93C5FD" strokeWidth="2"/>
                </svg>
                Sesiones cerca de ti
              </button>
            )}

            {/* Horarios del cine elegido (modo "En cines" con cinema picker).
                Solo si el pool viene de /api/cinemas/:id/now y hay showtimes hoy.
                Filtra pasados y ordena ascendente; máximo 10 pills. */}
            {(() => {
              const list = Array.isArray(movie.cinemaShowtimes) ? movie.cinemaShowtimes : null;
              if (!list?.length) return null;
              const now = Date.now();
              const future = list
                .map(iso => ({ iso, t: new Date(iso).getTime() }))
                .filter(x => Number.isFinite(x.t) && x.t > now)
                .sort((a, b) => a.t - b.t)
                .slice(0, 10);
              if (!future.length) return null;
              return (
                <div style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: 14,
                  background: 'rgba(255,107,74,0.08)',
                  border: '1px solid rgba(255,107,74,0.25)',
                  boxSizing: 'border-box',
                }}>
                  <div style={{
                    fontFamily: '"Space Grotesk", system-ui',
                    fontSize: 11, fontWeight: 700,
                    color: 'rgba(255,107,74,0.95)',
                    textTransform: 'uppercase',
                    marginBottom: 10,
                  }}>Sesiones hoy en este cine</div>
                  <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: 6,
                  }}>
                    {future.map(({ iso, t }) => {
                      const d = new Date(t);
                      const hh = String(d.getHours()).padStart(2, '0');
                      const mm = String(d.getMinutes()).padStart(2, '0');
                      return (
                        <div
                          key={iso}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 8,
                            background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,107,74,0.4)',
                            color: '#fff',
                            fontFamily: '"Space Grotesk", system-ui',
                            fontSize: 13, fontWeight: 700,
                            lineHeight: 1,
                          }}
                        >{hh}:{mm}</div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
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
    </div>,
    document.body
  );
};

const Dot = () => <span style={{ width: 3, height: 3, borderRadius: 999, background: 'rgba(255,255,255,0.3)' }}/>;

export default DetailSheet;

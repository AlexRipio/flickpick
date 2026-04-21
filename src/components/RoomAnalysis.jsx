import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AmbientBackdrop, BackButton } from '@/components/fp/primitives';
import { Poster } from '@/components/fp/Poster';
import { FP, memberColor } from '@/lib/fp';
import { getRoom, subscribe, hydrateRoomById } from '@/lib/roomStore';
import { posterUrl } from '@/lib/tmdb';
import { computeRoomAnalysis } from '@/lib/roomAnalysis';
import html2canvas from 'html2canvas'

// ── Animated counter ──────────────────────────────────────────────────────────
function AnimatedNumber({ target, duration = 1200, suffix = '' }) {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCurrent(Math.round(ease * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    const id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [target, duration]);
  return <>{current}{suffix}</>;
}

// ── Genre bar ─────────────────────────────────────────────────────────────────
function GenreBar({ genre, maxCount, delay = 0 }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth((genre.count / maxCount) * 100), delay);
    return () => clearTimeout(t);
  }, [genre.count, maxCount, delay]);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>
        <span>{genre.emoji} {genre.name}</span>
        <span style={{ color: FP.textDim }}>{genre.count} {genre.count === 1 ? 'match' : 'matches'}</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 999,
          background: 'linear-gradient(90deg, #FF6B4A, #FF3B6B)',
          width: `${width}%`,
          transition: `width 0.9s cubic-bezier(0.2,0.8,0.3,1) ${delay}ms`,
        }}/>
      </div>
    </div>
  );
}

// ── Share card (captured as image) ───────────────────────────────────────────
const ShareCard = React.forwardRef(function ShareCard({ analysis, room }, ref) {
  if (!analysis) return null;
  const { compatibilityPct, compatTier, totalMatches, memberStats, topGenres } = analysis;
  return (
    <div ref={ref} style={{
      width: 380, minHeight: 580,
      background: 'linear-gradient(145deg, #1a0533 0%, #0B0420 50%, #07050E 100%)',
      borderRadius: 28, padding: '36px 28px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
      fontFamily: '"Space Grotesk", system-ui',
      position: 'absolute', left: '-9999px', top: 0,
    }}>
      {/* Logo */}
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 4, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
        🎬 FlickPick Wrapped
      </div>

      {/* Big % */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: '"Syne", sans-serif', fontSize: 96, fontWeight: 900, lineHeight: 0.9,
          background: compatTier.bg,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>{compatibilityPct}%</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginTop: 8, letterSpacing: 1 }}>
          COMPATIBILIDAD
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginTop: 6 }}>
          {compatTier.emoji} {compatTier.label}
        </div>
      </div>

      {/* Members */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
        {memberStats.map((ms, i) => (
          <div key={ms.member.id} style={{ textAlign: 'center' }}>
            {ms.member.avatarUrl ? (
              <div style={{
                width: 48, height: 48, borderRadius: 999, overflow: 'hidden',
                background: '#1a0f2e', margin: '0 auto',
              }}>
                <img src={ms.member.avatarUrl} alt={ms.member.name} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
              </div>
            ) : (
              <div style={{
                width: 48, height: 48, borderRadius: 999,
                background: memberColor(i), color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 800, margin: '0 auto',
              }}>{(ms.member.name || '?')[0].toUpperCase()}</div>
            )}
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{ms.member.name}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: ms.personality.color }}>{ms.personality.emoji} {ms.personality.label}</div>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div style={{
        width: '100%', borderRadius: 16,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        padding: '14px 18px',
        display: 'flex', gap: 20, justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 30, fontWeight: 900, color: '#FF3B6B' }}>{totalMatches}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>MATCHES</div>
        </div>
        {topGenres[0] && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 26 }}>{topGenres[0].emoji}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600, maxWidth: 60, lineHeight: 1.2 }}>{topGenres[0].name.toUpperCase()}</div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontWeight: 600, letterSpacing: 2, marginTop: 'auto' }}>
        flickpick.app
      </div>
    </div>
  );
});

// ── Main screen ───────────────────────────────────────────────────────────────
export default function RoomAnalysis() {
  const { id: roomId }    = useParams();
  const navigate          = useNavigate();
  const shareCardRef      = useRef(null);

  const [room, setRoom]         = useState(() => getRoom(roomId));
  const [loading, setLoading]   = useState(!getRoom(roomId));
  const [visible, setVisible]   = useState(false);
  const [sharing, setSharing]   = useState(false);

  // Load room
  useEffect(() => {
    const unsub = subscribe(() => setRoom(getRoom(roomId)));
    hydrateRoomById(roomId)
      .then(r => { if (r) setRoom(r); setLoading(false); })
      .catch(() => setLoading(false));
    return () => unsub?.();
  }, [roomId]);

  // Entrance animation
  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => setVisible(true), 80);
      return () => clearTimeout(t);
    }
  }, [loading]);

  const analysis = room ? computeRoomAnalysis(room) : null;

  // ── Share ─────────────────────────────────────────────────────────────────
  const handleShare = async () => {
    setSharing(true);
    try {
      // Try html2canvas to capture the share card as an image
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(shareCardRef.current, {
        backgroundColor: '#0B0420',
        scale: 2,
        useCORS: true,
        logging: false,
      });

      canvas.toBlob(async (blob) => {
        const file = new File([blob], 'flickpick-wrapped.png', { type: 'image/png' });
        const text = `🎬 ${analysis.compatibilityPct}% de compatibilidad cinematográfica\n${analysis.compatTier.emoji} ${analysis.compatTier.label}\n\n${analysis.totalMatches} matches juntos 🍿`;

        if (navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({ title: 'FlickPick Wrapped', text, files: [file] });
          } catch {}
        } else if (navigator.share) {
          await navigator.share({ title: 'FlickPick Wrapped', text }).catch(() => {});
        } else {
          // Download
          const url = URL.createObjectURL(blob);
          const a   = document.createElement('a');
          a.href     = url;
          a.download = 'flickpick-wrapped.png';
          a.click();
          URL.revokeObjectURL(url);
        }
        setSharing(false);
      }, 'image/png');
    } catch {
      // Fallback: share text only
      const text = `🎬 FlickPick Wrapped\n${analysis?.compatibilityPct}% compatibilidad · ${analysis?.compatTier.emoji} ${analysis?.compatTier.label}\n${analysis?.totalMatches} matches juntos 🍿`;
      if (navigator.share) {
        await navigator.share({ title: 'FlickPick Wrapped', text }).catch(() => {});
      } else {
        navigator.clipboard?.writeText(text);
      }
      setSharing(false);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A070F' }}>
        <AmbientBackdrop hue={280}/>
        <div style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>🎬</div>
          <div style={{ color: FP.textDim, fontSize: 14, marginTop: 12 }}>Calculando compatibilidad…</div>
        </div>
      </div>
    );
  }

  if (!room || !analysis) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A070F' }}>
        <AmbientBackdrop hue={280}/>
        <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', color: FP.textDim }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>😕</div>
          <div>Sala no encontrada</div>
          <button onClick={() => navigate('/home')} style={{ marginTop: 16, padding: '10px 22px', borderRadius: 999, background: FP.flame, border: 'none', color: '#fff', cursor: 'pointer' }}>Inicio</button>
        </div>
      </div>
    );
  }

  const { compatibilityPct, compatTier, memberStats, topGenres, bestMatch, hiddenGem, totalMatches, totalMoviesEvaluated, mostPicky, mostOpen, headline } = analysis;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#07050E', overflowY: 'auto', overflowX: 'hidden' }}>
      <AmbientBackdrop hue={290}/>

      {/* Hidden share card for image capture */}
      <ShareCard ref={shareCardRef} analysis={analysis} room={room} />

      <div style={{
        position: 'relative', zIndex: 2,
        maxWidth: 520, margin: '0 auto',
        padding: '0 20px 60px',
      }}>

        {/* Top bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 0',
        }}>
          <BackButton onClick={() => navigate(-1)}/>
          <div style={{ fontSize: 12, fontWeight: 700, color: FP.textDim, letterSpacing: 2, textTransform: 'uppercase' }}>FlickPick Wrapped</div>
          <div style={{ width: 40 }}/>
        </div>

        {/* ── Hero: Compatibility % ── */}
        <div style={{
          textAlign: 'center',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.7s cubic-bezier(0.2,0.8,0.3,1)',
          padding: '28px 0 24px',
        }}>
          {/* Glow ring */}
          <div style={{
            width: 200, height: 200, borderRadius: 999,
            background: `conic-gradient(${compatTier.color} ${compatibilityPct * 3.6}deg, rgba(255,255,255,0.06) 0deg)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto',
            boxShadow: `0 0 60px ${compatTier.color}44, 0 0 120px ${compatTier.color}22`,
            transition: 'box-shadow 1s',
          }}>
            <div style={{
              width: 172, height: 172, borderRadius: 999,
              background: 'linear-gradient(145deg, #1a0533, #07050E)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                fontFamily: '"Syne", "Space Grotesk", sans-serif',
                fontSize: 64, fontWeight: 900, lineHeight: 1,
                background: compatTier.bg,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                {visible && <AnimatedNumber target={compatibilityPct} suffix="%" duration={1400}/>}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: 2 }}>
                COMPATIBILIDAD
              </div>
            </div>
          </div>

          <div style={{
            marginTop: 20,
            opacity: visible ? 1 : 0,
            transition: 'all 0.6s 0.4s',
          }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{compatTier.emoji}</div>
            <div style={{
              fontFamily: '"Syne", "Space Grotesk", sans-serif',
              fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: -0.5,
            }}>{compatTier.label}</div>
            <div style={{ fontSize: 13, color: FP.textDim, marginTop: 6, fontStyle: 'italic' }}>
              "{headline}"
            </div>
          </div>
        </div>

        {/* ── Stats pill row ── */}
        <div style={{
          display: 'flex', gap: 10, justifyContent: 'center',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(16px)',
          transition: 'all 0.6s 0.5s',
          marginBottom: 20,
        }}>
          {[
            { label: 'Matches', value: totalMatches, emoji: '🎯' },
            { label: 'Evaluadas', value: totalMoviesEvaluated, emoji: '🎬' },
          ].map(s => (
            <div key={s.label} style={{
              flex: 1, textAlign: 'center', padding: '14px 8px',
              borderRadius: 18,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <div style={{ fontSize: 22 }}>{s.emoji}</div>
              <div style={{
                fontFamily: '"Syne", sans-serif',
                fontSize: 30, fontWeight: 900, color: '#fff', lineHeight: 1, marginTop: 4,
              }}>
                {visible && <AnimatedNumber target={s.value} duration={900}/>}
              </div>
              <div style={{ fontSize: 11, color: FP.textDim, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Member personality cards ── */}
        <SectionTitle>Personalidades del grupo</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {memberStats.map((ms, i) => (
            <div key={ms.member.id} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '16px 18px', borderRadius: 20,
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${ms.personality.color}44`,
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateX(0)' : 'translateX(-20px)',
              transition: `all 0.6s ${0.6 + i * 0.12}s`,
            }}>
              {/* Avatar */}
              {ms.member.avatarUrl ? (
                <div style={{
                  width: 52, height: 52, borderRadius: 999, overflow: 'hidden',
                  flexShrink: 0, background: '#1a0f2e',
                  boxShadow: `0 0 18px ${memberColor(i)}66`,
                }}>
                  <img src={ms.member.avatarUrl} alt={ms.member.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                </div>
              ) : (
                <div style={{
                  width: 52, height: 52, borderRadius: 999,
                  background: memberColor(i), color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, fontWeight: 800, flexShrink: 0,
                  boxShadow: `0 0 18px ${memberColor(i)}66`,
                }}>{(ms.member.name || '?')[0].toUpperCase()}</div>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>{ms.member.name}</div>
                <div style={{
                  fontWeight: 700, fontSize: 13,
                  color: ms.personality.color, marginTop: 1,
                }}>{ms.personality.emoji} {ms.personality.label}</div>
                <div style={{ fontSize: 11, color: FP.textDim, marginTop: 2, lineHeight: 1.3 }}>
                  {ms.personality.desc}
                </div>
              </div>

              {/* Like rate ring */}
              <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
                <svg width="44" height="44" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
                  <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4"/>
                  <circle cx="22" cy="22" r="18" fill="none" stroke={ms.personality.color} strokeWidth="4"
                    strokeDasharray={`${2 * Math.PI * 18}`}
                    strokeDashoffset={`${2 * Math.PI * 18 * (1 - ms.likeRate)}`}
                    strokeLinecap="round"
                    style={{ transition: `stroke-dashoffset 1s cubic-bezier(0.2,0.8,0.3,1) ${0.8 + i * 0.1}s` }}
                  />
                </svg>
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 800, color: ms.personality.color,
                }}>{Math.round(ms.likeRate * 100)}%</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Genre breakdown ── */}
        {topGenres.length > 0 && (
          <>
            <SectionTitle>Vuestros géneros favoritos</SectionTitle>
            <div style={{
              padding: '18px 20px', borderRadius: 20,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              marginBottom: 24,
              opacity: visible ? 1 : 0,
              transition: 'all 0.6s 0.8s',
            }}>
              {topGenres.map((g, i) => (
                <GenreBar key={g.id} genre={g} maxCount={topGenres[0].count} delay={visible ? 900 + i * 100 : 99999}/>
              ))}
            </div>
          </>
        )}

        {/* ── Best match ── */}
        {bestMatch && (
          <>
            <SectionTitle>Vuestra mejor peli juntos</SectionTitle>
            <div style={{
              display: 'flex', gap: 14, padding: '14px 16px', borderRadius: 20,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,59,107,0.25)',
              marginBottom: bestMatch && hiddenGem ? 16 : 24,
              opacity: visible ? 1 : 0,
              transition: 'all 0.6s 0.9s',
            }}>
              <div style={{ width: 64, height: 90, borderRadius: 12, overflow: 'hidden', flexShrink: 0, position: 'relative', background: '#1a0f2e' }}>
                {bestMatch.poster_path
                  ? <img src={posterUrl(bestMatch.poster_path, 'w342')} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🎬</div>
                }
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: FP.textDim, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>🏆 Top rated</div>
                <div style={{ fontFamily: '"Syne", sans-serif', fontSize: 17, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{bestMatch.title || bestMatch.name}</div>
                {bestMatch.vote_average > 0 && (
                  <div style={{ marginTop: 5, fontSize: 14, fontWeight: 700, color: '#FFD166' }}>★ {bestMatch.vote_average.toFixed(1)}</div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── Hidden gem ── */}
        {hiddenGem && (
          <>
            <SectionTitle>Joya oculta del grupo</SectionTitle>
            <div style={{
              display: 'flex', gap: 14, padding: '14px 16px', borderRadius: 20,
              background: 'rgba(139,92,246,0.08)',
              border: '1px solid rgba(139,92,246,0.25)',
              marginBottom: 24,
              opacity: visible ? 1 : 0,
              transition: 'all 0.6s 1s',
            }}>
              <div style={{ width: 64, height: 90, borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: '#1a0f2e' }}>
                {hiddenGem.poster_path
                  ? <img src={posterUrl(hiddenGem.poster_path, 'w342')} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>💎</div>
                }
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#C084FC', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>💎 Poco conocida</div>
                <div style={{ fontFamily: '"Syne", sans-serif', fontSize: 17, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{hiddenGem.title || hiddenGem.name}</div>
                <div style={{ marginTop: 5, fontSize: 12, color: FP.textDim }}>
                  Popularidad baja, gusto alto 🙌
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Fun fact ── */}
        {mostPicky && mostOpen && mostPicky.member.id !== mostOpen.member.id && (
          <>
            <SectionTitle>Curiosidades</SectionTitle>
            <div style={{
              display: 'flex', gap: 10, marginBottom: 28,
              opacity: visible ? 1 : 0,
              transition: 'all 0.6s 1.1s',
            }}>
              {[
                { member: mostPicky, label: 'Más selectivo/a', emoji: '🧐', rate: mostPicky.likeRate },
                { member: mostOpen,  label: 'Más abierto/a',   emoji: '😄', rate: mostOpen.likeRate },
              ].map((item, i) => {
                const idx = memberStats.findIndex(ms => ms.member.id === item.member.member.id);
                return (
                  <div key={item.member.member.id} style={{
                    flex: 1, textAlign: 'center', padding: '14px 10px',
                    borderRadius: 18,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}>
                    <div style={{ fontSize: 22 }}>{item.emoji}</div>
                    {item.member.member.avatarUrl ? (
                      <div style={{
                        width: 36, height: 36, borderRadius: 999, overflow: 'hidden',
                        background: '#1a0f2e', margin: '8px auto 4px',
                      }}>
                        <img src={item.member.member.avatarUrl} alt={item.member.member.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                      </div>
                    ) : (
                      <div style={{
                        width: 36, height: 36, borderRadius: 999,
                        background: memberColor(idx < 0 ? i : idx), color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 15, fontWeight: 800, margin: '8px auto 4px',
                      }}>{(item.member.member.name || '?')[0].toUpperCase()}</div>
                    )}
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{item.member.member.name}</div>
                    <div style={{ fontSize: 11, color: FP.textDim, marginTop: 2 }}>{item.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#FFB547', marginTop: 3 }}>
                      {Math.round(item.rate * 100)}% likes
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── Share / actions ── */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 10,
          opacity: visible ? 1 : 0,
          transition: 'all 0.6s 1.2s',
        }}>
          <button
            onClick={handleShare}
            disabled={sharing}
            style={{
              width: '100%', height: 56, borderRadius: 999,
              background: sharing ? 'rgba(255,59,107,0.4)' : FP.flame,
              border: 'none', color: '#fff',
              fontFamily: '"Space Grotesk"', fontWeight: 700, fontSize: 16,
              cursor: sharing ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: '0 8px 24px rgba(255,59,107,0.35)',
              transition: 'background 0.2s',
            }}
          >
            {sharing ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                  <circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10"/>
                </svg>
                Generando imagen…
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Compartir análisis
              </>
            )}
          </button>

          <button
            onClick={() => navigate(`/room/${roomId}/matches`)}
            style={{
              width: '100%', height: 48, borderRadius: 999,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              fontFamily: '"Space Grotesk"',
            }}
          >Ver matches 🍿</button>
        </div>
      </div>

      {/* Floating confetti on entry */}
      {visible && <MiniConfetti />}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: FP.textDim,
      letterSpacing: 2, textTransform: 'uppercase',
      marginBottom: 10,
    }}>{children}</div>
  );
}

function MiniConfetti() {
  const pieces = Array.from({ length: 30 }, (_, i) => {
    const colors = ['#FF6B4A', '#FF3B6B', '#9B3BFF', '#4EFFD6', '#FFB547', '#8B5CF6'];
    const color = colors[i % colors.length];
    const x = Math.random() * 100;
    const delay = Math.random() * 0.6;
    const size = 4 + Math.random() * 7;
    const dur = 2 + Math.random() * 1.5;
    return { i, color, x, delay, size, dur };
  });
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '40vh', pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      {pieces.map(p => (
        <div key={p.i} style={{
          position: 'absolute', top: '-10px', left: `${p.x}%`,
          width: p.size, height: p.size * 0.5,
          background: p.color, borderRadius: 2,
          animation: `fp-fall-${p.i} ${p.dur}s ease-in ${p.delay}s forwards`,
          opacity: 0,
        }}/>
      ))}
      <style>{pieces.map(p => `
        @keyframes fp-fall-${p.i} {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(40vh) rotate(${Math.random() * 720}deg); opacity: 0; }
        }
      `).join('\n')}</style>
    </div>
  );
}

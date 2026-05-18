import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AmbientBackdrop, BackButton, GradientButton, TextField } from '@/components/fp/primitives';
import YearRangePicker from '@/components/YearRangePicker';
import MoodSheet from '@/components/MoodSheet';
import CinemaPickerSheet from '@/components/CinemaPickerSheet';
import { FP } from '@/lib/fp';
import { useProfile } from '@/contexts/ProfileContext';
import { createRoom } from '@/lib/roomStore';
import { VIBES } from '@/lib/vibes';

// Official TMDB provider logos (paths verified against /watch/providers ES).
const TMDB_IMG = (p) => p ? `https://image.tmdb.org/t/p/w185${p}` : null;
const ALL_PLATFORMS = [
  { id: 'cartelera', name: 'En cines',  logo: null,                                  accent: '#FF6B4A', popcorn: true },
  { id: 'netflix',   name: 'Netflix',   logo: '/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg',    accent: '#E50914' },
  { id: 'prime',     name: 'Prime',     logo: '/emthp39XA2YScoYL1p0sdbAH2WA.jpg',    accent: '#00A8E1' },
  { id: 'max',       name: 'Max',       logo: '/Ajqyt5aNxNGjmF9uOfxArGrdf3X.jpg',    accent: '#9B3BFF' },
  { id: 'disney',    name: 'Disney+',   logo: '/97yvRBw1GzX7fXprcF80er19ot.jpg',     accent: '#3D85F2' },
  { id: 'apple',     name: 'Apple TV+', logo: '/peURlLlr8jggOwK53fJ5wdQl05y.jpg',    accent: '#E8E8E8' },
  { id: 'movistar',  name: 'Movistar+', logo: '/jse4MOi92Jgetym7nbXFZZBI6LK.jpg',    accent: '#019DF4' },
  { id: 'filmin',    name: 'Filmin',    logo: '/kO2SWXvDCHAquaUuTJBuZkTBAuU.jpg',    accent: '#FFB400' },
];

const CreateRoomScreen = () => {
  const navigate = useNavigate();
  const { profile, ensureProfile } = useProfile();
  const [roomName, setRoomName] = useState('Noche de peli');
  const [mediaType, setMediaType] = useState('movie');
  const [platforms, setPlatforms] = useState(['netflix', 'prime']);
  const [yearFrom, setYearFrom] = useState(2018);
  const [yearTo, setYearTo] = useState(new Date().getFullYear());
  const [includeWatched, setIncludeWatched] = useState(false);
  const [swipeTarget, setSwipeTarget] = useState(null); // null = sin límite
  const [vibes, setVibes] = useState([]);
  const [moodOpen, setMoodOpen] = useState(false);
  const [cinemaPickerOpen, setCinemaPickerOpen] = useState(false);
  const [selectedCinema, setSelectedCinema] = useState(null); // {id, name, address, city}
  const [cinemaToast, setCinemaToast] = useState(null); // texto del toast (null = oculto)
  const [err, setErr] = useState('');

  const handleSelectCinema = (cinema) => {
    setSelectedCinema(cinema);
    setCinemaToast(`Cine actualizado: ${cinema.name}`);
    setTimeout(() => setCinemaToast(null), 2500);
  };

  // Scroll hint — encourages users to scroll past the platforms grid to
  // discover Estilo / Año / Incluir vistas. Hides as soon as they scroll.
  const scrollRef = useRef(null);
  const [showScrollHint, setShowScrollHint] = useState(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop > 40) setShowScrollHint(false);
      else setShowScrollHint(true);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const togglePlatform = (id) => {
    if (id === 'cartelera') {
      // Toggle cartelera; if turning on, disable all streaming
      if (platforms.includes('cartelera')) {
        setPlatforms(p => p.filter(x => x !== 'cartelera'));
        setSelectedCinema(null);
      } else {
        setPlatforms(['cartelera']); // Only cartelera
        setCinemaPickerOpen(true);
      }
    } else {
      // Toggling streaming platform; disable cartelera if any streaming selected
      if (platforms.includes(id)) {
        setPlatforms(p => p.filter(x => x !== id));
      } else {
        const newPlatforms = platforms.filter(x => x !== 'cartelera').concat(id);
        setPlatforms(newPlatforms);
        setSelectedCinema(null);
      }
    }
  };

  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (busy) return;
    setErr('');
    if (!roomName.trim()) return setErr('Ponle un nombre a la sala.');
    if (!platforms.length) return setErr('Elige al menos una plataforma.');
    const me = profile?.name ? profile : ensureProfile('Invitado');
    setBusy(true);
    try {
      const prefs = { platforms, yearFrom, yearTo, mediaType, includeWatched, vibes, swipeTarget };
      if (selectedCinema) prefs.cinema = selectedCinema;
      const created = await createRoom({
        name: roomName.trim(),
        preferences: prefs,
        host: { id: me.id, name: me.name, avatarUrl: me.avatarUrl || null },
      });
      navigate(`/room/${created.id}/lobby`, { replace: true });
    } catch (e) {
      setErr(e?.message || 'No se pudo crear la sala.');
      setBusy(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <AmbientBackdrop hue={260}/>

      <div style={{ position: 'relative', zIndex: 2, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 520, width: '100%', margin: '0 auto' }}>
        <BackButton onClick={() => navigate('/home')}/>
        <div style={{ fontSize: 13, fontWeight: 600, color: FP.textDim }}>Nueva sala</div>
        <div style={{ width: 42 }}/>
      </div>

      <div ref={scrollRef} style={{ position: 'relative', zIndex: 2, flex: 1, overflowY: 'auto', padding: '10px 24px calc(env(safe-area-inset-bottom, 0px) + 130px)', maxWidth: 520, width: '100%', margin: '0 auto' }}>
        <h1 style={{
          fontFamily: '"Inter", "Space Grotesk", sans-serif', fontSize: 30, fontWeight: 800,
          color: FP.text, margin: 0, letterSpacing: -0.8,
        }}>Crea tu sala</h1>
        <p style={{ fontSize: 14, color: FP.textDim, margin: '8px 0 22px' }}>
          Elige dónde ver y los años. Luego invitas con un código.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: FP.textDim, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
              Modo
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { id: 'movie', label: '🎬 Películas' },
                { id: 'tv', label: '📺 Series' },
              ].map(opt => (
                <button key={opt.id} onClick={() => setMediaType(opt.id)} style={{
                  flex: 1, padding: '14px 10px', borderRadius: 16,
                  background: mediaType === opt.id ? FP.flame : 'rgba(255,255,255,0.05)',
                  border: mediaType === opt.id ? 'none' : '1px solid rgba(255,255,255,0.1)',
                  color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer',
                  fontFamily: '"Space Grotesk", system-ui',
                  boxShadow: mediaType === opt.id ? '0 8px 22px rgba(255,59,107,0.3)' : 'none',
                  transition: 'all 0.18s',
                }}>{opt.label}</button>
              ))}
            </div>
          </div>
          <TextField label="Nombre de la sala" value={roomName} onChange={setRoomName} placeholder="Noche de peli 🍿"/>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: FP.textDim, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                Dónde buscar
              </div>
              <button
                type="button"
                onClick={() => {
                  const allIds = ALL_PLATFORMS.map(p => p.id);
                  const allSelected = allIds.every(id => platforms.includes(id));
                  setPlatforms(allSelected ? [] : allIds);
                }}
                style={{
                  padding: '4px 10px', borderRadius: 999,
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.18)',
                  color: FP.textDim, fontSize: 11, fontWeight: 700,
                  letterSpacing: 0.5, cursor: 'pointer',
                  fontFamily: '"Space Grotesk", system-ui',
                }}
              >
                {ALL_PLATFORMS.every(p => platforms.includes(p.id)) ? 'Ninguna' : 'Todas'}
              </button>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))',
              gap: 8,
            }}>
              {ALL_PLATFORMS.map(p => {
                const active = platforms.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePlatform(p.id)}
                    aria-pressed={active}
                    aria-label={p.name}
                    style={{
                      position: 'relative',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 5,
                      padding: '8px 4px 6px', borderRadius: 14,
                      background: active ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                      border: active ? `1.5px solid ${p.accent}` : '1px solid rgba(255,255,255,0.08)',
                      boxShadow: active ? `0 6px 16px ${p.accent}40` : 'none',
                      cursor: 'pointer', transition: 'all 0.15s',
                      transform: active ? 'translateY(-1px)' : 'none',
                    }}
                  >
                    <div style={{
                      width: 42, height: 42, borderRadius: 11, overflow: 'hidden',
                      background: p.popcorn
                        ? 'linear-gradient(135deg,#FF6B4A,#FF3B6B)'
                        : '#0e0420',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {p.popcorn ? (
                        <span style={{ fontSize: 24, lineHeight: 1, filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.35))' }}>🍿</span>
                      ) : (
                        <img
                          src={TMDB_IMG(p.logo)}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      )}
                    </div>
                    <div style={{
                      fontSize: 10, fontWeight: 700,
                      color: active ? '#fff' : FP.textDim,
                      letterSpacing: 0.2, lineHeight: 1.1, textAlign: 'center',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      maxWidth: 64,
                    }}>{p.name}</div>
                    {active && (
                      <div style={{
                        position: 'absolute', top: 4, right: 4,
                        width: 14, height: 14, borderRadius: '50%',
                        background: p.accent,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.4)',
                      }}>
                        <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                          <path d="M2.5 6.2L4.8 8.5L9.5 3.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cinema selector — only shown when cartelera is selected */}
          {platforms.includes('cartelera') && (
            <div style={{
              padding: '14px 16px', borderRadius: 12,
              background: 'rgba(255,107,74,0.08)',
              border: '1px solid rgba(255,107,74,0.25)',
            }}>
              {selectedCinema ? (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: FP.textDim, marginBottom: 8 }}>
                    🎬 Cine seleccionado
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                        {selectedCinema.name}
                      </div>
                      <div style={{
                        fontSize: 11, color: FP.textDim, marginTop: 2,
                      }}>
                        {selectedCinema.city}
                      </div>
                    </div>
                    <button
                      onClick={() => setCinemaPickerOpen(true)}
                      style={{
                        padding: '6px 10px', borderRadius: 8,
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                        color: FP.textDim, fontSize: 11, fontWeight: 600,
                        cursor: 'pointer', fontFamily: '"Space Grotesk", system-ui',
                      }}
                    >Cambiar</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setCinemaPickerOpen(true)}
                  style={{
                    width: '100%', padding: '12px 12px', borderRadius: 8,
                    background: 'rgba(255,107,74,0.15)', border: '1px solid rgba(255,107,74,0.4)',
                    color: '#fff', fontWeight: 600, fontSize: 13,
                    cursor: 'pointer', fontFamily: '"Space Grotesk", system-ui',
                  }}
                >
                  + Elige un cine
                </button>
              )}
            </div>
          )}

          {/* Vibes (mood) — opcional, abre bottom sheet */}
          <button
            type="button"
            onClick={() => setMoodOpen(true)}
            style={{
              display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 8,
              padding: '10px 16px', borderRadius: 999,
              background: vibes.length ? 'rgba(255,107,74,0.14)' : 'rgba(255,255,255,0.05)',
              border: vibes.length ? '1px solid rgba(255,107,74,0.45)' : '1px solid rgba(255,255,255,0.12)',
              color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              fontFamily: '"Space Grotesk", system-ui',
              transition: 'background 0.15s, border-color 0.15s',
            }}
          >
            {vibes.length === 0
              ? <>+ Estilo <span style={{ color: FP.textDim, fontWeight: 600 }}>(opcional)</span></>
              : <>{VIBES.filter(v => vibes.includes(v.id)).map(v => v.emoji).join(' ')} {vibes.length} {vibes.length === 1 ? 'estilo' : 'estilos'} · ✏️</>}
          </button>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: FP.textDim, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
              Año de estreno
            </div>
            <YearRangePicker
              yearFrom={yearFrom}
              yearTo={yearTo}
              min={1980}
              max={new Date().getFullYear()}
              allowAny={false}
              onChange={({ yearFrom: yf, yearTo: yt }) => {
                setYearFrom(yf ?? 1980);
                setYearTo(yt ?? new Date().getFullYear());
              }}
            />
          </div>

          {/* Límite de swipes — null = sin límite (pausa cada 25),
              número = sala termina al alcanzarlo (pausa en mitad). */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: FP.textDim, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                Límite de swipes
              </div>
              <div style={{ fontSize: 11, color: FP.textDim }}>
                {swipeTarget == null
                  ? 'Pausa cada 25'
                  : `Pausa a los ${Math.max(5, Math.ceil(swipeTarget / 2))}`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { value: null, label: '∞ Sin límite' },
                { value: 20, label: '20' },
                { value: 40, label: '40' },
                { value: 60, label: '60' },
                { value: 100, label: '100' },
              ].map(opt => {
                const active = swipeTarget === opt.value;
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => setSwipeTarget(opt.value)}
                    style={{
                      flex: opt.value == null ? '1 1 auto' : '0 0 auto',
                      padding: '10px 16px', borderRadius: 999,
                      background: active ? FP.flame : 'rgba(255,255,255,0.05)',
                      border: active ? 'none' : '1px solid rgba(255,255,255,0.10)',
                      color: '#fff', fontSize: 14, fontWeight: 700,
                      fontFamily: '"Space Grotesk", system-ui',
                      cursor: 'pointer',
                      boxShadow: active ? '0 6px 16px rgba(255,59,107,0.35)' : 'none',
                      transition: 'all 0.15s',
                    }}
                  >{opt.label}</button>
                );
              })}
            </div>
          </div>

          {/* Toggle: incluir películas que ya he visto */}
          <button
            type="button"
            onClick={() => setIncludeWatched(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, padding: '14px 16px', borderRadius: 16,
              background: includeWatched ? 'rgba(155,107,255,0.10)' : 'rgba(255,255,255,0.04)',
              border: includeWatched ? '1px solid rgba(155,107,255,0.40)' : '1px solid rgba(255,255,255,0.08)',
              cursor: 'pointer', textAlign: 'left',
              transition: 'background 0.15s, border-color 0.15s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" stroke={includeWatched ? '#9B6BFF' : 'rgba(255,255,255,0.55)'} strokeWidth="2" strokeLinejoin="round"/>
                <circle cx="12" cy="12" r="3" stroke={includeWatched ? '#9B6BFF' : 'rgba(255,255,255,0.55)'} strokeWidth="2"/>
              </svg>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: FP.text }}>
                  Incluir películas ya vistas
                </div>
                <div style={{ fontSize: 12, color: FP.textDim, marginTop: 2 }}>
                  {includeWatched ? 'Aparecerán también las que ya viste' : 'Solo películas nuevas para todos'}
                </div>
              </div>
            </div>
            {/* Switch visual */}
            <div style={{
              width: 44, height: 26, borderRadius: 999, flexShrink: 0,
              background: includeWatched ? '#9B6BFF' : 'rgba(255,255,255,0.15)',
              position: 'relative',
              transition: 'background 0.18s',
            }}>
              <div style={{
                position: 'absolute', top: 3, left: includeWatched ? 21 : 3,
                width: 20, height: 20, borderRadius: 999,
                background: '#fff',
                transition: 'left 0.22s cubic-bezier(.4,1.4,.6,1)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              }}/>
            </div>
          </button>

          {err && <div style={{ color: '#FF3B6B', fontSize: 13, fontWeight: 600 }}>{err}</div>}
        </div>
      </div>

      {/* Scroll hint — clic = baja suave; desaparece al scrollear */}
      <div
        style={{
          position: 'fixed', left: 0, right: 0,
          bottom: `calc(env(safe-area-inset-bottom, 0px) + 100px)`,
          zIndex: 9,
          pointerEvents: showScrollHint ? 'auto' : 'none',
          display: 'flex', justifyContent: 'center',
          opacity: showScrollHint ? 1 : 0,
          transform: showScrollHint ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 0.25s, transform 0.25s',
        }}
      >
        <button
          type="button"
          onClick={() => {
            const el = scrollRef.current;
            if (!el) return;
            // Soft scroll al final (donde está "Incluir vistas")
            el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
          }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 999,
            background: 'rgba(15,4,32,0.85)',
            border: '1px solid rgba(255,255,255,0.14)',
            color: '#fff', fontSize: 12, fontWeight: 700,
            fontFamily: '"Space Grotesk", system-ui',
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            letterSpacing: 0.2, cursor: 'pointer',
          }}
        >
          <span>Más opciones abajo</span>
          <span style={{ display: 'inline-block', animation: 'fp-bounce-down 1.4s ease-in-out infinite', fontSize: 14 }}>↓</span>
        </button>
        <style>{`
          @keyframes fp-bounce-down {
            0%, 100% { transform: translateY(0); }
            50%      { transform: translateY(4px); }
          }
        `}</style>
      </div>

      {/* Sticky bottom CTA — siempre a un toque sin importar el scroll. */}
      <div style={{
        position: 'fixed', left: 0, right: 0,
        bottom: 0, zIndex: 10,
        padding: `12px 20px calc(env(safe-area-inset-bottom, 0px) + 14px)`,
        background: 'linear-gradient(180deg, rgba(11,4,32,0.55) 0%, rgba(11,4,32,0.92) 60%, rgba(11,4,32,0.97) 100%)',
        backdropFilter: 'blur(18px) saturate(180%)',
        WebkitBackdropFilter: 'blur(18px) saturate(180%)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 -10px 30px rgba(0,0,0,0.35)',
      }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <GradientButton
            variant="flame"
            onClick={create}
            disabled={busy}
            style={{
              height: 64,
              fontSize: 17,
              fontWeight: 800,
              letterSpacing: 0.3,
              boxShadow: '0 14px 32px rgba(255,59,107,0.45)',
            }}
          >
            {busy ? 'Creando sala…' : '🎬 Empezar partida'}
          </GradientButton>
        </div>
      </div>

      <MoodSheet
        open={moodOpen}
        value={vibes}
        onClose={() => setMoodOpen(false)}
        onApply={setVibes}
      />

      <CinemaPickerSheet
        isOpen={cinemaPickerOpen}
        onClose={() => setCinemaPickerOpen(false)}
        onSelectCinema={handleSelectCinema}
      />

      {cinemaToast && (
        <div style={{
          position: 'fixed',
          left: '50%', transform: 'translateX(-50%)',
          bottom: `calc(env(safe-area-inset-bottom, 0px) + 110px)`,
          zIndex: 1100,
          padding: '10px 18px',
          borderRadius: 999,
          background: 'rgba(15, 4, 32, 0.92)',
          border: '1px solid rgba(255, 107, 74, 0.35)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          color: '#fff',
          fontFamily: '"Space Grotesk", system-ui',
          fontSize: 13, fontWeight: 700,
          letterSpacing: 0.2,
          display: 'inline-flex', alignItems: 'center', gap: 8,
          boxShadow: '0 12px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,107,74,0.15) inset',
          animation: 'fp-toast-in 0.22s cubic-bezier(.4,1.4,.6,1)',
          maxWidth: 'calc(100vw - 40px)',
        }}>
          <span style={{ fontSize: 16 }}>🎬</span>
          <span style={{
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{cinemaToast}</span>
          <style>{`
            @keyframes fp-toast-in {
              from { opacity: 0; transform: translate(-50%, 8px); }
              to   { opacity: 1; transform: translate(-50%, 0); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
};

export default CreateRoomScreen;

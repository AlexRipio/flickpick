import React, { useEffect, useState } from 'react';
import { FP } from '@/lib/fp';

// Backend lives at flickpick.mov/api (QA frontend domain has no /api proxy).
const API_BASE = import.meta.env.VITE_API_URL || 'https://flickpick.mov/api';

// Fetch with timeout to prevent UI hangs.
function fetchWithTimeout(path, ms = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(`${API_BASE}${path}`, { signal: ctrl.signal }).finally(() => clearTimeout(t));
}

const CinemaPickerSheet = ({ onSelectCinema, onClose, isOpen }) => {
  const [step, setStep] = useState('permission'); // permission | detecting | list
  const [cities, setCities] = useState([]);
  const [citiesError, setCitiesError] = useState('');
  const [selectedCity, setSelectedCity] = useState(null);
  const [theaters, setTheaters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [geoError, setGeoError] = useState('');

  // Reset state on close so reopens are clean.
  useEffect(() => {
    if (!isOpen) {
      setStep('permission');
      setSelectedCity(null);
      setTheaters([]);
      setError('');
      setGeoError('');
      setCitiesError('');
    }
  }, [isOpen]);

  // Fetch all cities on open.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      setCitiesError('');
      try {
        const res = await fetchWithTimeout('/cinemas/cities', 10000);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setCities(data.cities || []);
      } catch (e) {
        if (!cancelled) setCitiesError('No se pudieron cargar las ciudades. Reintenta.');
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  const requestGeolocation = () => {
    setGeoError('');
    if (!navigator.geolocation) {
      setGeoError('Geolocalización no disponible en tu dispositivo.');
      setStep('list');
      return;
    }
    setStep('detecting');
    const geoOpts = { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 };
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetchWithTimeout(
            `/cinemas/nearby?lat=${latitude}&lng=${longitude}`, 25000
          );
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          setSelectedCity({ cityId: data.city?.cityId, name: data.city?.name });
          setTheaters(Array.isArray(data.theaters) ? data.theaters : []);
          setStep('list');
        } catch (e) {
          setGeoError('No se pudieron cargar cines cercanos. Elige manualmente.');
          setStep('list');
        }
      },
      (err) => {
        const msg = err?.code === 1
          ? 'Permiso de ubicación denegado. Elige manualmente.'
          : 'No pudimos obtener tu ubicación. Elige manualmente.';
        setGeoError(msg);
        setStep('list');
      },
      geoOpts
    );
  };

  const fetchTheatersForCity = async (cityId, cityName) => {
    setSelectedCity({ cityId, name: cityName });
    setLoading(true);
    setError('');
    setTheaters([]);
    try {
      const res = await fetchWithTimeout(`/cinemas/city/${cityId}`, 25000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data.theaters) ? data.theaters : [];
      setTheaters(list);
      if (!list.length) setError('No se encontraron cines en esta ciudad.');
    } catch (e) {
      setError(e.name === 'AbortError'
        ? 'La petición tardó demasiado. Reintenta.'
        : 'Error al cargar cines. Reintenta.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'flex-end',
    }} onClick={onClose}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
      }} onClick={onClose} />

      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative', zIndex: 2,
          width: '100%', maxWidth: 520, margin: '0 auto',
          background: '#0a0415',
          borderRadius: '24px 24px 0 0',
          padding: '24px 20px calc(env(safe-area-inset-bottom, 0px) + 20px)',
          maxHeight: '80vh', overflowY: 'auto',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 20,
        }}>
          <h2 style={{
            fontSize: 18, fontWeight: 700, color: FP.text, margin: 0,
          }}>Elige tu cine</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: FP.textDim,
              fontSize: 20, cursor: 'pointer', padding: 0,
            }}
          >✕</button>
        </div>

        {step === 'permission' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{
              fontSize: 13, color: FP.textDim, margin: '0 0 16px 0',
            }}>
              Usa tu ubicación para encontrar el cine más cercano a ti, o elige manualmente.
            </p>
            <button
              onClick={requestGeolocation}
              style={{
                padding: '14px 20px', borderRadius: 12,
                background: FP.flame, border: 'none',
                color: '#fff', fontWeight: 700, fontSize: 14,
                cursor: 'pointer', fontFamily: '"Space Grotesk", system-ui',
              }}
            >📍 Detectar ubicación</button>
            <button
              onClick={() => setStep('list')}
              style={{
                padding: '12px 20px', borderRadius: 12,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff', fontWeight: 700, fontSize: 14,
                cursor: 'pointer', fontFamily: '"Space Grotesk", system-ui',
              }}
            >O elige manualmente</button>
          </div>
        )}

        {step === 'detecting' && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            padding: '40px 20px',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              border: '3px solid rgba(255,255,255,0.2)',
              borderTopColor: FP.flame,
              animation: 'spin 0.8s linear infinite',
            }} />
            <p style={{ color: FP.textDim, margin: 0, fontSize: 13 }}>Detectando ubicación...</p>
            <button
              onClick={() => { setStep('list'); setGeoError(''); }}
              style={{
                marginTop: 8, padding: '8px 16px', borderRadius: 8,
                background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                color: FP.textDim, fontSize: 12, cursor: 'pointer',
                fontFamily: '"Space Grotesk", system-ui',
              }}
            >Saltar y elegir manualmente</button>
          </div>
        )}

        {step === 'list' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {geoError && (
              <div style={{
                padding: '10px 14px', borderRadius: 8,
                background: 'rgba(255,107,74,0.15)', border: '1px solid rgba(255,107,74,0.3)',
                color: 'rgba(255,107,74,0.95)', fontSize: 12,
              }}>{geoError}</div>
            )}
            {error && (
              <div style={{
                padding: '10px 14px', borderRadius: 8,
                background: 'rgba(255,107,74,0.15)', border: '1px solid rgba(255,107,74,0.3)',
                color: 'rgba(255,107,74,0.95)', fontSize: 12,
              }}>{error}</div>
            )}
            {citiesError && !selectedCity && (
              <div style={{
                padding: '10px 14px', borderRadius: 8,
                background: 'rgba(255,107,74,0.15)', border: '1px solid rgba(255,107,74,0.3)',
                color: 'rgba(255,107,74,0.95)', fontSize: 12,
              }}>{citiesError}</div>
            )}

            {!selectedCity ? (
              <div>
                <p style={{
                  fontSize: 12, fontWeight: 700, color: FP.textDim,
                  letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, marginTop: 0,
                }}>Ciudades disponibles</p>
                {cities.length === 0 && !citiesError ? (
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                    padding: '20px',
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      border: '2px solid rgba(255,255,255,0.2)',
                      borderTopColor: FP.flame,
                      animation: 'spin 0.8s linear infinite',
                    }} />
                    <p style={{ color: FP.textDim, fontSize: 12, margin: 0 }}>Cargando ciudades...</p>
                  </div>
                ) : (
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8,
                  }}>
                    {cities.map(city => (
                      <button
                        key={city.cityId}
                        onClick={() => fetchTheatersForCity(city.cityId, city.name)}
                        disabled={loading}
                        style={{
                          padding: '12px 12px', borderRadius: 10,
                          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                          color: '#fff', fontWeight: 600, fontSize: 13,
                          cursor: loading ? 'wait' : 'pointer',
                          fontFamily: '"Space Grotesk", system-ui',
                          opacity: loading ? 0.5 : 1, textAlign: 'center',
                          transition: 'all 0.15s',
                        }}
                      >{city.name}</button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
                }}>
                  <button
                    onClick={() => { setSelectedCity(null); setTheaters([]); setError(''); }}
                    style={{
                      background: 'none', border: 'none', color: FP.textDim,
                      fontSize: 13, cursor: 'pointer', padding: '4px 8px',
                      fontFamily: '"Space Grotesk", system-ui',
                    }}
                  >← Atrás</button>
                  <h3 style={{
                    fontSize: 14, fontWeight: 700, color: FP.text, margin: 0,
                  }}>{selectedCity.name}</h3>
                </div>

                {loading ? (
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                    padding: '30px',
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      border: '2px solid rgba(255,255,255,0.2)',
                      borderTopColor: FP.flame,
                      animation: 'spin 0.8s linear infinite',
                    }} />
                    <p style={{ color: FP.textDim, fontSize: 12, margin: 0 }}>Cargando cines...</p>
                  </div>
                ) : (
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: 8,
                  }}>
                    {theaters.length === 0 ? (
                      !error && <p style={{ color: FP.textDim, fontSize: 13, margin: 0 }}>
                        No hay cines disponibles.
                      </p>
                    ) : (
                      theaters.map(theater => (
                        <button
                          key={theater.slug}
                          onClick={() => {
                            onSelectCinema({
                              id: theater.slug,
                              name: theater.name,
                              address: theater.address,
                              city: selectedCity.name,
                            });
                            onClose();
                          }}
                          style={{
                            textAlign: 'left', padding: '12px 14px', borderRadius: 10,
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                            color: '#fff', cursor: 'pointer', fontFamily: '"Space Grotesk", system-ui',
                            transition: 'all 0.15s',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{theater.name}</div>
                            {theater.address && (
                              <div style={{
                                fontSize: 11, color: FP.textDim, marginTop: 4,
                                maxHeight: 40, overflow: 'hidden', textOverflow: 'ellipsis',
                              }}>{theater.address}</div>
                            )}
                          </div>
                          {typeof theater.distKm === 'number' && (
                            <div style={{
                              flexShrink: 0,
                              padding: '4px 9px', borderRadius: 999,
                              background: 'rgba(255,107,74,0.15)',
                              border: '1px solid rgba(255,107,74,0.35)',
                              color: 'rgba(255,107,74,0.95)',
                              fontSize: 11, fontWeight: 700,
                              letterSpacing: 0.2,
                            }}>{theater.distKm} km</div>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{
          marginTop: 16, paddingTop: 12,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          textAlign: 'center',
          fontSize: 10, color: 'rgba(255,255,255,0.35)',
          letterSpacing: 0.3,
          fontFamily: '"Space Grotesk", system-ui',
        }}>
          Función disponible solo en España 🇪🇸
        </div>

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
};

export default CinemaPickerSheet;

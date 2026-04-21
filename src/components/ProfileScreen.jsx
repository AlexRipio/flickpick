import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AmbientBackdrop, Avatar, BackButton, TextField, GradientButton } from '@/components/fp/primitives';
import { FP } from '@/lib/fp';
import { useProfile } from '@/contexts/ProfileContext';
import {
  DICEBEAR_STYLES, dicebearUrl, defaultAvatarForName, freshSeed, uploadAvatar, canUpload,
} from '@/lib/avatars';

function readAllRooms() {
  try { return JSON.parse(localStorage.getItem('flickpick.rooms.v1') || '{}'); } catch { return {}; }
}

const ProfileScreen = () => {
  const navigate = useNavigate();
  const { profile, setProfileFields, clearProfile } = useProfile();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(profile?.name || '');
  const [draftEmail, setDraftEmail] = useState(profile?.email || '');
  const [avatarOpen, setAvatarOpen] = useState(false);

  const stats = useMemo(() => {
    if (!profile?.id) return { rooms: 0, matches: 0, likes: 0, skips: 0 };
    const all = Object.values(readAllRooms());
    let rooms = 0, matches = 0, likes = 0, skips = 0;
    for (const r of all) {
      if (!r) continue;
      const me = r.members?.find(m => m.id === profile.id);
      if (!me) continue;
      rooms += 1;
      matches += (r.matches?.length || 0);
      likes += me.taste?.likes || 0;
      skips += me.taste?.skips || 0;
    }
    return { rooms, matches, likes, skips };
  }, [profile]);

  if (!profile) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <AmbientBackdrop hue={280}/>
        <div style={{ position: 'relative', zIndex: 2, color: FP.textDim }}>Sin perfil.</div>
      </div>
    );
  }

  const initial = (profile.name || '?').trim().charAt(0).toUpperCase();

  const save = () => {
    if (!draftName.trim()) return;
    setProfileFields({ name: draftName.trim(), email: draftEmail.trim() });
    setEditing(false);
  };

  const logout = () => {
    if (!window.confirm('¿Cerrar sesión? Perderás los datos guardados.')) return;
    clearProfile();
    navigate('/welcome', { replace: true });
  };

  const handleAvatarSave = (patch) => {
    setProfileFields(patch);
    setAvatarOpen(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <AmbientBackdrop hue={280}/>

      <div style={{
        position: 'relative', zIndex: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', maxWidth: 520, width: '100%', margin: '0 auto',
      }}>
        <BackButton onClick={() => navigate('/home')}/>
        <div style={{ fontSize: 13, fontWeight: 600, color: FP.textDim }}>Perfil</div>
        <div style={{ width: 42 }}/>
      </div>

      <div className="no-scrollbar" style={{
        position: 'relative', zIndex: 2, flex: 1, overflowY: 'auto',
        padding: '6px 24px 40px', maxWidth: 520, width: '100%', margin: '0 auto',
      }}>
        {/* Avatar + name */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginTop: 6, marginBottom: 26 }}>
          <button onClick={() => setAvatarOpen(true)} style={{
            position: 'relative', padding: 0, background: 'transparent', border: 'none', cursor: 'pointer',
          }}>
            <div style={{
              width: 104, height: 104, borderRadius: 999,
              background: profile.avatarUrl ? '#1a0f2e' : FP.flame,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontFamily: '"Space Grotesk"', fontWeight: 800, fontSize: 42,
              boxShadow: '0 18px 40px rgba(255,59,107,0.45)',
              border: '3px solid rgba(255,255,255,0.1)',
              overflow: 'hidden',
            }}>
              {profile.avatarUrl
                ? <img src={profile.avatarUrl} alt={profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                : <span>{initial}</span>
              }
            </div>
            {/* Edit badge */}
            <div style={{
              position: 'absolute', right: -2, bottom: -2,
              width: 34, height: 34, borderRadius: 999,
              background: FP.flame,
              border: '3px solid #07050E',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(255,59,107,0.5)',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M14.06 6.19l3.75 3.75M3 21h4.24l10.58-10.58a1.5 1.5 0 000-2.12l-3.12-3.12a1.5 1.5 0 00-2.12 0L3 15.76V21z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </button>
          {!editing && (
            <>
              <div style={{
                fontFamily: '"Space Grotesk", system-ui',
                fontSize: 26, fontWeight: 800, color: FP.text,
                letterSpacing: -0.6,
              }}>{profile.name}</div>
              {profile.email && <div style={{ fontSize: 13, color: FP.textDim }}>{profile.email}</div>}
              <button onClick={() => setEditing(true)} style={{
                marginTop: 2, padding: '8px 16px', borderRadius: 999,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>Editar perfil</button>
            </>
          )}
        </div>

        {editing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 26 }}>
            <TextField label="Nombre" value={draftName} onChange={setDraftName} placeholder="Tu nombre"/>
            <TextField label="Email" value={draftEmail} onChange={setDraftEmail} placeholder="tu@correo.com" type="email"/>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={() => { setEditing(false); setDraftName(profile.name); setDraftEmail(profile.email || ''); }} style={{
                flex: 1, height: 48, borderRadius: 999,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>Cancelar</button>
              <div style={{ flex: 1.3 }}>
                <GradientButton variant="flame" onClick={save} style={{ height: 48 }}>Guardar</GradientButton>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 26,
        }}>
          <StatCard label="Salas" value={stats.rooms} accent={FP.violet}/>
          <StatCard label="Matches" value={stats.matches} accent={FP.flame}/>
          <StatCard label="Me gusta" value={stats.likes} accent="linear-gradient(135deg,#4EFFD6,#0EA5A0)"/>
          <StatCard label="Saltadas" value={stats.skips} accent="rgba(255,255,255,0.08)" plain/>
        </div>

        {/* Settings list */}
        <div style={{
          borderRadius: 20, overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.03)',
          marginBottom: 14,
        }}>
          <SettingRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2l3 7 7 .5-5.5 4.5L18 22l-6-4-6 4 1.5-8L2 9.5 9 9z" stroke="#FFB547" strokeWidth="2" strokeLinejoin="round"/></svg>}
            label="Tus matches"
            onClick={() => navigate('/home')}
          />
          <SettingRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h10" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>}
            label="Crear sala"
            onClick={() => navigate('/create')}
          />
          <SettingRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M14 3h7v7M10 21H3v-7M21 3l-8 8M3 21l8-8" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            label="Unirse con código"
            onClick={() => navigate('/join')}
          />
        </div>

        <div style={{
          borderRadius: 20, overflow: 'hidden',
          border: '1px solid rgba(255,59,107,0.2)',
          background: 'rgba(255,59,107,0.05)',
        }}>
          <SettingRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="#FF3B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            label={<span style={{ color: '#FF3B6B' }}>Cerrar sesión</span>}
            onClick={logout}
            hideChevron
          />
        </div>

        <div style={{
          marginTop: 26, textAlign: 'center',
          fontSize: 11, color: FP.textMuted,
          letterSpacing: 1, textTransform: 'uppercase',
        }}>
          FlickPick · Swipe. Match. Watch.
        </div>
      </div>

      {avatarOpen && (
        <AvatarPicker
          profile={profile}
          onClose={() => setAvatarOpen(false)}
          onSave={handleAvatarSave}
        />
      )}
    </div>
  );
};

// ── Avatar picker sheet ───────────────────────────────────────────────────────
function AvatarPicker({ profile, onClose, onSave }) {
  const [mode, setMode]           = useState('generate'); // 'generate' | 'upload'
  const [seed, setSeed]           = useState(profile.avatarSeed || profile.name || 'flickpick');
  const [selStyle, setSelStyle]   = useState(profile.avatarStyle || 'pixel-art');
  const [uploadUrl, setUploadUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr]             = useState('');
  const fileRef = useRef(null);

  const previewUrl = mode === 'upload'
    ? (uploadUrl || profile.avatarUrl || defaultAvatarForName(profile.name))
    : dicebearUrl(selStyle, seed);

  const regenerate = () => setSeed(freshSeed(profile.name));

  const pickFile = () => fileRef.current?.click();

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr('');

    // Show local preview immediately
    const localUrl = URL.createObjectURL(file);
    setUploadUrl(localUrl);

    if (!canUpload()) {
      setErr('La subida requiere cuenta conectada (Supabase). Usa "Generar" o conecta Google.');
      return;
    }

    setUploading(true);
    try {
      const publicUrl = await uploadAvatar(file, profile.id);
      setUploadUrl(publicUrl);
      URL.revokeObjectURL(localUrl);
    } catch (e2) {
      setErr(e2.message || 'Error al subir.');
      // keep the local preview so user sees what they picked
    } finally {
      setUploading(false);
    }
  };

  const save = () => {
    if (mode === 'generate') {
      onSave({
        avatarUrl: dicebearUrl(selStyle, seed),
        avatarStyle: selStyle,
        avatarSeed: seed,
        avatarType: 'dicebear',
      });
    } else {
      if (!uploadUrl) { setErr('Selecciona una imagen primero.'); return; }
      if (uploadUrl.startsWith('blob:') && canUpload()) {
        setErr('Espera a que termine la subida.');
        return;
      }
      if (uploadUrl.startsWith('blob:') && !canUpload()) {
        // No Supabase → can't persist remote URL. Block.
        setErr('No se puede guardar la foto sin conexión a Supabase. Usa "Generar".');
        return;
      }
      onSave({
        avatarUrl: uploadUrl,
        avatarType: 'upload',
      });
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 120,
        background: 'rgba(7,5,14,0.82)', backdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520,
          background: 'linear-gradient(180deg, #130828 0%, #0A070F 100%)',
          borderTopLeftRadius: 28, borderTopRightRadius: 28,
          border: '1px solid rgba(255,255,255,0.08)',
          maxHeight: '92vh', overflowY: 'auto',
          animation: 'fp-slide-up 0.3s cubic-bezier(0.2,0.8,0.3,1)',
          padding: '18px 22px 28px',
        }}
      >
        {/* Handle */}
        <div style={{ width: 40, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.2)', margin: '0 auto 14px' }}/>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h2 style={{
            fontFamily: '"Syne", "Space Grotesk", sans-serif',
            fontSize: 22, fontWeight: 800, color: FP.text, margin: 0, letterSpacing: -0.6,
          }}>Avatar</h2>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 999,
            background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M6 18L18 6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 140, height: 140, borderRadius: 999, overflow: 'hidden',
            background: '#1a0f2e',
            border: '3px solid rgba(255,255,255,0.12)',
            boxShadow: '0 20px 50px rgba(155,59,255,0.4)',
          }}>
            <img src={previewUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
          </div>
          {mode === 'generate' && (
            <button onClick={regenerate} style={{
              padding: '8px 16px', borderRadius: 999,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M4 4v6h6M20 20v-6h-6M20 4a8 8 0 00-14 3M4 20a8 8 0 0014-3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Generar nuevo
            </button>
          )}
        </div>

        {/* Mode tabs */}
        <div style={{
          display: 'flex', gap: 6, padding: 4, borderRadius: 14,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
          marginBottom: 18,
        }}>
          {[
            { id: 'generate', label: 'Generar', emoji: '✨' },
            { id: 'upload',   label: 'Subir foto', emoji: '📷' },
          ].map(t => (
            <button key={t.id} onClick={() => { setMode(t.id); setErr(''); }} style={{
              flex: 1, padding: '10px 8px', borderRadius: 11,
              background: mode === t.id ? 'rgba(255,255,255,0.09)' : 'transparent',
              border: 'none', color: mode === t.id ? '#fff' : FP.textDim,
              fontFamily: '"Space Grotesk"', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              transition: 'all 0.18s',
            }}>
              {t.emoji} {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {mode === 'generate' ? (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: FP.textDim, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
              Estilo
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 20,
            }}>
              {DICEBEAR_STYLES.map(s => {
                const active = s.id === selStyle;
                return (
                  <button key={s.id} onClick={() => setSelStyle(s.id)} style={{
                    padding: 8, borderRadius: 14,
                    background: active ? 'rgba(255,59,107,0.15)' : 'rgba(255,255,255,0.04)',
                    border: active ? '1.5px solid #FF3B6B' : '1px solid rgba(255,255,255,0.08)',
                    color: '#fff', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    transition: 'all 0.14s',
                  }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: 12, overflow: 'hidden',
                      background: '#1a0f2e',
                    }}>
                      <img src={dicebearUrl(s.id, seed)} alt={s.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                    </div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: active ? '#fff' : FP.textDim }}>{s.label}</div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div style={{ marginBottom: 20 }}>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={onFileChange}
              style={{ display: 'none' }}
            />
            <button onClick={pickFile} disabled={uploading} style={{
              width: '100%', padding: '18px 14px', borderRadius: 18,
              background: 'rgba(255,255,255,0.04)',
              border: '1.5px dashed rgba(255,255,255,0.18)',
              color: '#fff', cursor: uploading ? 'default' : 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              opacity: uploading ? 0.7 : 1,
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M16 8l-4-4-4 4M12 4v12" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                {uploading ? 'Subiendo…' : uploadUrl ? 'Cambiar foto' : 'Seleccionar foto'}
              </div>
              <div style={{ fontSize: 11, color: FP.textDim }}>PNG, JPG o WebP · máx 4 MB</div>
            </button>
            {!canUpload() && (
              <div style={{
                marginTop: 12, padding: '10px 12px', borderRadius: 12,
                background: 'rgba(255,179,71,0.08)',
                border: '1px solid rgba(255,179,71,0.25)',
                fontSize: 12, color: '#FFB547', lineHeight: 1.4,
              }}>
                ℹ️ La subida requiere cuenta conectada. Conéctate con Google o usa "Generar".
              </div>
            )}
          </div>
        )}

        {err && (
          <div style={{
            padding: '10px 12px', borderRadius: 12,
            background: 'rgba(255,59,107,0.08)',
            border: '1px solid rgba(255,59,107,0.25)',
            fontSize: 12.5, color: '#FF6B89', marginBottom: 14, lineHeight: 1.4,
          }}>
            {err}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, height: 50, borderRadius: 999,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}>Cancelar</button>
          <div style={{ flex: 1.4 }}>
            <GradientButton variant="flame" onClick={save} style={{ height: 50 }} disabled={uploading}>
              {uploading ? 'Subiendo…' : 'Guardar avatar'}
            </GradientButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent, plain }) {
  return (
    <div style={{
      padding: 16, borderRadius: 18,
      background: plain ? accent : 'rgba(255,255,255,0.04)',
      border: plain ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.06)',
      position: 'relative', overflow: 'hidden',
    }}>
      {!plain && (
        <div style={{
          position: 'absolute', top: -30, right: -30,
          width: 90, height: 90, borderRadius: 999,
          background: accent, opacity: 0.25, filter: 'blur(20px)',
        }}/>
      )}
      <div style={{
        position: 'relative', fontFamily: '"Space Grotesk"', fontSize: 30, fontWeight: 800,
        color: FP.text, letterSpacing: -1,
      }}>{value}</div>
      <div style={{
        position: 'relative', fontSize: 11, color: FP.textDim,
        letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700, marginTop: 2,
      }}>{label}</div>
    </div>
  );
}

function SettingRow({ icon, label, onClick, hideChevron }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', padding: '16px 18px',
      display: 'flex', alignItems: 'center', gap: 14,
      background: 'transparent', border: 'none',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      color: FP.text, cursor: 'pointer', textAlign: 'left',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: 'rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{label}</div>
      {!hideChevron && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(255,255,255,0.4)">
          <path d="M9 6l6 6-6 6"/>
        </svg>
      )}
    </button>
  );
}

export default ProfileScreen;

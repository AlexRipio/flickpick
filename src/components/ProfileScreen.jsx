import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AmbientBackdrop, BackButton, TextField, GradientButton } from '@/components/fp/primitives';
import { FP } from '@/lib/fp';
import { useProfile } from '@/contexts/ProfileContext';

function readAllRooms() {
  try { return JSON.parse(localStorage.getItem('flickpick.rooms.v1') || '{}'); } catch { return {}; }
}

const ProfileScreen = () => {
  const navigate = useNavigate();
  const { profile, setProfileFields, clearProfile } = useProfile();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(profile?.name || '');
  const [draftEmail, setDraftEmail] = useState(profile?.email || '');

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
          <div style={{
            width: 104, height: 104, borderRadius: 999,
            background: FP.flame,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontFamily: '"Space Grotesk"', fontWeight: 800, fontSize: 42,
            boxShadow: '0 18px 40px rgba(255,59,107,0.45)',
            border: '3px solid rgba(255,255,255,0.1)',
          }}>{initial}</div>
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
    </div>
  );
};

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

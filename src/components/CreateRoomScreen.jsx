import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AmbientBackdrop, BackButton, Chip, GradientButton, TextField } from '@/components/fp/primitives';
import { FP } from '@/lib/fp';
import { useProfile } from '@/contexts/ProfileContext';
import { createRoom } from '@/lib/roomStore';

const ALL_PLATFORMS = [
  { id: 'cartelera', name: 'En cines' },
  { id: 'netflix', name: 'Netflix' },
  { id: 'prime', name: 'Prime' },
  { id: 'max', name: 'Max' },
  { id: 'disney', name: 'Disney+' },
  { id: 'apple', name: 'Apple TV+' },
];

const CreateRoomScreen = () => {
  const navigate = useNavigate();
  const { profile, ensureProfile } = useProfile();
  const [roomName, setRoomName] = useState('Noche de peli');
  const [platforms, setPlatforms] = useState(['netflix', 'prime']);
  const [yearFrom, setYearFrom] = useState(2018);
  const [yearTo, setYearTo] = useState(new Date().getFullYear());
  const [err, setErr] = useState('');

  const togglePlatform = (id) =>
    setPlatforms(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const create = () => {
    setErr('');
    if (!roomName.trim()) return setErr('Ponle un nombre a la sala.');
    if (!platforms.length) return setErr('Elige al menos una plataforma.');
    const me = profile?.name ? profile : ensureProfile('Invitado');
    const created = createRoom({
      name: roomName.trim(),
      preferences: { platforms, yearFrom, yearTo },
      host: { id: me.id, name: me.name },
    });
    navigate(`/room/${created.id}/lobby`, { replace: true });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <AmbientBackdrop hue={260}/>

      <div style={{ position: 'relative', zIndex: 2, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 520, width: '100%', margin: '0 auto' }}>
        <BackButton onClick={() => navigate('/home')}/>
        <div style={{ fontSize: 13, fontWeight: 600, color: FP.textDim }}>Nueva sala</div>
        <div style={{ width: 42 }}/>
      </div>

      <div style={{ position: 'relative', zIndex: 2, flex: 1, overflowY: 'auto', padding: '10px 24px 40px', maxWidth: 520, width: '100%', margin: '0 auto' }}>
        <h1 style={{
          fontFamily: '"Space Grotesk", system-ui', fontSize: 30, fontWeight: 800,
          color: FP.text, margin: 0, letterSpacing: -0.8,
        }}>Crea tu sala</h1>
        <p style={{ fontSize: 14, color: FP.textDim, margin: '8px 0 22px' }}>
          Elige dónde ver y los años. Luego invitas con un código.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <TextField label="Nombre de la sala" value={roomName} onChange={setRoomName} placeholder="Noche de peli 🍿"/>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: FP.textDim, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
              Dónde buscar
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {ALL_PLATFORMS.map(p => (
                <Chip key={p.id} active={platforms.includes(p.id)} onClick={() => togglePlatform(p.id)}>{p.name}</Chip>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: FP.textDim, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
              Año de estreno · {yearFrom}–{yearTo}
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16, padding: 16,
            }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <input type="range" min="1980" max={new Date().getFullYear()} value={yearFrom}
                  onChange={(e) => setYearFrom(Math.min(+e.target.value, yearTo))}
                  style={{ flex: 1, accentColor: '#FF3B6B' }}/>
                <input type="range" min="1980" max={new Date().getFullYear()} value={yearTo}
                  onChange={(e) => setYearTo(Math.max(+e.target.value, yearFrom))}
                  style={{ flex: 1, accentColor: '#FF3B6B' }}/>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: FP.textDim, fontWeight: 600 }}>
                <span>Desde {yearFrom}</span><span>Hasta {yearTo}</span>
              </div>
            </div>
          </div>

          {err && <div style={{ color: '#FF3B6B', fontSize: 13, fontWeight: 600 }}>{err}</div>}

          <GradientButton variant="flame" onClick={create} style={{ marginTop: 10 }}>
            Crear sala
          </GradientButton>
        </div>
      </div>
    </div>
  );
};

export default CreateRoomScreen;

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AmbientBackdrop, BackButton, GradientButton, TextField } from '@/components/fp/primitives';
import { FP } from '@/lib/fp';
import { useProfile } from '@/contexts/ProfileContext';
import { findRoomByCode, addMember, hydrateRoomByCode } from '@/lib/roomStore';

const CODE_LEN = 5;
const KEYS = ['Q','W','E','R','T','Y','U','I','O','P','A','S','D','F','G','H','J','K','L','Z','X','C','V','B','N','M','2','3','4','5','6','7','8','9'];

const JoinScreen = () => {
  const { joinCode } = useParams();
  const navigate = useNavigate();
  const { profile, setName } = useProfile();
  const [code, setCode] = useState('');
  const [draftName, setDraftName] = useState(profile?.name || '');
  const [err, setErr] = useState('');
  const [step, setStep] = useState(profile?.name ? 'code' : 'name');

  useEffect(() => { if (joinCode) setCode(joinCode.toUpperCase().slice(0, CODE_LEN)); }, [joinCode]);

  const filled = code.padEnd(CODE_LEN, ' ').split('');
  const tap = (c) => { if (code.length < CODE_LEN && /[A-Z0-9]/.test(c)) setCode(code + c); };
  const del = () => setCode(code.slice(0, -1));
  const canJoin = code.length === CODE_LEN;

  const doJoin = async () => {
    setErr('');
    const nameToUse = profile?.name || draftName.trim();
    if (!nameToUse) { setErr('Ponte un nombre.'); return; }
    // Check local first, then hydrate from Supabase if not found here.
    let room = findRoomByCode(code);
    if (!room) room = await hydrateRoomByCode(code);
    if (!room) { setErr('Sala no encontrada con ese código.'); return; }
    const me = profile?.name ? profile : setName(nameToUse);
    try {
      addMember(room.id, { id: me.id, name: me.name });
      navigate(`/room/${room.id}/lobby`, { replace: true });
    } catch (e) {
      setErr(e.message || 'No se pudo entrar.');
    }
  };

  if (step === 'name') {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column' }}>
        <AmbientBackdrop hue={320}/>
        <div style={{ position: 'relative', zIndex: 2, padding: '16px 20px', maxWidth: 520, width: '100%', margin: '0 auto' }}>
          <BackButton onClick={() => navigate('/home')}/>
        </div>
        <div style={{ position: 'relative', zIndex: 2, flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 520, width: '100%', margin: '0 auto' }}>
          <h1 style={{ fontFamily: '"Space Grotesk"', fontSize: 30, fontWeight: 800, color: FP.text, margin: 0, letterSpacing: -0.8 }}>¿Cómo te llamas?</h1>
          <p style={{ fontSize: 14, color: FP.textDim, margin: 0 }}>Tus compañeros te verán con este nombre.</p>
          <TextField label="Nombre" value={draftName} onChange={setDraftName} placeholder="Tu nombre" autoFocus/>
          <div style={{ flex: 1 }}/>
          <GradientButton variant="flame" onClick={() => { if (draftName.trim()) { setName(draftName.trim()); setStep('code'); } }} disabled={!draftName.trim()}>
            Continuar
          </GradientButton>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <AmbientBackdrop hue={320}/>
      <div style={{ position: 'relative', zIndex: 2, padding: '16px 20px', maxWidth: 520, width: '100%', margin: '0 auto' }}>
        <BackButton onClick={() => navigate('/home')}/>
      </div>
      <div style={{ position: 'relative', zIndex: 2, padding: '20px 24px', flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 520, width: '100%', margin: '0 auto' }}>
        <h1 style={{
          fontFamily: '"Space Grotesk", system-ui',
          fontSize: 32, fontWeight: 800, color: FP.text,
          margin: 0, letterSpacing: -0.8,
        }}>Únete a una sala</h1>
        <p style={{ fontSize: 15, color: FP.textDim, margin: '8px 0 32px' }}>
          Introduce el código que te compartieron.
        </p>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
          {filled.map((c, i) => (
            <div key={i} style={{
              width: 48, height: 60, borderRadius: 14,
              background: c.trim() ? FP.flame : 'rgba(255,255,255,0.04)',
              border: c.trim() ? 'none' : `1px solid ${i === code.length ? '#FF3B6B' : 'rgba(255,255,255,0.1)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: '"Space Grotesk", monospace',
              fontSize: 26, fontWeight: 800, color: '#fff',
              boxShadow: c.trim() ? '0 6px 18px rgba(255,59,107,0.3)' : 'none',
            }}>{c.trim() || ''}</div>
          ))}
        </div>
        {err && <div style={{ color: '#FF3B6B', fontSize: 13, textAlign: 'center', marginBottom: 8, fontWeight: 600 }}>{err}</div>}

        <div style={{ flex: 1 }}/>

        <div className="no-scrollbar" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 10 }}>
          {KEYS.map(c => (
            <button key={c} onClick={() => tap(c)} style={{
              height: 44, borderRadius: 12,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: FP.text, fontSize: 15, fontWeight: 700, cursor: 'pointer',
              fontFamily: '"Space Grotesk", monospace', padding: 0,
            }}>{c}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <button onClick={del} style={{
            flex: 1, height: 44, borderRadius: 12,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: FP.textDim, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>⌫ Borrar</button>
          <button onClick={() => setCode('')} style={{
            flex: 1, height: 44, borderRadius: 12,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: FP.textDim, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>Limpiar</button>
        </div>
        <GradientButton variant="flame" disabled={!canJoin} onClick={doJoin}>
          Entrar a la sala
        </GradientButton>
      </div>
    </div>
  );
};

export default JoinScreen;

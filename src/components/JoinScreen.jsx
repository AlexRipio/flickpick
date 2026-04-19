import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AmbientBackdrop, BackButton, GradientButton, TextField } from '@/components/fp/primitives';
import { FP } from '@/lib/fp';
import { useProfile } from '@/contexts/ProfileContext';
import { findRoomByCode, addMember, hydrateRoomByCode } from '@/lib/roomStore';
import { signInWithGoogle, hasSupabase } from '@/lib/auth';

const CODE_LEN = 5;
const KEYS = ['Q','W','E','R','T','Y','U','I','O','P','A','S','D','F','G','H','J','K','L','Z','X','C','V','B','N','M','2','3','4','5','6','7','8','9'];

const JoinScreen = () => {
  const { joinCode } = useParams();
  const navigate = useNavigate();
  const { profile, setName } = useProfile();

  const [code, setCode] = useState('');
  const [draftName, setDraftName] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  // Step: 'auto' | 'choose' | 'name' | 'code'
  const [step, setStep] = useState(() => {
    if (joinCode) {
      // Arriving via invite link
      if (profile?.name) return 'auto';   // already has session → skip straight to join
      return 'choose';                     // no session → show choice screen
    }
    return profile?.name ? 'code' : 'name';
  });

  useEffect(() => {
    if (joinCode) setCode(joinCode.toUpperCase().slice(0, CODE_LEN));
  }, [joinCode]);

  // Auto-join if user already has a session and came via link
  useEffect(() => {
    if (step === 'auto' && joinCode && profile?.name) {
      doJoinWithProfile(profile);
    }
  }, [step]);

  const filled = code.padEnd(CODE_LEN, ' ').split('');
  const tap = (c) => { if (code.length < CODE_LEN && /[A-Z0-9]/.test(c)) setCode(code + c); };
  const del = () => setCode(code.slice(0, -1));
  const canJoin = code.length === CODE_LEN;

  async function doJoinWithProfile(me) {
    setErr('');
    setLoading(true);
    const codeToUse = code || (joinCode?.toUpperCase().slice(0, CODE_LEN));
    let room = findRoomByCode(codeToUse);
    if (!room) room = await hydrateRoomByCode(codeToUse);
    if (!room) { setErr('Sala no encontrada.'); setLoading(false); return; }
    try {
      addMember(room.id, { id: me.id, name: me.name });
      navigate(`/room/${room.id}/lobby`, { replace: true });
    } catch (e) {
      setErr(e.message || 'No se pudo entrar.');
      setLoading(false);
    }
  }

  const doJoin = async () => {
    const nameToUse = profile?.name || draftName.trim();
    if (!nameToUse) { setErr('Ponte un nombre.'); return; }
    const me = profile?.name ? profile : setName(nameToUse);
    await doJoinWithProfile(me);
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result.redirecting) {
        // Google OAuth will redirect back; session handled by ProfileContext
        return;
      }
      if (result.profile) {
        const me = result.profile;
        await doJoinWithProfile(me);
      }
    } catch (e) {
      setErr(e.message);
      setLoading(false);
    }
  };

  // ── STEP: auto-joining ───────────────────────────────────────
  if (step === 'auto') {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <AmbientBackdrop hue={320}/>
        <div style={{ position: 'relative', zIndex: 2, color: FP.textDim, fontSize: 15 }}>
          Entrando a la sala…
        </div>
      </div>
    );
  }

  // ── STEP: choose (from invite link, no session) ─────────────
  if (step === 'choose') {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column' }}>
        <AmbientBackdrop hue={280}/>
        <div style={{ position: 'relative', zIndex: 2, padding: '16px 20px', maxWidth: 520, width: '100%', margin: '0 auto' }}>
          <BackButton onClick={() => navigate('/')}/>
        </div>
        <div style={{
          position: 'relative', zIndex: 2, flex: 1,
          padding: '20px 24px 36px', display: 'flex', flexDirection: 'column',
          maxWidth: 520, width: '100%', margin: '0 auto',
        }}>
          <div style={{ fontSize: 11, color: FP.cyan, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12, fontWeight: 700 }}>
            Te han invitado
          </div>
          <h1 style={{
            fontFamily: '"Syne", "Space Grotesk", sans-serif',
            fontSize: 34, fontWeight: 800, color: FP.text,
            margin: '0 0 8px', letterSpacing: -1, lineHeight: 1.1,
          }}>¿Cómo quieres entrar?</h1>
          <p style={{ fontSize: 14, color: FP.textDim, margin: '0 0 32px' }}>
            Elige rápido o conecta tu cuenta para guardar tu historial.
          </p>

          {/* Option 1: Quick name */}
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 22, padding: 20, marginBottom: 16,
          }}>
            <div style={{ fontFamily: '"Space Grotesk"', fontSize: 16, fontWeight: 700, color: FP.text, marginBottom: 6 }}>
              ⚡ Entrar con nombre
            </div>
            <div style={{ fontSize: 13, color: FP.textDim, marginBottom: 16 }}>
              Sin registro, entra en segundos.
            </div>
            <TextField
              label="Tu nombre"
              value={draftName}
              onChange={setDraftName}
              placeholder="¿Cómo te llaman?"
            />
            <button
              onClick={() => { if (draftName.trim()) { setName(draftName.trim()); doJoin(); } }}
              disabled={!draftName.trim() || loading}
              style={{
                marginTop: 12, width: '100%', height: 48, borderRadius: 999,
                background: draftName.trim() ? FP.flame : 'rgba(255,255,255,0.06)',
                border: 'none', color: '#fff',
                fontFamily: '"Space Grotesk"', fontWeight: 700, fontSize: 15,
                cursor: draftName.trim() ? 'pointer' : 'not-allowed', opacity: loading ? 0.6 : 1,
              }}
            >
              Entrar a la sala
            </button>
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }}/>
            <div style={{ fontSize: 12, color: FP.textMuted, fontWeight: 600 }}>O BIEN</div>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }}/>
          </div>

          {/* Option 2: Google */}
          <div style={{
            background: 'rgba(78,255,214,0.04)',
            border: '1px solid rgba(78,255,214,0.15)',
            borderRadius: 22, padding: 20,
          }}>
            <div style={{ fontFamily: '"Space Grotesk"', fontSize: 16, fontWeight: 700, color: FP.text, marginBottom: 6 }}>
              ✨ Conectar con Google
            </div>
            <div style={{ fontSize: 13, color: FP.textDim, marginBottom: 10 }}>Ventajas de tener cuenta:</div>
            <ul style={{ fontSize: 13, color: FP.textDim, paddingLeft: 18, margin: '0 0 16px', lineHeight: 1.8 }}>
              <li>Tu historial de matches guardado siempre</li>
              <li>Tu nombre y foto en la sala automáticamente</li>
              <li>Accede desde cualquier dispositivo</li>
              <li>Ve tus estadísticas de películas</li>
            </ul>
            <button
              onClick={handleGoogle}
              disabled={loading}
              style={{
                width: '100%', height: 48, borderRadius: 999,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 10,
                fontFamily: '"Space Grotesk"', fontWeight: 700, fontSize: 15,
                cursor: 'pointer', opacity: loading ? 0.6 : 1,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.23-5.89 11.5 11.5 0 00-.1-1.16z"/>
                <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.04a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z"/>
                <path fill="#FBBC05" d="M4.5 10.48A4.8 4.8 0 014.5 7.5V5.43H1.83a8 8 0 000 7.14l2.67-2.09z"/>
                <path fill="#EA4335" d="M8.98 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8 8 0 001.83 5.43L4.5 7.5A4.77 4.77 0 018.98 3.58z"/>
              </svg>
              Continuar con Google
            </button>
          </div>

          {err && <div style={{ color: '#FF3B6B', fontSize: 13, marginTop: 12, textAlign: 'center', fontWeight: 600 }}>{err}</div>}
        </div>
      </div>
    );
  }

  // ── STEP: name (manual entry, no invite link) ─────────────────
  if (step === 'name') {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column' }}>
        <AmbientBackdrop hue={320}/>
        <div style={{ position: 'relative', zIndex: 2, padding: '16px 20px', maxWidth: 520, width: '100%', margin: '0 auto' }}>
          <BackButton onClick={() => navigate('/home')}/>
        </div>
        <div style={{ position: 'relative', zIndex: 2, flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 520, width: '100%', margin: '0 auto' }}>
          <h1 style={{ fontFamily: '"Syne", "Space Grotesk", sans-serif', fontSize: 30, fontWeight: 800, color: FP.text, margin: 0, letterSpacing: -0.8 }}>¿Cómo te llamas?</h1>
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

  // ── STEP: code ─────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <AmbientBackdrop hue={320}/>
      <div style={{ position: 'relative', zIndex: 2, padding: '16px 20px', maxWidth: 520, width: '100%', margin: '0 auto' }}>
        <BackButton onClick={() => navigate('/home')}/>
      </div>
      <div style={{ position: 'relative', zIndex: 2, padding: '20px 24px', flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 520, width: '100%', margin: '0 auto' }}>
        <h1 style={{
          fontFamily: '"Syne", "Space Grotesk", sans-serif',
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
        <GradientButton variant="flame" disabled={!canJoin || loading} onClick={doJoin}>
          {loading ? 'Entrando…' : 'Entrar a la sala'}
        </GradientButton>
      </div>
    </div>
  );
};

export default JoinScreen;

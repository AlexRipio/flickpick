import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AmbientBackdrop, BackButton, GoogleGlyph, GradientButton, TextField } from '@/components/fp/primitives';
import { FP } from '@/lib/fp';
import { useProfile } from '@/contexts/ProfileContext';
import { signInWithEmail, signInWithGoogle, signUpWithEmail } from '@/lib/auth';

const SignInScreen = ({ mode = 'signup' }) => {
  const navigate = useNavigate();
  const { setProfileFields } = useProfile();
  const isSignup = mode === 'signup';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const canSubmit = email.includes('@') && password.length >= 6 && (!isSignup || name.trim().length >= 2);

  const submit = async () => {
    if (!canSubmit || loading) return;
    setLoading(true); setError(''); setInfo('');
    try {
      const res = isSignup
        ? await signUpWithEmail({ name, email, password })
        : await signInWithEmail({ email, password });
      if (res.needsConfirm) {
        setInfo('Te hemos enviado un email de confirmación. Revísalo para activar tu cuenta.');
      } else if (res.profile) {
        setProfileFields(res.profile);
        navigate('/home', { replace: true });
      }
    } catch (e) {
      setError(e.message || 'No se pudo completar la operación.');
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    if (loading) return;
    setLoading(true); setError('');
    try {
      const res = await signInWithGoogle();
      if (res?.profile) {
        setProfileFields(res.profile);
        navigate('/home', { replace: true });
      }
    } catch (e) {
      setError(e.message || 'No se pudo iniciar sesión con Google.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <AmbientBackdrop hue={280}/>

      <div style={{ position: 'relative', zIndex: 2, padding: '20px 24px 0', maxWidth: 480, width: '100%', margin: '0 auto' }}>
        <BackButton onClick={() => navigate('/welcome')}/>
      </div>

      <div style={{
        position: 'relative', zIndex: 2,
        padding: '20px 24px 32px', flex: 1,
        display: 'flex', flexDirection: 'column', gap: 20,
        maxWidth: 480, width: '100%', margin: '0 auto',
      }}>
        <div style={{ animation: 'fp-entrance 0.6s ease-out both' }}>
          <h1 style={{
            fontFamily: '"Space Grotesk", system-ui',
            fontSize: 32, fontWeight: 800, color: FP.text,
            margin: 0, letterSpacing: -0.8,
          }}>{isSignup ? 'Crea tu perfil' : 'Bienvenido de vuelta'}</h1>
          <p style={{ fontSize: 15, color: FP.textDim, margin: '8px 0 0' }}>
            {isSignup ? 'Empieza a hacer match en menos de un minuto.' : 'Inicia sesión y sigue la racha.'}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'fp-entrance 0.6s 0.08s ease-out both' }}>
          {isSignup && (
            <TextField label="Nombre" value={name} onChange={setName} placeholder="Como quieres que te llamen"/>
          )}
          <TextField label="Email" value={email} onChange={setEmail} type="email" placeholder="tu@correo.com"/>
          <TextField label="Contraseña" value={password} onChange={setPassword} type="password" placeholder="Al menos 6 caracteres"/>
        </div>

        {error && (
          <div style={{
            padding: '12px 14px', borderRadius: 14,
            background: 'rgba(255,59,107,0.12)', border: '1px solid rgba(255,59,107,0.35)',
            color: '#FFB0C2', fontSize: 13, fontWeight: 600,
          }}>{error}</div>
        )}
        {info && (
          <div style={{
            padding: '12px 14px', borderRadius: 14,
            background: 'rgba(78,255,214,0.10)', border: '1px solid rgba(78,255,214,0.35)',
            color: '#4EFFD6', fontSize: 13, fontWeight: 600,
          }}>{info}</div>
        )}

        <div style={{ flex: 1 }}/>

        <GradientButton variant="flame" onClick={submit} disabled={!canSubmit || loading}>
          {loading ? 'Cargando…' : (isSignup ? 'Crear cuenta' : 'Iniciar sesión')}
        </GradientButton>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: FP.textMuted, fontSize: 11, letterSpacing: 1.5 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }}/>
          O
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }}/>
        </div>

        <GradientButton variant="ghost" onClick={onGoogle} disabled={loading}>
          <GoogleGlyph size={18}/>
          Continuar con Google
        </GradientButton>

        <div style={{ textAlign: 'center', fontSize: 13, color: FP.textDim }}>
          {isSignup ? '¿Ya tienes cuenta? ' : '¿Nuevo aquí? '}
          <button onClick={() => navigate(isSignup ? '/signin' : '/signup')} style={{
            background: 'transparent', border: 'none', color: FP.flameSolid,
            fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 13,
          }}>{isSignup ? 'Inicia sesión' : 'Crea una cuenta'}</button>
        </div>
      </div>
    </div>
  );
};

export default SignInScreen;

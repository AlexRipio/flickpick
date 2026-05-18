import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AmbientBackdrop, BackButton, GradientButton, TextField, GoogleGlyph } from '@/components/fp/primitives';
import { FP } from '@/lib/fp';
import { useProfile } from '@/contexts/ProfileContext';
import { processGoogleUserInfo, registerWithEmail, loginWithEmail } from '@/lib/auth';
import { apiQaLogin, apiResendVerification } from '@/lib/api';
import { consumePendingJoin } from '@/lib/pendingJoin';

// Centralised post-auth redirect: if the user came from an invite
// link we send them straight back to /g/<code>, else /home.
function postAuthDestination() {
  const code = consumePendingJoin();
  return code ? `/g/${code}` : '/home';
}

const GOOGLE_CLIENT_ID = '480695177694-uip9jvgsh4gf7rhg03q2omskad5j1ai8.apps.googleusercontent.com';

const SignInScreen = ({ mode = 'signup' }) => {
  const navigate = useNavigate();
  const { setProfileFields } = useProfile();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [qaToken, setQaToken] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);

  const isQaMode = typeof window !== 'undefined' && window.location.origin.includes('qa');
  const isSignup = mode === 'signup';

  const canSubmit = isQaMode
    ? email.includes('@') && qaToken.trim() !== ''
    : email.includes('@') && password.length >= 6 && (!isSignup || confirmPassword.length >= 6);

  const submit = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError('');
    setInfo('');

    try {
      if (isQaMode) {
        const data = await apiQaLogin(email, qaToken);
        if (data?.user) {
          setProfileFields({
            id: data.user.id,
            name: data.user.name || email.split('@')[0],
            email: data.user.email,
            avatarUrl: data.user.avatar_url,
            provider: 'email',
          });
          navigate(postAuthDestination(), { replace: true });
        }
        return;
      }

      if (isSignup) {
        if (password !== confirmPassword) {
          setError('Las contrasenas no coinciden.');
          return;
        }
        const data = await registerWithEmail(email, password, email.split('@')[0]);
        setInfo(data.message || 'Cuenta creada. Revisa tu correo para verificar tu email.');
        setNeedsVerification(true);
      } else {
        const result = await loginWithEmail(email, password);
        if (result?.profile) {
          setProfileFields(result.profile);
          navigate(postAuthDestination(), { replace: true });
        }
      }
    } catch (e) {
      const msg = e.message || 'Error. Intentalo de nuevo.';
      setError(msg);
      if (msg.includes('Verifica tu email')) {
        setNeedsVerification(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiResendVerification(email);
      setInfo(data.message || 'Email de verificacion reenviado.');
    } catch (e) {
      setError(e.message || 'Error al reenviar.');
    } finally {
      setLoading(false);
    }
  };

  const tokenClientRef = useRef(null);

  useEffect(() => {
    if (isQaMode) return;
    const init = () => {
      if (!window.google?.accounts?.oauth2) return;
      try {
        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'openid email profile',
          callback: async (response) => {
            if (!response?.access_token) return;
            setError('');
            setLoading(true);
            try {
              const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${response.access_token}` },
              });
              const userInfo = await r.json();
              const { profile } = await processGoogleUserInfo(userInfo);
              if (profile) {
                setProfileFields(profile);
                navigate(postAuthDestination(), { replace: true });
              }
            } catch (e) {
              setError(e.message || 'Error al iniciar sesion con Google.');
            } finally {
              setLoading(false);
            }
          },
        });
      } catch {}
    };
    const timer = setTimeout(init, 300);
    return () => clearTimeout(timer);
  }, [isQaMode, navigate, setProfileFields]);

  const handleGoogleClick = () => {
    if (!tokenClientRef.current) return;
    setError('');
    tokenClientRef.current.requestAccessToken();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <AmbientBackdrop hue={280} />

      <div style={{ position: 'relative', zIndex: 2, padding: '20px 24px 0', maxWidth: 480, width: '100%', margin: '0 auto' }}>
        <BackButton onClick={() => navigate('/welcome')} />
      </div>

      <div style={{
        position: 'relative', zIndex: 2, padding: '20px 24px 32px',
        flex: 1, display: 'flex', flexDirection: 'column', gap: 20,
        maxWidth: 480, width: '100%', margin: '0 auto',
        overflowY: 'auto',
      }}>
        <div style={{ animation: 'fp-entrance 0.6s ease-out both' }}>
          <h1 style={{
            fontFamily: '"Space Grotesk", system-ui',
            fontSize: 32, fontWeight: 800, color: FP.text, margin: 0, letterSpacing: -0.8,
          }}>
            {isQaMode ? 'Acceso QA' : isSignup ? 'Crear cuenta' : 'Iniciar sesion'}
          </h1>
          <p style={{ fontSize: 15, color: FP.textDim, margin: '8px 0 0' }}>
            {isQaMode
              ? 'Introduce tu email de admin y el codigo secreto.'
              : isSignup
                ? 'Registrate con tu email y una contrasena.'
                : 'Accede con tu email y contrasena.'}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'fp-entrance 0.6s 0.08s ease-out both' }}>
          <TextField label="Email" value={email} onChange={setEmail} type="email" placeholder="tu@correo.com" />
          {isQaMode ? (
            <TextField label="Codigo secreto" value={qaToken} onChange={setQaToken} type="password" placeholder="Codigo de acceso QA" />
          ) : (
            <>
              <TextField label="Contrasena" value={password} onChange={setPassword} type="password" placeholder={isSignup ? 'Minimo 6 caracteres' : 'Tu contrasena'} />
              {isSignup && (
                <TextField label="Confirmar contrasena" value={confirmPassword} onChange={setConfirmPassword} type="password" placeholder="Repite la contrasena" />
              )}
            </>
          )}
        </div>

        {error && (
          <div style={{
            padding: '12px 14px', borderRadius: 14,
            background: 'rgba(255,59,107,0.12)', border: '1px solid rgba(255,59,107,0.35)',
            color: '#FFB0C2', fontSize: 13, fontWeight: 600,
          }}>
            {error}
          </div>
        )}
        {info && (
          <div style={{
            padding: '12px 14px', borderRadius: 14,
            background: 'rgba(78,255,214,0.10)', border: '1px solid rgba(78,255,214,0.35)',
            color: '#4EFFD6', fontSize: 13, fontWeight: 600,
          }}>
            {info}
          </div>
        )}

        {needsVerification && !isQaMode && (
          <button onClick={handleResendVerification} disabled={loading} style={{
            background: 'transparent', border: '1px solid rgba(78,255,214,0.3)',
            borderRadius: 999, padding: '10px 20px', color: '#4EFFD6',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            fontFamily: '"Space Grotesk", system-ui',
          }}>
            Reenviar email de verificacion
          </button>
        )}

        <div style={{ flex: 1 }} />

        <GradientButton variant="flame" onClick={submit} disabled={!canSubmit || loading}>
          {loading
            ? (isQaMode ? 'Accediendo...' : isSignup ? 'Creando cuenta...' : 'Entrando...')
            : (isQaMode ? 'Acceder a QA' : isSignup ? 'Crear cuenta' : 'Iniciar sesion')}
        </GradientButton>

        {!isQaMode && (
          <button onClick={() => navigate(isSignup ? '/signin' : '/signup')} style={{
            background: 'transparent', border: 'none', color: FP.textDim,
            fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '4px 0',
            fontFamily: '"Inter", system-ui', textAlign: 'center',
          }}>
            {isSignup
              ? <>Ya tienes cuenta? <span style={{ color: FP.flameSolid }}>Inicia sesion</span></>
              : <>No tienes cuenta? <span style={{ color: FP.flameSolid }}>Registrate</span></>}
          </button>
        )}

        {/* Divider */}
        {!isQaMode && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: FP.textMuted, fontSize: 11, letterSpacing: 1.5 }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              O
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            </div>

            <button
              onClick={handleGoogleClick}
              disabled={loading}
              style={{
                width: '100%', height: 56, borderRadius: 999,
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                color: '#ffffff',
                fontFamily: '"Space Grotesk", "Inter", system-ui, sans-serif',
                fontSize: 16, fontWeight: 700, letterSpacing: 0.2,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: 'none',
                transition: 'transform 0.12s, box-shadow 0.2s',
                opacity: loading ? 0.6 : 1,
              }}
              onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)'; }}
              onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <GoogleGlyph size={20} />
              Continuar con Google
            </button>
          </>
        )}

        {isQaMode && (
          <div style={{
            padding: '12px 14px', borderRadius: 14, textAlign: 'center',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            color: FP.textMuted, fontSize: 13,
          }}>
            Google login no disponible en QA.
          </div>
        )}
      </div>
    </div>
  );
};

export default SignInScreen;

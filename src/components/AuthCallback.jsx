import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { verifyEmail } from '@/lib/auth';
import { useProfile } from '@/contexts/ProfileContext';
import { consumePendingJoin } from '@/lib/pendingJoin';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setProfileFields } = useProfile();
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;

    const token = searchParams.get('token');
    const email = searchParams.get('email');

    if (!token || !email) {
      navigate('/home', { replace: true });
      return;
    }

    calledRef.current = true;

    (async () => {
      try {
        const result = await verifyEmail(email, token);
        if (result?.profile) {
          setSuccess(true);
          setProfileFields(result.profile);
          const code = consumePendingJoin();
          const dest = code ? `/g/${code}` : '/home';
          setTimeout(() => navigate(dest, { replace: true }), 1500);
        } else {
          setError('No se pudo verificar el email. Intentalo de nuevo.');
        }
      } catch (e) {
        setError(e.message || 'Enlace invalido o expirado.');
      }
    })();
  }, [navigate, searchParams, setProfileFields]);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0A070F',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 16, padding: 24, textAlign: 'center',
    }}>
      <img
        src="/logo.png"
        alt="FlickPick"
        style={{
          width: 56, height: 56, objectFit: 'cover', objectPosition: 'center top',
          transform: 'scale(1.55) translateY(-14%)', transformOrigin: 'center top',
          animation: success ? 'none' : 'fp-pulse 1.4s ease-in-out infinite',
        }}
      />
      <div style={{ fontSize: 14, color: success ? '#4EFFD6' : error ? '#FFB0C2' : 'rgba(255,255,255,0.5)', fontFamily: '"Space Grotesk"', fontWeight: 600 }}>
        {success ? 'Email verificado! Entrando...' : error ? error : 'Verificando email...'}
      </div>
      {error && (
        <button
          onClick={() => navigate('/signin', { replace: true })}
          style={{
            marginTop: 12, padding: '10px 22px', borderRadius: 999,
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff', fontFamily: '"Space Grotesk"', cursor: 'pointer',
          }}
        >
          Ir a iniciar sesion
        </button>
      )}
    </div>
  );
};

export default AuthCallback;

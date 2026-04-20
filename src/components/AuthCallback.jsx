import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, hasSupabase } from '@/lib/supabase';

/**
 * Dedicated OAuth landing route. Mobile browsers (iOS Safari especially) are
 * flaky about Supabase's automatic session detection when the redirect lands
 * anywhere that also renders the app shell. Having a minimal page that does
 * ONE thing — wait for the session, then navigate — fixes the "stuck on black
 * screen / Invitado profile" bug.
 *
 * With `detectSessionInUrl: true` and `flowType: 'pkce'` on the supabase
 * client, Supabase auto-exchanges the `?code=` param itself. We just wait
 * for the session to become available and then move the user to /home.
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let settled = false;

    function go(path) {
      if (cancelled || settled) return;
      settled = true;
      navigate(path, { replace: true });
    }

    if (!hasSupabase) {
      go('/home');
      return;
    }

    // 1) Listen for the auth event — most reliable.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) go('/home');
      else if (event === 'INITIAL_SESSION') {
        // INITIAL_SESSION fires once after URL detection. If still no session,
        // fall back to checking manually below.
      }
    });

    // 2) Also poll getSession for a few seconds as a safety net.
    (async () => {
      for (let i = 0; i < 20 && !cancelled && !settled; i++) {
        const { data } = await supabase.auth.getSession();
        if (data?.session) { go('/home'); return; }
        await new Promise(r => setTimeout(r, 250));
      }
      // 3) Last resort: try manual PKCE exchange.
      if (!cancelled && !settled) {
        try {
          const url = window.location.href;
          if (window.location.search.includes('code=')) {
            const { data, error } = await supabase.auth.exchangeCodeForSession(url);
            if (error) throw error;
            if (data?.session) { go('/home'); return; }
          }
        } catch (e) {
          console.error('[AuthCallback] exchange failed', e);
          if (!cancelled) setError(e.message || 'No se pudo iniciar sesión.');
          return;
        }
        if (!cancelled) setError('No se pudo iniciar sesión. Inténtalo de nuevo.');
      }
    })();

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, [navigate]);

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
          animation: 'fp-pulse 1.4s ease-in-out infinite',
        }}
      />
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontFamily: '"Space Grotesk"' }}>
        {error ? error : 'Iniciando sesión…'}
      </div>
      {error && (
        <button
          onClick={() => navigate('/welcome', { replace: true })}
          style={{
            marginTop: 12, padding: '10px 22px', borderRadius: 999,
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff', fontFamily: '"Space Grotesk"', cursor: 'pointer',
          }}
        >
          Volver
        </button>
      )}
    </div>
  );
};

export default AuthCallback;

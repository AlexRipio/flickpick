import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Toaster } from '@/components/ui/toaster';
import { ProfileProvider } from '@/contexts/ProfileContext';
import SplashScreen from '@/components/SplashScreen';
import WelcomeScreen from '@/components/WelcomeScreen';
import SignInScreen from '@/components/SignInScreen';
import HomeScreen from '@/components/HomeScreen';
import JoinScreen from '@/components/JoinScreen';
import CreateRoomScreen from '@/components/CreateRoomScreen';
import RoomLobby from '@/components/RoomLobby';
import MovieSwiper from '@/components/MovieSwiper';
import MatchesList from '@/components/MatchesList';
import ProfileScreen from '@/components/ProfileScreen';
import TrendingScreen from '@/components/TrendingScreen';
import AuthCallback from '@/components/AuthCallback';
import MatchesHistory from '@/components/MatchesHistory';
import WatchlistScreen from '@/components/WatchlistScreen';
import RoomAnalysis from '@/components/RoomAnalysis';
import LandingPage from '@/components/LandingPage';
import BottomNav from '@/components/BottomNav';
import ScrollToTopButton from '@/components/ScrollToTopButton';
import ErrorBoundary from '@/components/ErrorBoundary';
import CookieBanner from '@/components/CookieBanner';
import '@/lib/tracking';
import PrivacyPolicy from '@/components/legal/PrivacyPolicy';
import Terms from '@/components/legal/Terms';
import LegalNotice from '@/components/legal/LegalNotice';
import CookiePolicy from '@/components/legal/CookiePolicy';
import { initAnalytics } from '@/lib/analytics';
import { installNetworkMonitor } from '@/lib/network';
import NetworkIndicator from '@/components/NetworkIndicator';
import { LoadersGlobalCSS } from '@/components/Loaders';

if (typeof window !== 'undefined') {
  initAnalytics();
  installNetworkMonitor();
  // Track PWA installs / standalone launches (no-op when in browser tab).
  import('@/lib/installApp').then(({ pingInstallIfStandalone }) => {
    try { pingInstallIfStandalone(); } catch {}
  }).catch(() => {});
  // Refresh app badge whenever rooms/matches change (settings-refreshed
  // dispatches after every sync). Non-supporting browsers are no-op.
  window.addEventListener('flickpick:settings-refreshed', () => {
    try {
      const profile = JSON.parse(localStorage.getItem('flickpick.profile.v1') || 'null');
      if (!profile?.id) return;
      import('@/lib/badging').then(({ recomputeBadge }) => recomputeBadge(profile.id)).catch(() => {});
    } catch {}
  });
}

// Rutas pre-auth / transicionales donde NO se muestra la BottomNav
const HIDE_NAV_ROUTES = ['/', '/welcome', '/signin', '/signup', '/marca', '/create', '/join'];
const HIDE_NAV_PREFIXES = ['/auth/', '/g/', '/join/'];
// Routes that match by suffix — used for nested room paths.
const HIDE_NAV_SUFFIXES = ['/lobby'];
// Match the MovieSwiper view exactly (/room/:id without further segments)
// — la barra tapa botones de acción durante los swipes.
const SWIPER_PATH = /^\/room\/[^/]+\/?$/;

function shouldHideNav(pathname) {
  if (HIDE_NAV_ROUTES.includes(pathname)) return true;
  if (HIDE_NAV_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  if (HIDE_NAV_SUFFIXES.some((s) => pathname.endsWith(s))) return true;
  if (SWIPER_PATH.test(pathname)) return true;
  return false;
}

function GlobalBottomNav() {
  const { pathname } = useLocation();
  if (shouldHideNav(pathname)) return null;
  return <BottomNav />;
}

function GlobalScrollToTop() {
  const { pathname } = useLocation();
  if (shouldHideNav(pathname)) return null;
  return <ScrollToTopButton />;
}

// Triggers a server settings refresh on every route change (throttled
// to once per 4s). This makes the "auto-sync" indistinguishable from
// the manual button behaviour the user already confirmed works.
function GlobalAutoSync() {
  const { pathname } = useLocation();
  const lastRef = React.useRef(0);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { manualSyncNow } = await import('@/lib/userSync');
        // Read profile id straight from localStorage to avoid a hard
        // dependency on context ordering.
        let profileId = null;
        try {
          const p = JSON.parse(localStorage.getItem('flickpick.profile.v1') || 'null');
          profileId = p?.id || null;
        } catch {}
        if (!profileId) return;
        const now = Date.now();
        if (now - lastRef.current < 4000) return;
        lastRef.current = now;
        if (cancelled) return;
        await manualSyncNow(profileId);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [pathname]);
  return null;
}

function App() {
  return (
    <ErrorBoundary>
    <ProfileProvider>
      <Helmet>
        <title>FlickPick · Swipe. Match. Watch.</title>
        <meta name="description" content="Desliza, coincide y encuentra la película perfecta para tu noche." />
        <meta name="theme-color" content="#07050E" />
        <link rel="icon" type="image/webp" href="/Favicon.webp" />
        <style>{`
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        `}</style>
      </Helmet>
      <Router>
        <Routes>
          <Route path="/" element={<SplashScreen />} />
          <Route path="/welcome" element={<WelcomeScreen />} />
          <Route path="/signin" element={<SignInScreen mode="signin" />} />
          <Route path="/signup" element={<SignInScreen mode="signup" />} />
          <Route path="/home" element={<HomeScreen />} />
          <Route path="/create" element={<CreateRoomScreen />} />
          <Route path="/join" element={<JoinScreen />} />
          <Route path="/g/:joinCode" element={<JoinScreen />} />
          <Route path="/room/:id/lobby" element={<RoomLobby />} />
          <Route path="/room/:id" element={<MovieSwiper />} />
          <Route path="/room/:id/matches" element={<MatchesList />} />
          <Route path="/profile" element={<ProfileScreen />} />
          <Route path="/trending" element={<TrendingScreen />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/auth/verify-email" element={<AuthCallback />} />
          <Route path="/auth/magic-link" element={<AuthCallback />} />
          <Route path="/matches" element={<MatchesHistory />} />
          <Route path="/watchlist" element={<WatchlistScreen />} />
          <Route path="/room/:id/analysis" element={<RoomAnalysis />} />
          <Route path="/privacidad" element={<PrivacyPolicy />} />
          <Route path="/terminos" element={<Terms />} />
          <Route path="/aviso-legal" element={<LegalNotice />} />
          <Route path="/cookies" element={<CookiePolicy />} />
          <Route path="/marca" element={<LandingPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <GlobalBottomNav />
        <GlobalScrollToTop />
        <GlobalAutoSync />
        <CookieBanner />
        <NetworkIndicator />
        <LoadersGlobalCSS />
      </Router>
      <Toaster />
    </ProfileProvider>
    </ErrorBoundary>
  );
}

export default App;

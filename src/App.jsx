import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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

function App() {
  return (
    <ProfileProvider>
      <Helmet>
        <title>FlickPick · Swipe. Match. Watch.</title>
        <meta name="description" content="Desliza, coincide y encuentra la película perfecta para tu noche." />
        <meta name="theme-color" content="#07050E" />
        <link rel="icon" type="image/png" href="https://horizons-cdn.hostinger.com/d3551fad-72ca-4ad5-ba07-f146c8e06e64/d4a360fde869000ad5d9b9698a9f12e2.png" />
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
          <Route path="/matches" element={<MatchesHistory />} />
          <Route path="/watchlist" element={<WatchlistScreen />} />
          <Route path="/room/:id/analysis" element={<RoomAnalysis />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
      <Toaster />
    </ProfileProvider>
  );
}

export default App;

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Play, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useParams } from 'react-router-dom';
import { getRoom } from '@/lib/roomStore';
import { posterUrl } from '@/lib/tmdb';

const MatchScreen = () => {
  const { id: roomId, movieId } = useParams();
  const navigate = useNavigate();
  const room = getRoom(roomId);
  const match = room?.matches.find(m => String(m.movieId) === String(movieId));
  const movie = match?.movie;
  const poster = posterUrl(movie?.poster_path);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 relative overflow-hidden bg-[#0B1023] bg-[radial-gradient(1200px_circle_at_20%_15%,#FF6A0020,transparent_35%),conic-gradient(from_220deg_at_80%_20%,#FF336630,#7C3AED20,#0B1023)]">
      <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.7, type: 'spring', stiffness: 100 }} className="relative z-10 flex flex-col items-center text-center">
        <div className="relative">
          <Sparkles className="absolute -top-8 -left-8 w-16 h-16 text-yellow-400 animate-pulse" />
          <Sparkles className="absolute -bottom-8 -right-8 w-16 h-16 text-purple-400 animate-pulse" style={{ animationDelay: '0.3s' }} />
          <h1 className="text-6xl md:text-8xl font-extrabold text-white tracking-tighter" style={{ filter: 'drop-shadow(0 0 1rem #FFF)' }}>¡MATCH!</h1>
        </div>
        {movie && (
          <>
            <div className="relative w-64 mt-8 rounded-2xl shadow-2xl overflow-hidden">
              {poster ? <img src={poster} alt={movie.title} className="w-full h-full object-cover" /> : <div className="w-full aspect-[2/3] bg-slate-800" />}
            </div>
            <h2 className="mt-6 text-3xl font-bold text-white">{movie.title}</h2>
          </>
        )}
        <div className="mt-10 flex flex-col sm:flex-row gap-4 w-full max-w-sm">
          <Button onClick={() => navigate(`/room/${roomId}/matches`)} className="flex-1 text-lg font-bold py-6 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/30">
            <Play className="mr-2 h-6 w-6" /> Ver Matches
          </Button>
          <Button onClick={() => navigate(`/room/${roomId}`)} variant="secondary" className="flex-1 text-lg font-bold py-6 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">
            <Film className="mr-2 h-6 w-6" /> Seguir
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default MatchScreen;

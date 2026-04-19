import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, X, ArrowLeft, Film, Tv, Link as LinkIcon, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Checkbox } from "@/components/ui/checkbox";

const platforms = [
  { id: 'netflix', name: 'Netflix', icon: <Film className="w-5 h-5" /> },
  { id: 'prime', name: 'Prime Video', icon: <Film className="w-5 h-5" /> },
  { id: 'hbo', name: 'HBO Max', icon: <Tv className="w-5 h-5" /> },
  { id: 'disney', name: 'Disney+', icon: <Tv className="w-5 h-5" /> },
];

const GroupSetup = ({ onGroupCreated, onBack }) => {
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const { toast } = useToast();

  const handlePlatformToggle = (platformId) => {
    setSelectedPlatforms(prev => 
      prev.includes(platformId) 
        ? prev.filter(id => id !== platformId)
        : [...prev, platformId]
    );
  };

  const handleCreateRoom = () => {
    if (selectedPlatforms.length === 0) {
      toast({
        title: "Selecciona plataformas",
        description: "Elige al menos una plataforma de streaming.",
        variant: "destructive"
      });
      return;
    }
    
    // Mock functionality
    toast({
        title: "¡Sala creada (simulado)!",
        description: "Comparte el enlace o QR para que se unan tus amigos."
    });
    // In a real app, you would navigate or show a modal with join info
    // onGroupCreated({ platforms: selectedPlatforms });
  };
  
  const handleCopyLink = () => {
      navigator.clipboard.writeText('https://flickpick.app/join/XyZ123');
      toast({ title: 'Enlace copiado al portapapeles!' });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className="min-h-screen flex flex-col items-center justify-center p-4"
    >
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-blue-900/20 to-black z-0"></div>
        <div className="relative z-10 w-full max-w-lg">
            <div className="flex items-center mb-6">
                <Button variant="ghost" size="icon" onClick={onBack} className="mr-4 text-slate-300 hover:bg-slate-800">
                    <ArrowLeft className="w-6 h-6" />
                </Button>
                <h1 className="text-3xl font-bold text-white">Crear Sala</h1>
            </div>

            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 space-y-8 shadow-2xl">
                <div>
                    <label className="block text-xl font-semibold mb-4 text-white">
                        ¿Dónde quieres ver?
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                        {platforms.map((platform) => (
                        <div
                            key={platform.id}
                            onClick={() => handlePlatformToggle(platform.id)}
                            className={`flex items-center space-x-3 p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                                selectedPlatforms.includes(platform.id)
                                ? 'border-[#7C3AED] bg-purple-900/30'
                                : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'
                            }`}
                        >
                            <Checkbox
                                id={platform.id}
                                checked={selectedPlatforms.includes(platform.id)}
                                className="data-[state=checked]:bg-[#7C3AED] data-[state=checked]:border-[#7C3AED] border-slate-500"
                            />
                            <label htmlFor={platform.id} className="text-md font-medium text-white cursor-pointer">
                                {platform.name}
                            </label>
                        </div>
                        ))}
                    </div>
                </div>

                <Button
                    onClick={handleCreateRoom}
                    size="lg"
                    className="w-full text-lg font-bold py-6 bg-[#7C3AED] hover:bg-[#6d28d9] text-white rounded-xl shadow-lg shadow-purple-500/30 transform hover:scale-105 transition-transform duration-300"
                >
                    Generar Enlace de Invitación
                </Button>

                {/* Mocked Share Section */}
                <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="bg-slate-800/70 p-6 rounded-2xl border border-slate-700 text-center space-y-4"
                >
                    <h3 className="text-lg font-semibold text-white">¡Invita a tu grupo!</h3>
                    <div className="flex justify-center">
                        <div className="bg-white p-2 rounded-lg">
                            <img className="w-24 h-24" alt="QR Code" src="https://images.unsplash.com/photo-1676275775460-171a6cb34fa4" />
                        </div>
                    </div>
                    <p className="text-slate-400 text-sm">O comparte este enlace:</p>
                    <div className="flex items-center bg-slate-900 p-2 rounded-lg border border-slate-600">
                        <input type="text" readOnly value="flickpick.app/join/XyZ123" className="bg-transparent text-slate-300 w-full outline-none px-2" />
                        <Button onClick={handleCopyLink} size="sm" className="bg-[#2563EB] hover:bg-blue-700 text-white">
                            <LinkIcon className="w-4 h-4 mr-2" />
                            Copiar
                        </Button>
                    </div>
                </motion.div>
            </div>
        </div>
    </motion.div>
  );
};

export default GroupSetup;
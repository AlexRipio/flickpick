import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, Mail, Loader2 } from 'lucide-react';
import { useToast } from './ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const GoogleIcon = () => (
  <svg className="w-5 h-5 mr-2" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C42.012,35.23,44,30.038,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
  </svg>
);

const AuthModal = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const { toast } = useToast();
    const { signInWithGoogle, signInWithMagicLink } = useAuth();
    const [email, setEmail] = useState('');
    const [googleLoading, setGoogleLoading] = useState(false);
    const [magicLinkLoading, setMagicLinkLoading] = useState(false);
    const showAuth = searchParams.get('auth') === 'true';

    const handleClose = () => {
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete('auth');
        setSearchParams(newSearchParams, { replace: true });
    };

    const handleGoogleSignIn = async () => {
        setGoogleLoading(true);
        const { error } = await signInWithGoogle();
        if (error) {
            toast({ title: "Error de autenticación", description: "No se pudo iniciar sesión con Google. Inténtalo de nuevo.", variant: "destructive" });
            console.error("Google Sign-In Error:", error);
        }
        // Redirection is handled by Supabase, no need for navigate('/create') here
        setGoogleLoading(false);
    };
    
    const handleMagicLinkSignIn = async (e) => {
        e.preventDefault();
        if (email === '') {
            toast({ title: 'Introduce tu email', variant: 'destructive' });
            return;
        }
        setMagicLinkLoading(true);
        const { error } = await signInWithMagicLink(email);
        if (error) {
            toast({ title: "Error de autenticación", description: "No se pudo enviar el enlace. Revisa el correo e inténtalo de nuevo.", variant: "destructive" });
            console.error("Magic Link Error:", error);
        } else {
            toast({ title: "Revisa tu correo", description: "Te hemos enviado un enlace mágico para iniciar sesión." });
            handleClose();
        }
        setMagicLinkLoading(false);
    };

    return (
        <AnimatePresence>
            {showAuth && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={handleClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.9, y: 20 }}
                        transition={{ ease: "easeOut", duration: 0.2 }}
                        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-8 shadow-2xl relative text-center"
                        onClick={e => e.stopPropagation()}
                    >
                        <Button variant="ghost" size="icon" className="absolute top-4 right-4 text-slate-400 hover:bg-slate-800" onClick={handleClose}>
                            <X />
                        </Button>
                        
                        <h2 className="text-2xl font-bold text-white">¡Un paso más!</h2>
                        <p className="text-slate-400 mt-2 mb-8">Para crear salas y guardar tu perfil, necesitas una cuenta.</p>
                        
                        <div className="space-y-4">
                            <Button onClick={handleGoogleSignIn} disabled={googleLoading || magicLinkLoading} className="w-full text-lg py-6 bg-white text-black hover:bg-slate-200 disabled:opacity-70">
                                {googleLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <GoogleIcon />}
                                Continuar con Google
                            </Button>
                            
                            <form onSubmit={handleMagicLinkSignIn} className="flex items-center space-x-2">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Tu correo electrónico"
                                    className="w-full px-4 py-3 text-base text-white bg-slate-800 border-2 border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent transition-all"
                                    disabled={googleLoading || magicLinkLoading}
                                />
                                <Button type="submit" disabled={googleLoading || magicLinkLoading} className="py-3 bg-[#7C3AED] hover:bg-[#6d28d9] px-4 h-auto disabled:opacity-70">
                                    {magicLinkLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="w-5 h-5" />}
                                </Button>
                            </form>
                        </div>

                        <p className="text-xs text-slate-500 mt-6">
                            Al continuar, aceptas nuestros Términos de Servicio y Política de Privacidad.
                        </p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default AuthModal;
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleSession = useCallback(async (currentSession) => {
    setSession(currentSession);
    setUser(currentSession?.user ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      handleSession(initialSession);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        handleSession(newSession);
      }
    );

    return () => subscription.unsubscribe();
  }, [handleSession]);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/create`,
      },
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "No se pudo iniciar sesión",
        description: error.message || "Inténtalo de nuevo.",
      });
    }

    return { error };
  }, [toast]);
  
  const signInWithMagicLink = useCallback(async (email) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/create`,
      },
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "No se pudo enviar el enlace",
        description: error.message || "Inténtalo de nuevo.",
      });
    } else {
        toast({
            title: "Revisa tu correo",
            description: "Te hemos enviado un enlace mágico para iniciar sesión.",
        });
    }
    
    return { error };
  }, [toast]);


  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      toast({
        variant: "destructive",
        title: "Error al cerrar sesión",
        description: error.message || "Algo salió mal.",
      });
    }

    return { error };
  }, [toast]);

  const value = useMemo(() => ({
    user,
    session,
    loading,
    signInWithGoogle,
    signInWithMagicLink,
    signOut,
  }), [user, session, loading, signInWithGoogle, signInWithMagicLink, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
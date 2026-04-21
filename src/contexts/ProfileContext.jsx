import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthChange, signOut as authSignOut, hasSupabase } from "@/lib/auth";
import { defaultAvatarForName } from "@/lib/avatars";

const ProfileContext = createContext(null);

const KEY = "flickpick.profile.v1";

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
}
function save(p) {
  localStorage.setItem(KEY, JSON.stringify(p));
}
function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "u-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Only block rendering when there's an active OAuth callback in the URL.
// Normal app loads don't need to wait — they already have the session in storage.
function hasOAuthCallback() {
  if (typeof window === 'undefined') return false;
  const h = window.location.hash;
  const s = window.location.search;
  return h.includes('access_token') || s.includes('code=') || s.includes('error=');
}

export const ProfileProvider = ({ children }) => {
  const [profile, setProfile] = useState(() => load());
  // authLoading: true ONLY when returning from an OAuth redirect.
  const [authLoading, setAuthLoading] = useState(() => hasSupabase && hasOAuthCallback());

  useEffect(() => {
    const onStorage = (e) => { if (e.key === KEY) setProfile(load()); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // When Supabase is configured, keep profile in sync with the real auth session.
  useEffect(() => {
    if (!hasSupabase) return;

    // onAuthStateChange fires INITIAL_SESSION on page load — AFTER Supabase has
    // processed any OAuth token/code in the URL. This is the only reliable moment
    // to know the real session state on mobile OAuth redirects.
    const unsub = onAuthChange((p) => {
      if (p) {
        // Preserve user-picked avatar across re-auths: only default if missing.
        const existing = load();
        const merged = {
          ...p,
          avatarUrl: p.avatarUrl || existing?.avatarUrl || defaultAvatarForName(p.name),
          avatarStyle: existing?.avatarStyle || 'pixel-art',
          avatarSeed:  existing?.avatarSeed  || p.name,
          avatarType:  existing?.avatarType  || (p.avatarUrl ? 'oauth' : 'dicebear'),
        };
        save(merged); setProfile(merged);
      }
      else { localStorage.removeItem(KEY); setProfile(null); }
      setAuthLoading(false);
    });

    // Safety fallback: if onAuthStateChange never fires (edge case), unlock after 4s.
    const timeout = setTimeout(() => setAuthLoading(false), 4000);

    return () => { unsub(); clearTimeout(timeout); };
  }, []);

  const setName = (name) => {
    const next = profile
      ? { ...profile, name, avatarUrl: profile.avatarUrl || defaultAvatarForName(name) }
      : {
          id: uuid(), name, createdAt: Date.now(),
          avatarUrl: defaultAvatarForName(name),
          avatarStyle: 'pixel-art',
          avatarSeed: name,
          avatarType: 'dicebear',
        };
    save(next);
    setProfile(next);
    return next;
  };

  const setProfileFields = (patch) => {
    const base = profile || { id: uuid(), createdAt: Date.now(), name: 'Invitado' };
    const next = { ...base, ...patch };
    save(next);
    setProfile(next);
    return next;
  };

  const ensureProfile = (name) => {
    if (profile && profile.name) return profile;
    return setName(name || "Invitado");
  };

  const clearProfile = async () => {
    try { await authSignOut(); } catch {}
    localStorage.removeItem(KEY);
    setProfile(null);
  };

  const value = useMemo(() => ({ profile, user: profile, authLoading, setName, setProfileFields, ensureProfile, clearProfile }), [profile, authLoading]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
};

export const useProfile = () => {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
};

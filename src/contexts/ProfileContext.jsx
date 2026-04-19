import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getCurrentProfile, onAuthChange, signOut as authSignOut, hasSupabase } from "@/lib/auth";

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

export const ProfileProvider = ({ children }) => {
  const [profile, setProfile] = useState(() => load());

  useEffect(() => {
    const onStorage = (e) => { if (e.key === KEY) setProfile(load()); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // When Supabase is configured, keep profile in sync with the real auth session.
  useEffect(() => {
    if (!hasSupabase) return;
    getCurrentProfile().then(p => { if (p) { save(p); setProfile(p); } });
    const unsub = onAuthChange((p) => {
      if (p) { save(p); setProfile(p); }
      else { localStorage.removeItem(KEY); setProfile(null); }
    });
    return unsub;
  }, []);

  const setName = (name) => {
    const next = profile ? { ...profile, name } : { id: uuid(), name, createdAt: Date.now() };
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

  const value = useMemo(() => ({ profile, user: profile, setName, setProfileFields, ensureProfile, clearProfile }), [profile]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
};

export const useProfile = () => {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
};

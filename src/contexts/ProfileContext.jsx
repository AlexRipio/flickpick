import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthChange, signOut as authSignOut } from "@/lib/auth";
import { defaultAvatarForName } from "@/lib/avatars";
import { bootstrapUserSettings, userSync, installVisibilityRefresh, manualSyncNow, refreshUserSettings } from "@/lib/userSync";

const ProfileContext = createContext(null);

const KEY = "flickpick.profile.v1";
// Per-user "sticky" avatar store. Keyed by user.id (or email as fallback).
// Only written when the user actively chose an AI-generated or uploaded
// avatar — those choices must SURVIVE a logout/login cycle, so they live
// outside the main profile blob (which `clearProfile` wipes on logout).
const AVATAR_KEY_PREFIX = "flickpick.avatar.v1.";

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
}
function save(p) {
  localStorage.setItem(KEY, JSON.stringify(p));
}

function avatarKeyFor(user) {
  if (!user) return null;
  const id = user.id || user.email;
  return id ? AVATAR_KEY_PREFIX + id : null;
}
function loadStickyAvatar(user) {
  const k = avatarKeyFor(user);
  if (!k) return null;
  try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; }
}
function saveStickyAvatar(user, avatar) {
  const k = avatarKeyFor(user);
  if (!k || !avatar) return;
  try { localStorage.setItem(k, JSON.stringify(avatar)); } catch {}
}
function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "u-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Block rendering when returning from an auth callback (email verification).
function hasAuthCallback() {
  if (typeof window === 'undefined') return false;
  const s = window.location.search;
  return s.includes('token=') && s.includes('email=');
}

export const ProfileProvider = ({ children }) => {
  const [profile, setProfile] = useState(() => load());
  const [authLoading, setAuthLoading] = useState(true); // always wait for initAuth() to complete
  // Guard against bootstrapping the same user twice in the same tab
  // session (onAuthChange can fire on focus/refresh).
  const bootstrappedFor = React.useRef(null);

  useEffect(() => {
    const onStorage = (e) => { if (e.key === KEY) setProfile(load()); };
    // After a server-side refresh (visibility change), re-read the sticky
    // avatar — if it changed (e.g. user picked a new avatar on another
    // device) update the profile in React state so the UI reflects it.
    const onSettingsRefreshed = () => {
      setProfile((current) => {
        if (!current?.id) return current;
        const sticky = loadStickyAvatar(current);
        if (!sticky || !sticky.avatarUrl) return current;
        if (sticky.avatarType !== 'ai' && sticky.avatarType !== 'upload') return current;
        if (sticky.avatarUrl === current.avatarUrl) return current;
        const next = {
          ...current,
          avatarUrl: sticky.avatarUrl,
          avatarType: sticky.avatarType,
          avatarStyle: sticky.avatarStyle || current.avatarStyle,
          avatarSeed:  sticky.avatarSeed  || current.avatarSeed,
        };
        save(next);
        return next;
      });
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("flickpick:settings-refreshed", onSettingsRefreshed);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("flickpick:settings-refreshed", onSettingsRefreshed);
    };
  }, []);

  // Keep profile in sync with the auth session (JWT-based).
  useEffect(() => {
    const unsub = onAuthChange((p) => {
      if (p) {
        // Avatar resolution priority — robust merge:
        //  1. Si el user eligió AI/upload (sticky por user.id) — MANTENER siempre, sobrevive logout
        //  2. Si en este device hay profile local con AI/upload — MANTENER (caso fresh-install + sticky aún no migrado)
        //  3. Si tipo local es 'oauth'/'dicebear' y OAuth devuelve URL nueva — usar la nueva
        //  4. Si tipo local es 'dicebear' fallback — mejorar a oauth si hay URL
        //  5. Si nada de eso — calcular default por nombre
        const existing = load();
        const sticky = loadStickyAvatar(p);
        let avatarUrl, avatarType, avatarStyle, avatarSeed;

        const stickyValid = sticky && (sticky.avatarType === 'ai' || sticky.avatarType === 'upload') && sticky.avatarUrl;
        const localPicked = existing && (existing.avatarType === 'ai' || existing.avatarType === 'upload') && existing.avatarUrl;

        if (stickyValid) {
          avatarUrl = sticky.avatarUrl;
          avatarType = sticky.avatarType;
          avatarStyle = sticky.avatarStyle || existing?.avatarStyle || 'pixel-art';
          avatarSeed  = sticky.avatarSeed  || existing?.avatarSeed  || p.name;
        } else if (localPicked) {
          avatarUrl = existing.avatarUrl;
          avatarType = existing.avatarType;
          avatarStyle = existing.avatarStyle || 'pixel-art';
          avatarSeed  = existing.avatarSeed  || p.name;
          // Promote local choice to sticky so future logout/login cycles preserve it.
          saveStickyAvatar(p, { avatarUrl, avatarType, avatarStyle, avatarSeed });
        } else if (p.avatarUrl) {
          avatarUrl = p.avatarUrl;
          avatarType = 'oauth';
          avatarStyle = existing?.avatarStyle || 'pixel-art';
          avatarSeed  = existing?.avatarSeed  || p.name;
        } else if (existing?.avatarUrl) {
          avatarUrl = existing.avatarUrl;
          avatarType = existing.avatarType || 'dicebear';
          avatarStyle = existing.avatarStyle || 'pixel-art';
          avatarSeed  = existing.avatarSeed  || p.name;
        } else {
          avatarUrl = defaultAvatarForName(p.name);
          avatarType = 'dicebear';
          avatarStyle = 'pixel-art';
          avatarSeed  = p.name;
        }

        const merged = { ...p, avatarUrl, avatarType, avatarStyle, avatarSeed };
        save(merged); setProfile(merged);
        // Cross-device sync: pull server-side settings (watchlist,
        // onboarding-seen, avatar, top10, etc.), merge into localStorage.
        // Only once per user per tab session — onAuthChange may re-fire
        // on tab focus or periodic refresh and we must not stomp local
        // edits with stale server data mid-session.
        // Install visibility-refresh handler (idempotent) so changes on
        // another device sync into this one when the user comes back.
        installVisibilityRefresh(p.id);
        if (bootstrappedFor.current !== p.id) {
          bootstrappedFor.current = p.id;
          // EXACT same path as the manual "Sincronizar ahora" button —
          // the user confirmed that path works. Plus retries: re-fire
          // refresh + dispatch at 0.5s / 1.5s / 3s / 5s after login so
          // any component that mounts late ALWAYS catches an event.
          const dispatchRefresh = () => {
            try { window.dispatchEvent(new CustomEvent('flickpick:settings-refreshed')); } catch {}
          };
          const runFullSync = async () => {
            try { await manualSyncNow(p.id); } catch {}
            // Re-merge avatar to React state if server had a sticky one.
            const fresh = loadStickyAvatar(p);
            if (fresh && (fresh.avatarType === 'ai' || fresh.avatarType === 'upload') && fresh.avatarUrl) {
              const updated = {
                ...merged,
                avatarUrl: fresh.avatarUrl,
                avatarType: fresh.avatarType,
                avatarStyle: fresh.avatarStyle || merged.avatarStyle,
                avatarSeed:  fresh.avatarSeed  || merged.avatarSeed,
              };
              save(updated);
              setProfile(updated);
            }
            dispatchRefresh();
            // Stagger retries — covers components that mount late on
            // post-login navigation transitions.
            setTimeout(dispatchRefresh, 500);
            setTimeout(dispatchRefresh, 1500);
            setTimeout(async () => {
              try { await refreshUserSettings(p.id); } catch {}
              const fresh2 = loadStickyAvatar(p);
              if (fresh2 && (fresh2.avatarType === 'ai' || fresh2.avatarType === 'upload') && fresh2.avatarUrl) {
                setProfile(prev => prev ? {
                  ...prev,
                  avatarUrl: fresh2.avatarUrl,
                  avatarType: fresh2.avatarType,
                  avatarStyle: fresh2.avatarStyle || prev.avatarStyle,
                  avatarSeed: fresh2.avatarSeed || prev.avatarSeed,
                } : prev);
              }
              dispatchRefresh();
            }, 3000);
            setTimeout(dispatchRefresh, 5000);
          };
          runFullSync();
        }
      }
      else {
        localStorage.removeItem(KEY);
        setProfile(null);
        bootstrappedFor.current = null; // allow re-bootstrap on next login
      }
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
    // If the user just chose an AI/upload avatar, persist it under the
    // sticky per-user key so logout/login does not lose it.
    if (next.avatarType === 'ai' || next.avatarType === 'upload') {
      const av = {
        avatarUrl: next.avatarUrl,
        avatarType: next.avatarType,
        avatarStyle: next.avatarStyle,
        avatarSeed: next.avatarSeed,
      };
      saveStickyAvatar(next, av);
      userSync.avatar(av); // server-side persistence
    }
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

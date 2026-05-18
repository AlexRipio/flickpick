import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import FeedbackSheet from '@/components/FeedbackSheet';
import OnboardingTutorial, { resetOnboarding } from '@/components/OnboardingTutorial';
import UpdatesModal from '@/components/UpdatesModal';
import DeleteAccountSheet from '@/components/DeleteAccountSheet';
import InstallAppSheet from '@/components/InstallAppSheet';
import AvatarCropSheet from '@/components/AvatarCropSheet';
import { getLibrary, subscribeLibrary, removeFromLibrary, addToLibrary } from '@/lib/avatarLibrary';
import { isStandalone } from '@/lib/installApp';
import haptic, { isHapticSupported, isHapticEnabled, setHapticEnabled } from '@/lib/haptic';
import { manualSyncNow, repushLocalRooms } from '@/lib/userSync';
import { markAllMatchesSeen } from '@/lib/roomStore';
import { pushSupported, isPushSubscribed, subscribePush, unsubscribePush, sendTestPush } from '@/lib/push';
import { APP_VERSION } from '@/lib/appVersion';
import { AmbientBackdrop, Avatar, BackButton, TextField, GradientButton } from '@/components/fp/primitives';
import { FP } from '@/lib/fp';
import { useProfile } from '@/contexts/ProfileContext';
import {
  defaultAvatarForName, uploadAvatar, canUpload,
} from '@/lib/avatars';
import { apiGenerateAvatar, apiGetAvatarQuota } from '@/lib/api';

function readAllRooms() {
  try { return JSON.parse(localStorage.getItem('flickpick.rooms.v1') || '{}'); } catch { return {}; }
}

const ProfileScreen = () => {
  const navigate = useNavigate();
  const { profile, setProfileFields, clearProfile } = useProfile();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(profile?.name || '');
  const [draftEmail, setDraftEmail] = useState(profile?.email || '');
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const installed = isStandalone();
  const hapticAvailable = isHapticSupported();
  const [hapticOn, setHapticOnState] = useState(() => isHapticEnabled());
  const pushAvail = pushSupported();
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState('');

  useEffect(() => {
    if (!pushAvail) return;
    isPushSubscribed().then(setPushOn).catch(() => {});
  }, [pushAvail]);

  const handleTogglePush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    setPushMsg('');
    try {
      if (pushOn) {
        await unsubscribePush();
        setPushOn(false);
      } else {
        await subscribePush();
        setPushOn(true);
        // Send a test push so the user sees it work immediately.
        try { await sendTestPush(); } catch {}
      }
    } catch (e) {
      setPushMsg(e?.message || 'Error');
      setTimeout(() => setPushMsg(''), 4000);
    } finally {
      setPushBusy(false);
    }
  };
  const [syncStatus, setSyncStatus] = useState(''); // '' | 'syncing' | 'ok' | 'error'

  const [syncDetail, setSyncDetail] = useState('');
  const [repushStatus, setRepushStatus] = useState('');
  const [debugInfo, setDebugInfo] = useState('');
  // Debug rows hidden for normal users. To re-enable for troubleshooting:
  //   localStorage.setItem('flickpick.debug', '1') and refresh.
  const debugMode = (() => {
    try { return localStorage.getItem('flickpick.debug') === '1'; } catch { return false; }
  })();
  const [backendStatus, setBackendStatus] = useState(''); // '🟢 actualizado' / '🔴 código viejo' / ''
  const [copyOk, setCopyOk] = useState(false);

  // Bump this every time the backend debug-mine response shape changes.
  // Compare against `_backend_version` from response to detect cron reload.
  const EXPECTED_BACKEND_VERSION = 'fix-v5-2026-05-06d';

  const handleDebug = async () => {
    if (!profile?.id) return;
    setDebugInfo('cargando…');
    setBackendStatus('');
    try {
      const { apiFetch, apiListMyRooms } = await import('@/lib/api');
      const dbg = await apiFetch('/rooms/debug-mine');
      const mineRooms = await apiListMyRooms();
      let local = {};
      try { local = JSON.parse(localStorage.getItem('flickpick.rooms.v1') || '{}'); } catch {}
      const localCount = Object.keys(local).length;
      const matchedLocally = Object.values(local).filter(r => {
        if (!r || !profile?.id) return false;
        return (r.members?.some(m => m.id === profile.id)) || r.ownerId === profile.id;
      }).length;
      // RAW fetch to /rooms/mine — bypasses apiFetch JSON parse so we
      // can see HTTP status, body size, parse errors, etc.
      let raw_mine = {};
      try {
        const { getToken } = await import('@/lib/api');
        const tk = getToken();
        const r = await fetch('https://flickpick.mov/api/rooms/mine', {
          cache: 'no-store',
          headers: tk ? { 'Authorization': 'Bearer ' + tk } : {},
        });
        const text = await r.text();
        raw_mine.status = r.status;
        raw_mine.content_type = r.headers.get('content-type');
        raw_mine.body_bytes = text.length;
        raw_mine.body_preview = text.slice(0, 200);
        try {
          const parsed = JSON.parse(text);
          raw_mine.parsed_rooms_length = Array.isArray(parsed?.rooms) ? parsed.rooms.length : 'NOT_ARRAY';
          raw_mine.parsed_count_field = parsed?.count;
        } catch (parseErr) {
          raw_mine.parse_error = parseErr.message;
          raw_mine.body_tail = text.slice(-200);
        }
      } catch (fe) {
        raw_mine.fetch_error = fe.message;
      }
      const summary = {
        ...dbg,
        FRONTEND_apiListMyRooms_returned: Array.isArray(mineRooms) ? mineRooms.length : 'NOT_ARRAY',
        FRONTEND_first_3_room_ids: (mineRooms || []).slice(0, 3).map(r => r?.id),
        LOCAL_storage_room_count: localCount,
        LOCAL_filtered_for_user: matchedLocally,
        FRONTEND_raw_mine: raw_mine,
      };
      // Detect if backend cron has reloaded with the latest code.
      if (dbg?._backend_version === EXPECTED_BACKEND_VERSION) {
        const startedAt = dbg._backend_started_at ? new Date(dbg._backend_started_at) : null;
        const ago = startedAt ? Math.round((Date.now() - startedAt.getTime()) / 1000) : null;
        setBackendStatus(`🟢 backend actualizado${ago != null ? ` (reiniciado hace ${ago < 60 ? ago + 's' : Math.round(ago/60) + 'm'})` : ''}`);
      } else {
        setBackendStatus(`🔴 backend con código viejo (v=${dbg?._backend_version || 'sin versión'}) — espera al cron`);
      }
      setDebugInfo(JSON.stringify(summary, null, 2));
    } catch (e) {
      setDebugInfo('Error: ' + (e?.message || 'unknown'));
    }
  };

  const handleCopyDebug = async () => {
    if (!debugInfo) return;
    try {
      await navigator.clipboard.writeText(debugInfo);
      setCopyOk(true);
      setTimeout(() => setCopyOk(false), 1800);
    } catch {
      setCopyOk(false);
    }
  };

  const handleRepushRooms = async () => {
    if (!profile?.id || repushStatus === 'busy') return;
    setRepushStatus('busy');
    try {
      const r = await repushLocalRooms(profile.id);
      // Re-run sync to see updated server count
      const s = await manualSyncNow(profile.id);
      setRepushStatus(`✓ ${r.pushed} subidas (${r.errors} errores) · ${s.roomsCount ?? 0} en server`);
    } catch (e) {
      setRepushStatus('Error: ' + (e?.message || 'unknown'));
    }
    setTimeout(() => setRepushStatus(''), 8000);
  };

  const handleManualSync = async () => {
    if (!profile?.id || syncStatus === 'syncing') return;
    setSyncStatus('syncing');
    setSyncDetail('');
    try {
      const res = await manualSyncNow(profile.id);
      setSyncStatus(res.ok ? 'ok' : 'error');
      if (res.ok) {
        setSyncDetail(`local ${res.localCount ?? 0} · subidas ${res.pushed ?? 0} · errores ${res.errors ?? 0} · server ${res.roomsCount ?? 0}`);
      }
    } catch {
      setSyncStatus('error');
    }
    setTimeout(() => { setSyncStatus(''); setSyncDetail(''); }, 5000);
  };

  const stats = useMemo(() => {
    if (!profile?.id) return { rooms: 0, matches: 0, likes: 0, skips: 0 };
    const all = Object.values(readAllRooms());
    let rooms = 0, matches = 0, likes = 0, skips = 0;
    for (const r of all) {
      if (!r) continue;
      const me = r.members?.find(m => m.id === profile.id);
      if (!me) continue;
      rooms += 1;
      matches += (r.matches?.length || 0);
      likes += me.taste?.likes || 0;
      skips += me.taste?.skips || 0;
    }
    return { rooms, matches, likes, skips };
  }, [profile]);

  if (!profile) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <AmbientBackdrop hue={280}/>
        <div style={{ position: 'relative', zIndex: 2, color: FP.textDim }}>Sin perfil.</div>
      </div>
    );
  }

  const initial = (profile.name || '?').trim().charAt(0).toUpperCase();

  const save = () => {
    if (!draftName.trim()) return;
    setProfileFields({ name: draftName.trim(), email: draftEmail.trim() });
    setEditing(false);
  };

  const logout = () => {
    if (!window.confirm('¿Cerrar sesión? Perderás los datos guardados.')) return;
    clearProfile();
    navigate('/welcome', { replace: true });
  };

  const handleAvatarSave = (patch) => {
    setProfileFields(patch);
    setAvatarOpen(false);
  };

  const [notifClearedAt, setNotifClearedAt] = useState(0);
  const clearAllNotifications = () => {
    if (!profile?.id) return;
    const touched = markAllMatchesSeen(profile.id);
    import('@/lib/badging').then(({ recomputeBadge, clearBadge }) => {
      clearBadge();
      recomputeBadge(profile.id);
    }).catch(() => {});
    setNotifClearedAt(Date.now());
    setTimeout(() => setNotifClearedAt(0), 2400);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <AmbientBackdrop hue={280}/>

      <div style={{
        position: 'relative', zIndex: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', maxWidth: 520, width: '100%', margin: '0 auto',
      }}>
        <BackButton onClick={() => navigate('/home')}/>
        <div style={{ fontSize: 13, fontWeight: 600, color: FP.textDim }}>Perfil</div>
        <div style={{ width: 42 }}/>
      </div>

      <div className="no-scrollbar" style={{
        position: 'relative', zIndex: 2, flex: 1, overflowY: 'auto',
        padding: '6px 24px var(--fp-content-bottom)', maxWidth: 520, width: '100%', margin: '0 auto',
      }}>
        {/* Avatar + name */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginTop: 6, marginBottom: 26 }}>
          <button onClick={() => setAvatarOpen(true)} style={{
            position: 'relative', padding: 0, background: 'transparent', border: 'none', cursor: 'pointer',
          }}>
            <div style={{
              width: 104, height: 104, borderRadius: 999,
              background: profile.avatarUrl ? '#1a0f2e' : FP.flame,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontFamily: '"Space Grotesk"', fontWeight: 800, fontSize: 42,
              boxShadow: '0 18px 40px rgba(255,59,107,0.45)',
              border: '3px solid rgba(255,255,255,0.1)',
              overflow: 'hidden',
            }}>
              {profile.avatarUrl
                ? <img src={profile.avatarUrl} alt={profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                : <span>{initial}</span>
              }
            </div>
            {/* Edit badge */}
            <div style={{
              position: 'absolute', right: -2, bottom: -2,
              width: 34, height: 34, borderRadius: 999,
              background: FP.flame,
              border: '3px solid #07050E',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(255,59,107,0.5)',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M14.06 6.19l3.75 3.75M3 21h4.24l10.58-10.58a1.5 1.5 0 000-2.12l-3.12-3.12a1.5 1.5 0 00-2.12 0L3 15.76V21z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </button>
          {!editing && (
            <>
              <div style={{
                fontFamily: '"Space Grotesk", system-ui',
                fontSize: 26, fontWeight: 800, color: FP.text,
                letterSpacing: -0.6,
              }}>{profile.name}</div>
              {profile.email && <div style={{ fontSize: 13, color: FP.textDim }}>{profile.email}</div>}
              <button onClick={() => setEditing(true)} style={{
                marginTop: 2, padding: '8px 16px', borderRadius: 999,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>Editar perfil</button>
            </>
          )}
        </div>

        {editing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 26 }}>
            <TextField label="Nombre" value={draftName} onChange={setDraftName} placeholder="Tu nombre"/>
            <TextField label="Email" value={draftEmail} onChange={setDraftEmail} placeholder="tu@correo.com" type="email"/>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={() => { setEditing(false); setDraftName(profile.name); setDraftEmail(profile.email || ''); }} style={{
                flex: 1, height: 48, borderRadius: 999,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>Cancelar</button>
              <div style={{ flex: 1.3 }}>
                <GradientButton variant="flame" onClick={save} style={{ height: 48 }}>Guardar</GradientButton>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 26,
        }}>
          <StatCard label="Salas" value={stats.rooms} accent={FP.violet}/>
          <StatCard label="Matches" value={stats.matches} accent={FP.flame}/>
          <StatCard label="Me gusta" value={stats.likes} accent="linear-gradient(135deg,#4EFFD6,#0EA5A0)"/>
          <StatCard label="Saltadas" value={stats.skips} accent="rgba(255,255,255,0.08)" plain/>
        </div>

        {/* Settings list */}
        <div style={{
          borderRadius: 20, overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.03)',
          marginBottom: 14,
        }}>
          <SettingRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2l3 7 7 .5-5.5 4.5L18 22l-6-4-6 4 1.5-8L2 9.5 9 9z" stroke="#FFB547" strokeWidth="2" strokeLinejoin="round"/></svg>}
            label="Tus matches"
            onClick={() => navigate('/home')}
          />
          <SettingRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h10" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>}
            label="Crear sala"
            onClick={() => navigate('/create')}
          />
          <SettingRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M14 3h7v7M10 21H3v-7M21 3l-8 8M3 21l8-8" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            label="Unirse con código"
            onClick={() => navigate('/join')}
          />
        </div>

        {/* Soporte / contacto */}
        <div style={{
          borderRadius: 20, overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.03)',
          marginBottom: 28,
        }}>
          <SettingRow
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M9 18h6M10 21h4M12 3a7 7 0 00-4 12.7c.6.5 1 1.2 1 2v.3h6v-.3c0-.8.4-1.5 1-2A7 7 0 0012 3z" stroke="#FFD166" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
            label="Enviar sugerencia"
            onClick={() => setFeedbackOpen(true)}
          />
          <SettingRow
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#5BFFB0" strokeWidth="2"/>
                <path d="M12 8v4M12 16v.01" stroke="#5BFFB0" strokeWidth="2.4" strokeLinecap="round"/>
              </svg>
            }
            label="Ver tutorial de bienvenida"
            onClick={() => { if (profile?.id) resetOnboarding(profile.id); setTutorialOpen(true); }}
          />
          <SettingRow
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 2c.6 3-1.5 4.6-2.8 6C7.7 9.7 6 11.4 6 14a6 6 0 0012 0c0-2.2-1-3.6-2.3-4.7-1-.9-1.7-1.7-1.7-3 0-1-.5-2.6-2-4.3z" fill="#FF6B4A"/>
              </svg>
            }
            label={`Novedades de la app · v${APP_VERSION}`}
            onClick={() => setUpdatesOpen(true)}
          />
          <SettingRow
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 3v12M12 15l-4-4M12 15l4-4" stroke="#3FA9FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M5 17v2a2 2 0 002 2h10a2 2 0 002-2v-2" stroke="#3FA9FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
            label={installed ? 'App instalada ✓' : 'Instalar como app'}
            onClick={() => setInstallOpen(true)}
          />
          {hapticAvailable && (
            <SettingRow
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect x="6" y="2" width="12" height="20" rx="3" stroke="#B388FF" strokeWidth="2"/>
                  <path d="M2 9l1.5 1.5M2 15l1.5-1.5M22 9l-1.5 1.5M22 15l-1.5-1.5" stroke="#B388FF" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="12" cy="18" r="1" fill="#B388FF"/>
                </svg>
              }
              label="Vibración al hacer swipe y match"
              onClick={() => {
                const next = !hapticOn;
                setHapticEnabled(next);
                setHapticOnState(next);
                if (next) haptic.success();
              }}
              right={<ToggleSwitch on={hapticOn} />}
            />
          )}
          {pushAvail && (
            <SettingRow
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="#FFB547" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              }
              label={
                pushBusy ? 'Activando…' :
                pushMsg ? `⚠️ ${pushMsg}` :
                pushOn ? 'Notificaciones activadas' : 'Activar notificaciones de match'
              }
              onClick={handleTogglePush}
              right={<ToggleSwitch on={pushOn} />}
            />
          )}
          <SettingRow
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M21 12a9 9 0 11-3-6.7M21 4v5h-5" stroke="#5BE7FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
            label={
              syncStatus === 'syncing' ? 'Sincronizando…' :
              syncStatus === 'ok'      ? `✓ Sincronizado${syncDetail ? ' · ' + syncDetail : ''}` :
              syncStatus === 'error'   ? 'Error al sincronizar' :
              'Sincronizar mis datos ahora'
            }
            onClick={handleManualSync}
            hideChevron={syncStatus !== ''}
          />
          {debugMode && (
            <SettingRow
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 4v12M12 4l-4 4M12 4l4 4M5 20h14" stroke="#FFB547" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              }
              label={repushStatus || 'Re-subir mis salas al servidor'}
              onClick={handleRepushRooms}
              hideChevron={!!repushStatus}
            />
          )}
          {debugMode && (
            <SettingRow
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#7AE7FF" strokeWidth="2"/><path d="M12 7v6M12 17v.01" stroke="#7AE7FF" strokeWidth="2.4" strokeLinecap="round"/></svg>}
              label="Diagnóstico salas (debug)"
              onClick={handleDebug}
            />
          )}
        </div>
        {debugMode && debugInfo && (
          <div style={{ margin: '12px 0' }}>
            {backendStatus && (
              <div style={{
                padding: '8px 12px', marginBottom: 8, borderRadius: 10,
                background: backendStatus.startsWith('🟢') ? 'rgba(91,255,176,0.10)' : 'rgba(255,107,74,0.12)',
                border: backendStatus.startsWith('🟢') ? '1px solid rgba(91,255,176,0.35)' : '1px solid rgba(255,107,74,0.40)',
                color: '#fff', fontSize: 12, fontWeight: 600,
                fontFamily: '"Space Grotesk", system-ui',
              }}>
                {backendStatus}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button onClick={handleCopyDebug} style={{
                flex: 1, height: 38, borderRadius: 10,
                background: copyOk ? 'linear-gradient(135deg, #5BFFB0, #3FA9FF)' : 'rgba(122,231,255,0.15)',
                border: '1px solid rgba(122,231,255,0.35)',
                color: copyOk ? '#001' : '#7AE7FF',
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
                fontFamily: '"Space Grotesk", system-ui',
              }}>
                {copyOk ? '✓ Copiado' : '📋 Copiar JSON'}
              </button>
              <button onClick={handleDebug} style={{
                flex: 1, height: 38, borderRadius: 10,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                fontFamily: '"Space Grotesk", system-ui',
              }}>
                🔄 Volver a comprobar
              </button>
            </div>
            <div style={{
              padding: 14, borderRadius: 12,
              background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(122,231,255,0.25)',
              fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11,
              color: '#7AE7FF', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              maxHeight: 320, overflow: 'auto',
            }}>
              {debugInfo}
            </div>
          </div>
        )}

        <div style={{
          borderRadius: 20, overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.03)',
          marginBottom: 16,
        }}>
          <SettingRow
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 01-6 0m6 0H9"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
            label={notifClearedAt ? 'Notificaciones limpiadas ✓' : 'Marcar notificaciones como vistas'}
            onClick={clearAllNotifications}
            hideChevron
          />
        </div>

        <div style={{
          borderRadius: 20, overflow: 'hidden',
          border: '1px solid rgba(255,59,107,0.2)',
          background: 'rgba(255,59,107,0.05)',
        }}>
          <SettingRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="#FF3B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            label={<span style={{ color: '#FF3B6B' }}>Cerrar sesión</span>}
            onClick={logout}
            hideChevron
          />
        </div>

        {/* ── Eliminar cuenta — zona peligrosa ──────────────────────────── */}
        <div style={{
          borderRadius: 20, overflow: 'hidden',
          border: '1px solid rgba(255,75,75,0.22)',
          background: 'rgba(255,75,75,0.04)',
          marginTop: 16,
        }}>
          <SettingRow
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6"
                  stroke="#FF6B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
            label={<span style={{ color: '#FF6B6B' }}>Eliminar cuenta</span>}
            onClick={() => setDeleteOpen(true)}
            hideChevron
          />
        </div>

        {/* ── Acerca de · TMDB attribution + legal links ─────────────────── */}
        <div style={{
          marginTop: 28, padding: 18, borderRadius: 20,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 800, color: FP.textMuted,
            letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12,
          }}>
            Acerca de FlickPick
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
            <img
              src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg"
              alt="TMDB"
              style={{ width: 56, height: 'auto', flexShrink: 0, marginTop: 2 }}
            />
            <div style={{
              fontSize: 11.5, lineHeight: 1.5, color: 'rgba(255,255,255,0.62)',
            }}>
              Datos de películas y series cortesía de The Movie Database (TMDB).
              FlickPick no está respaldado ni certificado por TMDB.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { to: '/terminos',    label: 'Términos de uso' },
              { to: '/privacidad',  label: 'Política de Privacidad' },
              { to: '/cookies',     label: 'Política de Cookies' },
              { to: '/aviso-legal', label: 'Aviso Legal' },
            ].map(l => (
              <Link key={l.to} to={l.to} style={{
                fontSize: 12.5, color: 'rgba(255,255,255,0.78)',
                textDecoration: 'none', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ color: FP.flameSolid }}>·</span> {l.label}
              </Link>
            ))}
          </div>
        </div>

        <div style={{
          marginTop: 18, textAlign: 'center',
          fontSize: 11, color: FP.textMuted,
          letterSpacing: 1, textTransform: 'uppercase',
        }}>
          FlickPick · Swipe. Match. Watch.
        </div>
      </div>

      {avatarOpen && (
        <AvatarPicker
          profile={profile}
          onClose={() => setAvatarOpen(false)}
          onSave={handleAvatarSave}
        />
      )}

      <FeedbackSheet
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        defaultEmail={profile?.email || ''}
      />

      {tutorialOpen && (
        <OnboardingTutorial onClose={() => setTutorialOpen(false)} />
      )}

      {updatesOpen && (
        <UpdatesModal profileId={profile?.id} onClose={() => setUpdatesOpen(false)} />
      )}

      <InstallAppSheet open={installOpen} onClose={() => setInstallOpen(false)} />

      {deleteOpen && (
        <DeleteAccountSheet
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => {
            clearProfile();
            navigate('/welcome', { replace: true });
          }}
        />
      )}
    </div>
  );
};

// ── AI styles ─────────────────────────────────────────────────────────────────
// Style IDs match the backend prompt templates in routes/avatars.js.
// Cinema-style presets — names must match STYLE_TEMPLATES on the backend
// (backend/routes/avatars.js). The label/emoji are pure UI.
const AI_STYLES = [
  { id: 'noir',        label: 'Cine negro',   emoji: '🎩' },
  { id: 'bladerunner', label: 'Blade Runner', emoji: '🌃' },
  { id: 'wes',         label: 'Wes Anderson', emoji: '🟧' },
  { id: 'western',     label: 'Western',      emoji: '🤠' },
  { id: 'ghibli',      label: 'Ghibli',       emoji: '🌿' },
  { id: 'scifi',       label: 'Sci-fi',       emoji: '🚀' },
  { id: 'seventies',   label: 'Setentero',    emoji: '📽️' },
  { id: 'tarantino',   label: 'Tarantino',    emoji: '🎬' },
];
const AI_LABELS = ['Imaginando…', 'Mezclando colores…', 'Pintando píxeles…', 'Casi listo…'];
const AI_QUOTA_KEY = 'flickpick.ai-avatar.last-gen';

function getAiUsedToday() {
  try {
    const last = localStorage.getItem(AI_QUOTA_KEY);
    if (!last) return false;
    const lastDay = new Date(last).toDateString();
    const today   = new Date().toDateString();
    return lastDay === today;
  } catch { return false; }
}

function timeUntilTomorrow() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setHours(24, 0, 0, 0);
  const diff = tomorrow - now;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}m`;
}

// ── Avatar picker sheet ───────────────────────────────────────────────────────
function AvatarPicker({ profile, onClose, onSave }) {
  const [mode, setMode]           = useState('ai'); // 'ai' | 'upload'
  // AI state
  const [aiStyle, setAiStyle]     = useState(null);
  const [aiPrompt, setAiPrompt]   = useState('');
  const [generating, setGenerating] = useState(false);
  const [genLabel, setGenLabel]   = useState(AI_LABELS[0]);
  const [aiResult, setAiResult]   = useState(null);
  const [aiUsed, setAiUsed]       = useState(getAiUsedToday());
  // Upload state
  const [uploadUrl, setUploadUrl] = useState(null);
  const [cropSrc, setCropSrc] = useState(null);
  const [libraryItems, setLibraryItems] = useState(() => getLibrary(profile?.id));
  const [pickedLibrary, setPickedLibrary] = useState(null);

  useEffect(() => {
    const refresh = () => setLibraryItems(getLibrary(profile?.id));
    refresh();
    const unsub = subscribeLibrary(refresh);
    return unsub;
  }, [profile?.id]);
  const [uploading, setUploading] = useState(false);
  const [err, setErr]             = useState('');
  const fileRef = useRef(null);

  // Cycle the "Imaginando…" label while generating
  useEffect(() => {
    if (!generating) return;
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % AI_LABELS.length;
      setGenLabel(AI_LABELS[i]);
    }, 1500);
    return () => clearInterval(t);
  }, [generating]);

  // Sync quota with backend on mount — server is source of truth (the
  // localStorage flag is only a UX hint to avoid an instant 429 round-trip).
  useEffect(() => {
    apiGetAvatarQuota().then((q) => {
      if (!q) return;
      if (q.remaining <= 0) {
        setAiUsed(true);
        try { localStorage.setItem(AI_QUOTA_KEY, new Date().toISOString()); } catch {}
      } else {
        setAiUsed(false);
      }
    });
  }, []);

  const pickFile = () => fileRef.current?.click();

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    // Reset the input so picking the same file again still fires onChange
    if (e.target) e.target.value = '';
    if (!file) return;
    setErr('');
    if (!/^image\//.test(file.type)) {
      setErr('El archivo debe ser una imagen.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setErr('La imagen es demasiado grande (máx 8 MB).');
      return;
    }
    const localUrl = URL.createObjectURL(file);
    setCropSrc(localUrl);
  };

  const handleCropConfirm = (dataUrl) => {
    if (cropSrc) { try { URL.revokeObjectURL(cropSrc); } catch {} }
    setCropSrc(null);
    setUploadUrl(dataUrl);
  };

  const handleCropCancel = () => {
    if (cropSrc) { try { URL.revokeObjectURL(cropSrc); } catch {} }
    setCropSrc(null);
  };

  // Real AI generation — calls /api/avatars/generate which proxies to
  // Hugging Face FLUX.1-schnell. Server enforces 1/day quota.
  const generateAI = async () => {
    if (aiUsed || generating) return;
    let chosenStyle = aiStyle;
    if (!chosenStyle && !aiPrompt.trim()) {
      // "Sorpréndeme" semantics — pick a random style if user hasn't
      const random = AI_STYLES[Math.floor(Math.random() * AI_STYLES.length)];
      chosenStyle = random.id;
      setAiStyle(chosenStyle);
    }
    setErr('');
    setGenerating(true);
    setAiResult(null);
    setGenLabel(AI_LABELS[0]);

    // Retry automático para errores transitorios (503 modelo cargando, 429 saturado)
    // Tres intentos con backoff: 0s, 12s, 30s. Total ~45s ventana de retry.
    const RETRY_DELAYS = [0, 12_000, 30_000];
    const isTransient = (msg) =>
      msg.includes('model_loading') || msg.includes('calentando') ||
      msg.includes('saturad') || msg.includes('503') || msg.includes('429');

    let lastErr = null;
    for (let attempt = 0; attempt < RETRY_DELAYS.length; attempt++) {
      if (RETRY_DELAYS[attempt] > 0) {
        setGenLabel(`Reintentando… (${attempt + 1}/3)`);
        await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
      }
      try {
        const data = await apiGenerateAvatar(chosenStyle, aiPrompt);
        if (!data?.url) throw new Error('Respuesta vacía del servidor.');
        setAiResult(data.url);
        try { localStorage.setItem(AI_QUOTA_KEY, new Date().toISOString()); } catch {}
        setAiUsed(true);
        setErr('');
        setGenerating(false);
        return; // success
      } catch (e2) {
        lastErr = e2;
        const msg = e2?.message || '';
        if (!isTransient(msg)) break; // non-retryable error → break out
      }
    }

    // Final error after all retries exhausted (or non-retryable from start)
    const msg = lastErr?.message || 'No se pudo generar. Inténtalo más tarde.';
    if (msg.includes('quota_exceeded') || msg.includes('Has usado')) {
      setErr('Has usado tu generación de hoy. Vuelve mañana.');
      setAiUsed(true);
    } else if (msg.includes('model_loading') || msg.includes('calentando') || msg.includes('saturad')) {
      setErr('El modelo está cargando o saturado. Vuelve a intentarlo en 1-2 minutos.');
    } else if (msg.includes('ai_not_configured')) {
      setErr('La generación con IA aún no está activa. Inténtalo más tarde.');
    } else if (msg.includes('Authentication required')) {
      setErr('Debes iniciar sesión con Google o magic link para generar.');
    } else {
      setErr(msg);
    }
    setGenerating(false);
  };

  const surpriseMe = () => {
    if (aiUsed || generating) return;
    const random = AI_STYLES[Math.floor(Math.random() * AI_STYLES.length)];
    setAiStyle(random.id);
    setAiPrompt('');
    // Trigger generation on next tick
    setTimeout(() => generateAI(), 50);
  };

  // Preview source: aurora while generating, AI result if done, fallback to current
  const showAurora = generating;
  const previewImg = mode === 'mine'
    ? (pickedLibrary?.url || profile.avatarUrl || defaultAvatarForName(profile.name))
    : mode === 'upload'
      ? (uploadUrl || profile.avatarUrl || defaultAvatarForName(profile.name))
      : (aiResult || profile.avatarUrl || defaultAvatarForName(profile.name));

  const save = () => {
    if (mode === 'mine') {
      if (!pickedLibrary) { setErr('Selecciona un avatar de tu galería.'); return; }
      onSave({ avatarUrl: pickedLibrary.url, avatarType: pickedLibrary.type || 'upload', avatarStyle: pickedLibrary.style || aiStyle });
      return;
    }
    if (mode === 'ai') {
      if (!aiResult) { setErr('Genera un avatar primero.'); return; }
      try { if (profile?.id) addToLibrary(profile.id, { type: 'ai', url: aiResult, style: aiStyle }); } catch {}
      onSave({ avatarUrl: aiResult, avatarType: 'ai', avatarStyle: aiStyle });
    } else {
      if (!uploadUrl) { setErr('Selecciona una imagen primero.'); return; }
      if (uploadUrl.startsWith('blob:')) {
        setErr('Espera a que termine el procesado.');
        return;
      }
      try { if (profile?.id) addToLibrary(profile.id, { type: 'upload', url: uploadUrl }); } catch {}
      onSave({ avatarUrl: uploadUrl, avatarType: 'upload' });
    }
  };

  return (
    <>
    {cropSrc && (
      <AvatarCropSheet
        imageSrc={cropSrc}
        onCancel={handleCropCancel}
        onConfirm={handleCropConfirm}
      />
    )}
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 120,
        background: 'rgba(7,5,14,0.82)', backdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520,
          background: 'linear-gradient(180deg, #130828 0%, #0A070F 100%)',
          borderTopLeftRadius: 28, borderTopRightRadius: 28,
          border: '1px solid rgba(255,255,255,0.08)',
          maxHeight: '92vh', overflowY: 'auto',
          animation: 'fp-slide-up 0.3s cubic-bezier(0.2,0.8,0.3,1)',
          padding: '18px 22px var(--fp-sheet-bottom)',
        }}
      >
        {/* Handle */}
        <div style={{ width: 40, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.2)', margin: '0 auto 14px' }}/>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h2 style={{
            fontFamily: '"Inter", "Space Grotesk", sans-serif',
            fontSize: 22, fontWeight: 800, color: FP.text, margin: 0, letterSpacing: -0.6,
          }}>Avatar</h2>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 999,
            background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M6 18L18 6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Preview — aurora while generating, result/current otherwise */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          {showAurora ? (
            <div className="fp-aurora-wrap">
              <div className="fp-aurora-blob"/>
              <div className="fp-aurora-grain"/>
              <div className="fp-aurora-ring"/>
              <div className="fp-aurora-label">{genLabel}</div>
            </div>
          ) : (
            <div style={{
              width: 140, height: 140, borderRadius: 999, overflow: 'hidden',
              background: '#1a0f2e',
              border: '3px solid rgba(255,255,255,0.12)',
              boxShadow: aiResult
                ? '0 20px 60px rgba(255,59,107,0.55), 0 0 0 4px rgba(255,59,107,0.18)'
                : '0 20px 50px rgba(155,59,255,0.4)',
              transition: 'box-shadow 0.4s ease',
            }}>
              <img
                src={previewImg}
                alt="preview"
                className={aiResult ? 'fp-aurora-reveal' : ''}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          )}
          {mode === 'ai' && aiResult && !generating && (
            <div style={{
              padding: '6px 12px', borderRadius: 999,
              background: 'rgba(78,255,214,0.1)',
              border: '1px solid rgba(78,255,214,0.25)',
              color: '#9CE9CD', fontSize: 11, fontWeight: 700, letterSpacing: 1,
              textTransform: 'uppercase',
            }}>✓ Generado con IA</div>
          )}
        </div>

        {/* Mode tabs */}
        <div style={{
          display: 'flex', gap: 6, padding: 4, borderRadius: 14,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
          marginBottom: 18,
        }}>
          {[
            { id: 'ai',     label: 'Generar IA',  emoji: '✨' },
            { id: 'upload', label: 'Subir foto',  emoji: '📷' },
            { id: 'mine',   label: 'Mis avatares', emoji: '🎞️' },
          ].map(t => (
            <button key={t.id} onClick={() => { setMode(t.id); setErr(''); }} style={{
              flex: 1, padding: '10px 8px', borderRadius: 11,
              background: mode === t.id ? 'rgba(255,255,255,0.09)' : 'transparent',
              border: 'none', color: mode === t.id ? '#fff' : FP.textDim,
              fontFamily: '"Space Grotesk"', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              transition: 'all 0.18s',
            }}>
              {t.emoji} {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {mode === 'mine' ? (
          <div style={{ marginBottom: 20 }}>
            {libraryItems.length === 0 ? (
              <div style={{
                padding: '32px 16px', borderRadius: 16,
                background: 'rgba(255,255,255,0.03)',
                border: '1.5px dashed rgba(255,255,255,0.12)',
                textAlign: 'center', color: FP.textDim,
              }}>
                <div style={{ fontSize: 30, marginBottom: 10 }}>🎞️</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: FP.text, marginBottom: 4 }}>
                  Tu galería está vacía
                </div>
                <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                  Genera un avatar con IA o sube una foto y guárdalo para tenerlo a mano cuando quieras volver a usarlo.
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: FP.textDim, marginBottom: 12 }}>
                  Toca un avatar para previsualizar. Mantén pulsado para borrar.
                </div>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10,
                }}>
                  {libraryItems.map((it) => {
                    const isActive = profile?.avatarUrl === it.url;
                    const isPicked = pickedLibrary?.id === it.id;
                    return (
                      <LibraryThumb
                        key={it.id}
                        item={it}
                        active={isActive}
                        picked={isPicked}
                        onPick={() => setPickedLibrary(it)}
                        onRemove={() => {
                          if (!profile?.id) return;
                          if (!window.confirm('¿Borrar este avatar de tu galería?')) return;
                          removeFromLibrary(profile.id, it.id);
                          if (pickedLibrary?.id === it.id) setPickedLibrary(null);
                        }}
                      />
                    );
                  })}
                </div>
              </>
            )}
          </div>
        ) : mode === 'ai' ? (
          <div style={{ marginBottom: 20 }}>
            {/* Quota pill */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 14,
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: FP.textDim,
                letterSpacing: 1.5, textTransform: 'uppercase',
              }}>Estilo</div>
              <div style={{
                padding: '4px 10px', borderRadius: 999,
                background: aiUsed ? 'rgba(255,255,255,0.04)' : 'rgba(78,255,214,0.08)',
                border: `1px solid ${aiUsed ? 'rgba(255,255,255,0.1)' : 'rgba(78,255,214,0.22)'}`,
                fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5,
                color: aiUsed ? FP.textDim : '#9CE9CD',
              }}>{aiUsed ? `🌙 Vuelve en ${timeUntilTomorrow()}` : '✨ 1 / día'}</div>
            </div>

            {/* Style chips */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14,
            }}>
              {AI_STYLES.map(s => {
                const active = s.id === aiStyle;
                return (
                  <button
                    key={s.id}
                    onClick={() => setAiStyle(s.id)}
                    disabled={generating}
                    style={{
                      padding: '12px 6px', borderRadius: 14,
                      background: active
                        ? 'linear-gradient(135deg, rgba(255,59,107,0.18), rgba(155,59,255,0.18))'
                        : 'rgba(255,255,255,0.04)',
                      border: active ? '1.5px solid #FF3B6B' : '1px solid rgba(255,255,255,0.08)',
                      color: '#fff', cursor: generating ? 'default' : 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      transition: 'all 0.18s',
                      opacity: generating ? 0.5 : 1,
                    }}
                  >
                    <div style={{ fontSize: 22 }}>{s.emoji}</div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: active ? '#fff' : FP.textDim }}>{s.label}</div>
                  </button>
                );
              })}
            </div>

            {/* Prompt input */}
            <div style={{
              fontSize: 11, fontWeight: 700, color: FP.textDim,
              letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8,
            }}>Tu idea (opcional)</div>
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value.slice(0, 200))}
                disabled={generating || aiUsed}
                placeholder="Astronauta surfeando en una ola de neón…"
                style={{
                  width: '100%', height: 48, padding: '0 60px 0 16px',
                  borderRadius: 14,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#fff', fontSize: 14,
                  fontFamily: 'var(--fp-font-sans)',
                  outline: 'none',
                }}
              />
              <div style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                fontSize: 10, color: FP.textMuted,
              }}>{aiPrompt.length}/200</div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={surpriseMe}
                disabled={generating || aiUsed}
                style={{
                  flex: 1, height: 48, borderRadius: 999,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#fff', fontSize: 13, fontWeight: 700,
                  cursor: (generating || aiUsed) ? 'default' : 'pointer',
                  opacity: (generating || aiUsed) ? 0.4 : 1,
                  fontFamily: '"Space Grotesk"',
                }}
              >🎲 Sorpréndeme</button>
              <button
                onClick={generateAI}
                disabled={generating || aiUsed}
                style={{
                  flex: 1.6, height: 48, borderRadius: 999,
                  background: (generating || aiUsed)
                    ? 'rgba(255,255,255,0.06)'
                    : 'linear-gradient(135deg, #FF3B6B, #9B3BFF)',
                  border: 'none',
                  color: '#fff', fontSize: 14, fontWeight: 700,
                  cursor: (generating || aiUsed) ? 'default' : 'pointer',
                  opacity: (generating || aiUsed) ? 0.4 : 1,
                  fontFamily: '"Space Grotesk"',
                  boxShadow: (generating || aiUsed) ? 'none' : '0 8px 22px rgba(255,59,107,0.35)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {generating
                  ? <>⏳ Generando…</>
                  : aiResult
                    ? <>🔄 Regenerar</>
                    : <>✨ Generar</>}
              </button>
            </div>

            {aiUsed && (
              <div style={{
                marginTop: 12, padding: '10px 12px', borderRadius: 12,
                background: 'rgba(155,59,255,0.06)',
                border: '1px solid rgba(155,59,255,0.2)',
                fontSize: 12, color: '#C9B0FF', lineHeight: 1.4, textAlign: 'center',
              }}>
                🌙 Has usado tu generación de hoy. Vuelve en {timeUntilTomorrow()} para crear otro.
              </div>
            )}
          </div>
        ) : (
          <div style={{ marginBottom: 20 }}>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={onFileChange}
              style={{ display: 'none' }}
            />
            <button onClick={pickFile} disabled={uploading} style={{
              width: '100%', padding: '18px 14px', borderRadius: 18,
              background: 'rgba(255,255,255,0.04)',
              border: '1.5px dashed rgba(255,255,255,0.18)',
              color: '#fff', cursor: uploading ? 'default' : 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              opacity: uploading ? 0.7 : 1,
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M16 8l-4-4-4 4M12 4v12" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                {uploading ? 'Subiendo…' : uploadUrl ? 'Cambiar foto' : 'Seleccionar foto'}
              </div>
              <div style={{ fontSize: 11, color: FP.textDim }}>PNG, JPG o WebP · máx 4 MB</div>
            </button>
            {!canUpload(profile) && (
              <div style={{
                marginTop: 12, padding: '10px 12px', borderRadius: 12,
                background: 'rgba(78,255,214,0.06)',
                border: '1px solid rgba(78,255,214,0.18)',
                fontSize: 12, color: '#9CE9CD', lineHeight: 1.4,
              }}>
                ℹ️ La foto se guarda en este dispositivo. Conéctate con Google o magic link para sincronizarla en todos tus dispositivos.
              </div>
            )}
          </div>
        )}

        {err && (
          <div style={{
            padding: '10px 12px', borderRadius: 12,
            background: 'rgba(255,59,107,0.08)',
            border: '1px solid rgba(255,59,107,0.25)',
            fontSize: 12.5, color: '#FF6B89', marginBottom: 14, lineHeight: 1.4,
          }}>
            {err}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, height: 50, borderRadius: 999,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}>Cancelar</button>
          <div style={{ flex: 1.4 }}>
            <GradientButton variant="flame" onClick={save} style={{ height: 50 }} disabled={uploading}>
              {uploading ? 'Subiendo…' : 'Guardar avatar'}
            </GradientButton>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

function StatCard({ label, value, accent, plain }) {
  return (
    <div style={{
      padding: 16, borderRadius: 18,
      background: plain ? accent : 'rgba(255,255,255,0.04)',
      border: plain ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.06)',
      position: 'relative', overflow: 'hidden',
    }}>
      {!plain && (
        <div style={{
          position: 'absolute', top: -30, right: -30,
          width: 90, height: 90, borderRadius: 999,
          background: accent, opacity: 0.25, filter: 'blur(20px)',
        }}/>
      )}
      <div style={{
        position: 'relative', fontFamily: '"Space Grotesk"', fontSize: 30, fontWeight: 800,
        color: FP.text, letterSpacing: -1,
      }}>{value}</div>
      <div style={{
        position: 'relative', fontSize: 11, color: FP.textDim,
        letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700, marginTop: 2,
      }}>{label}</div>
    </div>
  );
}

function SettingRow({ icon, label, onClick, hideChevron, right }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', padding: '16px 18px',
      display: 'flex', alignItems: 'center', gap: 14,
      background: 'transparent', border: 'none',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      color: FP.text, cursor: 'pointer', textAlign: 'left',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: 'rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{label}</div>
      {right ? right : !hideChevron && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(255,255,255,0.4)">
          <path d="M9 6l6 6-6 6"/>
        </svg>
      )}
    </button>
  );
}

function LibraryThumb({ item, active, picked, onPick, onRemove }) {
  const pressTimer = useRef(null);
  const triggered = useRef(false);

  const handleDown = () => {
    triggered.current = false;
    pressTimer.current = setTimeout(() => {
      triggered.current = true;
      onRemove?.();
    }, 600);
  };
  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };
  const handleUp = () => {
    if (!triggered.current) onPick?.();
    cancelPress();
  };

  const ringColor = picked
    ? '#FF3B6B'
    : active
      ? '#4EFFD6'
      : 'rgba(255,255,255,0.10)';
  const ringWidth = picked || active ? 2.5 : 1.5;

  return (
    <div
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
      style={{
        position: 'relative', aspectRatio: '1 / 1',
        borderRadius: 999, overflow: 'hidden',
        border: `${ringWidth}px solid ${ringColor}`,
        background: '#0A070F',
        cursor: 'pointer',
        userSelect: 'none', touchAction: 'manipulation',
        transition: 'border-color 0.18s, transform 0.12s',
        transform: picked ? 'scale(0.96)' : 'scale(1)',
      }}
    >
      <img
        src={item.url}
        alt={item.style || item.type}
        draggable={false}
        style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
      />
      {/* Badge: AI style or upload icon */}
      <div style={{
        position: 'absolute', bottom: 4, right: 4,
        padding: '2px 7px', borderRadius: 999,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
        fontSize: 9, fontWeight: 800, color: '#fff',
        letterSpacing: 0.6, textTransform: 'uppercase',
        lineHeight: 1.4, pointerEvents: 'none',
      }}>
        {item.type === 'ai' ? (item.style || 'IA') : 'Foto'}
      </div>
      {active && (
        <div style={{
          position: 'absolute', top: 4, left: 4,
          width: 18, height: 18, borderRadius: 999,
          background: '#4EFFD6', color: '#003522',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 900,
          boxShadow: '0 0 8px rgba(78,255,214,0.6)',
          pointerEvents: 'none',
        }}>✓</div>
      )}
    </div>
  );
}

function ToggleSwitch({ on }) {
  return (
    <div style={{
      width: 44, height: 26, borderRadius: 999,
      background: on ? 'linear-gradient(135deg, #FF6B4A, #FF3B6B)' : 'rgba(255,255,255,0.12)',
      position: 'relative', transition: 'background 0.2s',
      flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', top: 3, left: on ? 21 : 3,
        width: 20, height: 20, borderRadius: 999, background: '#fff',
        transition: 'left 0.2s cubic-bezier(.2,.8,.3,1)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
      }}/>
    </div>
  );
}

export default ProfileScreen;

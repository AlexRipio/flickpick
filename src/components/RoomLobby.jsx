import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { AmbientBackdrop, Avatar, BackButton, GradientButton } from '@/components/fp/primitives';
import { FP, memberColor } from '@/lib/fp';
import { useProfile } from '@/contexts/ProfileContext';
import { getRoom, startRoom, closeRoom, subscribe, hydrateRoomById } from '@/lib/roomStore';

const RoomLobby = () => {
  const { id: roomId } = useParams();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [room, setRoom] = useState(() => getRoom(roomId));
  const [copied, setCopied] = useState(false);
  const [soloWarning, setSoloWarning] = useState(false);

  useEffect(() => {
    const handleRoom = (r) => {
      if (!r) return;
      setRoom(r);
      if (r.status === 'live') navigate(`/room/${roomId}`, { replace: true });
      if (r.status === 'ended') navigate('/home', { replace: true });
    };
    const unsub = subscribe(() => handleRoom(getRoom(roomId)));
    const onStorage = () => handleRoom(getRoom(roomId));
    window.addEventListener('storage', onStorage);
    hydrateRoomById(roomId).then(r => { if (r) handleRoom(r); });
    return () => { unsub?.(); window.removeEventListener('storage', onStorage); };
  }, [roomId]);

  if (!room) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: FP.textDim }}>
        <AmbientBackdrop hue={260}/>
        <div style={{ position: 'relative', zIndex: 2 }}>Sala no encontrada.</div>
      </div>
    );
  }

  const isHost = profile?.id === room.ownerId;
  const joinLink = `${window.location.origin}/g/${room.joinCode}`;

  const copy = () => {
    navigator.clipboard?.writeText(joinLink).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const start = () => {
    if (!soloWarning && room.members.length === 1) {
      setSoloWarning(true);
      return;
    }
    startRoom(roomId);
    navigate(`/room/${roomId}`, { replace: true });
  };

  const handleClose = () => {
    if (window.confirm('¿Cerrar la sala para todos los participantes?')) {
      closeRoom(roomId);
      navigate('/home', { replace: true });
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <AmbientBackdrop hue={260}/>

      <div style={{
        position: 'relative', zIndex: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', maxWidth: 520, width: '100%', margin: '0 auto',
      }}>
        <BackButton onClick={() => navigate('/home')}/>
        <div style={{ fontSize: 13, fontWeight: 600, color: FP.textDim }}>Sala de espera</div>
        {isHost ? (
          <button onClick={handleClose} style={{
            background: 'rgba(255,59,107,0.12)', border: '1px solid rgba(255,59,107,0.3)',
            borderRadius: 999, padding: '6px 14px', color: '#FF3B6B',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>Cerrar sala</button>
        ) : <div style={{ width: 42 }}/>}
      </div>

      <div style={{
        position: 'relative', zIndex: 2, flex: 1,
        padding: '10px 24px 28px', display: 'flex', flexDirection: 'column', gap: 20,
        maxWidth: 520, width: '100%', margin: '0 auto', overflowY: 'auto',
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 26, padding: 22, textAlign: 'center',
        }}>
          <div style={{ fontSize: 11, color: FP.textMuted, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 10 }}>
            Código de invitación
          </div>
          <div style={{
            fontFamily: '"Space Grotesk", monospace',
            fontSize: 44, fontWeight: 800, letterSpacing: 8,
            background: FP.flame,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            lineHeight: 1,
          }}>{room.joinCode}</div>
          {/* QR Code */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, marginTop: 4 }}>
            <div style={{
              background: '#fff', borderRadius: 16, padding: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              <QRCodeSVG value={joinLink} size={120} bgColor="#ffffff" fgColor="#0A070F" level="M"/>
            </div>
          </div>

          <button onClick={copy} style={{
            marginTop: 16,
            padding: '10px 18px', borderRadius: 999,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            {copied ? (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 7l3 3 7-7" stroke="#4EFFD6" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span style={{ color: '#4EFFD6' }}>Copiado</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="11" height="11" rx="2" stroke="#fff" strokeWidth="2"/><path d="M5 15V5a2 2 0 012-2h10" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
                Copiar enlace
              </>
            )}
          </button>
          <div style={{ marginTop: 12, fontSize: 11, color: FP.textMuted, wordBreak: 'break-all' }}>
            {joinLink}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, color: FP.textDim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
            En la sala · {room.members.length}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {room.members.map((m, i) => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 18,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <Avatar name={m.name} color={memberColor(i)}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: FP.text }}>
                    {m.name}{m.isHost && <span style={{ color: FP.flameSolid, fontSize: 11, marginLeft: 8, fontWeight: 700 }}>ANFITRIÓN</span>}
                    {m.id === profile?.id && <span style={{ color: FP.cyan, fontSize: 11, marginLeft: 8, fontWeight: 700 }}>TÚ</span>}
                  </div>
                  <div style={{ fontSize: 12, color: FP.textDim }}>Listo</div>
                </div>
                <div style={{
                  width: 8, height: 8, borderRadius: 999,
                  background: '#4EFFD6',
                  boxShadow: '0 0 12px #4EFFD6',
                }}/>
              </div>
            ))}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', borderRadius: 18,
              border: '1px dashed rgba(255,255,255,0.15)',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 999,
                background: 'rgba(255,255,255,0.05)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: FP.textMuted,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <div style={{ fontSize: 14, color: FP.textDim }}>Esperando a que se unan…</div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1 }}/>

        {isHost ? (
          <GradientButton variant="flame" onClick={start}>
            Empezar a deslizar
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M9 6l6 6-6 6"/></svg>
          </GradientButton>
        ) : (
          <div style={{
            padding: 16, textAlign: 'center', borderRadius: 18,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            color: FP.textDim, fontSize: 14,
          }}>
            Esperando a que el anfitrión empiece…
          </div>
        )}
      </div>

      {soloWarning && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(7,5,14,0.92)', backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 28,
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 28, padding: 32,
            maxWidth: 380, width: '100%', textAlign: 'center',
          }}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>🎬</div>
            <div style={{
              fontFamily: '"Syne", "Space Grotesk", sans-serif',
              fontSize: 22, fontWeight: 800, color: FP.text,
              marginBottom: 12, letterSpacing: -0.5,
            }}>«Houston, we have a problem»</div>
            <div style={{
              fontSize: 14, color: FP.textDim, lineHeight: 1.6, marginBottom: 28,
            }}>
              Parece que vas a deslizar solo... como Leo DiCaprio esperando su Oscar. No pasa nada, a veces uno es suficiente 🍿
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => setSoloWarning(false)} style={{
                width: '100%', height: 52, borderRadius: 999,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.18)',
                color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer',
                fontFamily: '"Space Grotesk"',
              }}>Esperar a alguien</button>
              <button onClick={() => { setSoloWarning(false); startRoom(roomId); navigate(`/room/${roomId}`, { replace: true }); }} style={{
                width: '100%', height: 52, borderRadius: 999,
                background: FP.flame, border: 'none',
                color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer',
                fontFamily: '"Space Grotesk"',
                boxShadow: '0 8px 22px rgba(255,59,107,0.35)',
              }}>Empezar solo 🎬</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomLobby;

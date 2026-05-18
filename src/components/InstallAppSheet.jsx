import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FP } from '@/lib/fp';
import {
  detectPlatform,
  getDeferredPrompt,
  isStandalone,
  onDeferredPromptChange,
  triggerInstall,
} from '@/lib/installApp';

const ShareIosIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M12 3v12M12 3l-4 4M12 3l4 4" stroke="#3FA9FF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5 11v8a2 2 0 002 2h10a2 2 0 002-2v-8" stroke="#3FA9FF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const PlusBoxIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="3" y="3" width="18" height="18" rx="4" stroke="#3FA9FF" strokeWidth="2.2"/>
    <path d="M12 8v8M8 12h8" stroke="#3FA9FF" strokeWidth="2.2" strokeLinecap="round"/>
  </svg>
);

const ChromeMenuIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="12" cy="6" r="1.6" fill="#5BFFB0"/>
    <circle cx="12" cy="12" r="1.6" fill="#5BFFB0"/>
    <circle cx="12" cy="18" r="1.6" fill="#5BFFB0"/>
  </svg>
);

const InstallIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M12 3v12M12 15l-4-4M12 15l4-4" stroke="#5BFFB0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5 17v2a2 2 0 002 2h10a2 2 0 002-2v-2" stroke="#5BFFB0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CheckIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="12" cy="12" r="10" stroke="#5BFFB0" strokeWidth="2"/>
    <path d="M8 12.5l2.8 2.8L16.5 9.5" stroke="#5BFFB0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

function Step({ n, icon, title, body }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '36px 32px 1fr', gap: 12, alignItems: 'flex-start',
      padding: '12px 0',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 999,
        background: 'linear-gradient(135deg, #FF6B4A, #FF3B6B)',
        color: '#fff', fontWeight: 800, fontSize: 13,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 6px 16px rgba(255,59,107,0.35)',
      }}>{n}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 28 }}>{icon}</div>
      <div>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, fontFamily: '"Space Grotesk", system-ui' }}>{title}</div>
        <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 1.45, marginTop: 2 }}>{body}</div>
      </div>
    </div>
  );
}

const InstallAppSheet = ({ open, onClose }) => {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState(() => detectPlatform());
  const [hasPrompt, setHasPrompt] = useState(() => !!getDeferredPrompt());
  const [installing, setInstalling] = useState(false);
  const [copied, setCopied] = useState(false);
  const standalone = isStandalone();

  useEffect(() => {
    if (!open) { setShow(false); return; }
    setPlatform(detectPlatform());
    setHasPrompt(!!getDeferredPrompt());
    setCopied(false);
    const t = setTimeout(() => setShow(true), 20);
    const off = onDeferredPromptChange((p) => setHasPrompt(!!p));
    return () => { clearTimeout(t); off(); };
  }, [open]);

  const close = () => {
    setShow(false);
    setTimeout(() => onClose?.(), 280);
  };

  const handleAndroidInstall = async () => {
    setInstalling(true);
    const res = await triggerInstall();
    setInstalling(false);
    if (res.ok) close();
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard?.writeText(window.location.origin + '/');
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  if (!open) return null;

  // Variant selection
  let variant = 'unsupported';
  if (standalone) variant = 'installed';
  else if (platform.isIOS && platform.browser === 'safari') variant = 'ios-safari';
  else if (platform.isIOS) variant = 'ios-other';
  else if (hasPrompt) variant = 'native-prompt';
  else if (platform.os === 'android') variant = 'android-fallback';
  else variant = 'desktop-fallback';

  return createPortal(
    <div onClick={close} style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: show ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0)',
      backdropFilter: show ? 'blur(8px)' : 'blur(0px)',
      WebkitBackdropFilter: show ? 'blur(8px)' : 'blur(0px)',
      transition: 'background 0.25s, backdrop-filter 0.25s',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 520, maxHeight: '90vh',
        background: 'linear-gradient(180deg, #1a0f2e 0%, #0B0420 100%)',
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 -30px 60px rgba(0,0,0,0.6)',
        transform: show ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.32s cubic-bezier(.2,.8,.3,1)',
        display: 'flex', flexDirection: 'column',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
      }}>
        {/* handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 6px' }}>
          <div style={{ width: 44, height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.25)' }}/>
        </div>

        {/* hero */}
        <div style={{ padding: '6px 24px 4px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 10px 24px rgba(255,59,107,0.25)',
            overflow: 'hidden',
          }}>
            <img src="/icons/apple-touch-icon-180.png" alt="" width={56} height={56} style={{ display: 'block' }}/>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: FP.text, fontFamily: '"Space Grotesk", system-ui', lineHeight: 1.1 }}>
              Instalar FlickPick
            </div>
            <div style={{ fontSize: 13, color: FP.textDim, marginTop: 4 }}>
              Acceso directo en tu pantalla de inicio.
            </div>
          </div>
        </div>

        <div style={{ padding: '14px 24px 18px', overflowY: 'auto' }}>
          {variant === 'installed' && (
            <div style={{
              padding: '20px 18px', borderRadius: 16,
              background: 'rgba(91,255,176,0.08)',
              border: '1px solid rgba(91,255,176,0.25)',
              textAlign: 'center', color: '#fff',
            }}>
              <div style={{ fontSize: 32, marginBottom: 6 }}>✅</div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Ya tienes FlickPick instalada</div>
              <div style={{ fontSize: 13, color: FP.textDim, marginTop: 6 }}>
                Estás usando la app desde tu pantalla de inicio.
              </div>
            </div>
          )}

          {variant === 'native-prompt' && (
            <>
              <div style={{ fontSize: 14, color: FP.textDim, lineHeight: 1.5, marginBottom: 14 }}>
                Tu navegador permite instalar FlickPick con un solo toque. Podrás abrirla desde el icono del cajón de apps, sin barras del navegador.
              </div>
              <button
                onClick={handleAndroidInstall}
                disabled={installing}
                style={{
                  width: '100%', height: 56, borderRadius: 999,
                  background: 'linear-gradient(135deg, #FF6B4A 0%, #FF3B6B 100%)',
                  color: '#fff', fontWeight: 800, fontSize: 16,
                  fontFamily: '"Space Grotesk", system-ui',
                  border: 'none', cursor: 'pointer',
                  boxShadow: '0 14px 30px rgba(255,59,107,0.35)',
                  opacity: installing ? 0.7 : 1,
                }}
              >
                {installing ? 'Instalando…' : 'Instalar app'}
              </button>
            </>
          )}

          {variant === 'ios-safari' && (
            <div>
              <div style={{ fontSize: 14, color: FP.textDim, lineHeight: 1.5, marginBottom: 4 }}>
                En iOS solo Safari puede instalar apps web. Sigue estos pasos:
              </div>
              <div style={{ marginTop: 6 }}>
                <Step n={1} icon={<ShareIosIcon/>} title="Toca el botón Compartir"
                  body="El icono cuadrado con flecha hacia arriba en la barra inferior de Safari."/>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }}/>
                <Step n={2} icon={<PlusBoxIcon/>} title='Elige "Añadir a pantalla de inicio"'
                  body="Desplázate hacia abajo en el menú compartir hasta verlo."/>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }}/>
                <Step n={3} icon={<CheckIcon/>} title="Confirma con Añadir"
                  body="Aparecerá el icono de FlickPick en tu pantalla de inicio. Listo."/>
              </div>
            </div>
          )}

          {variant === 'ios-other' && (
            <div>
              <div style={{
                padding: '14px 16px', borderRadius: 14,
                background: 'rgba(255,193,7,0.08)',
                border: '1px solid rgba(255,193,7,0.30)',
                color: '#FFD166', fontSize: 13, lineHeight: 1.5,
                marginBottom: 14,
              }}>
                <strong>Estás en {platform.browser === 'chrome-ios' ? 'Chrome' : platform.browser === 'firefox-ios' ? 'Firefox' : platform.browser === 'edge-ios' ? 'Edge' : 'otro navegador'} para iOS.</strong> Apple no permite instalar apps web fuera de Safari. Abre esta página en Safari para continuar.
              </div>
              <button onClick={copyUrl} style={{
                width: '100%', height: 52, borderRadius: 14,
                background: 'rgba(255,255,255,0.06)',
                color: '#fff', fontWeight: 700, fontSize: 15,
                fontFamily: '"Space Grotesk", system-ui',
                border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer',
              }}>
                {copied ? '✓ Enlace copiado' : 'Copiar enlace'}
              </button>
              <div style={{ fontSize: 12, color: FP.textMuted, textAlign: 'center', marginTop: 10 }}>
                Pega el enlace en Safari y vuelve a pulsar este botón allí.
              </div>
            </div>
          )}

          {variant === 'android-fallback' && (
            <div>
              <div style={{ fontSize: 14, color: FP.textDim, lineHeight: 1.5, marginBottom: 8 }}>
                Tu navegador puede instalar FlickPick desde su menú:
              </div>
              <Step n={1} icon={<ChromeMenuIcon/>} title="Abre el menú del navegador"
                body="Los tres puntos arriba a la derecha en Chrome."/>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }}/>
              <Step n={2} icon={<InstallIcon/>} title='Pulsa "Instalar app" o "Añadir a pantalla de inicio"'
                body="El nombre exacto depende de la versión de tu navegador."/>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }}/>
              <Step n={3} icon={<CheckIcon/>} title="Confirma"
                body="FlickPick aparecerá en tu cajón de apps como una más."/>
            </div>
          )}

          {variant === 'desktop-fallback' && (
            <div>
              <div style={{ fontSize: 14, color: FP.textDim, lineHeight: 1.5, marginBottom: 8 }}>
                En el escritorio puedes instalar FlickPick desde Chrome o Edge:
              </div>
              <Step n={1} icon={<InstallIcon/>} title="Pulsa el icono de instalación"
                body="Aparece en la barra de direcciones, a la derecha de la URL."/>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }}/>
              <Step n={2} icon={<CheckIcon/>} title="Confirma con Instalar"
                body="FlickPick se abrirá en su propia ventana, sin barras del navegador."/>
              <div style={{
                marginTop: 14, padding: '12px 14px', borderRadius: 12,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: FP.textMuted, fontSize: 12, lineHeight: 1.5,
              }}>
                Si no ves el icono, abre el menú ⋮ del navegador y elige <em>"Instalar FlickPick…"</em>.
              </div>
            </div>
          )}
        </div>

        <div style={{
          padding: '12px 24px 4px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', justifyContent: 'flex-end',
        }}>
          <button onClick={close} style={{
            padding: '10px 18px', borderRadius: 999,
            background: 'transparent', color: FP.textDim,
            border: '1px solid rgba(255,255,255,0.12)',
            cursor: 'pointer', fontSize: 14, fontWeight: 600,
            fontFamily: '"Space Grotesk", system-ui',
          }}>Cerrar</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default InstallAppSheet;

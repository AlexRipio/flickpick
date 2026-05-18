import React, { useCallback, useEffect, useState } from 'react';
import Cropper from 'react-easy-crop';
import { FP } from '@/lib/fp';

/**
 * AvatarCropSheet — bottom sheet that lets the user crop an uploaded
 * image to a square (visually shown as a circle via cropShape="round").
 *
 * Output: a 512x512 JPEG data URL passed to onConfirm.
 *
 * Props:
 *   imageSrc: blob:/object URL of the uploaded file
 *   onCancel: () => void
 *   onConfirm: (dataUrl: string) => void
 */
const OUTPUT_SIZE = 512;
const JPEG_Q = 0.88;

async function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
    img.crossOrigin = 'anonymous';
    img.src = src;
  });
}

async function getCroppedDataUrl(imageSrc, pixelCrop) {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(
    img,
    pixelCrop.x, pixelCrop.y,
    pixelCrop.width, pixelCrop.height,
    0, 0,
    OUTPUT_SIZE, OUTPUT_SIZE,
  );
  return canvas.toDataURL('image/jpeg', JPEG_Q);
}

export default function AvatarCropSheet({ imageSrc, onCancel, onConfirm }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixelCrop, setPixelCrop] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const onCropComplete = useCallback((_, areaPixels) => {
    setPixelCrop(areaPixels);
  }, []);

  useEffect(() => {
    // Reset on new image
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setPixelCrop(null);
    setErr('');
  }, [imageSrc]);

  const handleConfirm = async () => {
    if (!pixelCrop) return;
    setBusy(true);
    setErr('');
    try {
      const dataUrl = await getCroppedDataUrl(imageSrc, pixelCrop);
      onConfirm?.(dataUrl);
    } catch (e) {
      setErr(e?.message || 'No se pudo recortar la imagen.');
      setBusy(false);
    }
  };

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 140,
        background: 'rgba(7,5,14,0.88)', backdropFilter: 'blur(16px)',
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
          padding: '18px 22px var(--fp-sheet-bottom)',
          animation: 'fp-slide-up 0.3s cubic-bezier(0.2,0.8,0.3,1)',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}
      >
        {/* Handle */}
        <div style={{
          width: 40, height: 4, borderRadius: 999,
          background: 'rgba(255,255,255,0.2)', margin: '0 auto',
        }}/>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{
            fontFamily: '"Inter", "Space Grotesk", sans-serif',
            fontSize: 20, fontWeight: 800, color: FP.text, margin: 0, letterSpacing: -0.4,
          }}>Ajusta tu foto</h2>
          <button onClick={onCancel} aria-label="Cancelar" style={{
            width: 32, height: 32, borderRadius: 999,
            background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div style={{ fontSize: 13, color: FP.textDim, marginTop: -4 }}>
          Arrastra para encuadrar · pellizca para ampliar
        </div>

        {/* Cropper canvas — fixed aspect square area */}
        <div style={{
          position: 'relative', width: '100%',
          aspectRatio: '1 / 1',
          background: '#000',
          borderRadius: 18, overflow: 'hidden',
        }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            objectFit="contain"
          />
        </div>

        {/* Zoom slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 4px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke={FP.textDim} strokeWidth="2"/>
            <path d="M8 11h6" stroke={FP.textDim} strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input
            type="range"
            min={1} max={3} step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            style={{
              flex: 1, accentColor: '#FF6B4A',
              height: 4,
            }}
          />
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke={FP.textDim} strokeWidth="2"/>
            <path d="M8 11h6M11 8v6" stroke={FP.textDim} strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>

        {err && (
          <div style={{
            fontSize: 13, color: '#FF8B8B',
            background: 'rgba(255,75,75,0.08)', border: '1px solid rgba(255,75,75,0.2)',
            padding: '10px 12px', borderRadius: 12,
          }}>{err}</div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button
            onClick={onCancel}
            disabled={busy}
            style={{
              flex: 1, height: 54, borderRadius: 999,
              background: 'rgba(255,255,255,0.06)',
              color: '#fff', fontWeight: 700, fontSize: 15,
              border: '1px solid rgba(255,255,255,0.10)',
              cursor: busy ? 'default' : 'pointer',
              fontFamily: '"Space Grotesk", system-ui',
              opacity: busy ? 0.6 : 1,
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy || !pixelCrop}
            style={{
              flex: 1.4, height: 54, borderRadius: 999,
              background: 'linear-gradient(135deg, #FF6B4A, #FF3B6B)',
              color: '#fff', fontWeight: 800, fontSize: 15,
              border: 'none', cursor: busy ? 'default' : 'pointer',
              fontFamily: '"Space Grotesk", system-ui',
              boxShadow: '0 10px 24px rgba(255,59,107,0.35)',
              opacity: (busy || !pixelCrop) ? 0.6 : 1,
            }}
          >
            {busy ? 'Procesando…' : 'Usar esta foto'}
          </button>
        </div>
      </div>
    </div>
  );
}

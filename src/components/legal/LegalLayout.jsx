import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AmbientBackdrop, BackButton } from '@/components/fp/primitives';
import { FP } from '@/lib/fp';

// Shared layout for the four legal pages. Keeps typography, scroll
// container and back navigation consistent across all of them.
export default function LegalLayout({ title, children, lastUpdated }) {
  const navigate = useNavigate();
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <AmbientBackdrop hue={260}/>

      <div style={{
        position: 'relative', zIndex: 2, padding: '16px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        maxWidth: 720, width: '100%', margin: '0 auto',
      }}>
        <BackButton onClick={() => navigate(-1)}/>
        <div style={{ fontSize: 13, fontWeight: 600, color: FP.textDim }}>Legal</div>
        <div style={{ width: 42 }}/>
      </div>

      <div className="no-scrollbar" style={{
        position: 'relative', zIndex: 2, flex: 1, overflowY: 'auto',
        maxWidth: 720, width: '100%', margin: '0 auto',
        padding: '8px 24px 60px',
      }}>
        <h1 style={{
          fontFamily: '"Inter", "Space Grotesk", sans-serif',
          fontSize: 32, fontWeight: 800, color: FP.text,
          margin: '0 0 6px', letterSpacing: -0.8,
        }}>{title}</h1>
        {lastUpdated && (
          <div style={{ fontSize: 12, color: FP.textDim, marginBottom: 28 }}>
            Última actualización: {lastUpdated}
          </div>
        )}
        <div style={{
          fontSize: 14.5, lineHeight: 1.65, color: 'rgba(255,255,255,0.85)',
          fontFamily: '"Space Grotesk", system-ui',
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export const LegalH2 = ({ children }) => (
  <h2 style={{
    fontFamily: '"Inter", sans-serif',
    fontSize: 19, fontWeight: 800, color: '#fff',
    margin: '28px 0 10px', letterSpacing: -0.3,
  }}>{children}</h2>
);

export const LegalH3 = ({ children }) => (
  <h3 style={{
    fontSize: 15.5, fontWeight: 700, color: '#fff',
    margin: '20px 0 8px',
  }}>{children}</h3>
);

export const LegalUL = ({ children }) => (
  <ul style={{ margin: '8px 0 8px 18px', padding: 0 }}>{children}</ul>
);

export const LegalLI = ({ children }) => (
  <li style={{ marginBottom: 6 }}>{children}</li>
);

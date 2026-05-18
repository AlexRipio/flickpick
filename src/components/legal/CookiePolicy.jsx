import React from 'react';
import { Link } from 'react-router-dom';
import LegalLayout, { LegalH2, LegalUL, LegalLI } from './LegalLayout';
import { resetConsent } from '@/lib/consent';

export default function CookiePolicy() {
  return (
    <LegalLayout title="Política de Cookies" lastUpdated="2 de mayo de 2026">
      <p>
        Esta política describe el uso de cookies y tecnologías similares (almacenamiento
        local, sessionStorage, IndexedDB) en flickpick.mov, en cumplimiento de la LSSI y la
        guía de la AEPD sobre el uso de cookies (julio 2023).
      </p>

      <LegalH2>1. ¿Qué son las cookies?</LegalH2>
      <p>
        Las cookies son pequeños archivos de texto que un sitio web almacena en tu dispositivo
        para recordar información entre visitas. La normativa equipara las tecnologías de
        almacenamiento del navegador (localStorage, sessionStorage) a las cookies a efectos
        de información y consentimiento.
      </p>

      <LegalH2>2. Cookies que utilizamos</LegalH2>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: '14px 0 6px' }}>
        Técnicas (siempre activas, exentas de consentimiento)
      </h3>
      <LegalUL>
        <LegalLI><strong>Sesión / autenticación</strong>: token JWT y datos de tu perfil para mantener tu sesión activa entre visitas (localStorage <code>flickpick.profile.v1</code>, <code>flickpick.jwt.v1</code>).</LegalLI>
        <LegalLI><strong>Salas y votos</strong>: datos de las salas, votos y matches en curso (<code>flickpick.rooms.v1</code>, <code>flickpick.codes.v1</code>).</LegalLI>
        <LegalLI><strong>Watchlist</strong>: tu lista de películas guardadas (<code>flickpick.watchlist.v1</code>).</LegalLI>
        <LegalLI><strong>Preferencias UI</strong>: tema, navegación oculta/mostrada, etc.</LegalLI>
      </LegalUL>

      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: '14px 0 6px' }}>
        Analíticas (sólo con tu consentimiento)
      </h3>
      <LegalUL>
        <LegalLI><strong>Google Analytics 4</strong>: estadísticas anónimas de uso (páginas vistas, dispositivo, país aproximado). No se cruza con datos personales. IP anonimizada. Cookies <code>_ga</code>, <code>_ga_*</code>. Caducidad: hasta 14 meses.</LegalLI>
      </LegalUL>

      <LegalH2>3. Gestión y revocación del consentimiento</LegalH2>
      <p>
        En tu primera visita te mostramos un banner para aceptar o rechazar las cookies
        analíticas. Las técnicas son imprescindibles para que la app funcione y no requieren
        consentimiento.
      </p>
      <p>
        Puedes cambiar tu decisión en cualquier momento desde aquí:
      </p>
      <p>
        <button
          onClick={() => { resetConsent(); window.location.reload(); }}
          style={{
            padding: '10px 18px', borderRadius: 999,
            background: 'rgba(255,107,74,0.18)',
            border: '1px solid rgba(255,107,74,0.55)',
            color: '#FFB199', fontWeight: 700, fontSize: 13,
            fontFamily: '"Space Grotesk", system-ui',
            cursor: 'pointer',
          }}
        >Volver a abrir el banner de cookies</button>
      </p>
      <p>
        También puedes bloquear o eliminar cookies desde la configuración de tu navegador:
        <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noreferrer" style={{ color: '#FF6B4A', marginLeft: 4 }}>Chrome</a>,
        <a href="https://support.mozilla.org/es/kb/proteccion-mejorada-rastreo-firefox-escritorio" target="_blank" rel="noreferrer" style={{ color: '#FF6B4A', marginLeft: 4 }}>Firefox</a>,
        <a href="https://support.apple.com/es-es/guide/safari/sfri11471/mac" target="_blank" rel="noreferrer" style={{ color: '#FF6B4A', marginLeft: 4 }}>Safari</a>,
        <a href="https://support.microsoft.com/es-es/microsoft-edge" target="_blank" rel="noreferrer" style={{ color: '#FF6B4A', marginLeft: 4 }}>Edge</a>.
      </p>

      <LegalH2>4. Más información</LegalH2>
      <p>
        Para más detalles sobre cómo tratamos tus datos consulta nuestra
        <Link to="/privacidad" style={{ color: '#FF6B4A' }}> Política de Privacidad</Link>.
      </p>
    </LegalLayout>
  );
}

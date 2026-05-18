import React from 'react';
import { Link } from 'react-router-dom';
import LegalLayout, { LegalH2, LegalUL, LegalLI } from './LegalLayout';

export default function PrivacyPolicy() {
  return (
    <LegalLayout title="Política de Privacidad" lastUpdated="4 de mayo de 2026">
      <p>
        En FlickPick respetamos tu privacidad. Esta política explica qué datos recogemos,
        para qué los usamos y los derechos que tienes sobre ellos, conforme al Reglamento (UE)
        2016/679 (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD).
      </p>

      <LegalH2>1. Responsable del tratamiento</LegalH2>
      <p>
        <strong>ProfesionalNet Global Marketing, S.L.</strong> (CIF B87169322), con domicilio
        en Avenida de Manoteras 30, Oficinas A213, 28050 Madrid, titular del sitio
        flickpick.mov (en adelante, «el Responsable»). Datos identificativos completos
        disponibles en el <Link to="/aviso-legal" style={{ color: '#FF6B4A' }}>Aviso Legal</Link>.<br/>
        Email de contacto para asuntos de privacidad: <strong>legal@flickpick.mov</strong>
      </p>

      <LegalH2>2. Datos que recogemos</LegalH2>
      <LegalUL>
        <LegalLI><strong>Cuenta y autenticación</strong>: dirección de email, nombre o alias, foto/avatar (si la subes o generas con IA).</LegalLI>
        <LegalLI><strong>Datos de uso</strong>: votos en swipes, matches, salas creadas y miembros, watchlist, pelis marcadas como vistas.</LegalLI>
        <LegalLI><strong>Datos técnicos</strong>: dirección IP del backend, tipo de navegador, idioma, marca de tiempo de la sesión.</LegalLI>
        <LegalLI><strong>Datos de Google</strong> (si te registras con OAuth): identificador, email y foto de perfil que Google nos transmite.</LegalLI>
        <LegalLI><strong>Métricas anónimas</strong> (si aceptas cookies analíticas): páginas vistas, dispositivo, país aproximado vía Google Analytics.</LegalLI>
        <LegalLI><strong>Ubicación aproximada</strong> (solo si la solicitas activamente al usar la función «Cines cerca de ti»): coordenadas GPS de tu dispositivo procesadas en el momento para calcular el cine más cercano y ordenar resultados por distancia. <strong>No se almacenan</strong> en nuestros servidores ni se asocian a tu cuenta — se descartan al terminar la petición.</LegalLI>
      </LegalUL>

      <LegalH2>3. Finalidades y base legal</LegalH2>
      <LegalUL>
        <LegalLI><strong>Prestación del servicio</strong>: ejecución de contrato (Art. 6.1.b RGPD).</LegalLI>
        <LegalLI><strong>Autenticación y seguridad</strong>: interés legítimo (Art. 6.1.f).</LegalLI>
        <LegalLI><strong>Análisis de uso anónimo</strong>: tu consentimiento (Art. 6.1.a), revocable en cualquier momento.</LegalLI>
        <LegalLI><strong>Comunicaciones del servicio</strong> (magic-link, verificación de email, alertas funcionales): ejecución del contrato.</LegalLI>
        <LegalLI><strong>Geolocalización para cines cercanos</strong>: tu consentimiento explícito (Art. 6.1.a RGPD), otorgado mediante el diálogo nativo del navegador al pulsar «Detectar ubicación». Puedes denegar el permiso en cualquier momento desde los ajustes de tu navegador o sistema operativo y seguir usando la app eligiendo la ciudad manualmente.</LegalLI>
      </LegalUL>

      <LegalH2>4. Plazos de conservación</LegalH2>
      <LegalUL>
        <LegalLI>Datos de cuenta: mientras la cuenta esté activa. Si solicitas la baja, eliminamos los datos en un plazo máximo de 30 días.</LegalLI>
        <LegalLI>Logs técnicos: 90 días.</LegalLI>
        <LegalLI>Datos analíticos agregados: hasta 14 meses (configuración estándar de Google Analytics).</LegalLI>
      </LegalUL>

      <LegalH2>5. Destinatarios y transferencias internacionales</LegalH2>
      <p>
        No vendemos tus datos. Algunos servicios proveedores procesan datos en EE.UU. con
        garantías adecuadas (Data Privacy Framework):
      </p>
      <LegalUL>
        <LegalLI><strong>Google LLC</strong> (Google Sign-In, Google Analytics).</LegalLI>
        <LegalLI><strong>The Movie Database (TMDB)</strong>: nuestro proveedor de datos de películas y series. No le enviamos tu información personal; sus consultas son anónimas.</LegalLI>
        <LegalLI><strong>Dinahosting (España)</strong>: hosting del backend y la base de datos PostgreSQL.</LegalLI>
      </LegalUL>

      <LegalH2>6. Tus derechos (ARSULIPO)</LegalH2>
      <p>
        Puedes ejercer en cualquier momento tus derechos de Acceso, Rectificación, Supresión,
        Limitación, Portabilidad y Oposición escribiendo a <strong>legal@flickpick.mov</strong>
        desde la dirección registrada en tu cuenta. Te responderemos en un plazo máximo de
        un mes.
      </p>
      <p>
        Si consideras que el tratamiento no se ajusta a la normativa, puedes presentar una
        reclamación ante la Agencia Española de Protección de Datos (
        <a href="https://www.aepd.es" target="_blank" rel="noreferrer" style={{ color: '#FF6B4A' }}>www.aepd.es</a>).
      </p>

      <LegalH2>7. Menores de edad</LegalH2>
      <p>
        FlickPick está reservado a usuarios mayores de 14 años. No recogemos conscientemente
        datos de menores de esa edad. Si detectamos que un menor ha creado una cuenta sin la
        autorización de sus tutores, la eliminaremos.
      </p>

      <LegalH2>8. Cambios en esta política</LegalH2>
      <p>
        Podemos actualizar esta política para reflejar cambios legales o funcionales. Te
        avisaremos por email cuando los cambios sean materiales.
      </p>
    </LegalLayout>
  );
}

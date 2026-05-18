import React from 'react';
import { Link } from 'react-router-dom';
import LegalLayout, { LegalH2, LegalUL, LegalLI } from './LegalLayout';

export default function LegalNotice() {
  return (
    <LegalLayout title="Aviso Legal" lastUpdated="2 de mayo de 2026">
      <p>
        En cumplimiento de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la
        Información y de Comercio Electrónico (LSSI-CE), se informa de los siguientes datos
        identificativos del titular del sitio web <strong>flickpick.mov</strong>:
      </p>

      <LegalH2>Datos del titular</LegalH2>
      <LegalUL>
        <LegalLI><strong>Denominación social:</strong> ProfesionalNet Global Marketing, S.L.</LegalLI>
        <LegalLI><strong>CIF:</strong> B87169322</LegalLI>
        <LegalLI><strong>Domicilio fiscal:</strong> Avenida de Manoteras 30, Oficinas A213, 28050 Madrid</LegalLI>
        <LegalLI><strong>Email de contacto:</strong> legal@flickpick.mov</LegalLI>
        <LegalLI><strong>Sitio web:</strong> https://flickpick.mov</LegalLI>
      </LegalUL>

      <LegalH2>Objeto</LegalH2>
      <p>
        El sitio web flickpick.mov ofrece una aplicación gratuita que permite a grupos de
        usuarios decidir qué película o serie ver de manera colaborativa, mediante un sistema
        de swipes y matches con datos provenientes de The Movie Database (TMDB).
      </p>

      <LegalH2>Propiedad intelectual e industrial</LegalH2>
      <p>
        Todos los elementos del sitio (código, diseño, logotipos, textos, gráficos) son
        propiedad del Responsable o cuentan con la correspondiente autorización para su uso.
        Se prohíbe expresamente la reproducción, distribución o transformación sin
        autorización previa por escrito.
      </p>
      <p>
        La información de películas y series mostrada proviene de TMDB y se utiliza conforme
        a sus condiciones (
        <a href="https://www.themoviedb.org/api-terms-of-use" target="_blank" rel="noreferrer" style={{ color: '#FF6B4A' }}>
          themoviedb.org/api-terms-of-use
        </a>). FlickPick no está respaldado ni certificado por TMDB.
      </p>

      <LegalH2>Responsabilidad</LegalH2>
      <p>
        El Responsable no garantiza la inexistencia de interrupciones o errores en el acceso
        al sitio web, ni la actualización absoluta de los contenidos, si bien realizará los
        esfuerzos razonables para evitarlos. El Responsable no se hace responsable de los
        daños y perjuicios producidos por el uso ilegítimo del sitio.
      </p>

      <LegalH2>Enlaces a terceros</LegalH2>
      <p>
        Los enlaces a sitios externos (plataformas de streaming, búsquedas en Google, etc.)
        se facilitan a título informativo. El Responsable no controla esos sitios ni asume
        responsabilidad sobre sus contenidos o políticas de privacidad.
      </p>

      <LegalH2>Privacidad y cookies</LegalH2>
      <p>
        El tratamiento de datos personales se rige por la
        <Link to="/privacidad" style={{ color: '#FF6B4A' }}> Política de Privacidad</Link>.
        El uso de cookies y almacenamiento local se describe en la
        <Link to="/cookies" style={{ color: '#FF6B4A' }}> Política de Cookies</Link>.
      </p>

      <LegalH2>Legislación aplicable</LegalH2>
      <p>
        El presente aviso se rige por la legislación española. Para cualquier controversia,
        las partes se someten a los Juzgados y Tribunales del domicilio del Responsable.
      </p>
    </LegalLayout>
  );
}

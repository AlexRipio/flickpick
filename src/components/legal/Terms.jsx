import React from 'react';
import { Link } from 'react-router-dom';
import LegalLayout, { LegalH2, LegalUL, LegalLI } from './LegalLayout';

export default function Terms() {
  return (
    <LegalLayout title="Términos y Condiciones de Uso" lastUpdated="2 de mayo de 2026">
      <p>
        Bienvenido a FlickPick. Al usar este servicio aceptas estas condiciones. Si no
        estás de acuerdo, no uses la aplicación.
      </p>

      <LegalH2>1. Descripción del servicio</LegalH2>
      <p>
        FlickPick es una aplicación web que permite a grupos de usuarios elegir qué
        película o serie ver mediante un sistema de swipes y matches. Mostramos información
        agregada de The Movie Database (TMDB).
      </p>

      <LegalH2>2. Edad mínima</LegalH2>
      <p>
        Para usar FlickPick debes tener al menos <strong>14 años</strong>. Si eres menor de
        edad pero mayor de 14, declaras tener la autorización de tus padres o tutores legales.
      </p>

      <LegalH2>3. Cuenta de usuario</LegalH2>
      <LegalUL>
        <LegalLI>Eres responsable de la veracidad de los datos que proporcionas.</LegalLI>
        <LegalLI>No puedes ceder tu cuenta a terceros.</LegalLI>
        <LegalLI>Debes notificar cualquier acceso no autorizado a legal@flickpick.mov.</LegalLI>
      </LegalUL>

      <LegalH2>4. Uso aceptable</LegalH2>
      <p>Te comprometes a NO:</p>
      <LegalUL>
        <LegalLI>Usar nombres, avatares o nombres de sala con contenido ofensivo, racista, sexual, violento o que infrinja derechos de terceros.</LegalLI>
        <LegalLI>Intentar acceder a partes restringidas del sistema, hacer ingeniería inversa, scrapear masivamente o saturar nuestros servidores.</LegalLI>
        <LegalLI>Usar la app para fines ilícitos o que vulneren derechos de propiedad intelectual.</LegalLI>
      </LegalUL>
      <p>
        Nos reservamos el derecho a suspender o eliminar cuentas que infrinjan estas reglas,
        sin previo aviso si la gravedad lo justifica.
      </p>

      <LegalH2>5. Propiedad intelectual</LegalH2>
      <LegalUL>
        <LegalLI>El logotipo, marca, código fuente y diseño de FlickPick son del Responsable.</LegalLI>
        <LegalLI>La información de películas y series, incluidos pósters, sinopsis, reparto, fechas y trailers, proviene de <strong>The Movie Database (TMDB)</strong>. FlickPick no está respaldado ni certificado por TMDB.</LegalLI>
        <LegalLI>Las marcas comerciales de plataformas de streaming (Netflix, Prime Video, Max, Disney+, Apple TV+, Movistar+, etc.) pertenecen a sus respectivos titulares.</LegalLI>
      </LegalUL>

      <LegalH2>6. Avatares generados por IA</LegalH2>
      <p>
        Si usas la función de generar avatar con IA, aceptas que el prompt y la imagen
        resultante puedan ser revisados automáticamente para detectar contenido prohibido.
        No se usarán para entrenar modelos de terceros.
      </p>

      <LegalH2>7. Disponibilidad del servicio</LegalH2>
      <p>
        FlickPick se ofrece «tal cual». No garantizamos disponibilidad ininterrumpida, ausencia
        total de errores ni que la información de películas/series sea exhaustiva o esté
        actualizada al instante. La fecha de estreno y plataformas dependen de TMDB.
      </p>

      <LegalH2>8. Limitación de responsabilidad</LegalH2>
      <p>
        En la máxima medida permitida por la ley, no seremos responsables de daños
        indirectos, lucro cesante o pérdidas derivadas del uso o imposibilidad de uso del
        servicio. Nada en estos términos limita la responsabilidad por dolo, negligencia
        grave, daños personales o cualquier otro supuesto que la ley no permita excluir.
      </p>

      <LegalH2>9. Modificaciones</LegalH2>
      <p>
        Podemos actualizar estos términos cuando sea necesario. Te informaremos en la app
        cuando los cambios sean relevantes. El uso continuado tras la notificación implica
        aceptación.
      </p>

      <LegalH2>10. Privacidad</LegalH2>
      <p>
        El tratamiento de tus datos se rige por nuestra <Link to="/privacidad" style={{ color: '#FF6B4A' }}>Política de Privacidad</Link>.
        El uso de cookies está descrito en la <Link to="/cookies" style={{ color: '#FF6B4A' }}>Política de Cookies</Link>.
      </p>

      <LegalH2>11. Ley aplicable y jurisdicción</LegalH2>
      <p>
        Estos términos se rigen por la ley española. Para cualquier controversia las partes
        se someten a los Juzgados y Tribunales del domicilio del Responsable, salvo que la
        normativa de consumidores aplique fuero distinto.
      </p>
    </LegalLayout>
  );
}

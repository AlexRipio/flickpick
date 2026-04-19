# FlickPick — Guía de despliegue y auth real

La app funciona de dos maneras:

1. **Modo local (por defecto, sin configuración)** — cuentas guardadas en `localStorage` del navegador, salas sincronizadas solo entre pestañas del mismo dispositivo. El botón "Continuar con Google" crea un perfil demo. Sirve para prototipar, **no** para que dos personas hagan match desde móviles distintos.
2. **Modo producción (con Supabase configurado)** — signup/signin validan contra una base de datos real, Google OAuth abre el login real de Google, y las salas se sincronizan entre dispositivos en tiempo real.

> **Por qué el botón de Google parece un "login de prueba" ahora:** no has configurado `VITE_SUPABASE_URL` ni `VITE_SUPABASE_ANON_KEY`. Sin esas variables el código detecta que no hay backend y usa el modo local (línea `hasSupabase` en `src/lib/supabase.js`). Cuando las añadas, el mismo botón abrirá el flujo OAuth real de Google.

---

## 1. Crear el proyecto de Supabase (2 min)

1. Ve a https://supabase.com, regístrate gratis, crea un proyecto.
2. En **SQL Editor** pega el contenido de `supabase/schema.sql` y ejecútalo.
3. En **Settings → API** copia:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` key → `VITE_SUPABASE_ANON_KEY`

Crea un archivo `.env.local` en `APP/` con esas dos variables (ver `.env.example`).

Reinicia `npm run dev`. Desde este momento:
- Signup/Signin guardan al usuario en Supabase Auth.
- Las salas viajan entre dispositivos vía Supabase Realtime.

## 2. Activar Google real (3 min)

1. En Supabase: **Authentication → Providers → Google → Enable**.
2. Supabase te muestra un **Redirect URL** (algo como `https://xxx.supabase.co/auth/v1/callback`).
3. Ve a https://console.cloud.google.com → **APIs & Services → Credentials → Create OAuth client ID**:
   - Application type: Web application
   - Authorized redirect URIs: pega el Redirect URL del paso anterior
4. Copia el Client ID + Client Secret y pégalos en Supabase (Google provider).
5. En **Authentication → URL Configuration → Site URL** pon `http://localhost:3000` (dev) y tu dominio real de Vercel (prod).

Listo. El botón "Continuar con Google" ahora abre el popup real de Google.

## 3. Deploy en Vercel (2 min)

```bash
cd APP
npx vercel
# o conecta el repo desde https://vercel.com/new
```

En Vercel → Project → Settings → Environment Variables añade:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Y vuelve a desplegar. El `vercel.json` ya tiene:
- `buildCommand: npm run build`
- rewrites para que las rutas de React Router no devuelvan 404
- caché eterno para `/assets/*`

Una vez desplegado, actualiza el **Site URL** en Supabase al dominio de Vercel, y añade ese dominio también a las Authorized Redirect URIs de Google.

---

## Checklist para entregar "listo para pruebas"

- [ ] `.env.local` creado con las dos variables de Supabase.
- [ ] `supabase/schema.sql` ejecutado en el proyecto Supabase.
- [ ] Google provider habilitado en Supabase + credenciales de Google Cloud.
- [ ] Vercel desplegado con las dos variables de entorno.
- [ ] Site URL en Supabase apunta al dominio de Vercel.
- [ ] Prueba: regístrate con email → cierra sesión → inicia con Google → crea sala → abre el link `/g/XXXXX` en otro móvil → ambos veis el lobby y los matches en vivo.

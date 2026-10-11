# Plazo 2.0 · Release y despliegue Cloudflare Pages

**Alcance:** publicación beta técnica con Supabase Auth y almacenamiento cifrado en cliente. No es un producto comercial listo para suscripciones.

## Configuración confirmada de backend
- Proyecto Supabase exclusivo: `dvqalzgyivqgnenjutub` — https://supabase.com/dashboard/project/dvqalzgyivqgnenjutub
- Región São Paulo, plan Free.
- Migración `supabase/migrations/20261010232436_plazo_initial_encrypted_schema.sql` aplicada y RLS habilitada en todas las tablas.
- URL + clave publicable incluidas como configuración pública del frontend. **Nunca añadir** service_role ni `sb_secret_`.

## Cloudflare Pages
### Alternativa sin sesión de navegador: GitHub Actions

El workflow `.github/workflows/deploy-cloudflare.yml` compila Vite y publica `dist`
en Cloudflare Pages con Direct Upload cada vez que cambia `main`.
Requiere los secretos de repositorio `CLOUDFLARE_API_TOKEN` (Account / Cloudflare
Pages / Edit, limitado a la cuenta seleccionada) y `CLOUDFLARE_ACCOUNT_ID`.
El token nunca se incorpora al bundle, al repositorio ni al informe.

El paso previo inspecciona los proyectos de la cuenta antes de crear `plazo-app`.
No modifica proyectos ajenos. Se detiene si existe otro proyecto vinculado al
repositorio, si `plazo-app` apunta a otro repositorio, usa Git nativo o tiene otra
rama de producción. No cambia automáticamente la estrategia de despliegue.

La URL se obtiene de la respuesta de Cloudflare; no se presupone disponible
`plazo-app.pages.dev`. El paso final comprueba HTML, bundle Vite y destino Supabase
y deja los resultados en el resumen de Actions. Eso no valida correos ni cuentas
reales. Direct Upload no permite convertir ese mismo proyecto a integración Git
nativa; la automatización reside en GitHub Actions.

GitHub Pages se conserva hasta verificar el despliegue Cloudflare. Después se
puede dejar su workflow solo manual y revisar el antiguo despliegue desde rama.

### Configuración con integración Git nativa
Este repositorio antes era HTML estático y su configuración probable era Framework **None**, sin build command y salida `.`. La versión 2.0 requiere compilar JavaScript con Vite. En Workers & Pages → proyecto de Plazo → Settings → Builds / Build configuration:

| Campo | Valor |
| --- | --- |
| Repositorio Git | `alexisebas-latam/Translation-app` |
| Production branch | `main` |
| Framework preset | Vite (o None con comando manual) |
| Root directory | `/` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js | 22.12+ (configurar si se utiliza una versión anterior) |

Guardar cambios y repetir un despliegue con el último commit de `main`. **Sin esta configuración, un hosting estático que sirva código fuente no ejecutará correctamente los imports npm**.

La URL real del proyecto Cloudflare **no está identificada ni verificada desde ChatGPT**. No se ha conectado un administrador de Cloudflare ni token API; GitHub por sí solo no puede modificar la configuración del proyecto Pages existente. El build de GitHub Actions verifica que se genere `dist` pero NO certifica que Cloudflare lo haya publicado.

## Supabase Auth → URL Configuration
Antes de probar correos reales, abrir:

https://supabase.com/dashboard/project/dvqalzgyivqgnenjutub/auth/url-configuration

1. Definir **Site URL** como el dominio HTTPS público real de Plazo (por ejemplo, `https://MI-PLAZO.pages.dev`; sustituir por el real).
2. Agregar redirecciones explícitas para `https://MI-PLAZO.pages.dev/` y `https://MI-PLAZO.pages.dev/?mode=reset`. No dejar una URL de localhost en producción.
3. Si se prueba en desarrollo local, agregar `http://127.0.0.1:5173/` y `http://127.0.0.1:5173/?mode=reset` solo para el entorno de desarrollo.
4. Revisar que Email Auth/Confirm Email estén habilitados según la política del proyecto, configurar plantillas y entrega SMTP apropiada si se piensa vender. No desactivar verificación de correo para compensar un redirect incorrecto.
5. Verificar que se recibe el correo, la confirmación regresa al dominio correcto y el login funciona.

La contraseña de Supabase sirve para autenticación, **no** para descifrar la bóveda. La clave de recuperación de 43 caracteres se genera en navegador y debe permanecer en poder del usuario. Si se pierde, recuperación de acceso/correo NO permite recuperar el contenido.

## Ensayos post-despliegue
1. Navegación responsive PC (1440×900) y móvil (390×844), teclado y error de red.
2. Registrar usuario A con correo verificable → verificar confirmación.
3. Crear espacio y bóveda A → **guardar clave de recuperación** fuera del backend.
4. Crear registros A y verificar que la base solo muestra ciphertext (no nombres/valores privados).
5. Iniciar sesión desde un segundo navegador con A → introducir secreto → ver registros.
6. Registrar usuario B con otro correo verificable → comprobar que B no ve ni puede actualizar registros de A, incluso forzando IDs de workspace por API.
7. Restablecer contraseña de A → los datos permanecen cifrados hasta entregar la clave de recuperación.
8. Probar bloqueo, cierre de sesión y pérdida de clave con datos ficticios.
9. Revisar Supabase Security Advisor y logs mínimos; no usar información de clientes reales en las pruebas.
10. Verificar que una actualización de la web no queda atrapada por el viejo SW.

**No se declaran ejecutadas las pruebas 2–10 hasta contar con un deployment y dos cuentas confirmadas reales.** La CI valida flujos y layouts en entornos de prueba y los controles RLS ya han sido inspeccionados.

## Comandos locales
```bash
npm install
npm run build
npm run dev
npm test
npm run test:ui
npm run test:live
```

Cloudflare documentación oficial: https://developers.cloudflare.com/pages/configuration/build-configuration/
Supabase URL allowlist: https://supabase.com/docs/guides/auth/redirect-urls

## Rollback
Original Plazo 1.x archivado en `legacy/index.html` y `legacy/sw.js`. Para volver a él se requiere un commit de revert/reinstauración y revisar cachés/service workers. Nunca destruir el proyecto Supabase ni borrar bóvedas por rollback.

## Bloqueos comerciales
No lanzar Hotmart, no anunciar E2EE auditado, no invitar a clientes con información confidencial ni afirmar cumplimiento normativo definitivo hasta pruebas reales y revisión independiente de seguridad.

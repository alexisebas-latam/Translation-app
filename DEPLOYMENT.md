# Plazo 2.0: despliegue Cloudflare Pages

## Estado verificado el 11 de octubre de 2026

- Proyecto existente y exclusivo: `plazo-app`.
- URL pública real: https://plazo-app.pages.dev/
- Fuente confirmada por API: `alexisebas-latam/Translation-app`.
- Producción: `main`, despliegues Git automáticos habilitados.
- Compilación: `npm run build`; salida: `dist`; raíz: `/`.
- Backend existente: `dvqalzgyivqgnenjutub`, activo, PostgreSQL 17.
- Migración `20261010232436_plazo_initial_encrypted_schema` aplicada una vez; RLS activo en las tres tablas.

El build Git nativo terminó correctamente para el commit
`2ed8380e3f59ea86f0b2f7d53c480a3fa544c4c5`.
La comprobación obtuvo HTTP 200 para HTML y el bundle
`/assets/index-3cjsH1bQ.js`, que apunta al Supabase correcto.
La URL también se abrió en navegador y el formulario de registro se mostró.

Pruebas nuevas en GitHub Actions: 25 unitarias aprobadas, 6 TODO;
pruebas de demo y de interfaz de autenticación PC/móvil aprobadas en Chromium.
Son pruebas automatizadas de interfaz, no autenticación real con dos usuarios.

Evidencia: https://github.com/alexisebas-latam/Translation-app/actions/runs/38182103866
CI: https://github.com/alexisebas-latam/Translation-app/actions/runs/38182103899

## Automatización y credenciales

Cloudflare conserva su integración Git nativa para publicar cambios de `main`.
El workflow `deploy-cloudflare.yml` queda solo manual: configura/verifica el
proyecto mediante API y solicita un build Git. Así no crea un segundo despliegue
por cada push. El fallback Direct Upload existe únicamente para una cuenta
sin proyecto Git previo. No se creó un proyecto adicional.

`CLOUDFLARE_API_TOKEN` permanece en GitHub Actions secrets. El Account ID público
confirmado es `9b667cd94f6eaf21a5cc5dd13f0b51c8`; puede sustituirse mediante
`CLOUDFLARE_ACCOUNT_ID`. Nunca añadir claves administrativas de Supabase,
`service_role` ni `sb_secret_` al frontend.

El script no modifica sitios ajenos. Rechaza otra fuente Git o proyectos
duplicados vinculados al repositorio. No registra tokens ni respuestas completas
que podrían contener variables privadas.

## Pendiente: Supabase Auth y pruebas reales

No se declara configurada la URL de Auth ni probados correos reales.
El conector Supabase disponible permite revisar BD y RLS, pero no ofrece edición
de Auth URL Configuration. El panel requiere una sesión; la selección GitHub /
passkey quedó esperando interacción del navegador.

Cuando se acceda al panel del proyecto existente, configurar y verificar:

- Site URL: `https://plazo-app.pages.dev/`.
- Redirect URLs exactas: `https://plazo-app.pages.dev/` y
  `https://plazo-app.pages.dev/?mode=reset`.
- Mantener confirmación de correo habilitada.
- Probar dos cuentas con correos verificables, confirmación, login y reset.
- Con datos ficticios, crear bóveda/cliente, inspeccionar ciphertext en BD,
  intentar acceso cruzado por API y recuperar en otro navegador con su clave.
- Restablecer login sin clave de bóveda no debe descifrar datos.
- Verificar bloqueo, cierre de sesión y persistencia real.

Security Advisor: aviso de protección contra contraseñas filtradas desactivada.
Revisar disponibilidad en el plan Free antes de cambiarla; no activar gastos.
No presentar la beta como seguridad auditada ni integrar Hotmart.

## GitHub Pages secundario

Se conserva temporalmente el workflow anterior: el repositorio todavía ejecuta
un despliegue incorporado desde rama que puede publicar fuentes sin compilar.
Desactivar solo el workflow compilado dejaría ese problema sin resolver.
Para retirarlo, revisar Settings / Pages y desactivar la publicación secundaria
o cambiar la fuente antes de dejar el workflow solo manual. La integración
actual no ofrece acceso administrativo a ese ajuste. Cloudflare es el principal.

## Rollback

Plazo 1.x permanece en `legacy/`. Un rollback requiere un commit explícito y
revisión de cachés; no borrar tablas ni bóvedas de Supabase.

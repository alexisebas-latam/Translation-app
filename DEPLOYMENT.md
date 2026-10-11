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

## Supabase Auth: configurado y comprobado

El workflow de configuración completó correctamente el segundo intento:
https://github.com/alexisebas-latam/Translation-app/actions/runs/38182933718

La API confirmó mediante lectura posterior:

- Site URL: `https://plazo-app.pages.dev/`.
- Redirect URLs: `https://plazo-app.pages.dev/` y
  `https://plazo-app.pages.dev/?mode=reset`.
- Registro por correo habilitado; confirmación de correo habilitada.
- SMTP personalizado: no configurado.

`SUPABASE_ACCESS_TOKEN` permanece en GitHub Actions secrets. El script solo
modifica las URL y exige confirmación de correo; no imprime la respuesta completa
de Management API ni sus posibles secretos SMTP/proveedores.

## Pruebas reales realizadas

Se utilizó una cuenta de prueba con alias del buzón conectado y datos ficticios.
No se insertaron cuentas confirmadas administrativamente ni se desactivó la
confirmación de correo.

- Registro real por API: HTTP 200, usuario creado sin sesión automática.
- Correo de confirmación recibido. Posteriormente la cuenta fue comprobada como
  confirmada y con inicio de sesión en `auth.users`. Al intentar reutilizar el
  enlace de confirmación devolvió `otp_expired`; no se afirma haber verificado
  visualmente el primer recorrido de ese enlace por la interfaz.
- Correo de recuperación real recibido; token verificado mediante Auth API.
  Contraseña de la cuenta de prueba restablecida: HTTP 200. El correo apunta a
  `https://plazo-app.pages.dev/?mode=reset`.
- Login real con contraseña restablecida: correcto.
- Adaptador real de la aplicación conectado a Supabase: crea bóveda, guarda
  cliente ficticio, lee y descifra el mismo registro.
- Lectura de la fila de servidor: ciphertext, sin nombre legible ni secreto
  de recuperación.
- Bloqueo impide leer; clave de recuperación incorrecta rechazada.
- Segundo cliente SDK independiente, misma cuenta: sin clave no puede leer;
  con la clave recupera el registro persistido.
- Cliente sin autenticación: no puede leer el registro mediante Data API.
- Cierre de sesión: adaptadores bloqueados y lecturas rechazadas.

Estas pruebas se ejecutaron por API/SDK, no mediante dos navegadores físicos.
Las 6 pruebas de demo y 8 de interfaz PC/móvil en Chromium también pasaron, pero
no equivalen a un flujo visual completo con correos y usuarios independientes.

## Pendientes y límites reales

El registro de una segunda cuenta devolvió HTTP 429,
`over_email_send_rate_limit`. Sigue pendiente el aislamiento entre **dos
usuarios confirmados distintos** y las pruebas visuales de extremo a extremo
en navegador/iPhone, así como restablecer la contraseña después de crear datos
y verificar que sin la clave no se descifran.

El SMTP predeterminado de Supabase restringe destinatarios a miembros del
equipo y tiene límites de envío. Antes de abrir registro a usuarios externos,
configurar un proveedor SMTP apropiado sin activar gastos no autorizados.
No se ha declarado el registro público general como operativo.

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

## Mejora de clientes y navegación

Interfaz compacta de Inicio / Clientes / Privacidad, menú accesible de cuenta,
búsqueda local y formularios para agregar/editar clientes. Eliminación solo tras
confirmación explícita. Las ediciones vuelven a cifrar el contenido y verifican
la versión previa para detectar escrituras concurrentes. No se añadieron tablas
ni se migraron datos. Proyectos y finanzas siguen fuera de esta beta.

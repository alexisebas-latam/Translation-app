# Plazo 2.0 — Beta de gestión para traductores

**Proyecto:** gestión profesional para traductores, con autenticación mediante Supabase y almacenamiento de datos de negocio cifrado en el cliente.

**Estado:** beta técnica para pruebas, NO apta aún para comercialización ni afirmaciones de cifrado extremo a extremo auditado. No se ha integrado Hotmart.

## Qué funciona
- Registro con correo y contraseña, ingreso, recuperación de contraseña mediante Supabase Auth.
- Workspace único por usuario con Row Level Security.
- Bóveda generada y cifrada en el navegador, con clave de recuperación de 43 caracteres bajo control del usuario.
- Creación/listado de clientes con nombres cifrados en el navegador antes de enviarlos.
- Interfaz responsive: panel ancho de escritorio y navegación inferior para móvil.
- Pruebas automatizadas de lógica y UI, incluida la interfaz legada en `legacy/`.

## Qué está pendiente
- Verificación end-to-end de dos cuentas reales, correos, configuración de redirecciones y sincronización de dispositivos físicos.
- Diseño seguro de recuperación alternativo, conflicto de ediciones y modo offline seguro.
- Migración completa de proyectos, tarifas y finanzas con controles de exactitud.
- Prueba de seguridad independiente, auditoría E2EE y revisión legal de privacidad.
- Moneda configurable, planes Free/Pro autorizados en servidor y pagos Hotmart.
- Configuración/verificación del despliegue Cloudflare.

## Ejecutar
Requiere Node 22.12 o superior:

```bash
npm install
npm run dev
npm run build
npm test
npm run test:ui
npm run test:live
```

La URL y **clave publicable** del Supabase dedicado a Plazo están incorporadas al cliente. Son valores públicos; **nunca** publicar una clave `service_role` o `sb_secret_`.

## Recursos y procedimientos
- [Despliegue Cloudflare y redirecciones Supabase](DEPLOYMENT.md)
- [Base de datos y RLS](supabase/README.md)
- [Pruebas de cifrado/importación](v2/README.md)
- [Protocolo de autorizaciones](docs/v2-approval-gates.md)
- [Versión 1.x congelada](legacy/index.html)
- Estándares compartidos privados: [Desarrollo-apps-IA](https://github.com/alexisebas-latam/Desarrollo-apps-IA)

## Privacidad
RLS impide acceso entre usuarios a través de la API. Los contenidos de negocio se cifran **antes** de enviarse, de modo que una consulta ordinaria de base solo encuentra ciphertext y metadatos. El servicio todavía puede observar correo de identidad, IDs, recuentos, tamaños y actividad, y el responsable del frontend podría publicar código comprometido. No hacer promesas absolutas de cero conocimiento.

Los datos y claves de recuperación de los usuarios no deben compartirse con soporte ni almacenarse en logs/analítica.


## Producto restituido

La aplicación principal usa acceso directo con Supabase Auth, menú izquierdo, Panel, Proyectos, Clientes, Finanzas y Ajustes. Consulta [comportamiento, límites y validación](docs/product-restoration.md). Los módulos cifrados de la beta se conservan para recuperar los clientes antiguos; ya no bloquean el acceso cotidiano.

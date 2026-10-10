# Plazo 2.0 · Proyecto Supabase exclusivo

**Fecha de creación:** 2026-10-10
**Proyecto:** Plazo 2.0
**Organización:** alexisebas-latam
**Región:** sa-east-1 (São Paulo, Brasil)
**Plan comprobado al crear:** Free, costo de creación informado USD 0/mes.
**Base de datos:** PostgreSQL 17, proyecto activo.
**Estado:** esquema inicial IMPLEMENTADO en el proyecto Supabase, pero frontend / auth / sincronización aún NO conectados.

> Este directorio pertenece al repositorio CANÓNICO `Translation-app`. El hub `Desarrollo-apps-IA` solo contiene estándares y auditorías.

## Migración aplicada
`migrations/20261010232436_plazo_initial_encrypted_schema.sql`

Fue aplicada una sola vez en el Supabase exclusivo de Plazo con el identificador lógico `plazo_initial_encrypted_schema`. Supabase mantiene historial de migraciones. **No volver a ejecutar manualmente este SQL sobre la misma base.**

## Tablas y aislamiento
- `public.plazo_workspaces`: espacio individual por identidad autenticada; UUID de dueño y de workspace.
- `public.plazo_vaults`: sobre de clave cifrada AES-256-GCM (nonce, wrapped_key). La clave original y secreto de recuperación **no se almacenan**.
- `public.plazo_encrypted_records`: registros cifrados con nonce, ciphertext, identificadores opacos y versiones; los datos sensibles deben cifrarse en cliente.

Las tres tablas tienen RLS activa y políticas `owner_id = (select auth.uid())`; visitantes `anon` no reciben privilegios. Restricción de FK compuesta `(workspace_id, owner_id)` impide relacionar registros con espacios de otros usuarios incluso si se intenta forzar identificadores.

Las cuentas autenticadas pueden crear y consultar su espacio y su primera bóveda. Los registros cifrados admiten lectura, creación, edición de columnas específicas y eliminación por el propietario. Se bloquea desde cliente la reasignación de `owner_id` y `workspace_id`.

**La autorización no depende de guardar un ID de dueño en el navegador:** RLS compara contra el usuario autenticado por Supabase. Nunca enviar secretos de `service_role` a la PWA.

## Estado de verificación inicial
- Proyecto separado creado y confirmado `ACTIVE_HEALTHY`.
- 3 tablas creadas, 0 registros iniciales.
- RLS habilitada en todas y políticas verificadas en catálogo SQL (8 políticas).
- Privilegios de `anon` sin SELECT; `authenticated` con permisos específicos.
- Security Advisor de Supabase sin advertencias para esta versión.

**Límite:** todavía faltan pruebas reales de dos sesiones (usuario A/B) y de acceso por Data API, recuperación en dispositivos independientes, validación de configuración de correo Auth y una auditoría especializada del protocolo E2EE. Un administrador privilegiado sí puede consultar ciphertext y metadatos, aunque no debería tener el secreto de recuperación.

## Orden de conexión de la aplicación (pendiente)
1. Revisar el flujo de login deseado; propuesta inicial: correo + contraseña y confirmación de email. Pedir aprobación antes de activar cambios de configuración de correo y redirecciones.
2. Instalar y fijar versión de `@supabase/supabase-js` + archivo lock; configurar URL y **clave publicable** del proyecto. No incluir claves de servicio.
3. Registrarse con Auth y obtener el `auth.uid()` real.
4. Crear un workspace individual. El cliente recibe el UUID real de `plazo_workspaces.id`.
5. Generar en el navegador una bóveda y secreto de recuperación mediante `v2/security/vault.mjs`; guardar únicamente el sobre de clave en `plazo_vaults`.
6. Cifrar nombres, proyectos, tarifas y movimientos **antes** de subir; adaptar campos del objeto a columnas de `plazo_encrypted_records`.
7. Probar autenticación real, usuario A vs. B, restauración en segundo navegador/dispositivo y errores de sincronización.
8. Integrar frontend responsive y preparar la beta separada de `main`.
9. Más adelante: entitlements Free/Pro y Hotmart, con backend seguro independiente del cifrado.

## Notas de compatibilidad con el prototipo
- El mock de `v2/poc/` usa IDs `acct_...` **no UUID**, por lo que NO se debe usar directamente con PostgreSQL. En Auth real se emplearán UUID del proveedor.
- `v2/security/vault.mjs` devuelve propiedades JS `format`, `wrappedKey`, `recordId`, `version`; se necesita un adaptador tipado hacia `format_version`, `wrapped_key`, `record_id`, `record_version`.
- El backend no puede comprobar automáticamente que el ciphertext haya sido generado honestamente o que el cliente conserve la clave: los tests y una buena UX de recuperación son críticos.
- Hoy las modificaciones de registros no implementan control de concurrencia optimista; evitar sincronización multidispositivo real hasta resolver conflictos.
- En esta primera versión cada usuario solo tiene un workspace. Colaboración por equipos requiere rediseño de autorización y compartición criptográfica.

## Reglas de seguridad
Nunca registrar o exponer contenido en claro, secretos de recuperación, credenciales, SQL de administración sensible o tokens de servicio en GitHub, logs, capturas o herramientas de IA. No prometer cifrado extremo a extremo revisado externamente solo por tener AES-GCM + RLS.

Documentación oficial:
- https://supabase.com/docs/guides/auth
- https://supabase.com/docs/guides/database/postgres/row-level-security

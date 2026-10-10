# Plazo 2.0 — prueba de concepto aislada

Esta carpeta se encuentra **en el propio repositorio de Plazo**. No está importada por `index.html`: no modifica la PWA actual, la base local ni el despliegue.

## Implementado como código experimental
- `security/vault.mjs`: generación de bóveda local, secreto aleatorio de recuperación, envoltorio de clave y cifrado autenticado de registros con Web Crypto AES-GCM.
- `migration/legacy.mjs`: lectura y validación de un respaldo de Plazo 1.x sin escribir en la base, remapeo de identificadores y preparación de importación con datos ficticios.
- Pruebas Node automatizadas en `tests/`, ejecutables mediante `npm test`.

## No implementado todavía
Supabase Auth, PostgreSQL, políticas RLS, sincronización, UI de registro y desbloqueo, persistencia de bóveda, Hotmart, recuperación multiplataforma en navegador, manejo de conflictos y auditoría externa.

## Advertencias de privacidad
El operador no debe recibir el secreto de recuperación ni la clave privada. El resultado de `stageLegacyMigration` se encuentra **descifrado en memoria**: jamás sincronizarlo antes de cifrarlo, ni enviarlo a logs o servicios de IA. La clave de recuperación es un secreto de alta entropía que el usuario debe guardar por su cuenta. Si pierde clave y método de recuperación, el contenido podría quedar irrecuperable. La PWA controlada por el operador puede publicar JavaScript comprometido; no afirmar E2EE comercial auditado en esta fase.

## Cómo revisar
1. `npm test` desde la raíz (Node >=22 en CI).
2. Revisar pruebas negativas: manipulación de ciphertext, AAD de otros workspaces y secreto equivocado.
3. Evaluar pruebas de navegador con datos ficticios y recuperación entre dispositivos.
4. Solo entonces diseñar integración de autenticación/BD y definir las cuentas externas que deberá aprobar el propietario.

Ningún módulo se conecta a servicios externos.

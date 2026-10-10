# Plazo 2.0 — prueba de concepto aislada

Esta carpeta se encuentra **en el propio repositorio de Plazo**. No está importada por `index.html`: no modifica la PWA actual, la base local ni el despliegue.

## Implementado como código experimental
- `security/vault.mjs`: generación de bóveda local, secreto aleatorio de recuperación, envoltorio de clave y cifrado autenticado de registros con Web Crypto AES-GCM.
- `migration/legacy.mjs`: lectura y validación de un respaldo de Plazo 1.x sin escribir en la base, remapeo de identificadores y preparación de importación con datos ficticios.
- Pruebas Node automatizadas en `tests/`, ejecutables mediante `npm test`.

## Laboratorio responsive para PC y celular

Se añadió una interfaz experimental **que no reemplaza la PWA actual**:
- `demo/index.html`, `demo/styles.css`, `demo/main.mjs`: una sola aplicación adaptativa con **sidebar en escritorio** y **navegación inferior en móvil**.
- `poc/mock-service.mjs`: registro e inicio de sesión **simulados**, códigos aleatorios temporales y almacenamiento opaco cifrado mantenido exclusivamente en memoria.
- `poc/device.mjs`: cliente simulado que cifra antes de guardar, borra su clave de la sesión al salir y permite recuperar contenido desde otro dispositivo **simulado dentro de la misma página**.

### Cómo abrirlo en tu equipo

Con Node.js 22 o superior, desde la raíz del repositorio y en la rama `feat/plazo-v2-private-foundation`:

```bash
npm run demo
```

Abre **http://127.0.0.1:4173/v2/demo/** en el navegador. No se conecta a ningún servicio externo.

Flujo: crea una cuenta con **nombre ficticio** → copia identificador, código de acceso demo y clave de recuperación → crea uno o dos clientes ficticios → pulsa **Probar otro dispositivo** → introduce los códigos → recupera los clientes cifrados.

**Importante:** el cambio de dispositivo es **una simulación de dos clientes aislados en memoria** dentro del mismo navegador, no sincronización entre computadores reales. Recargar o cerrar la página descarta la cuenta, los registros, las claves y el almacén simulado. No uses credenciales, nombres ni proyectos reales.

Para probar visualmente ambos anchos, el proyecto incluye Playwright oficial `@playwright/test@1.64.0` y un workflow de GitHub Actions. En el equipo local, tras instalar dependencias:

```bash
npm install
npx playwright install chromium
npm run test:ui
```

Los controles del navegador también comprueban que nombres con caracteres HTML se presenten como texto. La identidad visual mantiene el carácter de Plazo, pero no es aún el sistema de diseño React final.

## No implementado todavía
Supabase Auth **real**, PostgreSQL, políticas RLS, sincronización real, persistencia de bóveda y sesiones, Hotmart, recuperación entre dispositivos físicos, colaboración, manejo de conflictos y auditoría externa. **La UI de registro y desbloqueo actual es simulada, no autenticación real.**

## Advertencias de privacidad
El operador no debe recibir el secreto de recuperación ni la clave privada. El resultado de `stageLegacyMigration` se encuentra **descifrado en memoria**: jamás sincronizarlo antes de cifrarlo, ni enviarlo a logs o servicios de IA. La clave de recuperación es un secreto de alta entropía que el usuario debe guardar por su cuenta. Si pierde clave y método de recuperación, el contenido podría quedar irrecuperable. La PWA controlada por el operador puede publicar JavaScript comprometido; no afirmar E2EE comercial auditado en esta fase.

## Cómo revisar
1. `npm test` desde la raíz (Node >=22 en CI).
2. Revisar pruebas negativas: manipulación de ciphertext, AAD de otros workspaces y secreto equivocado.
3. Evaluar pruebas de navegador con datos ficticios y recuperación entre dispositivos.
4. Solo entonces diseñar integración de autenticación/BD y definir las cuentas externas que deberá aprobar el propietario.

Ningún módulo se conecta a servicios externos.

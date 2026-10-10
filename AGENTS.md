# Plazo — reglas de trabajo para agentes IA

Este es el repositorio CANÓNICO de la aplicación Plazo. Repositorio de estándares: https://github.com/alexisebas-latam/Desarrollo-apps-IA (privado). Todo cambio de código, tests, configuración, migraciones o despliegue de Plazo se realiza **aquí**, jamás en el hub.

## Esta rama
`chore/plazo-v1-characterization` se limita a documentación, pruebas de comportamiento actual y protección contra subida accidental de datos. No alterar `index.html`, `sw.js`, iconos ni `manifest.json` en esta etapa. No crear despliegues.

## Reglas obligatorias
- Preservar Plazo 1.x y su almacenamiento IndexedDB. Nunca tocar datos reales del navegador desde GitHub.
- No enviar respaldos, datos de clientes, tarifas, tokens ni archivos privados a GitHub, LLM, CI, logs o tickets.
- No usar datos reales en pruebas; solo valores sintéticos.
- Documentar comportamiento ACTUAL aunque sea incorrecto; no confundir prueba de caracterización con cumplimiento de seguridad.
- Refactorizar o corregir hallazgos solo en otra etapa, con tests de regresión y aprobación.
- Separar identidad/Auth, autorización, cifrado controlado por usuario y suscripciones.
- No presentar RLS como E2EE. Evitar promesas de privacidad 'sin acceso del operador' hasta pruebas y revisión criptográfica.
- Free/Pro se validará en backend, pero no quitar lectura, recuperación ni exportación de datos al expirar el pago.
- Cambios en ramas y revisión antes de integrar en `main`; `main` no se modifica como parte de esta fase.

## Auditoría y diseño de migración
Consultar documentos del hub:
- `audits/plazo-2026-10-10.md`
- `audits/migracion-plazo-2.md`
- `audits/plan-de-pruebas-plazo.md`

Si el hub es inaccesible, no inventar sus contenidos. Solicitar al propietario acceso a las normas.

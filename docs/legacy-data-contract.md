# Contrato de datos observado — Plazo 1.x

Fuente: index.html del commit `d28a405b7a1e877aacb123a774929389b938b093`. Documenta formato actual, NO esquema aprobado de Plazo 2.0.

## Persistencia
IndexedDB `plazo_db`, versión 2, almacenes: `projects`, `clients`, `entries` (clave `id`) y `meta` (clave `k`). Los tres almacenes de negocio comparten contador de IDs `meta.nextId`, pero cada almacén tiene un espacio de claves propio. Los perfiles comparten el origen y filtran por `uid` en JavaScript; no son cuentas autenticadas.

## Registro aproximado
```json
{
  "client": {"id": 21, "uid": 9, "name": "Agencia de ejemplo", "type": "Agencia", "color": "#0E7C6B"},
  "project": {"id": 22, "uid": 9, "name": "Traducción de prueba", "client": 21, "lang": "EN › ES", "words": 2500, "rate": 0.07, "due": 1791600000000, "status": "curso"},
  "entry": {"id": 23, "uid": 9, "concept": "Servicio extra de prueba", "type": "ingreso", "amount": 50, "date": 1791600000000, "client": 21}
}
```

El JSON de exportación tiene `app:'Plazo'`, `version:2`, `exportedAt`, `userName`, `goalTarget`, `clients`, `projects`, `entries` y `nextId`. El export actual guarda el perfil seleccionado (no todos los perfiles locales a la vez) y es legible sin contraseña.

## Riesgos para una importación 2.0
- `uid` antiguo no constituye identidad autenticada.
- `id` entero no es globalmente único entre archivos, usuarios o dispositivos.
- Proyectos y entradas refieren al cliente mediante `client` entero; remapear al generar UUID.
- `due` y `date` son timestamps en milisegundos; respetar zona horaria de origen.
- `status`: pend, curso, entr, pag; **mezcla entrega y pago**. No inferir fechas de cobro inexistentes.
- Montos y tarifas usan `Number`, con moneda presumida USD; no inferir CLP/EUR sin dato.
- La importación 1.x borra antes de validar profundamente y no es atómica: **no usar para migración real**.
- No incluir semillas de demo en cuentas de pago.

## Procedimiento esperado de migración 2.0
Validar/normalizar localmente → vista previa → remapear IDs y relaciones → cifrar en cliente → staging + commit idempotente → verificar sumas/recuentos → conservar original y rollback.

## Datos de pruebas
Solo fixtures ficticios, nunca respaldos de traducciones reales. Probar clientes inexistentes, IDs colisionantes, campos vacíos, importación maliciosa y archivos corruptos.

# Plazo: restitución del producto · 12 octubre 2026

El propietario autorizó restaurar Panel, Proyectos, Clientes, Finanzas y Ajustes, menú izquierdo en PC y celular y acceso directo con Supabase Auth. También aceptó sustituir el cifrado en navegador en el uso cotidiano por datos legibles en Supabase protegidos mediante RLS por propietario. No se presenta este modelo como E2EE.

## Comportamiento

- Proyectos: cliente opcional, idiomas, servicio, palabras, horas, modalidad por palabra / por hora / precio fijo, tarifa, moneda USD/EUR/CLP, entrega con hora, estado del trabajo, notas y cobro acumulado con fecha.
- Clientes: alta, edición, búsqueda, eliminación con confirmación. Las referencias de proyectos/movimientos impiden eliminar un cliente asociado; deben reasignarse primero.
- Finanzas: ingresos de proyectos según fecha e importe cobrados, ingresos extras, gastos, balance, pendiente de cobro, filtros de mes/moneda y comparación de seis meses. No suma monedas diferentes.
- Panel: proyectos activos, palabras por trabajar, ingresos del mes, pendientes, próximas entregas, meta y ranking por cobros de proyectos.
- Ajustes: perfil, moneda, meta, cierre de sesión, exportación JSON e importación transaccional sin borrar ni sobrescribir registros. Importación compatible con respaldos originales `app: Plazo, version: 2`; los originales se interpretan en USD y el estado `pag` como cobrado, usando la entrega como fecha histórica disponible. Revisar fechas tras importar.
- Recuperación de clientes cifrados de la beta: una sola importación con la clave antigua en Ajustes; nunca se envía la clave al servidor. Se conservan las tablas cifradas originales.
- Escrituras y borrados usan versión del registro para rechazar cambios simultáneos. Fallos de sincronización no anuncian guardado exitoso.

## Límites explícitos

Beta, sin planes comerciales ni cobros de suscripción. Un proyecto registra un importe cobrado acumulado con una fecha; no implementa todavía un historial de cuotas independientes, facturas ni presupuestos. La meta compara ingresos cobrados en la moneda principal. El ranking considera cobros de proyectos, no movimientos extras. El respaldo exportado es legible y debe guardarse en privado. Importar no modifica preferencias actuales.

Supabase correo predeterminado tiene restricciones y límites para registro público. Confirmación de correo sigue activada; SMTP personalizado sigue pendiente. La sesión existente puede acceder directamente sin clave de bóveda. Las tablas antiguas y el almacenamiento de Plazo 1.x permanecen intactos.

## Validación

Compilación Vite local aprobada y 33 pruebas Node aprobadas (6 TODO históricas). Base real: comprobados RLS entre dos identidades mediante JWT claims de PostgreSQL, rechazo de referencias/propietarios ajenos, importación atómica, deduplicación y ausencia de permisos SELECT para anon. Pruebas transaccionales con datos sintéticos revertidos. CI [38194842683](https://github.com/alexisebas-latam/Translation-app/actions/runs/38194842683) aprobado: compilación, 33 pruebas Node, 6 pruebas de demo y 14 pruebas de producto en Chromium escritorio/celular. Probados acceso directo, clientes/proyectos/movimientos CRUD, precio por palabra/hora/fijo, finanzas, recarga, cierre de sesión, render seguro de texto y errores. Capturas visuales de las cinco secciones revisadas. Validación pública se completa tras promover a main. Las pruebas de navegador usan exclusivamente datos ficticios y rutas de API simuladas; no equivalen a cuentas independientes con correo real.

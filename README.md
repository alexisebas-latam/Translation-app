# Plazo 2.0 — Gestión para traductores independientes

Aplicación beta con Panel, Proyectos, Clientes, Finanzas y Ajustes. Frontend JavaScript/Vite, autenticación Supabase y PostgreSQL con permisos por propietario (RLS).

Alojamiento principal: https://plazo-app.pages.dev/ · despliegue automático de GitHub `main` mediante Cloudflare Pages.

## Funciones actuales

- Registro con confirmación de correo, inicio de sesión y recuperación de contraseña. Acceso directo al panel después de autenticar.
- Clientes: crear, consultar, editar, buscar y eliminar con confirmación y protección de referencias.
- Proyectos: cliente, idiomas, tipo de servicio, volumen de palabras, horas, tarifa por palabra / por hora / precio fijo, entrega, notas, estado del trabajo y cobro acumulado.
- Finanzas: cobros de proyectos, ingresos extras, gastos, saldo mensual y pendientes. USD, EUR y CLP se calculan por separado.
- Perfil, meta mensual, exportación e importación JSON transaccional sin borrar datos actuales.
- Menú izquierdo en escritorio y botón de tres líneas arriba a la izquierda en celular.

## Privacidad y límites

El propietario autorizó el modelo operativo Auth + RLS para simplificar el acceso. Los datos del producto se guardan **legibles en Supabase**: el operador del servicio puede acceder a ellos. RLS protege el acceso entre cuentas mediante la API; no equivale a cifrado de extremo a extremo ni a una auditoría independiente.

Las tablas cifradas de la beta anterior permanecen intactas. En Ajustes puede importarse una sola vez el contenido antiguo usando la clave de recuperación; la clave no se envía al servidor ni se requiere para el uso cotidiano.

Beta técnica, sin pagos ni planes Free/Pro comerciales. Un cobro acumulado por proyecto con una fecha; todavía no hay historial de cuotas, facturación o presupuestos. Los respaldos exportados son legibles. La configuración SMTP personalizada para registro público sigue pendiente: el correo predeterminado de Supabase tiene límites y restricciones. No se desactiva la confirmación de correo.

## Desarrollo

Node >=22.12.0:

```bash
npm ci
npm run dev
npm run build
npm test
npm run test:ui
npm run test:live
```

El frontend solo incluye la URL y clave **publicable** de Supabase. Nunca agregar claves `service_role`, `sb_secret_` o tokens administrativos.

- [Comportamiento, límites y resultados](docs/product-restoration.md)
- [Despliegue y Auth](DEPLOYMENT.md)
- [Esquema y RLS](supabase/README.md)
- [Original archivado](legacy/index.html)
- [Módulos cifrados anteriores](v2/README.md)
- Estándares: https://github.com/alexisebas-latam/Desarrollo-apps-IA

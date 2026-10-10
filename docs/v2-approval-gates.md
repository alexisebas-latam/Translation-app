# Puntos de autorización antes de Plazo 2.0

**Regla:** código y pruebas de Plazo en `Translation-app`; estándares comunes y hallazgos en `Desarrollo-apps-IA`. Trabajar en ramas hasta revisión, sin despliegue ni migración automática.

## Sin autorización externa (trabajo de desarrollo)
- Crear ramas, escribir módulos aislados y pruebas con datos **ficticios**.
- Evaluar librerías/repositorios y proponer diseño de pantallas, esquema y contratos de API.
- No copiar datos reales ni instalar scripts no verificados.

## Requiere aprobación antes de conectar, publicar o gastar
1. **Supabase (aprobación inicial COMPLETADA 2026-10-10):** ya existe proyecto Plazo 2.0 Free en São Paulo, con migración inicial de tablas cifradas/RLS aplicada. Cualquier upgrade, proveedor externo, gasto adicional o cambio de producción requiere autorización nueva. Nunca exponer claves secretas, y configurar URL/clave publicable con cuidado al integrar el frontend.
2. **Auth**: decidir método (email/passkey/MFA), mensajes transaccionales, recuperación y dominio. Nunca confundir recuperación de cuenta con recuperación de bóveda cifrada.
3. **Cloudflare**: confirmar sitio y rama desplegada; no cambiar la rama de producción, variables secretas, registros DNS ni dominios sin aprobación.
4. **Hotmart**: aprobar producto, ciclos de cobro, política Free/Pro, reembolsos y enlace seguro entre compra y usuario. Webhooks solo después de crear credenciales y probar sin dinero real cuando corresponda.
5. **Seguridad/privacidad**: revisar protocolo y recuperación de clave, informar pérdida irreversible posible, definir metadatos administrativos y plan legal antes de marketing E2EE.
6. **Lanzamiento**: autorizar rama/PR para merge a main, despliegue, beta y suscripciones reales.

## Roles
El usuario conserva control de sus cuentas y decisiones comerciales. La implementación no necesita que entregue contraseñas, tokens ni exportaciones privadas por chat. Los secretos se crean/configuran en el servicio autorizado.

## Recomendación de secuencia
PoC offline con Node y navegador → ensayo de recuperación → decisión Supabase/hosting → Auth/RLS con datos sintéticos → sincronización cifrada → UX/UI → Hotmart → beta privada y revisión de seguridad.

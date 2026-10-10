# Respaldo seguro de Plazo 1.x — procedimiento para el propietario

**Importante:** esta guía NO realiza un respaldo automático. Los datos de Plazo 1.x residen en IndexedDB del navegador y no están en GitHub. Ni un commit ni un deploy conservan esa información. No pruebes importación destructiva con datos reales.

## Paso 1: exportar el archivo desde el Plazo que contiene tus datos
1. Abre la instalación de Plazo donde están tus datos y selecciona el perfil correcto.
2. Ve a **Respaldo y licencia → Exportar JSON**.
3. Confirma que el navegador haya descargado un archivo `plazo-respaldo-AAAA-MM-DD.json` y que su tamaño sea razonable (no cero bytes).
4. Si usas varios perfiles locales de Plazo, exporta **cada uno por separado**.
5. Conserva el archivo original en un lugar seguro y una segunda copia redundante protegida.

## Paso 2: proteger el respaldo
El JSON de la versión actual **no está cifrado**: contiene nombres de clientes, proyectos, importes y otra información comercial en texto legible. Guárdalo en un contenedor/carpeta cifrada con una contraseña fuerte; evita carpetas compartidas y dispositivos ajenos. No lo subas a GitHub, chats, correo sin protección, herramientas de IA ni soporte.

## Paso 3: verificar SIN importar en tu sesión de trabajo
- Revisa la existencia, fecha y tamaño del archivo; un archivo vacío o corrupto no es respaldo válido.
- Valida únicamente el esquema con un verificador local de confianza o editor sin telemetría/servicios externos. Si es posible, compara totales y recuentos de tu aplicación con el respaldo sin publicar contenido.
- Para validar una restauración, usa un **perfil de navegador completamente separado**, un origen de pruebas idéntico y datos de ejemplo primero. La importación 1.x actualmente puede colisionar IDs y sobrescribir perfiles (hallazgo F-03), por lo que **no recomiendo restaurar datos reales en el origen habitual**.
- No borres, reinstales, restablezcas ni limpies almacenamiento de la instalación original hasta contar con un procedimiento de migración 2.0 probado.

## Paso 4: registrar controles
- Fecha/hora y perfil exportado.
- Dónde guardaste las dos copias cifradas.
- Resultado de validación, sin documentar datos privados.
- Fecha de la última exportación antes de cualquier cambio de estructura.

## Límite de esta fase
Desde GitHub no podemos acceder a IndexedDB de tus dispositivos. No se ha exportado, copiado ni modificado tu información local.

## Futuro Plazo 2.0
El importador será validado, no destructivo y reversible; migrará datos **en el dispositivo**, cifrará antes de subirlos y remapeará IDs/relaciones. Una cuenta Hotmart/Supabase nunca será excusa para leer tus proyectos o los de otros traductores.

# PLAN — Malako Store

## Objetivo

Tienda web estática de electrodomésticos lista para GitHub Pages: catálogo, carrito,
registro/login local y checkout por WhatsApp. Sin frameworks, sin librerías externas,
sin `fetch` y sin llamadas asíncronas externas.

## Configuración aprobada

| Parámetro | Valor |
|---|---|
| Nombre de tienda | Malako Store |
| WhatsApp | `51999999999` (placeholder en `CONFIG.WHATSAPP_NUMBER`, editable en `app.js`) |
| Moneda | Soles peruanos (`PEN`) con formato `es-PE` |
| Imágenes | `assets/img/producto1.jpg` … `producto8.jpg` generadas localmente |
| Autenticación | `localStorage` (demo, no seguridad real) |
| Checkout | Enlace `https://wa.me/<número>?text=<mensaje urlencoded>` |
| Despliegue | GitHub Pages, rama `main`, carpeta raíz `/` |
| Extras | `README.md`, `DOCS.md`, `PLAN.md`, `.nojekyll`, `favicon.svg` |

## Estructura de archivos

```text
index.html              Catálogo, carrito lateral y modales de cuenta/checkout
style.css               Diseño responsivo con variables, Grid y Flexbox
db.js                   const PRODUCTOS + window.PRODUCTOS (8 productos)
app.js                  Módulos Store/Auth/Cart/Checkout/UI en IIFEs
favicon.svg             Icono local
.nojekyll               Evita el procesado Jekyll en GitHub Pages
README.md               Uso, configuración y despliegue
DOCS.md                 Documentación técnica y guía de ampliaciones
PLAN.md                 Este documento
assets/img/             producto1.jpg … producto8.jpg
admin/index.html        Panel temporal de administración
admin/admin.js          Alta/baja de productos y descarga de db.js
```

## Decisiones técnicas

1. **Scripts clásicos con `defer`** para compatibilidad con `file://`; sin módulos ES
   ni `import`, lo que evita restricciones CORS al abrir el sitio localmente.
2. **`window.PRODUCTOS`** además de `const PRODUCTOS` para que `admin/admin.js`
   pueda leer el catálogo cargando `../db.js`.
3. **localStorage** con las claves `malako_users`, `malako_session`,
   `malako_cart` y `malako_admin_products` (borrador del panel).
4. **Contraseñas ofuscadas** con un hash djb2 con sal fija: suficiente para una demo
   sin backend, insuficiente para producción. Documentado en `README.md` y `DOCS.md`.
5. **Checkout sin pasarela**: formulario con nombre, teléfono, tipo de entrega,
   dirección, método de pago (Yape, Plin, transferencia, contra entrega) y notas.
   El pedido se arma como texto, se codifica con `encodeURIComponent` y se abre
   `wa.me` en una pestaña nueva; se ofrece un modal de respaldo con el enlace.
6. **admin/** genera `db.js` con `JSON.stringify` y lo descarga usando `Blob` +
   `URL.createObjectURL`. Mantiene un borrador en localStorage y permite restablecer.
7. **Imágenes locales**: rutas relativas a la raíz (`assets/img/...`); el panel
   administrativo añade `../` solo para la vista previa.

## Fases de implementación

1. Crear carpetas y `PLAN.md`.
2. `db.js` con ocho electrodomésticos y categorías variadas.
3. `index.html` con header, hero, catálogo, filtros, drawer, modales y footer.
4. `style.css` responsivo (breakpoints 1024, 900, 768, 640, 420 px).
5. `app.js` con utilidades, catálogo, autenticación, carrito, UI y checkout.
6. `admin/` con formulario validado, tabla, borrador y descarga.
7. Generar JPG, `favicon.svg`, `.nojekyll`, `README.md`, `DOCS.md`.
8. Verificar.

## Verificación prevista

- Los ocho JPG existen y pesan más de 0 bytes.
- `grep` de `https?://` solo encuentra `https://wa.me` (cero CDN, cero APIs).
- Registro/login persisten tras recargar; el carrito también.
- El checkout genera un enlace con productos, cantidades, total y método de pago.
- El panel admin descarga un `db.js` válido y reemplazable.
- Prueba en `file://` y con un servidor local (`python -m http.server`).

## Documentación de ampliaciones

`DOCS.md` incluye arquitectura, modelo de datos, esquema de localStorage, API
interna de cada módulo, recetas de ampliación, roadmap, convenciones de código,
checklist de QA y limitaciones conocidas.

## Criterios de aceptación

- Los seis archivos solicitados están completos y enlazados correctamente.
- Sin dependencias externas ni peticiones de red salvo WhatsApp al finalizar compra.
- Diseño usable en móvil, tablet y escritorio.
- Sitio desplegable en GitHub Pages desde la raíz de `main`.
- `admin/` documentado como carpeta temporal que debe eliminarse antes de publicar.

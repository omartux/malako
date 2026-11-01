# PLAN — Malako Store

## Objetivo

Tienda web estática de electrodomésticos lista para GitHub Pages: catálogo, carrito,
checkout como invitado por WhatsApp e ID de compra determinista de 16 dígitos. Sin
frameworks, sin librerías externas, sin `fetch`, sin cuentas de cliente y sin
llamadas asíncronas externas.

## Configuración aprobada

| Parámetro | Valor |
|---|---|
| Nombre de tienda | Malako Store |
| WhatsApp | `51999999999` (placeholder en `CONFIG.WHATSAPP_NUMBER`, editable en `app.js`) |
| Moneda | Soles peruanos (`PEN`) con formato `es-PE` |
| Imágenes | `assets/img/producto1.jpg` … `producto8.jpg` generadas localmente |
| Cuentas | Ninguna; checkout como invitado |
| Admin | Carpeta temporal sin login; eliminar antes de publicar |
| ID de compra | 16 dígitos: 8 de importe + 8 de cliente |
| Checkout | Enlace `https://wa.me/<número>?text=<mensaje urlencoded>` |
| Despliegue | GitHub Pages, rama `main`, carpeta raíz `/` |
| Extras | `README.md`, `DOCS.md`, `PLAN.md`, `.nojekyll`, `favicon.svg` |

## Estructura de archivos

```text
index.html              Catálogo, carrito lateral y modal de checkout
style.css               Diseño responsivo con variables, Grid y Flexbox
db.js                   const PRODUCTOS + window.PRODUCTOS (8 productos)
order-id.js             Generador/verificador compartido del ID
admin-warning.js        Detector y cierre del aviso de modo admin
app.js                  Módulos Catalog/Cart/Checkout/UI en IIFEs
favicon.svg             Icono local
.nojekyll               Evita el procesado Jekyll en GitHub Pages
README.md               Uso, configuración y despliegue
DOCS.md                 Documentación técnica y guía de ampliaciones
PLAN.md                 Este documento
assets/img/             producto1.jpg … producto8.jpg
admin/index.html        Panel temporal de administración y verificador
admin/admin.js          Catálogo, descarga de db.js y verificación de IDs
admin/admin-mode.js     Marcador de presencia del panel admin
```

## Decisiones técnicas

1. **Scripts clásicos con `defer`** para compatibilidad con `file://`; sin módulos ES
   ni `import`, lo que evita restricciones CORS al abrir el sitio localmente.
2. **`window.PRODUCTOS`** además de `const PRODUCTOS` para que `admin/admin.js`
   pueda leer el catálogo cargando `../db.js`.
3. **`localStorage`** solo con `malako_cart` y `malako_admin_products`. No se crean
   cuentas, sesiones ni contraseñas.
4. **Checkout sin pasarela**: formulario con nombre, teléfono, tipo de entrega,
   dirección, método de pago (Yape, Plin, transferencia, contra entrega) y notas.
   El pedido se arma como texto, se codifica con `encodeURIComponent` y se abre
   `wa.me` en una pestaña nueva; se ofrece un modal de respaldo con el enlace.
5. **ID determinista**: `order-id.js` genera 8 dígitos de importe ofuscado con XOR
   y 8 dígitos de cliente con FNV-1a 64. Usa `America/Lima` con segundos y no usa
   aleatoriedad. El mensaje de WhatsApp incluye la fecha exacta para permitir la
   verificación posterior.
6. **Admin folder-only**: el panel no tiene login ni enlace desde la tienda. Se
   activa por la existencia de `admin/`; debe eliminarse antes de publicar porque
   GitHub Pages expone todo el repositorio.
7. **Verificador local**: `admin/index.html` recalcula el ID desde nombre, teléfono,
   fecha, hora y monto. No guarda datos ni busca pedidos.
8. **admin/** genera `db.js` con `JSON.stringify` y lo descarga usando `Blob` +
   `URL.createObjectURL`. Mantiene un borrador en localStorage y permite restablecer.
9. **Imágenes locales**: rutas relativas a la raíz (`assets/img/...`); el panel
   administrativo añade `../` solo para la vista previa.
10. **Aviso de admin**: `admin-warning.js` inyecta `admin/admin-mode.js`; si el
    marcador carga, muestra “Modo admin activado” debajo del header. El cierre se
    guarda en `sessionStorage` y dura solo la pestaña actual.

## Fases de implementación

1. Crear carpetas y `PLAN.md`.
2. `db.js` con ocho electrodomésticos y categorías variadas.
3. `index.html` con header, hero, catálogo, filtros, drawer, checkout y footer.
4. `style.css` responsivo (breakpoints 1024, 900, 768, 640, 420 px).
5. `app.js` con utilidades, catálogo, carrito, UI y checkout.
6. `order-id.js` con el algoritmo compartido y el ejemplo verificable.
7. `admin/` con formulario validado, tabla, borrador, descarga y verificador.
8. Aviso de modo admin con marcador, cierre por pestaña y adaptación responsive.
9. Generar JPG, `favicon.svg`, `.nojekyll`, `README.md`, `DOCS.md`.
10. Verificar flujos, ID, admin, aviso, responsive y ausencia de restos de autenticación.

## Verificación prevista

- Los ocho JPG existen y pesan más de 0 bytes.
- `grep` de `https?://` solo encuentra `https://wa.me` (cero CDN, cero APIs).
- El carrito persiste tras recargar.
- El checkout no pide cuenta y genera un enlace con productos, cantidades, total,
  método de pago, fecha exacta e ID de 16 dígitos.
- El ID documentado `0003346156707567` se reproduce con el ejemplo aprobado.
- El verificador del admin marca coincidencia y detecta un ID incorrecto.
- Con `admin/admin-mode.js` presente, aparece “Modo admin activado” y se puede cerrar.
- El cierre no reaparece en la misma pestaña, pero sí en una pestaña nueva.
- Sin el marcador, el aviso permanece oculto.
- No quedan referencias a `Auth`, login, registro, `malako_users` ni
  `malako_session` en el código.
- El panel admin descarga un `db.js` válido y reemplazable.
- Prueba en `file://` y con un servidor local (`python -m http.server`).

## Documentación de ampliaciones

`DOCS.md` incluye arquitectura, modelo de datos, esquema de localStorage, API
interna de cada módulo, algoritmo del ID, recetas de ampliación, roadmap,
convenciones de código, checklist de QA y limitaciones conocidas.

## Criterios de aceptación

- Los archivos solicitados están completos y enlazados correctamente.
- Sin dependencias externas ni peticiones a terceros; solo `wa.me` al finalizar y
  el sondeo local del aviso de admin.
- Sin cuentas de cliente ni datos de autenticación.
- ID determinista de 16 dígitos verificable desde el admin.
- Aviso “Modo admin activado” visible, cerrable y sin mencionar la carpeta.
- Diseño usable en móvil, tablet y escritorio.
- Sitio desplegable en GitHub Pages desde la raíz de `main`.
- `admin/` documentado como carpeta temporal que debe eliminarse antes de publicar.

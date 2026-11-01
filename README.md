# Malako Store

Tienda web estática de electrodomésticos. Catálogo con filtros, carrito persistente,
registro e inicio de sesión local y checkout por WhatsApp. Sin frameworks, sin
librerías externas y sin llamadas `fetch`: solo HTML5, CSS3 y JavaScript vanilla.

## Características

- Catálogo renderizado desde un array local con búsqueda, filtro por categoría y orden.
- Carrito lateral persistente en `localStorage` con control de cantidades y stock.
- Registro e inicio de sesión guardados únicamente en el navegador.
- Checkout con datos del cliente, tipo de entrega y método de pago.
- Mensaje de WhatsApp generado automáticamente con productos, cantidades, total y datos.
- Panel temporal `admin/` para añadir o eliminar productos y descargar un nuevo `db.js`.
- Diseño responsivo, accesible con teclado y sin dependencias de red salvo WhatsApp.

## Estructura

```text
.
├── index.html          Catálogo, carrito y modales
├── style.css           Estilos de la tienda
├── db.js               Productos (const PRODUCTOS + window.PRODUCTOS)
├── app.js              Lógica de catálogo, auth, carrito y checkout
├── favicon.svg
├── .nojekyll
├── README.md
├── DOCS.md             Documentación técnica y de ampliaciones
├── PLAN.md             Plan de implementación
├── assets/img/         producto1.jpg … producto8.jpg
└── admin/
    ├── index.html      Panel temporal
    └── admin.js        Lógica del panel
```

## Probar en local

No requiere instalación. Puedes abrir `index.html` directamente o servirlo con
cualquier servidor estático:

```bash
python -m http.server 8000
```

Luego visita `http://localhost:8000`.

El sitio funciona también con `file://` porque usa scripts clásicos con `defer` y
rutas relativas. El panel está en `http://localhost:8000/admin/`.

## Configuración

### Número de WhatsApp

Edita la constante al inicio de `app.js`:

```js
const CONFIG = {
  STORE_NAME: 'Malako Store',
  WHATSAPP_NUMBER: '51999999999',
  CURRENCY: 'PEN',
  LOCALE: 'es-PE'
};
```

`WHATSAPP_NUMBER` debe incluir el código de país y solo dígitos (sin `+`, espacios
ni guiones). El número actual es un **placeholder**: cámbialo antes de publicar.

### Moneda

`CURRENCY` y `LOCALE` alimentan `Intl.NumberFormat`. Por ejemplo, para dólares:

```js
CURRENCY: 'USD',
LOCALE: 'en-US'
```

### Productos

Cada producto de `db.js` tiene esta forma:

```js
{
  id: 9,
  nombre: 'Nombre del producto',
  precio: 299,
  descripcion: 'Descripción breve.',
  categoria: 'Cocina',
  imagen: 'assets/img/producto9.jpg',
  stock: 10,
  destacado: false
}
```

El `id` debe ser único. `stock: 0` muestra el producto como agotado y deshabilita
la compra. Las categorías y los filtros se generan automáticamente.

### Imágenes

Coloca las imágenes en `assets/img/` y usa rutas relativas a la raíz. El formato
recomendado es 4:3 (por ejemplo, 800 × 600 px) para que las tarjetas se vean
uniformes. Si una imagen falta, se muestra un marcador de “Imagen no disponible”.

## Checkout por WhatsApp

1. El cliente agrega productos y abre el carrito.
2. Pulsa **Finalizar compra** y completa nombre, teléfono, entrega, dirección,
   método de pago y notas.
3. La tienda arma un resumen, calcula el total y abre:

```text
https://wa.me/<WHATSAPP_NUMBER>?text=<mensaje%20codificado>
```

4. El cliente envía el mensaje desde su WhatsApp. El pago (Yape, Plin,
   transferencia o contra entrega) y la entrega se coordinan en el chat.

No hay pasarela de pago ni procesamiento de tarjetas. El carrito se vacía después
de generar el pedido y se muestra un modal con el enlace de respaldo y la opción
de copiar el resumen.

## Cuentas y datos locales

Claves utilizadas en `localStorage`:

| Clave | Contenido |
|---|---|
| `malako_users` | Cuentas registradas |
| `malako_session` | Sesión activa |
| `malako_cart` | Carrito actual |
| `malako_admin_products` | Borrador del panel administrativo |

Para reiniciar la tienda en un navegador, abre DevTools → Application →
Local Storage y elimina esas claves, o ejecuta:

```js
localStorage.removeItem('malako_users');
localStorage.removeItem('malako_session');
localStorage.removeItem('malako_cart');
localStorage.removeItem('malako_admin_products');
```

La autenticación es **solo demostrativa**: las contraseñas se ofuscan con un hash
no criptográfico y cualquiera con acceso al navegador puede leer o modificar los
datos. No uses contraseñas reales ni datos sensibles.

## Panel administrativo

1. Abre `admin/index.html` en el navegador.
2. Añade o elimina productos. Los cambios quedan como borrador local.
3. Pulsa **Descargar db.js**.
4. Reemplaza el `db.js` de la raíz con el archivo descargado.
5. Recarga la tienda.

El panel no escribe archivos por sí solo: la descarga es manual por seguridad y
porque un sitio estático no puede modificar el servidor.

**Importante:** elimina la carpeta `admin/` antes de publicar el sitio. GitHub
Pages hace público todo el contenido del repositorio, incluido el panel.

## Publicar en GitHub Pages

1. Crea un repositorio y sube el contenido de esta carpeta a la rama `main`.
2. En GitHub ve a **Settings → Pages**.
3. En *Build and deployment*, selecciona **Deploy from a branch**.
4. Elige la rama `main` y la carpeta `/ (root)`.
5. Guarda y espera la publicación.

El archivo `.nojekyll` evita que Jekyll procese el sitio y que ignore archivos o
carpetas que empiezan con `_`, `.` o `#`.

Antes de publicar:

```bash
git rm -r admin
```

Revisa también que `PLAN.md` no exponga información que no quieras publicar.

## Solución de problemas

- **Los productos no aparecen:** abre la consola y verifica que `db.js` se cargue
  antes que `app.js` y que `PRODUCTOS` sea un array válido.
- **WhatsApp no abre:** revisa que el número tenga código de país y solo dígitos.
  Usa el botón del modal de respaldo o copia el resumen.
- **El checkout no valida:** el teléfono admite números, espacios, guiones y
  paréntesis; la dirección es obligatoria salvo en recojo en tienda.
- **Los cambios del panel no se ven:** descarga `db.js`, reemplaza el archivo de
  la raíz y recarga con `Ctrl + F5`.
- **Las imágenes no cargan:** las rutas son sensibles a mayúsculas en Linux/GitHub
  Pages; usa exactamente `assets/img/...`.

## Documentación técnica

Consulta [DOCS.md](DOCS.md) para arquitectura, modelo de datos, API interna,
recetas de ampliación, roadmap, convenciones y checklist de QA.

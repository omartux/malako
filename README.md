# Malako Store

Tienda web estática de electrodomésticos. Catálogo con filtros, carrito persistente,
checkout como invitado por WhatsApp e ID de compra determinista de 16 dígitos. Sin
frameworks, sin librerías externas y sin llamadas `fetch`: solo HTML5, CSS3 y
JavaScript vanilla.

## Características

- Catálogo renderizado desde un array local con búsqueda, filtro por categoría y orden.
- Carrito lateral persistente en `localStorage` con control de cantidades y stock.
- Checkout como invitado, sin cuentas, registro ni inicio de sesión.
- Mensaje de WhatsApp con productos, cantidades, total, fecha exacta y datos del cliente.
- ID de compra numérico de 16 dígitos que puede recalcularse con los datos del pedido.
- Panel temporal `admin/` para editar el catálogo, descargar un nuevo `db.js` y verificar IDs.
- Aviso pequeño “Modo admin activado” cuando la carpeta `admin/` está presente.
- Diseño responsivo, accesible con teclado y sin dependencias externas; solo usa
  WhatsApp al finalizar y un sondeo local para el aviso de admin.

## Estructura

```text
.
├── index.html          Catálogo, carrito y modales de checkout
├── style.css           Estilos de la tienda
├── db.js               Productos (const PRODUCTOS + window.PRODUCTOS)
├── order-id.js         Generador y verificador compartido del ID de compra
├── admin-warning.js    Detector y cierre del aviso de modo admin
├── app.js              Lógica de catálogo, carrito y checkout
├── favicon.svg
├── .nojekyll
├── README.md
├── DOCS.md             Documentación técnica y de ampliaciones
├── PLAN.md             Plan de implementación
├── assets/img/         producto1.jpg … producto8.jpg
└── admin/
    ├── index.html      Panel temporal y verificador
    ├── admin.js        Lógica del panel
    └── admin-mode.js   Marcador que activa el aviso en la tienda
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

La moneda no cambia el algoritmo del ID: el importe siempre se guarda internamente
en céntimos.

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
3. La tienda calcula el ID de compra, arma el resumen y abre:

```text
https://wa.me/<WHATSAPP_NUMBER>?text=<mensaje%20codificado>
```

4. El cliente envía el mensaje desde su WhatsApp. El pago (Yape, Plin,
   transferencia o contra entrega) y la entrega se coordinan en el chat.

No hay pasarela de pago ni procesamiento de tarjetas. El carrito se vacía después
de generar el pedido y se muestra un modal con el enlace de respaldo y la opción
de copiar el resumen.

El mensaje incluye una línea como esta:

```text
*Fecha:* 01/11/2026 15:30:00 (America/Lima)
```

Conserva ese mensaje: la fecha y hora exactas son necesarias para recalcular el ID.

## ID de compra

El ID tiene **16 dígitos** y no es aleatorio:

```text
0003346156707567
└──────┘└──────┘
importe  cliente
```

- **Importe (8 dígitos):** céntimos del pedido ofuscados con `XOR 0xA5A5`. Admite
  desde `S/ 0.01` hasta `S/ 999,999.99`.
- **Cliente (8 dígitos):** FNV-1a de 64 bits sobre
  `NOMBRE|TELEFONO|FECHA_HORA|CENTIMOS`, reducido a 8 dígitos.
- **Fecha/hora:** zona `America/Lima`, con segundos, en formato canónico
  `YYYY-MM-DDTHH:mm:ss`.
- **Normalización:** nombre en mayúsculas, sin tildes y con espacios simples;
  teléfono solo con dígitos.

Ejemplo verificable:

| Dato | Valor |
|---|---|
| Nombre | `Omar Castillo` |
| Teléfono | `987654321` |
| Fecha y hora | `01/11/2026 15:30:00` America/Lima |
| Monto | `S/ 100.00` |
| Entrada del hash | `OMAR CASTILLO|987654321|2026-11-01T15:30:00-05:00|10000` |
| ID | `0003346156707567` |

El importe puede recuperarse del ID. El nombre y el teléfono no se pueden
reconstruir desde el ID: para verificarlo hay que conocer los datos originales.

Sin base de datos no hay búsqueda de pedidos ni unicidad matemática garantizada.
Dos pedidos con el mismo nombre, teléfono, monto y segundo exacto producen el mismo
ID. El ID es una referencia de compra, no una prueba de pago ni un mecanismo de
seguridad.

## Datos locales

Claves utilizadas en `localStorage`:

| Clave | Contenido |
|---|---|
| `malako_cart` | Carrito actual |
| `malako_admin_products` | Borrador del panel administrativo |

El cierre del aviso de admin se guarda en `sessionStorage` bajo
`malako_admin_notice_dismissed` y dura solo la pestaña actual.

Las claves antiguas `malako_users` y `malako_session` ya no se usan. Puedes
eliminarlas manualmente desde DevTools → Application → Local Storage.

Para reiniciar la tienda en un navegador:

```js
localStorage.removeItem('malako_cart');
localStorage.removeItem('malako_admin_products');
localStorage.removeItem('malako_users');
localStorage.removeItem('malako_session');
sessionStorage.removeItem('malako_admin_notice_dismissed');
```

## Aviso de modo admin

Mientras exista `admin/admin-mode.js`, la tienda muestra una banda pequeña debajo
del header con el texto **“Modo admin activado”**. El aviso no menciona la carpeta
ni enlaza al panel.

- Se puede cerrar con el botón de la derecha.
- El cierre se recuerda solo en la pestaña actual (`sessionStorage`).
- Al abrir una pestaña o sesión nueva, vuelve a aparecer si `admin/` sigue presente.
- Al eliminar la carpeta `admin/`, el aviso deja de mostrarse.

El marcador `admin/admin-mode.js` es necesario porque un sitio estático no puede
consultar directamente si existe una carpeta.

## Panel administrativo

1. Abre `admin/index.html` en el navegador.
2. Añade o elimina productos. Los cambios quedan como borrador local.
3. Pulsa **Descargar db.js**.
4. Reemplaza el `db.js` de la raíz con el archivo descargado.
5. Recarga la tienda.

El panel también incluye **Verificar ID de compra**. Introduce nombre, teléfono,
fecha, hora exacta y monto para recalcular el ID. Si pegas el ID del pedido, el
panel indica si coincide. El verificador no guarda datos ni busca pedidos.

El panel no escribe archivos por sí solo: la descarga es manual por seguridad y
porque un sitio estático no puede modificar el servidor.

**Importante:** elimina la carpeta `admin/` antes de publicar el sitio. No tiene
login ni enlace desde la tienda, pero GitHub Pages hace público todo el contenido
del repositorio, incluido el panel.

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
- **No aparece “Modo admin activado”:** confirma que existe `admin/admin-mode.js`
  y que `admin-warning.js` se carga antes que `app.js`. Si cerraste el aviso en esa
  pestaña, se recordará hasta cerrarla.
- **El ID no se genera:** confirma que `order-id.js` se carga antes de `app.js` y
  que el monto no supera `S/ 999,999.99`.
- **Un ID no coincide:** revisa nombre, teléfono, fecha, hora con segundos y monto.
  Una diferencia de un segundo o de un céntimo cambia el resultado.
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
algoritmo del ID, recetas de ampliación, roadmap, convenciones y checklist de QA.

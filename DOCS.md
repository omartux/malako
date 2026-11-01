# Documentación técnica — Malako Store

Documento de referencia para mantener y ampliar la tienda. Describe la
arquitectura actual, el modelo de datos, el ID de compra y las recetas más
habituales.

## 1. Resumen

Malako Store es un sitio estático de una sola página. El catálogo vive en un array
de JavaScript (`db.js`), la interfaz se renderiza en el cliente (`app.js`) y la
compra se cierra fuera del sitio, en WhatsApp. No hay backend, base de datos,
pasarela de pago, cuentas de cliente, build step ni dependencias externas.

| Aspecto | Implementación |
|---|---|
| Lenguajes | HTML5, CSS3, JavaScript ES6+ |
| Renderizado | Cliente, con `innerHTML` y plantillas de string |
| Persistencia | `localStorage` para carrito/borrador; `sessionStorage` para el aviso de admin |
| Red | Solo `https://wa.me` al finalizar y el sondeo local `admin/admin-mode.js` |
| Dependencias | Ninguna |
| Autenticación | No hay cuentas de cliente |
| ID de compra | 16 dígitos deterministas; módulo compartido `order-id.js` |
| Hosting previsto | GitHub Pages (rama `main`, raíz) |
| Pago | Coordinado por WhatsApp (Yape, Plin, transferencia, contra entrega) |

## 2. Restricciones de diseño

Estas condiciones guían las decisiones y deben respetarse al ampliar:

1. Sin frameworks ni librerías externas.
2. Sin `fetch` ni peticiones asíncronas a servicios externos.
3. Imágenes locales en `assets/img/`.
4. Checkout como invitado; no hay registro, login ni sesión.
5. El carrito y el borrador del admin viven en `localStorage`.
6. Checkout mediante enlace `wa.me` con mensaje prellenado.
7. Un panel `admin/` temporal que se elimina antes de publicar.
8. El ID de compra debe poder recalcularse con los datos del pedido.
9. El aviso de admin se detecta con un archivo marcador; un sitio estático no puede
   consultar directorios directamente.

## 3. Arquitectura

```text
db.js ─────────────► window.PRODUCTOS
                              │
                              ▼
order-id.js ──────► window.MalakoOrderId
                              │
                              ▼
app.js ──► Catalog ──► Cart ──► Checkout ──► wa.me
             │           │          │
             ▼           ▼          ▼
            UI ◄──── localStorage  OrderId
             │
             ▼
            DOM
```

### Orden de carga

`index.html` carga con `defer`:

```html
<script src="order-id.js" defer></script>
<script src="admin-warning.js" defer></script>
<script src="db.js" defer></script>
<script src="app.js" defer></script>
```

`admin/index.html` carga el mismo módulo antes de sus scripts:

```html
<script src="../order-id.js" defer></script>
<script src="../db.js" defer></script>
<script src="admin.js" defer></script>
```

`db.js` define `const PRODUCTOS` y lo expone como `window.PRODUCTOS`.
`order-id.js` expone `window.MalakoOrderId`. `admin-warning.js` detecta el
marcador `admin/admin-mode.js` y gestiona el aviso de modo admin. `app.js` se
ejecuta como IIFE, crea los módulos y llama a `App.init()` cuando el DOM está
listo. `defer` garantiza el orden y evita bloqueos de renderizado. No se usan
módulos ES para que el sitio funcione también con `file://`.

### Organización de `app.js`

Todo el archivo está dentro de `(function (global) { ... })(window)`. Los módulos
se comunican por referencias directas:

- `Utils`: formato, escape, normalización y localStorage.
- `Catalog`: acceso de solo lectura al array de productos.
- `Cart`: estado del carrito y suscripciones.
- `Checkout`: construcción del ID, la URL y el mensaje de WhatsApp.
- `UI`: DOM, eventos, modales, renderizado y formularios.
- `App`: arranque.

Al final se expone `window.Malako` para depuración y para futuras ampliaciones.
El generador de ID se expone aparte como `window.MalakoOrderId` porque también lo
usa el panel administrativo.

## 4. Estructura de archivos

```text
index.html              Estructura de la tienda y modales
style.css               Estilos, variables y breakpoints
db.js                   Datos del catálogo
order-id.js             Generador y verificador compartido del ID
admin-warning.js        Detector y cierre del aviso de modo admin
app.js                  Lógica de la tienda
favicon.svg             Icono
.nojekyll               Desactiva Jekyll en GitHub Pages
admin/index.html        Interfaz del editor y verificador temporal
admin/admin.js          Lógica del editor, verificador y descarga de db.js
admin/admin-mode.js     Marcador de presencia del panel admin
assets/img/             Imágenes locales de productos
README.md               Guía de uso y despliegue
DOCS.md                 Este documento
PLAN.md                 Plan de implementación
```

## 5. Modelo de datos

### Producto

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | number o string | Sí | Identificador único |
| `nombre` | string | Sí | Nombre comercial |
| `precio` | number | Sí | Precio en soles, sin símbolo |
| `descripcion` | string | Sí | Texto corto para la tarjeta |
| `categoria` | string | Sí | Categoría usada por los filtros |
| `imagen` | string | Sí | Ruta local relativa, por ejemplo `assets/img/producto1.jpg` |
| `stock` | number | Sí | Unidades disponibles; `0` marca agotado |
| `destacado` | boolean | No | Ordena primero y muestra la etiqueta “Destacado” |

Ejemplo:

```js
{
  id: 9,
  nombre: 'Freidora de aire 5 L',
  precio: 349,
  descripcion: 'Cocción sin aceite, temporizador y canasta antiadherente.',
  categoria: 'Cocina',
  imagen: 'assets/img/producto9.jpg',
  stock: 10,
  destacado: true
}
```

Reglas actuales:

- Los IDs duplicados no se validan en la tienda; el panel administrativo evita
  crear duplicados solo por nombre, no por ID. Usa IDs únicos.
- `precio` se trata como número; no incluye IGV ni envío por separado.
- `stock` limita la cantidad agregada al carrito.
- Un producto sin `stock` se interpreta como `0` en la mayoría de los cálculos.
- Cualquier campo adicional se conserva al generar `db.js` desde el panel, pero
  la interfaz no lo usa.

### Categorías

Se derivan de los productos con `Catalog.categories()`. No hay lista fija: al
añadir un producto con una categoría nueva, el filtro aparece automáticamente.

## 6. Esquema de `localStorage`

| Clave | Tipo | Estructura | Uso |
|---|---|---|---|
| `malako_cart` | array | `[{ id, qty }]` | Carrito |
| `malako_admin_products` | array | Productos completos | Borrador del panel |

Notas:

- No hay claves de cuentas de usuario ni de sesión de cliente.
- Las claves antiguas `malako_users` y `malako_session` quedan sin uso; la tienda
  no las lee ni las borra automáticamente.
- Al cargar, el carrito se sanea: descarta IDs inexistentes, ajusta cantidades al
  stock y elimina productos agotados.
- Si `localStorage` está deshabilitado o lleno, las escrituras fallan de forma
  silenciosa; el carrito funciona solo en memoria hasta recargar.

### `sessionStorage`

| Clave | Tipo | Uso |
|---|---|---|
| `malako_admin_notice_dismissed` | string `"1"` | Recuerda que el aviso de admin se cerró en esta pestaña |

El cierre del aviso no se sincroniza entre pestañas ni sobrevive al cierre de la
pestaña.

## 7. ID de compra

El ID es un número de **16 dígitos** sin separadores:

```text
0003346156707567
└──────┘└──────┘
importe  cliente
```

Formato: 8 dígitos de importe + 8 dígitos de cliente.

### Constantes

| Constante | Valor | Uso |
|---|---|---|
| `TIME_ZONE` | `America/Lima` | Zona horaria de la fecha del pedido |
| `TIME_OFFSET` | `-05:00` | Offset fijo usado en el hash y al mostrar |
| `AMOUNT_KEY` | `0xA5A5` | Clave XOR del importe |
| `AMOUNT_DIGITS` | `8` | Longitud del bloque de importe |
| `CUSTOMER_DIGITS` | `8` | Longitud del bloque de cliente |
| `ID_LENGTH` | `16` | Longitud total |
| `HASH_MOD` | `100000000n` | Módulo del hash de cliente |
| `MAX_CENTS` | `99999999` | Máximo `S/ 999,999.99` |

### Importe

```js
token = String((cents ^ 0xA5A5) >>> 0).padStart(8, '0');
```

El importe debe estar entre `1` y `99999999` céntimos. El primer bloque se puede
decodificar sin conocer al cliente:

```js
cents = (parseInt(id.slice(0, 8), 10) ^ 0xA5A5) >>> 0;
```

### Cliente

1. Normalizar el nombre: `NFD`, quitar diacríticos, mayúsculas, espacios simples.
2. Normalizar el teléfono: dejar solo dígitos.
3. Convertir la fecha/hora de Lima a `YYYY-MM-DDTHH:mm:ss`.
4. Construir la entrada:

```text
NOMBRE|TELEFONO|YYYY-MM-DDTHH:mm:ss-05:00|CENTIMOS
```

5. Calcular FNV-1a de 64 bits.
6. Reducir con `mod 100000000` y rellenar a 8 dígitos.

### Ejemplo

| Dato | Valor |
|---|---|
| Nombre | `Omar Castillo` |
| Teléfono | `987654321` |
| Fecha/hora | `01/11/2026 15:30:00` America/Lima |
| Monto | `S/ 100.00` |
| Entrada | `OMAR CASTILLO|987654321|2026-11-01T15:30:00-05:00|10000` |
| Token importe | `00033461` |
| Token cliente | `56707567` |
| ID | `0003346156707567` |

### Recuperación y límites

- Con nombre, teléfono, fecha/hora exacta y monto se recalcula el ID.
- El importe se decodifica del primer bloque.
- El nombre y el teléfono no se pueden reconstruir desde el ID.
- Sin base de datos no hay búsqueda por ID ni unicidad matemática garantizada.
- Dos pedidos con el mismo nombre, teléfono, monto y segundo producen el mismo ID.
- El ID es una referencia de compra, no una prueba de pago ni un control de acceso.
- El algoritmo es público; no debe usarse para proteger información sensible.

## 8. API interna

### `Malako.CONFIG`

Objeto congelado:

| Propiedad | Valor por defecto | Descripción |
|---|---|---|
| `STORE_NAME` | `Malako Store` | Nombre usado en mensajes y UI |
| `WHATSAPP_NUMBER` | `51999999999` | Destino de los pedidos; solo dígitos |
| `CURRENCY` | `PEN` | Código ISO de moneda |
| `LOCALE` | `es-PE` | Locale de formato |
| `STORAGE.cart` | `malako_cart` | Clave del carrito |

### `Malako.Utils`

| Método | Retorno | Uso |
|---|---|---|
| `money(value)` | string | Formatea con `Intl.NumberFormat` |
| `escapeHTML(value)` | string | Escapa `& < > " '` |
| `normalize(value)` | string | Minúsculas sin acentos para búsqueda |
| `debounce(fn, ms)` | función | Retrasa la búsqueda |
| `readJSON(key, fallback)` | any | Lee y parsea con manejo de errores |
| `writeJSON(key, value)` | boolean | Escribe JSON |

### `Malako.Catalog`

| Método | Retorno |
|---|---|
| `all()` | array de productos o `[]` |
| `byId(id)` | producto o `null` |
| `categories()` | array de categorías únicas |

### `Malako.Cart`

| Método | Retorno | Descripción |
|---|---|---|
| `detail()` | `{ lines, count, subtotal }` | Estado calculado con nombres y precios actuales |
| `subscribe(listener)` | función | Suscribe a cambios y devuelve un unsubscribe |
| `add(id, qty)` | `{ ok, product }` o `{ ok: false, error }` | Valida stock |
| `setQty(id, qty)` | `{ ok }` o `{ ok: false, error }` | Ajusta cantidad; `qty < 1` elimina |
| `remove(id)` | `undefined` | Elimina una línea |
| `clear()` | `undefined` | Vacía el carrito |

`detail().lines` contiene `{ product, qty, lineTotal }`. `subtotal` es la suma de
`lineTotal` en soles. No se aplican impuestos ni envío.

### `Malako.Checkout`

| Método | Retorno | Descripción |
|---|---|---|
| `buildUrl(text)` | string | URL `wa.me` con el texto codificado |
| `buildMessage(customer, detail)` | `{ ok: true, code, display, text, url }` o `{ ok: false, error }` | Genera ID y resumen |
| `launch(url)` | `undefined` | Abre el enlace en una pestaña nueva |

`customer` esperado:

```js
{
  nombre: 'María López',
  telefono: '987654321',
  entrega: 'Delivery a domicilio',
  direccion: 'Av. Ejemplo 123',
  metodo: 'Yape',
  notas: 'Entregar por la tarde'
}
```

`code` es el ID de 16 dígitos; `display` es la fecha/hora usada en el mensaje.

### `MalakoOrderId`

Módulo global compartido por tienda y admin.

| Miembro | Retorno | Uso |
|---|---|---|
| `TIME_ZONE` | string | `America/Lima` |
| `TIME_OFFSET` | string | `-05:00` |
| `ID_LENGTH` | number | `16` |
| `MAX_CENTS` | number | `99999999` |
| `normalizeName(value)` | string | Normaliza nombre |
| `normalizePhone(value)` | string | Deja solo dígitos |
| `toCents(value)` | number o `NaN` | Convierte soles a céntimos |
| `canonicalDateTime(date)` | string o `null` | Fecha/hora de Lima |
| `displayDateTime(date)` | string | Fecha/hora legible |
| `canonicalFromInputs(date, time)` | string o `null` | Valida campos `date` y `time` |
| `amountToken(cents)` | string o `null` | Bloque de importe |
| `decodeAmountToken(token)` | number o `null` | Céntimos desde 8 dígitos |
| `customerToken(data)` | string | Bloque de cliente |
| `build(data)` | objeto `{ ok, id, amountToken, customerToken, cents, canonical, display }` o `{ ok:false, error }` | Genera el ID |
| `isValidId(value)` | boolean | Valida 16 dígitos |
| `decodeAmount(id)` | number o `null` | Céntimos desde el ID completo |

`build()` acepta `{ nombre, telefono, monto, fecha }` o `{ nombre, telefono, cents,
canonical }`. `monto` está en soles; `cents` es un entero.

### `Malako.UI`

| Método | Descripción |
|---|---|
| `init()` | Cachea elementos, conecta eventos y hace el primer render |
| `toast(message, type)` | Muestra una notificación (`success`, `error`, `info`) |
| `openDialog(element)` | Abre un modal o drawer y gestiona el foco |
| `openCheckout()` | Abre el checkout si el carrito tiene líneas |
| `renderCatalog()` | Vuelve a renderizar el catálogo con el estado actual |
| `renderCart(snapshot)` | Renderiza el carrito con un snapshot opcional |

### `Malako.App`

| Método | Descripción |
|---|---|
| `init()` | Arranque manual; `app.js` lo llama automáticamente |

## 9. Flujos principales

### Renderizado del catálogo

1. `UI.init()` cachea los elementos y arma filtros y catálogo.
2. `filteredProducts()` aplica categoría, búsqueda normalizada y orden.
3. `cardTemplate()` genera cada tarjeta con `escapeHTML`.
4. Delegación de eventos en `#product-grid` detecta `data-add`.
5. `Cart.add()` valida stock, persiste y notifica a los suscriptores.

### Carrito

- El drawer se abre con `#cart-btn` y se cierra con botón, overlay o `Escape`.
- Los cambios en `localStorage` se reflejan en el badge y el subtotal.
- El botón de checkout se deshabilita con el carrito vacío.
- Al finalizar, el carrito se vacía después de construir el mensaje.

### Checkout

1. `#cart-checkout` cierra el drawer y abre `#checkout-modal`.
2. Se renderiza el resumen y se comprueban los campos nativos (`required`,
   `minlength`) y las reglas del formulario.
3. Se valida el teléfono y la dirección (excepto recojo en tienda).
4. `Checkout.buildMessage()` llama a `MalakoOrderId.build()` con nombre, teléfono,
   monto y fecha actual.
5. El mensaje incluye ID, fecha exacta, productos, total, entrega, pago y cliente.
6. `Checkout.launch()` abre `wa.me` mediante un `<a target="_blank">` sintético.
7. Se abre `#wa-modal` con el enlace de respaldo y la opción de copiar.
8. El carrito se vacía y se muestra un toast.

Si `order-id.js` no está disponible o el monto supera el máximo, el checkout
muestra un error y no abre WhatsApp ni vacía el carrito.

### Verificación en el admin

1. El vendedor abre `admin/index.html`.
2. Introduce nombre, teléfono, fecha, hora con segundos y monto.
3. Pega opcionalmente el ID del pedido.
4. El panel llama a `MalakoOrderId.build()` con el mismo algoritmo.
5. Muestra el ID calculado, el importe decodificado y si coincide.
6. No guarda datos ni modifica el borrador del catálogo.

### Aviso de modo admin

1. `index.html` incluye el aviso oculto y carga `admin-warning.js`.
2. El script comprueba `sessionStorage`; si el aviso ya se cerró en esta pestaña,
   termina sin hacer el sondeo.
3. Si no se cerró, inyecta `admin/admin-mode.js` como script.
4. Si el marcador carga y define `window.MALAKO_ADMIN_PRESENT = true`, se muestra
   la banda “Modo admin activado”.
5. Si el marcador no existe o falla, el aviso permanece oculto.
6. El botón de cierre guarda la decisión en `sessionStorage` y oculta la banda.

No se muestra ningún enlace al panel ni el texto “carpeta admin”. El aviso solo
comunica que el modo administrador está activo.

## 10. Recetas de ampliación

### 10.1 Añadir o editar productos

Con el panel:

1. Abre `admin/index.html`.
2. Completa el formulario y pulsa **Agregar producto**.
3. Pulsa **Descargar db.js**.
4. Reemplaza `db.js` en la raíz.

Manualmente: añade un objeto al array de `db.js` con un `id` único. Para editar,
modifica el objeto correspondiente. No cambies la estructura ni el nombre
`PRODUCTOS` sin actualizar `app.js`.

### 10.2 Añadir imágenes

1. Copia el archivo a `assets/img/` con un nombre sin espacios, por ejemplo
   `freidora-5l.jpg`.
2. Usa una imagen 4:3 (800 × 600 px recomendado).
3. Referénciala como `assets/img/freidora-5l.jpg`.
4. Mantén minúsculas y guiones para evitar problemas en GitHub Pages.

Si una imagen falla, `app.js` aplica un SVG local embebido como respaldo. No
requiere red.

### 10.3 Crear una categoría nueva

Asigna el nuevo valor en `categoria`. El filtro se genera solo. Si quieres un
orden concreto de categorías, cambia `Catalog.categories()` o define una lista
constante:

```js
const CATEGORIAS = ['Refrigeración', 'Cocina', 'Lavandería', 'Climatización'];
```

### 10.4 Cambiar el mensaje de WhatsApp

Edita `Checkout.buildMessage()` en `app.js`. Mantén la línea de fecha con segundos
si quieres que el ID siga siendo verificable. El texto se envía como una sola
cadena; `\n` se convierte en salto de línea al codificar.

Reglas de `wa.me`:

- Número solo con dígitos, código de país incluido.
- Sin `+`, espacios, paréntesis ni ceros iniciales.
- El texto debe pasar por `encodeURIComponent`.
- Los asteriscos `*texto*` se muestran en negrita en WhatsApp.
- Un enlace abre el chat con el mensaje escrito, pero no lo envía.

### 10.5 Añadir un campo al checkout

1. Añade el campo en `#checkout-form` de `index.html` con un `id`.
2. Añádelo a `ELEMENT_IDS` y a `customer` en `bindCheckout()`.
3. Inclúyelo en `Checkout.buildMessage()`.
4. Si es obligatorio, usa `required` y valídalo con `checkValidity()`.
5. Documenta el nuevo campo en este archivo.

No añadas campos al ID sin actualizar `order-id.js`: el hash usa exactamente
nombre, teléfono, fecha/hora y céntimos.

### 10.6 Añadir un método de pago o entrega

Los métodos son opciones de un `<select>`. Para agregar uno:

```html
<option value="Tarjeta en tienda">Tarjeta en tienda</option>
```

El valor viaja automáticamente al mensaje. Actualiza también la lista informativa
de `#checkout-modal` y la sección de beneficios si corresponde. No agregues una
pasarela real sin backend.

### 10.7 Cupones o descuentos

No hay sistema de cupones. Implementación mínima:

1. Añade un campo de cupón y un botón “Aplicar” en el carrito.
2. Guarda el descuento en `Cart` (por ejemplo, `{ code, percent }`) y expón una
   función `applyCoupon(code)`.
3. Calcula `discount` y `total` en `Cart.detail()`.
4. Envía el descuento y el total final en `Checkout.buildMessage()`.
5. Persiste el cupón si debe sobrevivir a la recarga.

El ID usa el `subtotal` del momento. Si el total final cambia por un descuento,
decide explícitamente si el ID debe codificar el subtotal o el total y actualiza
la documentación y el verificador.

### 10.8 Envío o delivery con costo

Actualmente el subtotal es el total. Para añadir envío:

1. Define zonas y tarifas en `CONFIG` o en un array local.
2. Pide distrito o zona en el checkout.
3. Calcula `shipping` en `buildMessage()` (o en `Cart.detail()` si afecta la UI).
4. Muestra “Envío” y “Total” por separado.
5. Mantén el texto “envío a coordinar” si la tarifa no es fija.

Si el ID debe cubrir el total con envío, pasa ese total a `MalakoOrderId.build()`
y documenta el cambio.

### 10.9 Galería de imágenes

Cambia `imagen` por `imagenes: []` y actualiza:

- `cardTemplate()` para la imagen principal.
- Un nuevo modal de detalle con miniaturas.
- `cartLineTemplate()` para usar `imagenes[0]`.
- El panel `admin.js` para aceptar varias rutas separadas por comas.

Conserva `imagen` como campo compatible si tienes datos existentes.

### 10.10 Cambiar moneda o idioma

Para moneda, ajusta `CURRENCY` y `LOCALE` en `CONFIG`; `Utils.money()` y el panel
administrativo usan `Intl.NumberFormat`. Recuerda que los precios de `db.js` deben
estar en la nueva moneda.

Para idioma, extrae los textos visibles a un objeto de traducciones y añade un
selector. Hoy los textos están en HTML y en `app.js`; es una refactorización
mediana, no un cambio de configuración.

### 10.11 Mejorar el panel administrativo

Ideas de bajo riesgo:

- Botón “Editar” que rellene el formulario y actualice en lugar de añadir.
- Importar un `db.js` o JSON existente con `FileReader`.
- Exportar copia de seguridad en JSON.
- Validar IDs duplicados y campos vacíos con más detalle.
- Vista previa de la tarjeta completa.
- Ordenar la tabla por columna.
- Historial local de IDs verificados, sin datos personales.

No añadas subida de imágenes sin backend: un sitio estático no puede escribir en
`assets/img/`. El flujo actual es copiar la imagen manualmente y descargar `db.js`.

### 10.12 Backend real

La interfaz está separada de los datos, lo que facilita migrar:

1. Sustituye `Catalog.all()` por datos de una API o base de datos.
2. Mantén la forma del producto para no tocar las plantillas.
3. Mueve el carrito y el stock a servidor para evitar condiciones de carrera.
4. Registra pedidos en una tabla antes de redirigir a WhatsApp.
5. Añade validación y autorización en el servidor; nunca confíes en el cliente.
6. Si usas un backend, puedes mantener el checkout por WhatsApp como confirmación.

Si migras el ID a servidor, conserva el mismo algoritmo o versiona el formato para
no invalidar pedidos históricos.

### 10.13 SEO y analítica

El catálogo se renderiza con JavaScript, por lo que los bots deben ejecutar JS. Para
mejorar:

- Añade contenido estático en el HTML (textos, categorías, preguntas frecuentes).
- Usa metadatos `description`, Open Graph y Twitter Card.
- Añade datos estructurados `Product` y `Store` en JSON-LD.
- Genera una página por producto si necesitas indexación fuerte.
- Si agregas analítica, revisa la privacidad y las restricciones de red del proyecto.

## 11. Convenciones

- JavaScript vanilla ES6+, sin transpilación.
- Módulos como IIFEs y namespace único `window.Malako`.
- El ID compartido vive en `window.MalakoOrderId`, fuera de `Malako`, para poder
  cargarlo también en el admin sin inicializar la tienda.
- Nombres de variables y funciones en español; clases CSS descriptivas.
- Escapar siempre datos dinámicos con `Utils.escapeHTML()` antes de `innerHTML`.
- Precios como números; formatear solo al mostrar.
- Rutas de imágenes relativas a la raíz y en minúsculas.
- Eventos delegados en contenedores estables (`#product-grid`, `#cart-items`).
- `localStorage` siempre con prefijo `malako_` y lectura tolerante a errores.
- Mantener el sitio funcional sin servicios externos; solo se permite `wa.me` al
  finalizar y el sondeo local del aviso de admin.
- Actualizar `README.md` y `DOCS.md` cuando cambie la configuración o la API.

## 12. Checklist de QA manual

### Catálogo

- [ ] Se muestran todos los productos de `db.js`.
- [ ] Búsqueda por nombre, descripción y categoría, con y sin tildes.
- [ ] Filtros de categoría y orden por precio/nombre.
- [ ] Estado vacío al buscar algo inexistente y botón “Limpiar filtros”.
- [ ] Producto con `stock: 0` aparece agotado y sin botón activo.
- [ ] Imagen faltante muestra el respaldo local.

### Carrito y checkout

- [ ] Agregar, sumar, restar y eliminar líneas.
- [ ] No se supera el stock disponible.
- [ ] Badge y subtotal coinciden.
- [ ] Persistencia tras recargar.
- [ ] Drawer se cierra con botón, overlay y `Escape`.
- [ ] Carrito vacío deshabilita el checkout.
- [ ] Validación de nombre, teléfono y dirección.
- [ ] Recojo en tienda oculta y desactiva la dirección.
- [ ] No existe botón, modal ni menú de cuenta.
- [ ] El mensaje incluye ID de 16 dígitos y fecha con segundos.
- [ ] El ID codifica el total en céntimos.
- [ ] El enlace `wa.me` usa el número configurado y el texto codificado.
- [ ] El modal de respaldo permite abrir WhatsApp y copiar el resumen.
- [ ] El carrito queda vacío después de generar el pedido.

### ID de compra

- [ ] `MalakoOrderId.build()` devuelve el ejemplo documentado.
- [ ] El ID tiene exactamente 16 dígitos.
- [ ] `decodeAmount()` recupera el importe esperado.
- [ ] Un cambio de un segundo altera el bloque de cliente.
- [ ] Un cambio de un céntimo altera el bloque de importe.
- [ ] El monto máximo `S/ 999,999.99` funciona.
- [ ] Un monto superior se rechaza sin romper la página.
- [ ] La fecha se interpreta en `America/Lima`.

### Aviso de modo admin

- [ ] Con `admin/admin-mode.js` presente, aparece “Modo admin activado”.
- [ ] El aviso no menciona la carpeta ni enlaza al panel.
- [ ] El botón de cierre oculta la banda.
- [ ] Tras cerrar y recargar, no reaparece en la misma pestaña.
- [ ] En una pestaña nueva vuelve a aparecer.
- [ ] Sin el marcador, el aviso permanece oculto.
- [ ] El cierre no añade claves a `localStorage`.

### Panel admin

- [ ] Carga el catálogo desde `../db.js`.
- [ ] Alta con validaciones y vista previa de imagen.
- [ ] Eliminación con confirmación.
- [ ] Borrador restaurado tras recargar.
- [ ] Restablecer recupera el catálogo original.
- [ ] Descarga un `db.js` sintácticamente válido.
- [ ] El archivo descargado funciona al reemplazar el de la raíz.
- [ ] El verificador recalcula el ejemplo y marca “Coincide”.
- [ ] Un ID incorrecto marca “No coincide”.
- [ ] El verificador no añade claves a `localStorage`.

### Responsive y accesibilidad

- [ ] 360, 414, 768, 1024, 1440 px sin desbordes horizontales.
- [ ] Navegación completa con teclado y foco visible.
- [ ] `Escape` cierra modales y el foco regresa al disparador.
- [ ] Contraste suficiente y textos alternativos en imágenes de producto.
- [ ] `prefers-reduced-motion` desactiva animaciones.

## 13. Limitaciones conocidas

- **Cuentas:** no existen. El admin se protege solo eliminando la carpeta del
  repositorio público.
- **Seguridad:** cualquier persona con acceso al navegador puede leer el carrito y
  el borrador local. No hay datos de pago ni contraseñas.
- **Alcance de datos:** `localStorage` es por navegador y dispositivo; no se
  sincroniza ni se comparte entre usuarios.
- **Stock:** se valida solo en el cliente. Dos personas pueden comprar la última
  unidad; no hay reservas.
- **Pedidos:** no se guardan en el sitio. El único registro es el chat de WhatsApp.
- **ID:** es una referencia determinista, no una prueba de pago; puede colisionar y
  no permite recuperar nombre o teléfono.
- **Pago:** no se procesa ningún pago en línea.
- **Admin:** no edita archivos directamente; requiere descargar y reemplazar. No
  sube imágenes. Si se publica, queda accesible públicamente.
- **Detección de admin:** depende de `admin/admin-mode.js`; si la carpeta existe
  pero falta el marcador, no se muestra el aviso. Al eliminar `admin/`, el sondeo
  falla y la interfaz oculta el aviso, aunque el navegador puede registrar un 404
  de red en la consola.
- **Catálogo:** renderizado en cliente; el HTML inicial no contiene los productos.
- **WhatsApp:** el usuario debe pulsar “Enviar”; el enlace solo prellena el mensaje.
  Un número inválido o sin WhatsApp no abrirá el chat correcto.
- **Imágenes:** los JPG incluidos son marcadores generados localmente.
- **Sin tests automatizados en el repositorio:** la verificación es manual o con
  scripts CDP externos.

## 14. Roadmap sugerido

### Corto plazo

1. Reemplazar el número de WhatsApp y las imágenes de ejemplo.
2. Editar productos desde el panel (no solo añadir/eliminar).
3. Copia de seguridad/importación del catálogo en JSON.
4. Revisar textos legales, garantía y horarios.
5. Pruebas en móviles reales.

### Mediano plazo

1. Modal de detalle de producto y galería.
2. Cupones y costos de envío por zona.
3. Búsqueda con sugerencias y orden persistente.
4. Exportación de pedidos a un archivo local antes de WhatsApp.
5. Modo oscuro y mejoras de accesibilidad.
6. Datos estructurados y metadatos sociales.
7. Historial local del verificador sin datos personales.

### Largo plazo

1. Backend con base de datos, stock real y panel autenticado.
2. Registro de pedidos y estados de entrega.
3. Notificaciones por correo o WhatsApp Business API.
4. PWA instalable con caché de imágenes.
5. Analítica y optimización de conversión con consentimiento.
6. Verificación del ID en servidor con registro de pedidos.

## 15. Mantenimiento

Antes de cada publicación:

1. Actualiza `WHATSAPP_NUMBER`, precios y stock.
2. Verifica que no existan rutas absolutas ni imágenes externas.
3. Comprueba que no haya `fetch`, CDNs ni dependencias nuevas.
4. Ejecuta el checklist de QA.
5. Elimina `admin/` del repositorio público.
6. Publica y prueba el enlace de WhatsApp desde un teléfono real.
7. Verifica un ID real de extremo a extremo con el panel local.

Para depurar, abre la consola y usa:

```js
Malako.Cart.detail()
Malako.Catalog.all()
Malako.CONFIG
MalakoOrderId.build({ nombre: 'Omar Castillo', telefono: '987654321', monto: 100, canonical: '2026-11-01T15:30:00' })
```

No expongas datos de clientes en la consola ni en el repositorio.

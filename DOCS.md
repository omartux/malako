# Documentación técnica — Malako Store

Documento de referencia para mantener y ampliar la tienda. Describe la
arquitectura actual, el modelo de datos, la API interna y recetas concretas para
las mejoras más habituales.

## 1. Resumen

Malako Store es un sitio estático de una sola página. El catálogo vive en un array
de JavaScript (`db.js`), la interfaz se renderiza en el cliente (`app.js`) y la
compra se cierra fuera del sitio, en WhatsApp. No hay backend, base de datos,
pasarela de pago, build step ni dependencias externas.

| Aspecto | Implementación |
|---|---|
| Lenguajes | HTML5, CSS3, JavaScript ES6+ |
| Renderizado | Cliente, con `innerHTML` y plantillas de string |
| Persistencia | `localStorage` |
| Red | Solo `https://wa.me` al finalizar la compra |
| Dependencias | Ninguna |
| Autenticación | Demo local, hash djb2 con sal fija |
| Hosting previsto | GitHub Pages (rama `main`, raíz) |
| Pago | Coordinado por WhatsApp (Yape, Plin, transferencia, contra entrega) |

## 2. Restricciones de diseño

Estas condiciones guían las decisiones y deben respetarse al ampliar:

1. Sin frameworks ni librerías externas.
2. Sin `fetch` ni peticiones asíncronas a servicios externos.
3. Imágenes locales en `assets/img/`.
4. Usuarios y carrito en `localStorage`.
5. Checkout mediante enlace `wa.me` con mensaje prellenado.
6. Un panel `admin/` temporal que se elimina antes de publicar.

## 3. Arquitectura

```text
db.js  ──►  window.PRODUCTOS
                    │
                    ▼
app.js  ──►  Catalog ──► Cart ──► Checkout ──► wa.me
                │          │          │
                ▼          ▼          ▼
               UI ◄──── localStorage ◄── Auth
                │
                ▼
               DOM
```

### Orden de carga

`index.html` carga con `defer`:

```html
<script src="db.js" defer></script>
<script src="app.js" defer></script>
```

`db.js` define `const PRODUCTOS` y lo expone como `window.PRODUCTOS`. `app.js` se
ejecuta como IIFE, crea los módulos y llama a `App.init()` cuando el DOM está
listo. `defer` garantiza el orden y evita bloqueos de renderizado. No se usan
módulos ES para que el sitio funcione también al abrirlo con `file://`.

### Organización de `app.js`

Todo el archivo está dentro de `(function (global) { ... })(window)`. Los módulos
se comunican por referencias directas:

- `Utils`: formato, escape, normalización, localStorage y hash.
- `Catalog`: acceso de solo lectura al array de productos.
- `Auth`: cuentas y sesión.
- `Cart`: estado del carrito y suscripciones.
- `Checkout`: construcción de la URL y del mensaje de WhatsApp.
- `UI`: DOM, eventos, modales, renderizado y formularios.
- `App`: arranque.

Al final se expone `window.Malako` para depuración y para futuras ampliaciones.

## 4. Estructura de archivos

```text
index.html              Estructura de la tienda y modales
style.css               Estilos, variables y breakpoints
db.js                   Datos del catálogo
app.js                  Lógica de la tienda
favicon.svg             Icono
.nojekyll               Desactiva Jekyll en GitHub Pages
admin/index.html        Interfaz del editor temporal
admin/admin.js          Lógica del editor y descarga de db.js
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
| `malako_users` | array | `[{ id, nombre, email, password, creadoEn }]` | Cuentas registradas |
| `malako_session` | objeto o `null` | `{ id, nombre, email }` | Sesión activa |
| `malako_cart` | array | `[{ id, qty }]` | Carrito |
| `malako_admin_products` | array | Productos completos | Borrador del panel |

Notas:

- `password` guarda `h` + hash djb2 hexadecimal, no la contraseña original.
- El carrito no se separa por usuario: dos cuentas en el mismo navegador comparten
  el mismo carrito.
- Al cargar, el carrito se sanea: descarta IDs inexistentes, ajusta cantidades al
  stock y elimina productos agotados.
- Si `localStorage` está deshabilitado o lleno, las escrituras fallan de forma
  silenciosa; la sesión y el carrito funcionan solo en memoria hasta recargar.

## 7. API interna (`window.Malako`)

### `Malako.CONFIG`

Objeto congelado:

| Propiedad | Valor por defecto | Descripción |
|---|---|---|
| `STORE_NAME` | `Malako Store` | Nombre usado en mensajes y UI |
| `WHATSAPP_NUMBER` | `51999999999` | Destino de los pedidos; solo dígitos |
| `CURRENCY` | `PEN` | Código ISO de moneda |
| `LOCALE` | `es-PE` | Locale de formato |
| `STORAGE` | claves | Nombres de las claves de localStorage |

### `Malako.Utils`

| Método | Retorno | Uso |
|---|---|---|
| `money(value)` | string | Formatea con `Intl.NumberFormat` |
| `escapeHTML(value)` | string | Escapa `& < > " '` |
| `normalize(value)` | string | Minúsculas sin acentos para búsqueda |
| `debounce(fn, ms)` | función | Retrasa la búsqueda |
| `readJSON(key, fallback)` | any | Lee y parsea con manejo de errores |
| `writeJSON(key, value)` | boolean | Escribe JSON |
| `hashPassword(password)` | string | Hash no criptográfico con sal fija |
| `orderCode()` | string | Código tipo `MK-XXXXXX` |

### `Malako.Catalog`

| Método | Retorno |
|---|---|
| `all()` | array de productos o `[]` |
| `byId(id)` | producto o `null` |
| `categories()` | array de categorías únicas |

### `Malako.Auth`

| Método | Retorno |
|---|---|
| `currentUser()` | `{ id, nombre, email }` o `null` |
| `register({ nombre, email, password, confirm })` | `{ ok, user }` o `{ ok: false, error }` |
| `login(email, password)` | `{ ok, user }` o `{ ok: false, error }` |
| `logout()` | `undefined` |

Validaciones: nombre de 3 caracteres o más, correo con formato básico, contraseña
de 6 caracteres o más, confirmación igual y correo único.

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
`lineTotal`. No se aplican impuestos ni envío.

### `Malako.Checkout`

| Método | Retorno | Descripción |
|---|---|---|
| `buildUrl(text)` | string | URL `wa.me` con el texto codificado |
| `buildMessage(customer, detail)` | `{ code, text, url }` | Arma el resumen completo |
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

## 8. Flujos principales

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
4. `Checkout.buildMessage()` arma el texto con código de pedido y total.
5. `Checkout.launch()` abre `wa.me` mediante un `<a target="_blank">` sintético.
6. Se abre `#wa-modal` con el enlace de respaldo y la opción de copiar.
7. El carrito se vacía y se muestra un toast.

### Autenticación

- El botón de usuario abre el modal si no hay sesión, o el menú si la hay.
- Login y registro comparten el modal con pestañas.
- Al autenticarse se actualiza el header y se cierra el modal.
- El nombre de la sesión se usa para prellenar el checkout.
- Al cerrar sesión se limpia el nombre prellenado; el carrito se conserva.

## 9. Recetas de ampliación

### 9.1 Añadir o editar productos

Con el panel:

1. Abre `admin/index.html`.
2. Completa el formulario y pulsa **Agregar producto**.
3. Pulsa **Descargar db.js**.
4. Reemplaza `db.js` en la raíz.

Manualmente: añade un objeto al array de `db.js` con un `id` único. Para editar,
modifica el objeto correspondiente. No cambies la estructura ni el nombre
`PRODUCTOS` sin actualizar `app.js`.

### 9.2 Añadir imágenes

1. Copia el archivo a `assets/img/` con un nombre sin espacios, por ejemplo
   `freidora-5l.jpg`.
2. Usa una imagen 4:3 (800 × 600 px recomendado).
3. Referénciala como `assets/img/freidora-5l.jpg`.
4. Mantén minúsculas y guiones para evitar problemas en GitHub Pages.

Si una imagen falla, `app.js` aplica un SVG local embebido como respaldo. No
requiere red.

### 9.3 Crear una categoría nueva

Asigna el nuevo valor en `categoria`. El filtro se genera solo. Si quieres un
orden concreto de categorías, cambia `Catalog.categories()` o define una lista
constante:

```js
const CATEGORIAS = ['Refrigeración', 'Cocina', 'Lavandería', 'Climatización'];
```

### 9.4 Cambiar el mensaje de WhatsApp

Edita `Checkout.buildMessage()` en `app.js`. El texto se envía como una sola
cadena; `\n` se convierte en salto de línea al codificar.

Reglas de `wa.me`:

- Número solo con dígitos, código de país incluido.
- Sin `+`, espacios, paréntesis ni ceros iniciales.
- El texto debe pasar por `encodeURIComponent`.
- Los asteriscos `*texto*` se muestran en negrita en WhatsApp.
- Un enlace abre el chat con el mensaje escrito, pero no lo envía.

### 9.5 Añadir un campo al checkout

1. Añade el campo en `#checkout-form` de `index.html` con un `id`.
2. Añádelo a `ELEMENT_IDS` y a `customer` en `bindCheckout()`.
3. Inclúyelo en `Checkout.buildMessage()`.
4. Si es obligatorio, usa `required` y valídalo con `checkValidity()`.
5. Documenta el nuevo campo en este archivo.

### 9.6 Añadir un método de pago o entrega

Los métodos son opciones de un `<select>`. Para agregar uno:

```html
<option value="Tarjeta en tienda">Tarjeta en tienda</option>
```

El valor viaja automáticamente al mensaje. Actualiza también la lista informativa
de `#checkout-modal` y la sección de beneficios si corresponde. No agregues una
pasarela real sin backend.

### 9.7 Cupones o descuentos

No hay sistema de cupones. Implementación mínima:

1. Añade un campo de cupón y un botón “Aplicar” en el carrito.
2. Guarda el descuento en `Cart` (por ejemplo, `{ code, percent }`) y expón una
   función `applyCoupon(code)`.
3. Calcula `discount` y `total` en `Cart.detail()`.
4. Envía el descuento y el total final en `Checkout.buildMessage()`.
5. Persiste el cupón si debe sobrevivir a la recarga.

Valida los cupones en el cliente solo como demo: cualquiera puede modificarlos.
Para reglas reales necesitas servidor.

### 9.8 Envío o delivery con costo

Actualmente el subtotal es el total. Para añadir envío:

1. Define zonas y tarifas en `CONFIG` o en un array local.
2. Pide distrito o zona en el checkout.
3. Calcula `shipping` en `buildMessage()` (o en `Cart.detail()` si afecta la UI).
4. Muestra “Envío” y “Total” por separado.
5. Mantén el texto “envío a coordinar” si la tarifa no es fija.

### 9.9 Galería de imágenes

Cambia `imagen` por `imagenes: []` y actualiza:

- `cardTemplate()` para la imagen principal.
- Un nuevo modal de detalle con miniaturas.
- `cartLineTemplate()` para usar `imagenes[0]`.
- El panel `admin.js` para aceptar varias rutas separadas por comas.

Conserva `imagen` como campo compatible si tienes datos existentes.

### 9.10 Carrito por usuario

Hoy `malako_cart` es compartido. Para separarlo:

1. Define una clave dinámica: `malako_cart_<userId>` o `malako_cart_guest`.
2. En `Auth.login()` y `Auth.register()`, cambia el carrito activo y recarga.
3. En `Auth.logout()`, guarda el carrito actual y carga el de invitado.
4. Decide si fusionar el carrito de invitado al iniciar sesión.
5. `Cart` necesitaría una función `setStorageKey(key)` y persistir con esa clave.

### 9.11 Backend real

La interfaz está separada de los datos, lo que facilita migrar:

1. Sustituye `Catalog.all()` por datos de una API o base de datos.
2. Mantén la forma del producto para no tocar las plantillas.
3. Mueve autenticación a sesiones o tokens HTTP-only.
4. Mueve el carrito y el stock a servidor para evitar condiciones de carrera.
5. Registra pedidos en una tabla antes de redirigir a WhatsApp.
6. Añade validación y autorización en el servidor; nunca confíes en el cliente.
7. Si usas un backend, puedes mantener el checkout por WhatsApp como confirmación.

Opciones sin escribir un backend completo: Supabase, Firebase o una función
serverless. Requiere agregar dependencias o `fetch`, lo que rompe las restricciones
actuales del proyecto.

### 9.12 Autenticación real

El hash actual es reversible por fuerza bruta y no usa salt por usuario. Para
producción:

- Usa Argon2, bcrypt o scrypt en el servidor.
- Usa HTTPS y cookies `HttpOnly`, `Secure` y `SameSite`.
- Añade verificación de correo y recuperación de contraseña.
- Limita intentos y aplica rate limiting.
- No guardes datos personales en `localStorage`.

### 9.13 Cambiar moneda o idioma

Para moneda, ajusta `CURRENCY` y `LOCALE` en `CONFIG`; `Utils.money()` y el panel
administrativo usan `Intl.NumberFormat`. Recuerda que los precios de `db.js` deben
estar en la nueva moneda.

Para idioma, extrae los textos visibles a un objeto de traducciones y añade un
selector. Hoy los textos están en HTML y en `app.js`; es una refactorización
mediana, no un cambio de configuración.

### 9.14 Mejorar el panel administrativo

Ideas de bajo riesgo:

- Botón “Editar” que rellene el formulario y actualice en lugar de añadir.
- Importar un `db.js` o JSON existente con `FileReader`.
- Exportar copia de seguridad en JSON.
- Validar IDs duplicados y campos vacíos con más detalle.
- Vista previa de la tarjeta completa.
- Ordenar la tabla por columna.

No añadas subida de imágenes sin backend: un sitio estático no puede escribir en
`assets/img/`. El flujo actual es copiar la imagen manualmente y descargar `db.js`.

### 9.15 SEO y analítica

El catálogo se renderiza con JavaScript, por lo que los bots deben ejecutar JS. Para
mejorar:

- Añade contenido estático en el HTML (textos, categorías, preguntas frecuentes).
- Usa metadatos `description`, Open Graph y Twitter Card.
- Añade datos estructurados `Product` y `Store` en JSON-LD.
- Genera una página por producto si necesitas indexación fuerte.
- Si agregas analítica, revisa la privacidad y las restricciones de red del proyecto.

## 10. Convenciones

- JavaScript vanilla ES6+, sin transpilación.
- Módulos como IIFEs y un namespace único `window.Malako`.
- Nombres de variables y funciones en español; clases CSS descriptivas.
- Escapar siempre datos dinámicos con `Utils.escapeHTML()` antes de `innerHTML`.
- Precios como números; formatear solo al mostrar.
- Rutas de imágenes relativas a la raíz y en minúsculas.
- Eventos delegados en contenedores estables (`#product-grid`, `#cart-items`).
- `localStorage` siempre con prefijo `malako_` y lectura tolerante a errores.
- Mantener el sitio funcional sin red salvo el enlace final de WhatsApp.
- Actualizar `README.md` y `DOCS.md` cuando cambie la configuración o la API.

## 11. Checklist de QA manual

### Catálogo

- [ ] Se muestran todos los productos de `db.js`.
- [ ] Búsqueda por nombre, descripción y categoría, con y sin tildes.
- [ ] Filtros de categoría y orden por precio/nombre.
- [ ] Estado vacío al buscar algo inexistente y botón “Limpiar filtros”.
- [ ] Producto con `stock: 0` aparece agotado y sin botón activo.
- [ ] Imagen faltante muestra el respaldo local.

### Carrito

- [ ] Agregar, sumar, restar y eliminar líneas.
- [ ] No se supera el stock disponible.
- [ ] Badge y subtotal coinciden.
- [ ] Persistencia tras recargar.
- [ ] Drawer se cierra con botón, overlay y `Escape`.
- [ ] Carrito vacío deshabilita el checkout.

### Cuentas

- [ ] Registro válido crea sesión y se mantiene tras recargar.
- [ ] Correo duplicado, contraseña corta y confirmación distinta muestran error.
- [ ] Login correcto e incorrecto.
- [ ] Logout limpia la sesión y actualiza el header.
- [ ] El nombre se prellena en el checkout.

### Checkout

- [ ] Validación de nombre, teléfono y dirección.
- [ ] Recojo en tienda oculta y desactiva la dirección.
- [ ] Resumen con productos, cantidades y total correctos.
- [ ] Métodos de pago y entrega llegan al mensaje.
- [ ] El enlace `wa.me` usa el número configurado y el texto codificado.
- [ ] El modal de respaldo permite abrir WhatsApp y copiar el resumen.
- [ ] El carrito queda vacío después de generar el pedido.

### Panel admin

- [ ] Carga el catálogo desde `../db.js`.
- [ ] Alta con validaciones y vista previa de imagen.
- [ ] Eliminación con confirmación.
- [ ] Borrador restaurado tras recargar.
- [ ] Restablecer recupera el catálogo original.
- [ ] Descarga un `db.js` sintácticamente válido.
- [ ] El archivo descargado funciona al reemplazar el de la raíz.

### Responsive y accesibilidad

- [ ] 360, 414, 768, 1024, 1440 px sin desbordes horizontales.
- [ ] Navegación completa con teclado y foco visible.
- [ ] `Escape` cierra modales y el foco regresa al disparador.
- [ ] Contraste suficiente y textos alternativos en imágenes de producto.
- [ ] `prefers-reduced-motion` desactiva animaciones.

## 12. Limitaciones conocidas

- **Seguridad:** hash djb2 no criptográfico, sesión manipulable y datos visibles en
  el navegador. Es una demo, no un sistema de cuentas real.
- **Alcance de datos:** `localStorage` es por navegador y dispositivo; no se
  sincroniza ni se comparte entre usuarios.
- **Stock:** se valida solo en el cliente. Dos personas pueden comprar la última
  unidad; no hay reservas.
- **Pedidos:** no se guardan en el sitio. El único registro es el chat de WhatsApp.
- **Pago:** no se procesa ningún pago en línea.
- **Carrito:** compartido entre cuentas del mismo navegador.
- **Admin:** no edita archivos directamente; requiere descargar y reemplazar. No
  sube imágenes. Si se publica, queda accesible públicamente.
- **Catalogo:** renderizado en cliente; el HTML inicial no contiene los productos.
- **WhatsApp:** el usuario debe pulsar “Enviar”; el enlace solo prellena el mensaje.
  Un número inválido o sin WhatsApp no abrirá el chat correcto.
- **Imágenes:** los JPG incluidos son marcadores generados localmente.
- **Sin tests automatizados:** la verificación es manual.

## 13. Roadmap sugerido

### Corto plazo

1. Reemplazar el número de WhatsApp y las imágenes de ejemplo.
2. Editar productos desde el panel (no solo añadir/eliminar).
3. Copia de seguridad/importación del catálogo en JSON.
4. Revisar textos legales, garantía y horarios.
5. Pruebas en móviles reales.

### Mediano plazo

1. Modal de detalle de producto y galería.
2. Carrito por usuario y fusión al iniciar sesión.
3. Cupones y costos de envío por zona.
4. Búsqueda con sugerencias y orden persistente.
5. Exportación de pedidos a un archivo local antes de WhatsApp.
6. Modo oscuro y mejoras de accesibilidad.
7. Datos estructurados y metadatos sociales.

### Largo plazo

1. Backend con base de datos, stock real y panel autenticado.
2. Autenticación segura y recuperación de contraseña.
3. Registro de pedidos y estados de entrega.
4. Notificaciones por correo o WhatsApp Business API.
5. PWA instalable con caché de imágenes.
6. Analítica y optimización de conversión con consentimiento.

## 14. Mantenimiento

Antes de cada publicación:

1. Actualiza `WHATSAPP_NUMBER`, precios y stock.
2. Verifica que no existan rutas absolutas ni imágenes externas.
3. Comprueba que no haya `fetch`, CDNs ni dependencias nuevas.
4. Ejecuta el checklist de QA.
5. Elimina `admin/` del repositorio público.
6. Publica y prueba el enlace de WhatsApp desde un teléfono real.

Para depurar, abre la consola y usa:

```js
Malako.Cart.detail()
Malako.Auth.currentUser()
Malako.Catalog.all()
Malako.CONFIG
```

No expongas datos de clientes en la consola ni en el repositorio.

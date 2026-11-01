(function () {
  'use strict';

  const DRAFT_KEY = 'malako_admin_products';
  const ORIGINAL = (Array.isArray(window.PRODUCTOS) ? window.PRODUCTOS : [])
    .filter(function (product) { return product && typeof product === 'object'; })
    .map(copyProduct);

  const els = {};
  let products = [];
  let draftRestored = false;
  let messageTimer = null;

  const priceFormatter = new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2
  });

  function copyProduct(product) {
    return Object.assign({}, product);
  }

  function escapeHTML(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[character];
    });
  }

  function money(value) {
    const number = Number(value);
    return priceFormatter.format(Number.isFinite(number) ? number : 0);
  }

  function normalize(value) {
    return String(value == null ? '' : value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function cache() {
    const ids = [
      'product-form', 'nombre', 'precio', 'stock', 'categoria', 'categorias',
      'descripcion', 'imagen', 'destacado', 'preview-wrap', 'preview', 'preview-name',
      'form-message', 'product-rows', 'catalog-stats', 'table-empty',
      'download-btn', 'reset-btn', 'draft-note'
    ];
    ids.forEach(function (id) {
      els[id] = document.getElementById(id);
    });
  }

  function loadDraft() {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      return parsed.filter(function (product) {
        return product && typeof product === 'object';
      });
    } catch (error) {
      return null;
    }
  }

  function saveDraft() {
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(products));
    } catch (error) {
      setMessage('No se pudo guardar el borrador en este navegador.', 'error');
    }
  }

  function nextId() {
    const numbers = products.map(function (product) {
      return Number(product.id);
    }).filter(function (number) {
      return Number.isFinite(number);
    });
    return numbers.length ? Math.max.apply(null, numbers) + 1 : 1;
  }

  function nextImagePath() {
    const numbers = products.map(function (product) {
      const match = String(product.imagen || '').match(/producto(\d+)\./i);
      return match ? Number(match[1]) : 0;
    });
    return 'assets/img/producto' + (Math.max.apply(null, [0].concat(numbers)) + 1) + '.jpg';
  }

  function assetPath(path) {
    const clean = String(path || '').trim();
    if (!clean) return '';
    return clean.indexOf('assets/') === 0 ? '../' + clean : clean;
  }

  function setMessage(text, type) {
    window.clearTimeout(messageTimer);
    els['form-message'].textContent = text || '';
    els['form-message'].classList.toggle('is-success', type === 'success');
    if (text) {
      messageTimer = window.setTimeout(function () {
        els['form-message'].textContent = '';
        els['form-message'].classList.remove('is-success');
      }, 6000);
    }
  }

  function renderAll() {
    renderStats();
    renderCategories();
    renderTable();
  }

  function renderStats() {
    const units = products.reduce(function (total, product) {
      return total + (Number(product.stock) || 0);
    }, 0);
    const inventory = products.reduce(function (total, product) {
      return total + (Number(product.precio) || 0) * (Number(product.stock) || 0);
    }, 0);
    const label = products.length === 1 ? '1 producto' : products.length + ' productos';
    els['catalog-stats'].textContent = label + ' · ' + units + ' unidades · inventario ' + money(inventory);
  }

  function renderCategories() {
    const list = [];
    products.forEach(function (product) {
      const category = String(product.categoria || '').trim();
      if (category && list.indexOf(category) === -1) list.push(category);
    });
    list.sort(function (a, b) { return a.localeCompare(b, 'es'); });
    els.categorias.innerHTML = list.map(function (category) {
      return '<option value="' + escapeHTML(category) + '"></option>';
    }).join('');
  }

  function renderTable() {
    els['product-rows'].innerHTML = products.map(function (product) {
      const id = escapeHTML(product.id);
      return [
        '<tr>',
        '<td><img src="' + escapeHTML(assetPath(product.imagen)) + '" alt="" loading="lazy"></td>',
        '<td>' + id + '</td>',
        '<td class="cell-name">' + escapeHTML(product.nombre) + '</td>',
        '<td>' + escapeHTML(product.categoria) + '</td>',
        '<td class="cell-price">' + money(product.precio) + '</td>',
        '<td>' + escapeHTML(product.stock) + '</td>',
        '<td><button class="delete-btn" type="button" data-delete="' + id + '">Eliminar</button></td>',
        '</tr>'
      ].join('');
    }).join('');
    els['table-empty'].hidden = products.length > 0;
  }

  function updatePreview() {
    const value = els.imagen.value.trim();
    if (!value) {
      els['preview-wrap'].hidden = true;
      return;
    }
    els['preview-wrap'].hidden = false;
    els.preview.src = assetPath(value);
    els['preview-name'].textContent = value;
  }

  function handlePreviewError() {
    els.preview.removeAttribute('src');
    els['preview-name'].textContent = 'Imagen no encontrada: ' + els.imagen.value.trim();
  }

  function handleTableImageError(event) {
    const image = event.target;
    if (!image || image.tagName !== 'IMG') return;
    image.removeAttribute('src');
  }

  function validateForm() {
    const form = els['product-form'];
    if (!form.checkValidity()) {
      form.reportValidity();
      return null;
    }

    const nombre = els.nombre.value.trim();
    const categoria = els.categoria.value.trim();
    const descripcion = els.descripcion.value.trim();
    const imagen = els.imagen.value.trim().replace(/^\.\//, '');
    const price = Number(els.precio.value);
    const stock = parseInt(els.stock.value, 10);

    if (!Number.isFinite(price) || price <= 0) {
      setMessage('El precio debe ser mayor que cero.', 'error');
      els.precio.focus();
      return null;
    }

    if (!Number.isInteger(stock) || stock < 0) {
      setMessage('El stock debe ser un número entero igual o mayor que cero.', 'error');
      els.stock.focus();
      return null;
    }

    if (products.some(function (product) {
      return normalize(product.nombre) === normalize(nombre);
    })) {
      setMessage('Ya existe un producto con ese nombre.', 'error');
      els.nombre.focus();
      return null;
    }

    if (!/^(assets\/|\.\.\/).+\.(jpg|jpeg|png|webp|svg)$/i.test(imagen)) {
      setMessage('Usa una ruta local válida, por ejemplo assets/img/producto9.jpg.', 'error');
      els.imagen.focus();
      return null;
    }

    return {
      id: nextId(),
      nombre: nombre,
      precio: Math.round(price * 100) / 100,
      descripcion: descripcion,
      categoria: categoria,
      imagen: imagen,
      stock: stock,
      destacado: els.destacado.checked
    };
  }

  function handleSubmit(event) {
    event.preventDefault();
    setMessage('');

    const product = validateForm();
    if (!product) return;

    products.push(product);
    saveDraft();
    renderAll();

    els['product-form'].reset();
    els.imagen.value = nextImagePath();
    updatePreview();
    els.nombre.focus();
    setMessage('Producto agregado. Descarga db.js para aplicar los cambios.', 'success');
  }

  function handleDelete(event) {
    const button = event.target.closest('[data-delete]');
    if (!button) return;

    const id = button.dataset.delete;
    const product = products.find(function (item) {
      return String(item.id) === String(id);
    });
    if (!product) return;

    if (!window.confirm('¿Eliminar "' + product.nombre + '" del catálogo?')) return;

    products = products.filter(function (item) {
      return String(item.id) !== String(id);
    });
    saveDraft();
    renderAll();
    setMessage('Producto eliminado.', 'success');
  }

  function downloadDatabase() {
    if (!products.length) {
      setMessage('El catálogo está vacío. Agrega al menos un producto antes de descargar.', 'error');
      return;
    }

    const header = '// Malako Store — catálogo de productos\n' +
      '// Generado: ' + new Date().toLocaleString('es-PE') + '\n\n';
    const content = header +
      'const PRODUCTOS = ' + JSON.stringify(products, null, 2) + ';\n\n' +
      'window.PRODUCTOS = PRODUCTOS;\n';

    const blob = new Blob([content], { type: 'text/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'db.js';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1500);

    setMessage('db.js descargado. Reemplaza el archivo de la raíz del proyecto.', 'success');
  }

  function resetCatalog() {
    if (!window.confirm('Se descartarán los cambios locales y se recargará el catálogo original de db.js. ¿Continuar?')) {
      return;
    }

    products = ORIGINAL.map(copyProduct);
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch (error) {
      setMessage('No se pudo limpiar el borrador.', 'error');
    }
    els['draft-note'].hidden = true;
    renderAll();
    els.imagen.value = nextImagePath();
    updatePreview();
    setMessage('Catálogo restablecido desde db.js.', 'success');
  }

  function init() {
    cache();
    const draft = loadDraft();
    draftRestored = Boolean(draft);
    products = draft ? draft.map(copyProduct) : ORIGINAL.map(copyProduct);

    els['draft-note'].hidden = !draftRestored;
    renderAll();

    els.imagen.value = nextImagePath();
    updatePreview();

    els['product-form'].addEventListener('submit', handleSubmit);
    els.imagen.addEventListener('input', updatePreview);
    els.preview.addEventListener('error', handlePreviewError);
    els.preview.addEventListener('load', function () {
      els['preview-name'].textContent = els.imagen.value.trim();
    });
    els['product-rows'].addEventListener('click', handleDelete);
    els['product-rows'].addEventListener('error', handleTableImageError, true);
    els['download-btn'].addEventListener('click', downloadDatabase);
    els['reset-btn'].addEventListener('click', resetCatalog);

    if (!ORIGINAL.length) {
      setMessage('No se pudo leer ../db.js. Puedes crear el catálogo desde cero.', 'error');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

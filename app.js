(function (global) {
  'use strict';

  const CONFIG = Object.freeze({
    STORE_NAME: 'Malako Store',
    WHATSAPP_NUMBER: '51999999999',
    CURRENCY: 'PEN',
    LOCALE: 'es-PE',
    STORAGE: Object.freeze({
      users: 'malako_users',
      session: 'malako_session',
      cart: 'malako_cart'
    })
  });

  const FALLBACK_IMAGE = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 360">' +
      '<rect width="480" height="360" fill="#efece6"/>' +
      '<rect x="168" y="118" width="144" height="112" rx="10" fill="none" stroke="#b9b3a8" stroke-width="7"/>' +
      '<path d="M168 168h144M210 118v50" fill="none" stroke="#b9b3a8" stroke-width="7" stroke-linecap="round"/>' +
      '<text x="240" y="300" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="19" fill="#8d867a">Imagen no disponible</text>' +
    '</svg>'
  );

  const Utils = (function () {
    const priceFormatter = new Intl.NumberFormat(CONFIG.LOCALE, {
      style: 'currency',
      currency: CONFIG.CURRENCY,
      minimumFractionDigits: 2
    });

    function money(value) {
      const number = Number(value);
      return priceFormatter.format(Number.isFinite(number) ? number : 0);
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

    function normalize(value) {
      return String(value == null ? '' : value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
    }

    function debounce(callback, wait) {
      let timer = null;
      return function () {
        const context = this;
        const args = arguments;
        window.clearTimeout(timer);
        timer = window.setTimeout(function () {
          callback.apply(context, args);
        }, wait);
      };
    }

    function readJSON(key, fallback) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (error) {
        return fallback;
      }
    }

    function writeJSON(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (error) {
        return false;
      }
    }

    function hashPassword(password) {
      const input = 'malako::' + String(password);
      let hash = 5381;
      for (let index = 0; index < input.length; index += 1) {
        hash = ((hash << 5) + hash + input.charCodeAt(index)) >>> 0;
      }
      return 'h' + hash.toString(16).padStart(8, '0');
    }

    function orderCode() {
      return 'MK-' + Date.now().toString(36).toUpperCase().slice(-6);
    }

    return {
      money: money,
      escapeHTML: escapeHTML,
      normalize: normalize,
      debounce: debounce,
      readJSON: readJSON,
      writeJSON: writeJSON,
      hashPassword: hashPassword,
      orderCode: orderCode
    };
  })();

  const Catalog = (function () {
    function all() {
      return Array.isArray(global.PRODUCTOS) ? global.PRODUCTOS : [];
    }

    function byId(id) {
      return all().find(function (product) {
        return String(product.id) === String(id);
      }) || null;
    }

    function categories() {
      const list = [];
      all().forEach(function (product) {
        const category = String(product.categoria || '').trim();
        if (category && list.indexOf(category) === -1) list.push(category);
      });
      return list;
    }

    return { all: all, byId: byId, categories: categories };
  })();

  const Auth = (function () {
    let current = Utils.readJSON(CONFIG.STORAGE.session, null);

    function getUsers() {
      const list = Utils.readJSON(CONFIG.STORAGE.users, []);
      return Array.isArray(list) ? list : [];
    }

    function currentUser() {
      return current && current.email ? current : null;
    }

    function toSession(user) {
      return { id: user.id, nombre: user.nombre, email: user.email };
    }

    function register(data) {
      const nombre = String(data.nombre || '').trim();
      const email = String(data.email || '').trim().toLowerCase();
      const password = String(data.password || '');
      const confirm = String(data.confirm || '');

      if (nombre.length < 3) {
        return { ok: false, error: 'Escribe tu nombre completo (mínimo 3 caracteres).' };
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        return { ok: false, error: 'Ingresa un correo electrónico válido.' };
      }
      if (password.length < 6) {
        return { ok: false, error: 'La contraseña debe tener al menos 6 caracteres.' };
      }
      if (password !== confirm) {
        return { ok: false, error: 'Las contraseñas no coinciden.' };
      }

      const users = getUsers();
      if (users.some(function (user) { return user.email === email; })) {
        return { ok: false, error: 'Ya existe una cuenta con ese correo electrónico.' };
      }

      const user = {
        id: 'u-' + Date.now().toString(36),
        nombre: nombre,
        email: email,
        password: Utils.hashPassword(password),
        creadoEn: new Date().toISOString()
      };

      users.push(user);
      if (!Utils.writeJSON(CONFIG.STORAGE.users, users)) {
        return { ok: false, error: 'No se pudo guardar la cuenta en este navegador.' };
      }

      current = toSession(user);
      Utils.writeJSON(CONFIG.STORAGE.session, current);
      return { ok: true, user: current };
    }

    function login(emailInput, passwordInput) {
      const email = String(emailInput || '').trim().toLowerCase();
      const password = String(passwordInput || '');

      if (!email || !password) {
        return { ok: false, error: 'Completa tu correo y contraseña.' };
      }

      const user = getUsers().find(function (item) {
        return item.email === email;
      });

      if (!user || user.password !== Utils.hashPassword(password)) {
        return { ok: false, error: 'Correo o contraseña incorrectos.' };
      }

      current = toSession(user);
      Utils.writeJSON(CONFIG.STORAGE.session, current);
      return { ok: true, user: current };
    }

    function logout() {
      current = null;
      try {
        window.localStorage.removeItem(CONFIG.STORAGE.session);
      } catch (error) {
        current = null;
      }
    }

    return { currentUser: currentUser, register: register, login: login, logout: logout };
  })();

  const Cart = (function () {
    const listeners = new Set();
    let items = sanitize(Utils.readJSON(CONFIG.STORAGE.cart, []));

    function sanitize(rawItems) {
      if (!Array.isArray(rawItems)) return [];
      const catalog = new Map(Catalog.all().map(function (product) {
        return [String(product.id), product];
      }));
      const merged = [];

      rawItems.forEach(function (raw) {
        if (!raw) return;
        const id = String(raw.id);
        const product = catalog.get(id);
        if (!product) return;
        const stock = Math.max(0, Number(product.stock) || 0);
        if (stock === 0) return;
        const quantity = Math.min(Math.max(1, parseInt(raw.qty, 10) || 1), stock);
        const existing = merged.find(function (item) { return item.id === id; });
        if (existing) existing.qty = Math.min(stock, existing.qty + quantity);
        else merged.push({ id: id, qty: quantity });
      });

      return merged;
    }

    function persist() {
      Utils.writeJSON(CONFIG.STORAGE.cart, items);
      emit();
    }

    function detail() {
      const lines = items.map(function (item) {
        const product = Catalog.byId(item.id);
        if (!product) return null;
        const price = Number(product.precio) || 0;
        return {
          product: product,
          qty: item.qty,
          lineTotal: price * item.qty
        };
      }).filter(Boolean);

      const count = lines.reduce(function (total, line) { return total + line.qty; }, 0);
      const subtotal = lines.reduce(function (total, line) { return total + line.lineTotal; }, 0);
      return { lines: lines, count: count, subtotal: subtotal };
    }

    function emit() {
      const snapshot = detail();
      listeners.forEach(function (listener) {
        listener(snapshot);
      });
    }

    function subscribe(listener) {
      listeners.add(listener);
      return function () {
        listeners.delete(listener);
      };
    }

    function add(id, quantity) {
      const product = Catalog.byId(id);
      if (!product) return { ok: false, error: 'Producto no disponible.' };

      const stock = Math.max(0, Number(product.stock) || 0);
      if (stock === 0) return { ok: false, error: 'Este producto está agotado.' };

      const amount = Math.max(1, parseInt(quantity, 10) || 1);
      const existing = items.find(function (item) { return item.id === String(id); });
      const currentQuantity = existing ? existing.qty : 0;

      if (currentQuantity + amount > stock) {
        return { ok: false, error: 'Solo quedan ' + stock + ' unidades de ' + product.nombre + '.' };
      }

      if (existing) existing.qty += amount;
      else items.push({ id: String(id), qty: amount });

      persist();
      return { ok: true, product: product };
    }

    function setQty(id, quantity) {
      const product = Catalog.byId(id);
      const target = items.find(function (item) { return item.id === String(id); });
      if (!product || !target) return { ok: false };

      const stock = Math.max(0, Number(product.stock) || 0);
      const next = parseInt(quantity, 10);

      if (!Number.isFinite(next) || next < 1) {
        remove(id);
        return { ok: true };
      }

      if (next > stock) {
        target.qty = stock;
        persist();
        return { ok: false, error: 'Stock máximo disponible: ' + stock + ' unidades.' };
      }

      target.qty = next;
      persist();
      return { ok: true };
    }

    function remove(id) {
      items = items.filter(function (item) { return item.id !== String(id); });
      persist();
    }

    function clear() {
      items = [];
      persist();
    }

    return {
      detail: detail,
      subscribe: subscribe,
      add: add,
      setQty: setQty,
      remove: remove,
      clear: clear
    };
  })();

  const Checkout = (function () {
    function buildUrl(text) {
      return 'https://wa.me/' + CONFIG.WHATSAPP_NUMBER + '?text=' + encodeURIComponent(text);
    }

    function buildMessage(customer, detail) {
      const code = Utils.orderCode();
      const lines = detail.lines.map(function (line, index) {
        return (index + 1) + '. ' + line.product.nombre + ' x' + line.qty + ' — ' + Utils.money(line.lineTotal);
      });

      const parts = [
        'Hola ' + CONFIG.STORE_NAME + ', quiero confirmar mi pedido ' + code + '.',
        '',
        '*Productos*',
        lines.join('\n'),
        '',
        '*Total:* ' + Utils.money(detail.subtotal),
        '*Entrega:* ' + customer.entrega,
        '*Método de pago:* ' + customer.metodo,
        '',
        '*Datos del cliente*',
        'Nombre: ' + customer.nombre,
        'Teléfono: ' + customer.telefono
      ];

      if (customer.direccion) parts.push('Dirección: ' + customer.direccion);
      if (customer.notas) parts.push('Notas: ' + customer.notas);
      parts.push('', 'Quedo atento/a para coordinar el pago y la entrega.');

      const text = parts.join('\n');
      return { code: code, text: text, url: buildUrl(text) };
    }

    function launch(url) {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
    }

    return { buildUrl: buildUrl, buildMessage: buildMessage, launch: launch };
  })();

  const UI = (function () {
    const els = {};
    const state = { category: 'Todos', search: '', sort: 'destacado' };
    const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    let lastFocused = null;
    let lastMessage = '';

    const ELEMENT_IDS = {
      searchForm: 'search-form',
      searchInput: 'search-input',
      userArea: 'user-area',
      userBtn: 'user-btn',
      userLabel: 'user-label',
      userMenu: 'user-menu',
      userMenuName: 'user-menu-name',
      userMenuEmail: 'user-menu-email',
      logoutBtn: 'logout-btn',
      cartBtn: 'cart-btn',
      cartCount: 'cart-count',
      filters: 'category-filters',
      sortSelect: 'sort-select',
      grid: 'product-grid',
      emptyCatalog: 'empty-catalog',
      resultsCount: 'results-count',
      clearFilters: 'clear-filters',
      cartOverlay: 'cart-overlay',
      cartDrawer: 'cart-drawer',
      cartClose: 'cart-close',
      cartItems: 'cart-items',
      cartEmpty: 'cart-empty',
      cartEmptyCta: 'cart-empty-cta',
      cartSubtotal: 'cart-subtotal',
      cartCheckout: 'cart-checkout',
      authModal: 'auth-modal',
      authClose: 'auth-close',
      loginPanel: 'login-panel',
      registerPanel: 'register-panel',
      loginForm: 'login-form',
      loginEmail: 'login-email',
      loginPassword: 'login-password',
      loginMessage: 'login-message',
      registerForm: 'register-form',
      regName: 'reg-name',
      regEmail: 'reg-email',
      regPassword: 'reg-password',
      regPassword2: 'reg-password2',
      regMessage: 'reg-message',
      checkoutModal: 'checkout-modal',
      checkoutClose: 'checkout-close',
      checkoutForm: 'checkout-form',
      checkoutSummary: 'checkout-summary',
      checkoutTotal: 'checkout-total',
      coNombre: 'co-nombre',
      coTelefono: 'co-telefono',
      coEntrega: 'co-entrega',
      coDireccion: 'co-direccion',
      coDireccionField: 'co-direccion-field',
      coMetodo: 'co-metodo',
      coNotas: 'co-notas',
      checkoutMessage: 'checkout-message',
      waModal: 'wa-modal',
      waClose: 'wa-close',
      waOpen: 'wa-open',
      waCopy: 'wa-copy',
      waCode: 'wa-code',
      toasts: 'toasts',
      waFab: 'wa-fab',
      waFooter: 'wa-footer',
      currentYear: 'current-year'
    };

    function cacheElements() {
      Object.keys(ELEMENT_IDS).forEach(function (key) {
        els[key] = document.getElementById(ELEMENT_IDS[key]);
      });
    }

    function init() {
      cacheElements();
      bindStaticLinks();
      bindSearch();
      bindFilters();
      bindCatalogActions();
      bindCart();
      bindAuth();
      bindCheckout();
      bindDialogs();
      bindUserMenu();
      bindImageFallbacks(document);
      renderFilters();
      renderCatalog();
      renderCart(Cart.detail());
      Cart.subscribe(renderCart);
      updateUser();
      els.coNombre.setAttribute('data-autofocus', '');
      els.currentYear.textContent = String(new Date().getFullYear());
    }

    function bindStaticLinks() {
      const text = 'Hola ' + CONFIG.STORE_NAME + ', quisiera más información sobre sus electrodomésticos.';
      [els.waFab, els.waFooter, document.getElementById('cart-wa-link')].forEach(function (node) {
        if (!node) return;
        node.href = Checkout.buildUrl(text);
        node.target = '_blank';
        node.rel = 'noopener noreferrer';
      });
    }

    function bindImageFallbacks(root) {
      (root || document).querySelectorAll('img[data-fallback]').forEach(function (image) {
        if (image.dataset.fallbackBound === 'true') return;
        image.dataset.fallbackBound = 'true';
        image.addEventListener('error', function () {
          image.src = FALLBACK_IMAGE;
          image.classList.add('is-fallback');
        }, { once: true });
      });
    }

    function toast(message, type) {
      if (!message) return;
      const node = document.createElement('div');
      node.className = 'toast toast-' + (type === 'error' ? 'error' : type === 'success' ? 'success' : 'info');
      node.setAttribute('role', 'status');
      node.textContent = message;
      els.toasts.appendChild(node);
      window.requestAnimationFrame(function () {
        node.classList.add('is-visible');
      });
      window.setTimeout(function () {
        node.classList.remove('is-visible');
        window.setTimeout(function () {
          node.remove();
        }, 260);
      }, 3600);
    }

    function openDialog(dialog) {
      if (!dialog) return;
      lastFocused = document.activeElement;
      dialog.classList.add('is-open');
      dialog.setAttribute('aria-hidden', 'false');
      if (dialog === els.cartDrawer) {
        els.cartOverlay.classList.add('is-open');
        els.cartOverlay.setAttribute('aria-hidden', 'false');
        els.cartBtn.setAttribute('aria-expanded', 'true');
      }
      document.body.classList.add('no-scroll');
      const preferred = Array.from(dialog.querySelectorAll('[data-autofocus]')).find(function (element) {
        return !element.closest('[hidden]');
      });
      const fallback = Array.from(dialog.querySelectorAll(FOCUSABLE)).find(function (element) {
        return element.offsetParent !== null;
      });
      const target = preferred || fallback;
      window.setTimeout(function () {
        if (target) target.focus();
      }, 80);
    }

    function closeDialog(dialog, options) {
      if (!dialog) return;
      dialog.classList.remove('is-open');
      dialog.setAttribute('aria-hidden', 'true');
      if (dialog === els.cartDrawer) {
        els.cartOverlay.classList.remove('is-open');
        els.cartOverlay.setAttribute('aria-hidden', 'true');
        els.cartBtn.setAttribute('aria-expanded', 'false');
      }
      const stillOpen = document.querySelector('.drawer.is-open, .modal.is-open');
      const restore = !options || options.restoreFocus !== false;
      if (!stillOpen) {
        document.body.classList.remove('no-scroll');
        if (restore && lastFocused && typeof lastFocused.focus === 'function') {
          lastFocused.focus();
        }
        if (restore) lastFocused = null;
      }
    }

    function bindDialogs() {
      els.cartClose.addEventListener('click', function () {
        closeDialog(els.cartDrawer);
      });
      els.cartOverlay.addEventListener('click', function () {
        closeDialog(els.cartDrawer);
      });
      els.authClose.addEventListener('click', function () {
        closeDialog(els.authModal);
      });
      els.checkoutClose.addEventListener('click', function () {
        closeDialog(els.checkoutModal);
      });
      els.waClose.addEventListener('click', function () {
        closeDialog(els.waModal);
      });

      [els.authModal, els.checkoutModal, els.waModal].forEach(function (modal) {
        modal.addEventListener('click', function (event) {
          if (event.target === modal) closeDialog(modal);
        });
      });

      document.addEventListener('keydown', function (event) {
        const openDialogs = Array.from(document.querySelectorAll('.modal.is-open, .drawer.is-open'));
        const active = openDialogs[openDialogs.length - 1];

        if (!active) {
          if (event.key === 'Escape' && !els.userMenu.hidden) closeUserMenu();
          return;
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          closeDialog(active);
          return;
        }

        if (event.key !== 'Tab') return;
        const focusable = Array.from(active.querySelectorAll(FOCUSABLE)).filter(function (element) {
          return element.offsetParent !== null || element === document.activeElement;
        });
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      });
    }

    function bindUserMenu() {
      els.userBtn.addEventListener('click', function (event) {
        event.stopPropagation();
        if (Auth.currentUser()) toggleUserMenu();
        else openDialog(els.authModal);
      });

      els.logoutBtn.addEventListener('click', function () {
        Auth.logout();
        updateUser();
        closeUserMenu();
        els.coNombre.value = '';
        toast('Sesión cerrada.', 'success');
      });

      document.addEventListener('click', function (event) {
        if (!event.target.closest('#user-area')) closeUserMenu();
      });
    }

    function toggleUserMenu() {
      const willOpen = els.userMenu.hidden;
      els.userMenu.hidden = !willOpen;
      els.userBtn.setAttribute('aria-expanded', String(willOpen));
    }

    function closeUserMenu() {
      els.userMenu.hidden = true;
      els.userBtn.setAttribute('aria-expanded', 'false');
    }

    function updateUser() {
      const user = Auth.currentUser();
      els.userLabel.textContent = user ? user.nombre.split(/\s+/)[0] : 'Ingresar';
      els.userBtn.setAttribute('aria-label', user ? 'Abrir menú de cuenta de ' + user.nombre : 'Iniciar sesión o registrarse');
      els.userBtn.classList.toggle('is-logged', Boolean(user));
      els.userMenuName.textContent = user ? user.nombre : '';
      els.userMenuEmail.textContent = user ? user.email : '';
      els.logoutBtn.hidden = !user;
      if (!user) closeUserMenu();
    }

    function bindSearch() {
      els.searchInput.addEventListener('input', Utils.debounce(function () {
        state.search = els.searchInput.value;
        renderCatalog();
      }, 160));

      els.searchForm.addEventListener('submit', function (event) {
        event.preventDefault();
        state.search = els.searchInput.value;
        renderCatalog();
      });

      els.sortSelect.addEventListener('change', function () {
        state.sort = els.sortSelect.value;
        renderCatalog();
      });

      els.clearFilters.addEventListener('click', function () {
        state.category = 'Todos';
        state.search = '';
        state.sort = 'destacado';
        els.searchInput.value = '';
        els.sortSelect.value = 'destacado';
        renderFilters();
        renderCatalog();
      });
    }

    function bindFilters() {
      els.filters.addEventListener('click', function (event) {
        const chip = event.target.closest('[data-category]');
        if (!chip) return;
        state.category = chip.dataset.category;
        renderFilters();
        renderCatalog();
      });
    }

    function renderFilters() {
      const categories = ['Todos'].concat(Catalog.categories());
      els.filters.innerHTML = categories.map(function (category) {
        const active = state.category === category;
        return '<button type="button" class="chip' + (active ? ' is-active' : '') + '"' +
          ' data-category="' + Utils.escapeHTML(category) + '"' +
          ' aria-pressed="' + String(active) + '">' +
          Utils.escapeHTML(category) +
          '</button>';
      }).join('');
    }

    function filteredProducts() {
      const query = Utils.normalize(state.search);
      let products = Catalog.all().slice();

      if (state.category !== 'Todos') {
        products = products.filter(function (product) {
          return product.categoria === state.category;
        });
      }

      if (query) {
        products = products.filter(function (product) {
          const haystack = Utils.normalize([product.nombre, product.descripcion, product.categoria].join(' '));
          return haystack.indexOf(query) !== -1;
        });
      }

      const price = function (product) { return Number(product.precio) || 0; };

      switch (state.sort) {
        case 'precio-asc':
          products.sort(function (a, b) { return price(a) - price(b); });
          break;
        case 'precio-desc':
          products.sort(function (a, b) { return price(b) - price(a); });
          break;
        case 'nombre':
          products.sort(function (a, b) {
            return String(a.nombre).localeCompare(String(b.nombre), 'es');
          });
          break;
        default:
          products.sort(function (a, b) {
            return (Number(b.destacado) || 0) - (Number(a.destacado) || 0) ||
              Number(a.id) - Number(b.id);
          });
      }

      return products;
    }

    function renderCatalog() {
      const products = filteredProducts();
      els.grid.innerHTML = products.map(cardTemplate).join('');
      bindImageFallbacks(els.grid);
      els.emptyCatalog.hidden = products.length > 0;
      els.resultsCount.textContent = products.length === 1 ? '1 producto' : products.length + ' productos';
      els.grid.setAttribute('aria-busy', 'false');
    }

    function cardTemplate(product) {
      const stock = Math.max(0, Number(product.stock) || 0);
      const soldOut = stock === 0;
      const lowStock = !soldOut && stock <= 3;
      const stockLabel = soldOut ? 'Agotado' : lowStock ? 'Últimas ' + stock + ' unidades' : 'Disponible';

      return [
        '<article class="product-card">',
        '<div class="product-media">',
        product.destacado ? '<span class="product-tag">Destacado</span>' : '',
        '<img src="' + Utils.escapeHTML(product.imagen) + '" alt="' + Utils.escapeHTML(product.nombre) + '"',
        ' loading="lazy" width="480" height="360" data-fallback>',
        '</div>',
        '<div class="product-body">',
        '<span class="product-category">' + Utils.escapeHTML(product.categoria) + '</span>',
        '<h3 class="product-name">' + Utils.escapeHTML(product.nombre) + '</h3>',
        '<p class="product-desc">' + Utils.escapeHTML(product.descripcion) + '</p>',
        '<div class="product-meta">',
        '<p class="product-price">' + Utils.money(product.precio) + '</p>',
        '<p class="product-stock' + (lowStock ? ' is-low' : '') + '">' + Utils.escapeHTML(stockLabel) + '</p>',
        '</div>',
        '<button class="btn btn-primary btn-block btn-add" type="button" data-add="' + Utils.escapeHTML(product.id) + '"' + (soldOut ? ' disabled' : '') + '>',
        soldOut ? 'Sin stock' : 'Agregar al carrito',
        '</button>',
        '</div>',
        '</article>'
      ].join('');
    }

    function bindCatalogActions() {
      els.grid.addEventListener('click', function (event) {
        const button = event.target.closest('[data-add]');
        if (!button) return;
        const result = Cart.add(button.dataset.add, 1);
        if (result.ok) {
          toast(result.product.nombre + ' se agregó al carrito.', 'success');
          pulseCart();
        } else {
          toast(result.error, 'error');
        }
      });
    }

    function pulseCart() {
      els.cartCount.style.animation = 'none';
      void els.cartCount.offsetWidth;
      els.cartCount.style.animation = '';
    }

    function bindCart() {
      els.cartBtn.addEventListener('click', function () {
        renderCart(Cart.detail());
        openDialog(els.cartDrawer);
      });

      els.cartCheckout.addEventListener('click', function () {
        closeDialog(els.cartDrawer, { restoreFocus: false });
        openCheckout();
      });

      els.cartEmptyCta.addEventListener('click', function () {
        closeDialog(els.cartDrawer);
        const catalog = document.getElementById('catalogo');
        if (catalog) catalog.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      els.cartItems.addEventListener('click', function (event) {
        const quantityButton = event.target.closest('[data-qty]');
        if (quantityButton) {
          const id = quantityButton.dataset.id;
          const delta = Number(quantityButton.dataset.qty);
          const line = Cart.detail().lines.find(function (item) {
            return String(item.product.id) === String(id);
          });
          if (!line) return;
          const result = Cart.setQty(id, line.qty + delta);
          if (result && result.error) toast(result.error, 'error');
          return;
        }

        const removeButton = event.target.closest('[data-remove]');
        if (removeButton) {
          Cart.remove(removeButton.dataset.remove);
          toast('Producto eliminado del carrito.');
        }
      });
    }

    function renderCart(snapshot) {
      const detail = snapshot || Cart.detail();
      els.cartCount.textContent = String(detail.count);
      els.cartCount.hidden = detail.count === 0;
      els.cartBtn.setAttribute('aria-label', detail.count
        ? 'Abrir carrito, ' + detail.count + ' productos'
        : 'Abrir carrito vacío');
      els.cartSubtotal.textContent = Utils.money(detail.subtotal);
      els.cartCheckout.disabled = detail.lines.length === 0;
      els.cartEmpty.hidden = detail.lines.length > 0;
      els.cartItems.hidden = detail.lines.length === 0;
      els.cartItems.innerHTML = detail.lines.map(cartLineTemplate).join('');
      bindImageFallbacks(els.cartItems);
      if (detail.count > 0) pulseCart();
    }

    function cartLineTemplate(line) {
      const product = line.product;
      const id = Utils.escapeHTML(product.id);
      return [
        '<li class="cart-line">',
        '<img class="cart-thumb" src="' + Utils.escapeHTML(product.imagen) + '" alt="" width="72" height="72" data-fallback>',
        '<div class="cart-line-main">',
        '<p class="cart-line-name">' + Utils.escapeHTML(product.nombre) + '</p>',
        '<p class="cart-line-price">' + Utils.money(product.precio) + ' c/u</p>',
        '<div class="qty-control" role="group" aria-label="Cantidad de ' + Utils.escapeHTML(product.nombre) + '">',
        '<button class="qty-btn" type="button" data-qty="-1" data-id="' + id + '" aria-label="Quitar una unidad">−</button>',
        '<span class="qty-value" aria-live="polite">' + line.qty + '</span>',
        '<button class="qty-btn" type="button" data-qty="1" data-id="' + id + '" aria-label="Agregar una unidad">+</button>',
        '</div>',
        '</div>',
        '<div class="cart-line-side">',
        '<p class="cart-line-total">' + Utils.money(line.lineTotal) + '</p>',
        '<button class="link-btn" type="button" data-remove="' + id + '">Eliminar</button>',
        '</div>',
        '</li>'
      ].join('');
    }

    function bindAuth() {
      document.querySelectorAll('[data-auth-tab]').forEach(function (tab) {
        tab.addEventListener('click', function () {
          switchAuthTab(tab.dataset.authTab);
        });
      });

      els.loginForm.addEventListener('submit', function (event) {
        event.preventDefault();
        const result = Auth.login(els.loginEmail.value, els.loginPassword.value);
        if (!result.ok) {
          setFormMessage(els.loginMessage, result.error);
          return;
        }
        els.loginForm.reset();
        setFormMessage(els.loginMessage, '');
        updateUser();
        closeDialog(els.authModal);
        toast('Bienvenido/a, ' + result.user.nombre + '.', 'success');
      });

      els.registerForm.addEventListener('submit', function (event) {
        event.preventDefault();
        const result = Auth.register({
          nombre: els.regName.value,
          email: els.regEmail.value,
          password: els.regPassword.value,
          confirm: els.regPassword2.value
        });

        if (!result.ok) {
          setFormMessage(els.regMessage, result.error);
          return;
        }

        els.registerForm.reset();
        setFormMessage(els.regMessage, '');
        updateUser();
        closeDialog(els.authModal);
        toast('Cuenta creada. Bienvenido/a, ' + result.user.nombre + '.', 'success');
      });
    }

    function switchAuthTab(mode) {
      document.querySelectorAll('[data-auth-tab]').forEach(function (tab) {
        const active = tab.dataset.authTab === mode;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
      });

      els.loginPanel.hidden = mode !== 'login';
      els.registerPanel.hidden = mode !== 'register';
      setFormMessage(els.loginMessage, '');
      setFormMessage(els.regMessage, '');

      const form = mode === 'login' ? els.loginForm : els.registerForm;
      const firstInput = form.querySelector('input');
      if (firstInput) firstInput.focus();
    }

    function setFormMessage(node, message) {
      if (!node) return;
      node.textContent = message || '';
    }

    function bindCheckout() {
      els.coEntrega.addEventListener('change', syncDelivery);

      els.checkoutForm.addEventListener('submit', function (event) {
        event.preventDefault();
        const detail = Cart.detail();

        if (!detail.lines.length) {
          setFormMessage(els.checkoutMessage, 'Tu carrito está vacío.');
          return;
        }

        if (!els.checkoutForm.checkValidity()) {
          els.checkoutForm.reportValidity();
          return;
        }

        const pickup = els.coEntrega.value === 'Recojo en tienda';
        const customer = {
          nombre: els.coNombre.value.trim(),
          telefono: els.coTelefono.value.trim(),
          entrega: els.coEntrega.value,
          direccion: pickup ? '' : els.coDireccion.value.trim(),
          metodo: els.coMetodo.value,
          notas: els.coNotas.value.trim()
        };

        if (!/^[0-9+\s()\-]{6,20}$/.test(customer.telefono)) {
          setFormMessage(els.checkoutMessage, 'Ingresa un teléfono válido (solo números, espacios o guiones).');
          els.coTelefono.focus();
          return;
        }

        if (!pickup && customer.direccion.length < 6) {
          setFormMessage(els.checkoutMessage, 'Ingresa una dirección de entrega válida.');
          els.coDireccion.focus();
          return;
        }

        setFormMessage(els.checkoutMessage, '');
        const order = Checkout.buildMessage(customer, detail);
        lastMessage = order.text;
        els.waCode.textContent = order.code;
        els.waOpen.href = order.url;
        Cart.clear();
        els.checkoutForm.reset();
        syncDelivery();
        closeDialog(els.checkoutModal, { restoreFocus: false });
        Checkout.launch(order.url);
        openDialog(els.waModal);
        toast('Pedido ' + order.code + ' preparado. Confirma el envío en WhatsApp.', 'success');
      });

      els.waCopy.addEventListener('click', function () {
        if (!lastMessage) return;
        copyText(lastMessage);
      });
    }

    function syncDelivery() {
      const pickup = els.coEntrega.value === 'Recojo en tienda';
      els.coDireccionField.hidden = pickup;
      els.coDireccion.required = !pickup;
      if (pickup) els.coDireccion.value = '';
    }

    function openCheckout() {
      const detail = Cart.detail();
      if (!detail.lines.length) {
        toast('Agrega productos al carrito antes de finalizar.', 'error');
        return;
      }
      renderCheckoutSummary(detail);
      prefillCheckout();
      syncDelivery();
      setFormMessage(els.checkoutMessage, '');
      openDialog(els.checkoutModal);
    }

    function renderCheckoutSummary(detail) {
      els.checkoutSummary.innerHTML = detail.lines.map(function (line) {
        return '<li><span>' + Utils.escapeHTML(line.product.nombre) +
          ' <span class="summary-qty">x' + line.qty + '</span></span>' +
          '<strong>' + Utils.money(line.lineTotal) + '</strong></li>';
      }).join('');
      els.checkoutTotal.textContent = Utils.money(detail.subtotal);
    }

    function prefillCheckout() {
      const user = Auth.currentUser();
      if (user && !els.coNombre.value.trim()) els.coNombre.value = user.nombre;
    }

    function copyText(text) {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(text).then(function () {
          toast('Resumen copiado al portapapeles.', 'success');
        }).catch(function () {
          legacyCopy(text);
        });
        return;
      }
      legacyCopy(text);
    }

    function legacyCopy(text) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '-1000px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      let copied = false;
      try {
        copied = document.execCommand('copy');
      } catch (error) {
        copied = false;
      }
      textarea.remove();
      toast(copied ? 'Resumen copiado al portapapeles.' : 'No se pudo copiar el resumen.', copied ? 'success' : 'error');
    }

    function openCheckoutDialog() {
      openCheckout();
    }

    return {
      init: init,
      toast: toast,
      openDialog: openDialog,
      openCheckout: openCheckoutDialog,
      renderCatalog: renderCatalog,
      renderCart: renderCart
    };
  })();

  const App = (function () {
    function init() {
      if (!document.getElementById('product-grid')) return;
      UI.init();
      if (!Catalog.all().length) {
        UI.toast('No se pudo leer el catálogo. Revisa db.js.', 'error');
      }
    }

    return { init: init };
  })();

  global.Malako = {
    CONFIG: CONFIG,
    Utils: Utils,
    Catalog: Catalog,
    Auth: Auth,
    Cart: Cart,
    Checkout: Checkout,
    UI: UI,
    App: App
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', App.init);
  } else {
    App.init();
  }
})(window);

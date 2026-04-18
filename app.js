/* ═══════════════════════════════════════════════════════════
   MayaCode S.A. — Aplicación principal
   SPA con localStorage, carrito, checkout y portal de cliente
═══════════════════════════════════════════════════════════ */

/* ─── ESTADO GLOBAL ──────────────────────────────────────── */
const App = {
  state: {
    view: 'home',
    cart: [],
    user: null,
    currentProduct: null,
    detailQty: 1,
    search: '',
    category: 'all',
    checkoutStep: 1,
    checkoutData: { shipping: {}, payment: 'transfer' },
    orders: [],
    portalTab: 'orders',
    quoteSuccess: false,
    lastOrder: null,
    lastQuoteSync: null,
  },

  /* ─── CATÁLOGO DINÁMICO ─────────────────────────────── */
  catalog: [...(typeof PRODUCTS !== 'undefined' ? PRODUCTS : [])],

  async loadCatalogFromOdoo() {
    try {
      const url = `${this.getBridgeUrl()}/api/products`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return;
      const data = await res.json();
      if (data.ok && Array.isArray(data.products) && data.products.length > 0) {
        this.catalog = data.products;
        this.renderFeaturedProducts();
        this.renderOffersSection();
        if (this.state.view === 'catalog') this.renderCatalog();
      }
    } catch (_) { /* bridge no disponible, usa catálogo estático */ }
  },

  /* ─── INIT ───────────────────────────────────────────── */
  init() {
    this.loadFromStorage();
    this.setupAnimationObserver();
    this.bindNavEvents();
    this.navigate('home');
    this.updateCartBadge();
    this.loadCatalogFromOdoo();
  },

  loadFromStorage() {
    try {
      const cart   = localStorage.getItem('mc_cart');
      const user   = localStorage.getItem('mc_user');
      const orders = localStorage.getItem('mc_orders');
      if (cart)   this.state.cart   = JSON.parse(cart);
      if (user)   this.state.user   = JSON.parse(user);
      if (orders) this.state.orders = JSON.parse(orders);
    } catch(e) { /* silent */ }
  },

  saveCart()   { localStorage.setItem('mc_cart',   JSON.stringify(this.state.cart));   },
  saveUser()   { localStorage.setItem('mc_user',   JSON.stringify(this.state.user));   },
  saveOrders() { localStorage.setItem('mc_orders', JSON.stringify(this.state.orders)); },

  getBridgeUrl() {
    const saved = localStorage.getItem('mc_odoo_bridge_url');
    if (saved) return saved.replace(/\/$/, '');
    // Si se sirve desde el bridge server mismo, usar mismo origin
    if (location.protocol !== 'file:') return location.origin.replace(/\/$/, '');
    return 'http://localhost:8088';
  },

  async callBridge(endpoint, payload = {}) {
    const url = `${this.getBridgeUrl()}${endpoint}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Bridge respondió HTTP ${res.status}`);
    }

    return res.json();
  },

  mapOdooStateToPortalStatus(odooState) {
    const map = {
      draft: 'pending',
      sent: 'pending',
      sale: 'processing',
      done: 'delivered',
      cancel: 'cancelled',
    };
    return map[odooState] || 'processing';
  },

  async syncOrderToOdoo(order) {
    if (!this.state.user) {
      return { synced: false, error: 'Usuario no autenticado' };
    }

    const payload = {
      localOrderId: order.id,
      user: {
        name: this.state.user.name,
        email: this.state.user.email,
      },
      shipping: order.shipping,
      payment: order.payment,
      items: order.items,
      total: order.total,
    };

    try {
      const result = await this.callBridge('/api/checkout', payload);
      if (!result?.ok) {
        return { synced: false, error: result?.error || 'No se pudo sincronizar en Odoo' };
      }

      return {
        synced: true,
        saleOrder: result.saleOrder,
        partner: result.partner,
        crmLead: result.crmLead,
      };
    } catch (e) {
      return { synced: false, error: e.message || 'Bridge no disponible' };
    }
  },

  async syncQuoteToOdoo(payload) {
    try {
      const result = await this.callBridge('/api/quote', payload);
      if (!result?.ok) {
        return { synced: false, error: result?.error || 'No se pudo registrar la cotización en Odoo' };
      }

      return {
        synced: true,
        lead: result.lead,
        partner: result.partner,
      };
    } catch (e) {
      return { synced: false, error: e.message || 'Bridge no disponible' };
    }
  },

  setupAnimationObserver() {
    if (typeof window.IntersectionObserver !== 'function') {
      this.revealObserver = null;
      return;
    }

    this.revealObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            this.revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
  },

  animateVisibleElements(scope = document) {
    const selector = [
      '.category-card',
      '.hero-stat',
      '.promo-banner',
      '.product-card',
      '.checkout-card',
      '.cart-item',
      '.order-row',
      '.auth-card',
      '.quote-card',
      '.portal-header',
    ].join(',');

    const elements = scope.querySelectorAll(selector);
    elements.forEach((el, index) => {
      el.classList.add('reveal-item');
      el.style.transitionDelay = `${Math.min(index, 10) * 35}ms`;

      if (this.revealObserver) {
        this.revealObserver.observe(el);
      } else {
        el.classList.add('is-visible');
      }
    });
  },

  /* ─── NAVEGACIÓN ─────────────────────────────────────── */
  navigate(view, data = {}) {
    // Actualizar estado
    this.state.view = view;
    if (data.product)  this.state.currentProduct = data.product;
    if (data.category) { this.state.category = data.category; }

    // Ocultar todas las vistas
    document.querySelectorAll('[data-view]').forEach(el => el.classList.add('hidden'));

    // Mostrar la vista pedida
    let activeView = view;
    let el = document.getElementById('view-' + activeView);
    if (el) {
      el.classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Renderizar contenido
    // 'register' reutiliza el contenedor de 'login'
    const resolvedView = view === 'register' ? 'login' : view;
    if (resolvedView !== view) {
      const el2 = document.getElementById('view-login');
      document.querySelectorAll('[data-view]').forEach(e => e.classList.add('hidden'));
      if (el2) el2.classList.remove('hidden');
      activeView = resolvedView;
      el = el2;
    }

    const renders = {
      home:         () => this.renderHome(),
      catalog:      () => this.renderCatalog(),
      product:      () => this.renderProductDetail(),
      cart:         () => this.renderCart(),
      checkout:     () => this.renderCheckout(),
      confirmation: () => this.renderConfirmation(),
      login:        () => this.renderLogin(),
      register:     () => this.renderRegister(),
      portal:       () => this.renderPortal(),
      quote:        () => this.renderQuote(),
    };
    if (renders[view]) renders[view]();
    this.updateNavState();
    this.animateVisibleElements(el || document);
  },

  updateNavState() {
    const u = this.state.user;
    document.getElementById('nav-user-name').textContent = u ? u.name.split(' ')[0] : 'Ingresar';
    document.getElementById('nav-user-icon').textContent = '';
    document.getElementById('nav-portal-btn').style.display = u ? 'flex' : 'none';
  },

  bindNavEvents() {
    document.getElementById('nav-logo').addEventListener('click', () => this.navigate('home'));
    document.getElementById('nav-catalog').addEventListener('click', () => this.navigate('catalog'));
    document.getElementById('nav-cart').addEventListener('click', () => this.navigate('cart'));
    document.getElementById('nav-user').addEventListener('click', () => {
      this.state.user ? this.navigate('portal') : this.navigate('login');
    });
    document.getElementById('nav-portal-btn').addEventListener('click', () => this.navigate('portal'));
    document.getElementById('nav-quote').addEventListener('click', () => this.navigate('quote'));

    // Búsqueda
    const searchInput  = document.getElementById('search-input');
    const searchCat    = document.getElementById('search-category');
    const searchSubmit = document.getElementById('search-submit');

    const doSearch = () => {
      this.state.search   = searchInput.value.trim();
      this.state.category = searchCat.value;
      this.navigate('catalog');
    };
    searchSubmit.addEventListener('click', doSearch);
    searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  },

  /* ─── HOME ───────────────────────────────────────────── */
  renderHome() {
    this.renderFeaturedProducts();
    this.renderOffersSection();
    this.bindHomeEvents();
  },

  renderFeaturedProducts() {
    const featured = this.catalog.filter(p => p.badge).slice(0, 8);
    const grid = document.getElementById('home-featured-grid');
    if (grid) grid.innerHTML = featured.map(p => this.productCardHTML(p)).join('');
  },

  renderOffersSection() {
    const offers = this.catalog.filter(p => p.oldPrice).slice(0, 4);
    const grid = document.getElementById('home-offers-grid');
    if (grid) grid.innerHTML = offers.map(p => this.productCardHTML(p)).join('');
  },

  bindHomeEvents() {
    document.querySelectorAll('.home-category-card').forEach(el => {
      el.addEventListener('click', () => {
        this.state.category = el.dataset.cat;
        this.state.search   = '';
        this.navigate('catalog');
      });
    });
    document.querySelectorAll('.see-all').forEach(el => {
      el.addEventListener('click', () => {
        this.state.category = 'all';
        this.state.search   = '';
        this.navigate('catalog');
      });
    });
    this.bindProductCardEvents();
  },

  /* ─── CATÁLOGO ───────────────────────────────────────── */
  renderCatalog() {
    // Sincronizar buscador con estado
    document.getElementById('search-input').value   = this.state.search;
    document.getElementById('search-category').value = this.state.category;

    // Filtrar
    let filtered = this.catalog;
    if (this.state.category !== 'all') {
      filtered = filtered.filter(p => p.category === this.state.category);
    }
    if (this.state.search) {
      const q = this.state.search.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }

    // Actualizar chips de categoría
    document.querySelectorAll('.filter-chip').forEach(c => {
      c.classList.toggle('active', c.dataset.cat === this.state.category);
    });

    // Resultado
    document.getElementById('catalog-results-count').textContent =
      `${filtered.length} producto${filtered.length !== 1 ? 's' : ''} encontrado${filtered.length !== 1 ? 's' : ''}`;

    const grid = document.getElementById('catalog-grid');
    if (filtered.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--gray-600)">
        <div style="font-size:3rem;margin-bottom:1rem">SIN RESULTADOS</div>
        <p style="font-weight:600">No se encontraron productos para "<strong>${this.state.search}</strong>"</p>
        <p style="font-size:.85rem;margin-top:.5rem">Intenta con otros términos o explora nuestras categorías.</p>
      </div>`;
    } else {
      grid.innerHTML = filtered.map(p => this.productCardHTML(p)).join('');
    }

    this.bindProductCardEvents();

    // Chips events
    document.querySelectorAll('.filter-chip').forEach(c => {
      c.addEventListener('click', () => {
        this.state.category = c.dataset.cat;
        this.renderCatalog();
      });
    });

    this.animateVisibleElements(document.getElementById('view-catalog'));
  },

  /* ─── TARJETA PRODUCTO HTML ──────────────────────────── */
  productCardHTML(p) {
    const discount = p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
    const catLabel = CATEGORIES.find(c => c.id === p.category)?.label || p.category;
    const starsHtml = this.starsHTML(p.rating);
    return `
    <div class="product-card" data-pid="${p.id}">
      <img class="product-card-img" src="${p.image}" alt="${p.name}" loading="lazy"
           onerror="this.src='https://placehold.co/400x300/1e40af/ffffff?text=${encodeURIComponent(p.name)}'">
      ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ''}
      <div class="product-card-body">
        <div class="product-category">${catLabel}</div>
        <div class="product-name">${p.name}</div>
        <div class="product-desc">${p.description}</div>
        <div class="product-rating">
          <span class="stars">${starsHtml}</span>
          <span class="rating-count">(${p.reviews})</span>
        </div>
        <div class="product-price-row">
          <span class="product-price">Q${p.price.toLocaleString('es-GT')}</span>
          ${p.oldPrice ? `<span class="product-old-price">Q${p.oldPrice.toLocaleString('es-GT')}</span>
          <span class="product-discount">-${discount}%</span>` : ''}
        </div>
        <button class="btn-add-cart" data-pid="${p.id}">
          Agregar al carrito
        </button>
      </div>
    </div>`;
  },

  starsHTML(rating) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
      html += i <= Math.round(rating) ? '★' : '☆';
    }
    return html;
  },

  bindProductCardEvents() {
    document.querySelectorAll('.product-card').forEach(card => {
      // Click en imagen/nombre → detalle
      card.addEventListener('click', e => {
        if (!e.target.closest('.btn-add-cart')) {
          const pid = parseInt(card.dataset.pid);
          const product = App.catalog.find(p => p.id === pid);
          if (product) {
            this.state.currentProduct = product;
            this.state.detailQty = 1;
            this.navigate('product');
          }
        }
      });
    });

    document.querySelectorAll('.btn-add-cart').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const pid = parseInt(btn.dataset.pid);
        const product = App.catalog.find(p => p.id === pid);
        if (product) {
          this.addToCart(product, 1);
          btn.classList.add('added');
          btn.innerHTML = '<span>✓</span> Agregado';
          setTimeout(() => {
            btn.classList.remove('added');
            btn.innerHTML = 'Agregar al carrito';
          }, 1500);
        }
      });
    });
  },

  /* ─── DETALLE DE PRODUCTO ────────────────────────────── */
  renderProductDetail() {
    const p = this.state.currentProduct;
    if (!p) { this.navigate('catalog'); return; }

    const catLabel = CATEGORIES.find(c => c.id === p.category)?.label || p.category;
    const discount = p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
    const stockClass = p.stock <= 5 ? 'stock-low' : 'stock-ok';
    const stockIcon  = p.stock <= 5 ? 'Stock:' : 'Stock:';
    const stockMsg   = p.stock <= 5 ? `Solo ${p.stock} en stock` : `${p.stock} en stock`;

    const container = document.getElementById('product-detail-content');
    container.innerHTML = `
      <nav class="breadcrumb">
        <span onclick="App.navigate('home')">Inicio</span> /
        <span onclick="App.navigate('catalog')">Catálogo</span> /
        <span onclick="App.state.category='${p.category}';App.navigate('catalog')">${catLabel}</span> /
        <span style="color:var(--blue-dark);font-weight:600">${p.name}</span>
      </nav>
      <div class="product-detail-grid">
        <div>
          <img class="product-detail-img" src="${p.image}" alt="${p.name}"
               onerror="this.src='https://placehold.co/400x300/1e40af/ffffff?text=${encodeURIComponent(p.name)}'">
        </div>
        <div class="product-detail-body">
          <div class="detail-category">${catLabel}</div>
          <h1>${p.name}</h1>
          <div class="detail-rating">
            <span class="stars" style="font-size:1rem">${this.starsHTML(p.rating)}</span>
            <span class="rating-count" style="font-size:.85rem">${p.rating} — ${p.reviews} reseñas</span>
          </div>
          <div class="detail-price">Q${p.price.toLocaleString('es-GT')}</div>
          ${p.oldPrice ? `<div class="detail-old-price">Antes: Q${p.oldPrice.toLocaleString('es-GT')}
            <span style="color:var(--red);font-weight:700;margin-left:.35rem">-${discount}%</span></div>` : '<div style="margin-bottom:1rem"></div>'}
          <p class="detail-desc">${p.fullDescription}</p>
          <div class="detail-specs">
            <h4>Especificaciones técnicas</h4>
            <ul>${p.specs.map(s => `<li>${s}</li>`).join('')}</ul>
          </div>
          <div class="stock-info">
            <span>${stockIcon}</span>
            <span class="${stockClass}">${stockMsg}</span>
          </div>
          <div class="qty-row">
            <div class="qty-control">
              <button class="qty-btn" id="qty-minus">−</button>
              <span class="qty-val" id="qty-display">1</span>
              <button class="qty-btn" id="qty-plus">+</button>
            </div>
            <button class="btn-add-detail" id="btn-add-detail">
              Agregar al carrito
            </button>
            <button class="btn-quote-detail" onclick="App.navigate('quote')">
              Cotizar
            </button>
          </div>
        </div>
      </div>
    `;

    // Eventos cantidad
    document.getElementById('qty-minus').addEventListener('click', () => {
      if (this.state.detailQty > 1) {
        this.state.detailQty--;
        document.getElementById('qty-display').textContent = this.state.detailQty;
      }
    });
    document.getElementById('qty-plus').addEventListener('click', () => {
      if (this.state.detailQty < p.stock) {
        this.state.detailQty++;
        document.getElementById('qty-display').textContent = this.state.detailQty;
      }
    });

    // Agregar al carrito
    document.getElementById('btn-add-detail').addEventListener('click', () => {
      this.addToCart(p, this.state.detailQty);
      const btn = document.getElementById('btn-add-detail');
      btn.innerHTML = '✓ Agregado al carrito';
      btn.style.background = 'var(--green)';
      setTimeout(() => {
        btn.innerHTML = 'Agregar al carrito';
        btn.style.background = '';
      }, 1800);
    });

    // También renderizar productos relacionados
    const related = App.catalog.filter(rp => rp.category === p.category && rp.id !== p.id).slice(0, 4);
    const relGrid = document.getElementById('related-grid');
    if (relGrid) {
      relGrid.innerHTML = related.map(rp => this.productCardHTML(rp)).join('');
      this.bindProductCardEvents();
    }
  },

  /* ─── CARRITO ────────────────────────────────────────── */
  addToCart(product, qty = 1) {
    const existing = this.state.cart.find(item => item.id === product.id);
    if (existing) {
      existing.qty = Math.min(existing.qty + qty, product.stock);
    } else {
      this.state.cart.push({ ...product, qty });
    }
    this.saveCart();
    this.updateCartBadge();
    this.showToast(`✓ ${product.name} agregado al carrito`, 'success');
  },

  removeFromCart(id) {
    this.state.cart = this.state.cart.filter(item => item.id !== id);
    this.saveCart();
    this.updateCartBadge();
    this.renderCart();
  },

  updateCartQty(id, delta) {
    const item = this.state.cart.find(i => i.id === id);
    if (!item) return;
    const newQty = item.qty + delta;
    if (newQty <= 0) {
      this.removeFromCart(id);
      return;
    }
    item.qty = Math.min(newQty, item.stock);
    this.saveCart();
    this.renderCart();
    this.updateCartBadge();
  },

  updateCartBadge() {
    const total = this.state.cart.reduce((s, i) => s + i.qty, 0);
    const badge = document.getElementById('cart-count');
    if (badge) {
      badge.textContent = total;
      badge.style.display = total > 0 ? 'flex' : 'none';
    }
  },

  cartTotal() {
    return this.state.cart.reduce((s, i) => s + i.price * i.qty, 0);
  },

  renderCart() {
    const container = document.getElementById('cart-content');
    const cart = this.state.cart;

    if (cart.length === 0) {
      container.innerHTML = `
        <div class="cart-empty">
          <div class="cart-empty-icon">-</div>
          <h3 style="font-weight:800;color:var(--blue-dark);margin-bottom:.5rem">Tu carrito está vacío</h3>
          <p>Explora nuestro catálogo y agrega los productos que necesitas.</p>
          <button class="btn-primary" style="margin-top:1.25rem" onclick="App.navigate('catalog')">
            Ver catálogo
          </button>
        </div>`;
      return;
    }

    const items = cart.map(item => {
      const subtotal = item.price * item.qty;
      return `
      <div class="cart-item" data-id="${item.id}">
        <img class="cart-item-img" src="${item.image}" alt="${item.name}"
             onerror="this.src='https://placehold.co/80x65/1e40af/ffffff?text=IMG'">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-cat">${CATEGORIES.find(c=>c.id===item.category)?.label||''}</div>
          <div class="cart-item-price">Q${item.price.toLocaleString('es-GT')}</div>
          <div class="cart-item-actions">
            <div class="cart-qty-control">
              <button class="cart-qty-btn" onclick="App.updateCartQty(${item.id},-1)">−</button>
              <span class="cart-qty-val">${item.qty}</span>
              <button class="cart-qty-btn" onclick="App.updateCartQty(${item.id},1)">+</button>
            </div>
            <button class="cart-remove" onclick="App.removeFromCart(${item.id})">Eliminar</button>
          </div>
        </div>
        <div class="cart-subtotal">Q${subtotal.toLocaleString('es-GT')}</div>
      </div>`;
    }).join('');

    const total = this.cartTotal();
    const shipping = total >= 500 ? 0 : 45;
    const grandTotal = total + shipping;

    container.innerHTML = `
      <div class="cart-grid">
        <div>
          <div style="font-weight:700;color:var(--blue-dark);margin-bottom:1rem">
            Productos (${cart.reduce((s,i)=>s+i.qty,0)} artículos)
          </div>
          ${items}
        </div>
        <div class="cart-summary">
          <div class="summary-title">Resumen del pedido</div>
          <div class="summary-line">
            <span>Subtotal</span><span>Q${total.toLocaleString('es-GT')}</span>
          </div>
          <div class="summary-line shipping">
            <span>Envío</span>
            <span>${shipping === 0 ? '¡Gratis!' : 'Q' + shipping}</span>
          </div>
          ${shipping > 0 ? `<p style="font-size:.75rem;color:var(--gray-600);margin-top:-.25rem">
            Envío gratis en compras mayores a Q500</p>` : ''}
          <div class="summary-line total">
            <span>Total</span><span>Q${grandTotal.toLocaleString('es-GT')}</span>
          </div>
          <button class="btn-checkout" onclick="App.startCheckout()">
            Proceder al pago →
          </button>
          <button style="width:100%;margin-top:.5rem;padding:.55rem;border-radius:8px;border:1.5px solid var(--gray-200);font-size:.85rem;font-weight:600;cursor:pointer;transition:all .2s"
            onmouseover="this.style.background='var(--gray-100)'" onmouseout="this.style.background=''"
            onclick="App.navigate('catalog')">
            ← Seguir comprando
          </button>
        </div>
      </div>`;

    this.animateVisibleElements(document.getElementById('view-cart'));
  },

  /* ─── CHECKOUT ───────────────────────────────────────── */
  startCheckout() {
    if (this.state.cart.length === 0) {
      this.showToast('Tu carrito está vacío', 'warning');
      return;
    }
    if (!this.state.user) {
      this.showToast('Inicia sesión para continuar', 'warning');
      this.navigate('login');
      return;
    }
    this.state.checkoutStep = 1;
    this.navigate('checkout');
  },

  renderCheckout() {
    this.updateSteps();
    const step = this.state.checkoutStep;

    // Actualizar visibilidad de pasos
    ['step1','step2','step3'].forEach((id, i) => {
      document.getElementById(id).classList.toggle('hidden', i + 1 !== step);
    });

    if (step === 1) this.renderCheckoutStep1();
    if (step === 2) this.renderCheckoutStep2();
    if (step === 3) this.renderCheckoutStep3();
  },

  updateSteps() {
    const step = this.state.checkoutStep;
    document.querySelectorAll('.checkout-step').forEach((el, i) => {
      el.classList.remove('active', 'done');
      if (i + 1 === step) el.classList.add('active');
      if (i + 1 < step)  el.classList.add('done');
    });
  },

  renderCheckoutStep1() {
    const cart = this.state.cart;
    const total = this.cartTotal();
    const shipping = total >= 500 ? 0 : 45;
    const grandTotal = total + shipping;

    const items = cart.map(item => `
      <div class="order-item-mini">
        <span>${item.name} × ${item.qty}</span>
        <span>Q${(item.price * item.qty).toLocaleString('es-GT')}</span>
      </div>`).join('');

    document.getElementById('step1-content').innerHTML = `
      <div class="checkout-card">
        <h3>Resumen del pedido</h3>
        <div class="order-summary-mini">
          ${items}
          <div class="summary-line" style="margin-top:.75rem;padding-top:.5rem;border-top:1px solid var(--gray-200)">
            <span style="font-size:.85rem">Envío</span>
            <span style="font-size:.85rem;color:var(--green)">${shipping === 0 ? 'Gratis' : 'Q' + shipping}</span>
          </div>
          <div class="order-total-mini">
            <span>Total a pagar</span>
            <span>Q${grandTotal.toLocaleString('es-GT')}</span>
          </div>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:.75rem;flex-wrap:wrap">
        <button class="btn-back" onclick="App.navigate('cart')">← Volver al carrito</button>
        <button class="btn-next" onclick="App.goToStep(2)">Datos de envío →</button>
      </div>`;
  },

  renderCheckoutStep2() {
    const u = this.state.user;
    const d = this.state.checkoutData.shipping;

    const deptOptions = DEPARTAMENTOS_GT.map(dep =>
      `<option value="${dep}" ${(d.departamento || dep === 'Guatemala') === dep ? 'selected' : ''}>${dep}</option>`
    ).join('');

    document.getElementById('step2-content').innerHTML = `
      <div class="checkout-card">
        <h3>Datos de envío</h3>
        <form id="shipping-form" onsubmit="return false">
          <div class="form-row">
            <div class="form-group">
              <label>Nombre completo *</label>
              <input type="text" id="s-name" required placeholder="Ej: Juan García"
                     value="${d.name || u?.name || ''}">
            </div>
            <div class="form-group">
              <label>Correo electrónico *</label>
              <input type="email" id="s-email" required placeholder="correo@ejemplo.com"
                     value="${d.email || u?.email || ''}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Teléfono *</label>
              <input type="tel" id="s-phone" required placeholder="5555-1234"
                     value="${d.phone || ''}">
            </div>
            <div class="form-group">
              <label>Departamento *</label>
              <select id="s-dept">${deptOptions}</select>
            </div>
          </div>
          <div class="form-group full">
            <label>Dirección completa *</label>
            <input type="text" id="s-address" required placeholder="Zona, colonia, calle y número"
                   value="${d.address || ''}">
          </div>
          <div class="form-group full">
            <label>Referencia / Notas adicionales</label>
            <textarea id="s-notes" placeholder="Color del portón, punto de referencia...">${d.notes || ''}</textarea>
          </div>
        </form>
      </div>
      <div style="display:flex;justify-content:space-between;gap:.75rem;flex-wrap:wrap">
        <button class="btn-back" onclick="App.goToStep(1)">← Regresar</button>
        <button class="btn-next" onclick="App.saveShippingAndContinue()">Método de pago →</button>
      </div>`;
  },

  saveShippingAndContinue() {
    const name    = document.getElementById('s-name').value.trim();
    const email   = document.getElementById('s-email').value.trim();
    const phone   = document.getElementById('s-phone').value.trim();
    const dept    = document.getElementById('s-dept').value;
    const address = document.getElementById('s-address').value.trim();
    const notes   = document.getElementById('s-notes').value.trim();

    if (!name || !email || !phone || !address) {
      this.showToast('Por favor completa todos los campos obligatorios', 'error');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.showToast('Ingresa un correo válido', 'error');
      return;
    }

    this.state.checkoutData.shipping = { name, email, phone, departamento: dept, address, notes };
    this.goToStep(3);
  },

  renderCheckoutStep3() {
    const d = this.state.checkoutData;
    const total = this.cartTotal();
    const shipping = total >= 500 ? 0 : 45;
    const grandTotal = total + shipping;

    document.getElementById('step3-content').innerHTML = `
      <div class="checkout-card">
        <h3>Método de pago</h3>
        <div class="payment-methods" id="payment-methods-container">
          ${this.paymentMethodHTML('transfer','TR','Transferencia bancaria',
            'Banco Industrial / BAM / Banrural. Adjunta tu comprobante.')}
          ${this.paymentMethodHTML('delivery','CE','Pago contra entrega',
            'Paga en efectivo al recibir tu pedido. Solo zona metropolitana.')}
          ${this.paymentMethodHTML('card','TC','Tarjeta de crédito / débito',
            'Visa, Mastercard, American Express. Procesado de forma segura.')}
        </div>
        ${d.payment === 'card' ? this.cardFormHTML() : ''}
      </div>
      <div class="checkout-card" style="margin-top:1rem">
        <h3>Confirmar pedido</h3>
        <div style="background:var(--gray-50);border-radius:8px;padding:1rem;font-size:.85rem;margin-bottom:1rem">
          <div style="display:flex;justify-content:space-between;margin-bottom:.4rem">
            <span style="font-weight:600">Entregar a:</span>
            <span>${d.shipping.name || ''}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:.4rem">
            <span style="font-weight:600">Dirección:</span>
            <span>${d.shipping.address || ''}, ${d.shipping.departamento || ''}</span>
          </div>
          <div style="display:flex;justify-content:space-between">
            <span style="font-weight:600">Total:</span>
            <span style="font-weight:800;color:var(--blue-dark)">Q${grandTotal.toLocaleString('es-GT')}</span>
          </div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;gap:.75rem;flex-wrap:wrap">
        <button class="btn-back" onclick="App.goToStep(2)">← Regresar</button>
        <button class="btn-next" style="background:var(--green)" onclick="App.placeOrder()">
          ✓ Confirmar pedido
        </button>
      </div>`;

    // Eventos de métodos de pago
    document.querySelectorAll('.payment-method').forEach(pm => {
      pm.addEventListener('click', () => {
        this.state.checkoutData.payment = pm.dataset.method;
        document.querySelectorAll('.payment-method').forEach(p => p.classList.remove('selected'));
        pm.classList.add('selected');
        // Re-render si cambió a/de tarjeta
        const cardFormEl = document.getElementById('card-form-section');
        if (pm.dataset.method === 'card' && !cardFormEl) {
          pm.closest('.payment-methods').insertAdjacentHTML('afterend', this.cardFormHTML());
        } else if (pm.dataset.method !== 'card' && cardFormEl) {
          cardFormEl.remove();
        }
      });
    });
  },

  paymentMethodHTML(method, icon, label, desc) {
    const selected = this.state.checkoutData.payment === method ? 'selected' : '';
    return `
    <div class="payment-method ${selected}" data-method="${method}">
      <input type="radio" name="payment" ${selected ? 'checked' : ''}>
      <span class="pm-icon">${icon}</span>
      <div class="pm-info">
        <strong>${label}</strong>
        <span>${desc}</span>
      </div>
    </div>`;
  },

  cardFormHTML() {
    return `
    <div id="card-form-section" style="margin-top:1rem;padding:1rem;background:var(--gray-50);border-radius:8px">
      <p style="font-size:.8rem;color:var(--gray-600);margin-bottom:.75rem">
        Pago simulado — No ingreses datos reales de tarjeta
      </p>
      <div class="form-row">
        <div class="form-group full">
          <label>Número de tarjeta</label>
          <input type="text" placeholder="1234 5678 9012 3456" maxlength="19"
                 oninput="this.value=this.value.replace(/[^0-9]/g,'').replace(/(.{4})/g,'$1 ').trim()">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Vencimiento</label>
          <input type="text" placeholder="MM/AA" maxlength="5">
        </div>
        <div class="form-group">
          <label>CVV</label>
          <input type="text" placeholder="123" maxlength="4">
        </div>
      </div>
      <div class="form-group">
        <label>Nombre en la tarjeta</label>
        <input type="text" placeholder="Como aparece en la tarjeta">
      </div>
    </div>`;
  },

  goToStep(step) {
    this.state.checkoutStep = step;
    this.renderCheckout();
  },

  async placeOrder() {
    // Generar número de orden
    const orderNum = 'MC-' + Date.now().toString().slice(-8);
    const order = {
      id: orderNum,
      date: new Date().toLocaleDateString('es-GT'),
      items: [...this.state.cart],
      total: this.cartTotal() + (this.cartTotal() >= 500 ? 0 : 45),
      shipping: { ...this.state.checkoutData.shipping },
      payment: this.state.checkoutData.payment,
      status: 'processing',
      odoo: { synced: false },
    };

    const sync = await this.syncOrderToOdoo(order);
    order.odoo = sync;
    if (sync.synced) {
      order.status = this.mapOdooStateToPortalStatus(sync.saleOrder?.state);
      this.showToast('Pedido sincronizado con Odoo (ERP + CRM)', 'success');
    } else {
      order.status = 'processing';
      this.showToast('Pedido guardado en modo local. Odoo no respondió.', 'warning');
    }

    this.state.orders.unshift(order);
    this.saveOrders();

    // Limpiar carrito
    this.state.cart = [];
    this.saveCart();
    this.updateCartBadge();

    // Guardar orden actual para mostrar en confirmación
    this.state.lastOrder = order;
    this.navigate('confirmation');
  },

  /* ─── CONFIRMACIÓN ───────────────────────────────────── */
  renderConfirmation() {
    const order = this.state.lastOrder;
    if (!order) { this.navigate('home'); return; }

    const synced = Boolean(order.odoo?.synced);
    const saleOrderName = order.odoo?.saleOrder?.name || order.id;
    const syncError = order.odoo?.error || '';

    const paymentLabels = {
      transfer: 'Transferencia bancaria',
      delivery: 'Pago contra entrega',
      card:     'Tarjeta de crédito/débito',
    };

    document.getElementById('confirmation-content').innerHTML = `
      <div class="confirm-icon">OK</div>
      <h2 class="confirm-title">¡Pedido realizado con éxito!</h2>
      <p class="confirm-subtitle">Gracias por tu compra. Recibirás una confirmación por correo electrónico.</p>


      <div class="confirm-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:.5rem;margin-bottom:1rem">
          <div>
            <p style="font-size:.8rem;color:var(--gray-600)">Número de orden</p>
            <div class="confirm-order-num">${order.id}</div>
          </div>
          <div style="text-align:right">
            <p style="font-size:.8rem;color:var(--gray-600)">Fecha</p>
            <p style="font-weight:700">${order.date}</p>
          </div>
        </div>

        <hr class="divider">

        <div style="font-size:.85rem">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.75rem">
            <div><span style="color:var(--gray-600)">Entregar a:</span> <strong>${order.shipping.name}</strong></div>
            <div><span style="color:var(--gray-600)">Pago:</span> <strong>${paymentLabels[order.payment]}</strong></div>
            <div style="grid-column:1/-1"><span style="color:var(--gray-600)">Dirección:</span> ${order.shipping.address}, ${order.shipping.departamento}</div>
          </div>

          <div style="background:var(--gray-50);border-radius:8px;padding:.75rem">
            ${order.items.map(item => `
              <div style="display:flex;justify-content:space-between;padding:.3rem 0;border-bottom:1px solid var(--gray-200)">
                <span>${item.name} × ${item.qty}</span>
                <span>Q${(item.price*item.qty).toLocaleString('es-GT')}</span>
              </div>`).join('')}
            <div style="display:flex;justify-content:space-between;margin-top:.5rem;font-weight:800;color:var(--blue-dark)">
              <span>Total pagado</span>
              <span>Q${order.total.toLocaleString('es-GT')}</span>
            </div>
          </div>
        </div>
      </div>

      <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;margin-top:.5rem">
        <button class="btn-primary" onclick="App.navigate('portal')">Ver mis pedidos</button>
        <button class="btn-outline" style="background:transparent;color:var(--blue-dark);border-color:var(--gray-200)"
          onclick="App.navigate('home')">Seguir comprando</button>
      </div>`;
  },

  /* ─── AUTH ───────────────────────────────────────────── */
  renderLogin() {
    document.getElementById('auth-content').innerHTML = `
      <div class="auth-container">
        <div class="auth-card">
          <div class="auth-logo">
            <div class="brand-logo-lg">MC</div>
            <h2>Iniciar sesión</h2>
            <p>Accede a tu cuenta para comprar y ver tus pedidos</p>
          </div>
          <div id="auth-error" style="display:none;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:.65rem;font-size:.82rem;color:#dc2626;margin-bottom:.75rem"></div>
          <div class="form-group-auth">
            <label>Correo electrónico</label>
            <input type="email" id="login-email" placeholder="tu@correo.com">
          </div>
          <div class="form-group-auth">
            <label>Contraseña</label>
            <input type="password" id="login-pass" placeholder="••••••••">
          </div>
          <button class="btn-auth" onclick="App.doLogin()">Ingresar →</button>
          <div style="text-align:center;margin-top:.5rem">
            <span style="font-size:.8rem;color:var(--gray-600);cursor:pointer" onclick="App.navigate('home')">
              ¿Olvidaste tu contraseña?
            </span>
          </div>
          <div class="auth-toggle">
            ¿No tienes cuenta? <a onclick="App.navigate('register')">Regístrate gratis</a>
          </div>
        </div>
        <p style="text-align:center;font-size:.75rem;color:var(--gray-600);margin-top:1rem">
          Demo: usa cualquier correo y contraseña (mín. 6 caracteres)
        </p>
      </div>`;

    document.getElementById('login-pass').addEventListener('keydown', e => {
      if (e.key === 'Enter') this.doLogin();
    });
  },

  doLogin() {
    const email = document.getElementById('login-email').value.trim();
    const pass  = document.getElementById('login-pass').value;
    const errEl = document.getElementById('auth-error');

    if (!email || !pass) {
      errEl.textContent = 'Por favor ingresa tu correo y contraseña.';
      errEl.style.display = 'block';
      return;
    }
    if (pass.length < 6) {
      errEl.textContent = 'La contraseña debe tener al menos 6 caracteres.';
      errEl.style.display = 'block';
      return;
    }

    // Simulación: aceptar cualquier credencial válida
    const users = JSON.parse(localStorage.getItem('mc_users') || '[]');
    const existing = users.find(u => u.email === email);

    if (existing) {
      if (existing.pass !== pass) {
        errEl.textContent = 'Contraseña incorrecta. Inténtalo de nuevo.';
        errEl.style.display = 'block';
        return;
      }
      this.state.user = existing;
    } else {
      // Auto-registro con el email
      const newUser = { id: Date.now(), email, pass, name: email.split('@')[0], joined: new Date().toLocaleDateString('es-GT') };
      users.push(newUser);
      localStorage.setItem('mc_users', JSON.stringify(users));
      this.state.user = newUser;
    }

    this.saveUser();
    this.updateNavState();
    this.showToast(`¡Bienvenido, ${this.state.user.name}!`, 'success');
    this.navigate('home');
  },

  renderRegister() {
    document.getElementById('auth-content').innerHTML = `
      <div class="auth-container">
        <div class="auth-card">
          <div class="auth-logo">
            <div class="brand-logo-lg">MC</div>
            <h2>Crear cuenta</h2>
            <p>Regístrate para comenzar a comprar en MayaCode</p>
          </div>
          <div id="auth-error" style="display:none;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:.65rem;font-size:.82rem;color:#dc2626;margin-bottom:.75rem"></div>
          <div class="form-group-auth">
            <label>Nombre completo</label>
            <input type="text" id="reg-name" placeholder="Tu nombre completo">
          </div>
          <div class="form-group-auth">
            <label>Correo electrónico</label>
            <input type="email" id="reg-email" placeholder="tu@correo.com">
          </div>
          <div class="form-group-auth">
            <label>Contraseña</label>
            <input type="password" id="reg-pass" placeholder="Mínimo 6 caracteres">
          </div>
          <div class="form-group-auth">
            <label>Confirmar contraseña</label>
            <input type="password" id="reg-pass2" placeholder="Repite tu contraseña">
          </div>
          <button class="btn-auth" onclick="App.doRegister()">Crear cuenta →</button>
          <div class="auth-toggle">
            ¿Ya tienes cuenta? <a onclick="App.navigate('login')">Inicia sesión</a>
          </div>
        </div>
      </div>`;
  },

  doRegister() {
    const name  = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const pass  = document.getElementById('reg-pass').value;
    const pass2 = document.getElementById('reg-pass2').value;
    const errEl = document.getElementById('auth-error');

    if (!name || !email || !pass || !pass2) {
      errEl.textContent = 'Por favor completa todos los campos.';
      errEl.style.display = 'block'; return;
    }
    if (pass.length < 6) {
      errEl.textContent = 'La contraseña debe tener mínimo 6 caracteres.';
      errEl.style.display = 'block'; return;
    }
    if (pass !== pass2) {
      errEl.textContent = 'Las contraseñas no coinciden.';
      errEl.style.display = 'block'; return;
    }

    const users = JSON.parse(localStorage.getItem('mc_users') || '[]');
    if (users.find(u => u.email === email)) {
      errEl.textContent = 'Ya existe una cuenta con ese correo.';
      errEl.style.display = 'block'; return;
    }

    const newUser = { id: Date.now(), email, pass, name, joined: new Date().toLocaleDateString('es-GT') };
    users.push(newUser);
    localStorage.setItem('mc_users', JSON.stringify(users));
    this.state.user = newUser;
    this.saveUser();
    this.updateNavState();
    this.showToast(`Cuenta creada. Bienvenido, ${name}.`, 'success');
    this.navigate('home');
  },

  logout() {
    this.state.user = null;
    localStorage.removeItem('mc_user');
    this.updateNavState();
    this.showToast('Sesión cerrada correctamente', 'success');
    this.navigate('home');
  },

  /* ─── PORTAL DEL CLIENTE ─────────────────────────────── */
  renderPortal() {
    if (!this.state.user) { this.navigate('login'); return; }
    const u = this.state.user;

    document.getElementById('portal-header').innerHTML = `
      <div class="portal-header">
        <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap">
          <div style="width:52px;height:52px;background:rgba(255,255,255,.2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.5rem">
            MC
          </div>
          <div>
            <h2>Hola, ${u.name}</h2>
            <p>${u.email} · Miembro desde ${u.joined || 'hoy'}</p>
          </div>
          <button onclick="App.logout()" style="margin-left:auto;background:rgba(255,255,255,.15);color:white;border:1px solid rgba(255,255,255,.3);border-radius:8px;padding:.4rem .85rem;font-size:.82rem;font-weight:600;cursor:pointer">
            Cerrar sesión
          </button>
        </div>
      </div>`;

    this.renderPortalTab('orders');

    // Bind tabs
    document.querySelectorAll('.portal-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.portal-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.renderPortalTab(tab.dataset.tab);
      });
    });
  },

  renderPortalTab(tab) {
    const container = document.getElementById('portal-tab-content');

    if (tab === 'orders') {
      const orders = this.state.orders;
      const statusLabel = {
        pending:'Pendiente',
        processing:'En proceso',
        shipped:'Enviado',
        delivered:'Entregado',
        cancelled:'Cancelado',
      };
      const statusClass = {
        pending:'status-pending',
        processing:'status-processing',
        shipped:'status-shipped',
        delivered:'status-delivered',
        cancelled:'status-pending',
      };

      if (orders.length === 0) {
        container.innerHTML = `
          <div style="text-align:center;padding:3rem;color:var(--gray-600)">
            <div style="font-size:1rem;margin-bottom:1rem;font-weight:700;letter-spacing:.08em">PEDIDOS</div>
            <h3 style="font-weight:800;color:var(--blue-dark);margin-bottom:.5rem">Sin pedidos aún</h3>
            <p>Cuando realices una compra, podrás ver el estado de tu pedido aquí.</p>
            <button class="btn-primary" style="margin-top:1.25rem" onclick="App.navigate('catalog')">
              Explorar catálogo
            </button>
          </div>`;
        this.animateVisibleElements(document.getElementById('view-portal'));
        return;
      }

      container.innerHTML = orders.map(order => {
        const preview = order.items.slice(0,2).map(i=>i.name).join(', ') + (order.items.length > 2 ? '...' : '');
        return `
        <div class="order-row">
          <div>
            <div class="order-num">${order.id}</div>
            <div class="order-date">${order.date}</div>
          </div>
          <div class="order-items-preview">${preview}</div>
          <span class="order-status ${statusClass[order.status] || 'status-processing'}">
            ${statusLabel[order.status] || 'En proceso'}
          </span>
          <div class="order-total-col">Q${order.total.toLocaleString('es-GT')}</div>
        </div>`;
      }).join('');

    }

    if (tab === 'profile') {
      const u = this.state.user;
      container.innerHTML = `
        <div class="auth-card" style="max-width:480px">
          <h3 style="font-size:1rem;font-weight:800;margin-bottom:1rem;color:var(--blue-dark)">Mi perfil</h3>
          <div class="form-row">
            <div class="form-group">
              <label>Nombre</label>
              <input type="text" value="${u.name}" id="profile-name">
            </div>
            <div class="form-group">
              <label>Correo</label>
              <input type="email" value="${u.email}" disabled style="background:var(--gray-100)">
            </div>
          </div>
          <button class="btn-auth" style="margin-top:.5rem" onclick="App.saveProfile()">
            Guardar cambios
          </button>
        </div>`;
    }

    if (tab === 'wishlist') {
      container.innerHTML = `
        <div style="text-align:center;padding:3rem;color:var(--gray-600)">
          <div style="font-size:1rem;margin-bottom:1rem;font-weight:700;letter-spacing:.08em">LISTA</div>
          <h3 style="font-weight:800;color:var(--blue-dark)">Lista de deseos</h3>
          <p>Pronto podrás guardar tus productos favoritos aquí.</p>
        </div>`;
    }

    this.animateVisibleElements(document.getElementById('view-portal'));
  },

  saveProfile() {
    const name = document.getElementById('profile-name').value.trim();
    if (!name) { this.showToast('El nombre no puede estar vacío', 'error'); return; }
    this.state.user.name = name;
    this.saveUser();
    this.showToast('Perfil actualizado correctamente', 'success');
    this.updateNavState();
  },

  /* ─── COTIZACIÓN ──────────────────────────────────────── */
  renderQuote() {
    const container = document.getElementById('quote-content');
    if (this.state.quoteSuccess) {
      const quoteSync = this.state.lastQuoteSync || { synced: false };
      container.innerHTML = `
        <div class="quote-card" style="text-align:center">
          <div style="font-size:1rem;margin-bottom:1rem;font-weight:700;letter-spacing:.08em">ENVIADO</div>
          <h2>¡Cotización enviada!</h2>
          <p style="color:var(--gray-600);margin-top:.5rem;margin-bottom:1.5rem">
            Nuestro equipo revisará tu solicitud y te contactará en menos de 24 horas
            con una propuesta personalizada.
          </p>
          ${quoteSync.synced ? `
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:1rem;text-align:left;font-size:.85rem;color:#166534;margin-bottom:1.5rem">
              <strong>Registrado en CRM:</strong> Tu solicitud fue ingresada en Odoo CRM${quoteSync.lead?.name ? ` como <strong>${quoteSync.lead.name}</strong>` : ''}
              y asignada a un ejecutivo de ventas.
            </div>
          ` : `
            <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:1rem;text-align:left;font-size:.85rem;color:#9a3412;margin-bottom:1.5rem">
              <strong>Modo local:</strong> La cotización se guardó en la web, pero no pudo sincronizarse con Odoo CRM.
              ${quoteSync.error ? `Detalle: ${quoteSync.error}.` : ''}
            </div>
          `}
          <button class="btn-primary" onclick="App.state.quoteSuccess=false;App.navigate('home')">
            Volver al inicio
          </button>
        </div>`;
      this.animateVisibleElements(document.getElementById('view-quote'));
      return;
    }

    const productOptions = App.catalog.map(p =>
      `<option value="${p.id}">${p.name} — Q${p.price.toLocaleString('es-GT')}</option>`
    ).join('');

    container.innerHTML = `
      <div class="quote-card">
        <h2>Solicitar Cotización</h2>
        <p class="sub">Completa el formulario y un asesor de ventas te contactará dentro de las próximas 24 horas con
        una propuesta personalizada para tu empresa o proyecto.</p>

        <div class="form-row">
          <div class="form-group">
            <label>Nombre completo *</label>
            <input type="text" id="q-name" placeholder="Tu nombre" value="${this.state.user?.name || ''}">
          </div>
          <div class="form-group">
            <label>Empresa / Organización</label>
            <input type="text" id="q-company" placeholder="Nombre de tu empresa">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Correo electrónico *</label>
            <input type="email" id="q-email" placeholder="correo@empresa.com" value="${this.state.user?.email || ''}">
          </div>
          <div class="form-group">
            <label>Teléfono *</label>
            <input type="tel" id="q-phone" placeholder="5555-1234">
          </div>
        </div>
        <div class="form-group" style="margin-bottom:.9rem">
          <label>Producto de interés *</label>
          <select id="q-product"><option value="">-- Selecciona un producto --</option>${productOptions}</select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Cantidad aproximada</label>
            <input type="number" id="q-qty" min="1" value="1" placeholder="1">
          </div>
          <div class="form-group">
            <label>Uso previsto</label>
            <select id="q-uso">
              <option>Uso personal</option>
              <option>Oficina / Empresa</option>
              <option>Educativo</option>
              <option>Proyecto especial</option>
            </select>
          </div>
        </div>
        <div class="form-group" style="margin-bottom:1.25rem">
          <label>Mensaje adicional</label>
          <textarea id="q-msg" placeholder="Cuéntanos más sobre tu requerimiento, especificaciones especiales, presupuesto, etc."></textarea>
        </div>
        <button class="btn-next" style="width:100%;padding:.8rem" onclick="App.submitQuote()">
          Enviar solicitud de cotización →
        </button>
      </div>`;

    this.animateVisibleElements(document.getElementById('view-quote'));
  },

  async submitQuote() {
    const name  = document.getElementById('q-name').value.trim();
    const email = document.getElementById('q-email').value.trim();
    const phone = document.getElementById('q-phone').value.trim();
    const prod  = document.getElementById('q-product').value;
    const company = document.getElementById('q-company').value.trim();
    const qty = Number(document.getElementById('q-qty').value || 1);
    const uso = document.getElementById('q-uso').value;
    const notes = document.getElementById('q-msg').value.trim();

    if (!name || !email || !phone || !prod) {
      this.showToast('Por favor completa los campos obligatorios', 'error');
      return;
    }

    const selectedProduct = App.catalog.find(p => p.id === Number(prod));
    this.state.lastQuoteSync = await this.syncQuoteToOdoo({
      name,
      email,
      phone,
      company,
      productId: Number(prod),
      productName: selectedProduct?.name || 'Producto no identificado',
      qty,
      usage: uso,
      message: notes,
    });

    this.state.quoteSuccess = true;
    this.renderQuote();
    if (this.state.lastQuoteSync.synced) {
      this.showToast('Cotización enviada y registrada en Odoo CRM', 'success');
    } else {
      this.showToast('Cotización enviada en modo local (sin conexión a Odoo)', 'warning');
    }
  },

  /* ─── TOAST ───────────────────────────────────────────── */
  showToast(msg, type = 'default') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'slideOut .25s ease forwards';
      setTimeout(() => toast.remove(), 250);
    }, 3000);
  },
};

/* ─── ARRANQUE ───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => App.init());

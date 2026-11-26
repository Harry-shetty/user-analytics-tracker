const FREE_SHIPPING = 4000;
const CART_KEY = 'demo_cart_v2';

const PRODUCTS = [
  { id: 1, name: 'Soy Wax Candle', material: 'Speckled stoneware · Cedar & fig', price: 1990, img: 'images/candle.jpg' },
  { id: 2, name: 'Architectural Desk Lamp', material: 'Brushed brass · Matte charcoal', price: 5490, img: 'images/lamp.jpg' },
  { id: 3, name: 'Ribbed Ceramic Planter', material: 'Hand-thrown terracotta · 16 cm', price: 2890, img: 'images/planter.jpg' },
  { id: 4, name: 'Stoneware Coffee Mug', material: 'Raw clay base · 320 ml', price: 1290, img: 'images/mug.jpg' },
];

const $ = (id) => document.getElementById(id);
const formatINR = (amount) => `₹${Math.round(amount).toLocaleString('en-IN')}`;
const findProduct = (id) => PRODUCTS.find((p) => p.id === id);

const app = $('app');
const drawer = $('cart-drawer');
const backdrop = $('drawer-backdrop');
const cartItemsEl = $('cart-items');
const checkoutBtn = $('checkout-btn');
const toastEl = $('toast');

let cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
let toastTimer = null;

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

function setDrawerOpen(open) {
  drawer.classList.toggle('open', open);
  backdrop.classList.toggle('open', open);
  drawer.setAttribute('aria-hidden', String(!open));
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
  $('cart-count').textContent = String(totalQty);
  renderDrawer();
}

function addToCart(id) {
  const item = cart.find((c) => c.id === id);
  if (item) item.qty += 1;
  else cart.push({ id, qty: 1 });
  saveCart();

  const product = findProduct(id);
  if (product) showToast(`Added ${product.name} to bag`);
}

function changeQty(id, delta) {
  cart = cart
    .map((c) => (c.id === id ? { ...c, qty: c.qty + delta } : c))
    .filter((c) => c.qty > 0);
  saveCart();
}

function renderDrawer() {
  if (!cart.length) {
    cartItemsEl.innerHTML = '<p class="empty-bag">Your bag is empty. Add a piece from the collection to test cart tracking.</p>';
    $('cart-subtotal').textContent = formatINR(0);
    $('shipping-note').textContent = `Free shipping on orders over ${formatINR(FREE_SHIPPING)}.`;
    checkoutBtn.disabled = true;
    checkoutBtn.style.opacity = '0.5';
    return;
  }

  let subtotal = 0;
  cartItemsEl.innerHTML = cart
    .map((item) => {
      const p = findProduct(item.id);
      if (!p) return '';
      subtotal += p.price * item.qty;
      return `
        <div class="cart-row">
          <img src="${p.img}" alt="${p.name}" />
          <div class="cart-info">
            <h4>${p.name}</h4>
            <div class="price tabular">${formatINR(p.price)}</div>
          </div>
          <div class="qty">
            <button type="button" data-qty-id="${p.id}" data-delta="-1" aria-label="Decrease quantity">−</button>
            <span class="tabular">${item.qty}</span>
            <button type="button" data-qty-id="${p.id}" data-delta="1" aria-label="Increase quantity">+</button>
          </div>
        </div>
      `;
    })
    .join('');

  $('cart-subtotal').textContent = formatINR(subtotal);
  $('shipping-note').textContent =
    subtotal >= FREE_SHIPPING
      ? 'You qualify for complimentary shipping.'
      : `Add ${formatINR(FREE_SHIPPING - subtotal)} more for free shipping.`;
  checkoutBtn.disabled = false;
  checkoutBtn.style.opacity = '1';
}

function renderProducts(discount = false) {
  return PRODUCTS.map((p) => {
    const price = formatINR(discount ? p.price * 0.8 : p.price);
    const oldPrice = discount ? `<span class="old tabular">${formatINR(p.price)}</span>` : '';
    return `
      <article class="card">
        <div class="thumb"><img src="${p.img}" alt="${p.name}" loading="lazy" /></div>
        <div class="card-body">
          <div class="card-top">
            <h3>${p.name}</h3>
            <div class="price tabular${discount ? ' sale' : ''}">${price}${oldPrice}</div>
          </div>
          <div class="card-meta">${p.material}</div>
          <button type="button" class="btn small add" data-id="${p.id}">Add to bag</button>
        </div>
      </article>
    `;
  }).join('');
}

const VIEWS = {
  home: () => `
    <section class="hero">
      <div class="wrap hero-grid">
        <div>
          <h1>Objects shaped for quiet rooms</h1>
          <p>Small-batch stoneware, brushed brass lighting, and hand-poured soy wax made for daily rituals. Complimentary shipping on orders over ₹4,000.</p>
          <div class="hero-actions">
            <button type="button" class="btn" id="shop-now">Shop the collection</button>
            <a class="btn secondary" href="demo.html?page=sale">View weekend sale</a>
          </div>
          <div class="hero-facts">
            <div><strong>4 pieces</strong>Small-batch release</div>
            <div><strong>30-day returns</strong>Prepaid shipping label</div>
          </div>
        </div>
        <div class="hero-frame">
          <img src="images/hero.jpg" alt="Sunlit oak tabletop with Lumen ceramic lamp, stoneware mug, and soy candle" />
        </div>
      </div>
    </section>
    <section class="section" id="products">
      <div class="wrap">
        <div class="section-head">
          <h2>Featured collection</h2>
          <p class="section-sub">Kiln-fired ceramics and solid brass</p>
        </div>
        <div class="grid">${renderProducts(false)}</div>
      </div>
    </section>
    <section class="band">
      <div class="wrap band-inner">
        <div>
          <h2>Weekend sale — 20% off</h2>
          <p>Applied automatically on every piece through Sunday.</p>
        </div>
        <a class="btn light" href="demo.html?page=sale">Shop the sale</a>
      </div>
    </section>
  `,

  sale: () => `
    <section class="section">
      <div class="wrap">
        <div class="section-head">
          <h2>Weekend sale</h2>
          <p class="section-sub">20% off the full release</p>
        </div>
        <div class="grid">${renderProducts(true)}</div>
      </div>
    </section>
  `,

  about: () => `
    <section class="section">
      <div class="wrap prose">
        <div class="section-head"><h2>About Lumen</h2></div>
        <p>Lumen is a studio storefront built to demonstrate real e-commerce session tracking and click heatmaps for CausalFunnel.</p>
        <p>Every page navigation records a page_view event, and every click on products, filters, or bag controls records normalized viewport coordinates directly into MongoDB.</p>
        <a class="btn" href="demo.html">Return to shop</a>
      </div>
    </section>
  `,

  contact: () => `
    <section class="section">
      <div class="wrap prose">
        <div class="section-head"><h2>Contact the studio</h2></div>
        <p>Questions about wholesale orders or shipping? Send a note below.</p>
        <form class="form-grid" id="contact-form">
          <label class="field">Name<input type="text" placeholder="Your name" required /></label>
          <label class="field">Email<input type="email" placeholder="you@studio.example" required /></label>
          <label class="field">Message<textarea rows="4" placeholder="How can we help?" required></textarea></label>
          <button type="submit" class="btn">Send message</button>
        </form>
        <div class="form-status" id="contact-msg"></div>
      </div>
    </section>
  `,

  returns: () => `
    <section class="section">
      <div class="wrap prose">
        <div class="section-head"><h2>Returns & exchanges</h2></div>
        <p>Unused pieces in original packaging may be returned within 30 days of delivery for a full refund or exchange.</p>
        <a class="btn" href="demo.html?page=contact">Start a return</a>
      </div>
    </section>
  `,
};

// Initialize page
const page = new URLSearchParams(location.search).get('page') || 'home';
app.innerHTML = (VIEWS[page] || VIEWS.home)();
document.title = `Lumen — ${page === 'home' ? 'Architectural Home Goods' : page[0].toUpperCase() + page.slice(1)}`;

document.querySelectorAll('nav a').forEach((link) => {
  if (link.dataset.page === page) link.classList.add('active');
});

// Event listeners
app.addEventListener('click', (e) => {
  const btn = e.target.closest('.add');
  if (!btn) return;
  addToCart(Number(btn.dataset.id));
  btn.classList.add('added');
  btn.textContent = 'Added to bag';
  setTimeout(() => {
    btn.classList.remove('added');
    btn.textContent = 'Add to bag';
  }, 1100);
});

$('shop-now')?.addEventListener('click', () => $('products').scrollIntoView({ behavior: 'smooth' }));
$('cart-btn').addEventListener('click', () => setDrawerOpen(true));
$('close-drawer').addEventListener('click', () => setDrawerOpen(false));
backdrop.addEventListener('click', () => setDrawerOpen(false));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') setDrawerOpen(false);
});

cartItemsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-qty-id]');
  if (!btn) return;
  changeQty(Number(btn.dataset.qtyId), Number(btn.dataset.delta));
});

checkoutBtn.addEventListener('click', () => {
  if (!cart.length) return;
  cart = [];
  saveCart();
  setDrawerOpen(false);
  showToast('Demo order placed. Thank you!');
});

$('contact-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  $('contact-msg').textContent = 'Message received. We will reply within one business day.';
  e.target.reset();
});

saveCart();

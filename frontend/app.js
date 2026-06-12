// ===== CONFIG =====
const API = 'http://localhost:3000/api';

// ===== STATE =====
let currentUser = JSON.parse(localStorage.getItem('ph_user')) || null;
let currentToken = localStorage.getItem('ph_token') || null;
let allProducts = [];
let cartItems = [];
let wishlistItems = [];
let displayedCount = 12;
let currentCategory = 'All';
let pendingAction = null;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  initNavbar();
  initSearch();
  initScrollReveal();
  await loadProducts();
  if (currentUser) {
    await loadCart();
    await loadWishlist();
  }
  loadAnnouncement();
  updateNavBadges();
  // Category scroll nav
  setTimeout(updateCatNavBtns, 300);
  const catScroll = document.getElementById('categories-scroll');
  if (catScroll) catScroll.addEventListener('scroll', updateCatNavBtns, { passive: true });
});

// ===== NAVBAR =====
function initNavbar() {
  window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    if (window.scrollY > 50) navbar.classList.add('scrolled');
    else navbar.classList.remove('scrolled');
  });
  document.getElementById('cart-btn').addEventListener('click', () => {
    if (!currentUser) { pendingAction = 'cart'; showAuthModal(); return; }
    showCartModal();
  });
  document.getElementById('wishlist-btn').addEventListener('click', () => {
    if (!currentUser) { pendingAction = 'wishlist'; showAuthModal(); return; }
    showProfileModal('wishlist');
  });
  document.getElementById('profile-btn').addEventListener('click', () => {
    if (!currentUser) { showAuthModal(); return; }
    showProfileModal('main');
  });
  document.getElementById('search-btn').addEventListener('click', () => {
    document.getElementById('search-overlay').classList.remove('hidden');
    document.getElementById('search-input').focus();
  });
}

// ===== SEARCH =====
function initSearch() {
  const input = document.getElementById('search-input');
  const overlay = document.getElementById('search-overlay');
  document.getElementById('search-close').addEventListener('click', () => overlay.classList.add('hidden'));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.add('hidden'); });
  let timeout;
  input.addEventListener('input', () => {
    clearTimeout(timeout);
    timeout = setTimeout(async () => {
      const q = input.value.trim();
      if (!q) { document.getElementById('search-results').innerHTML = ''; return; }
      const results = allProducts.filter(p => p.name.toLowerCase().includes(q.toLowerCase()) || p.category.toLowerCase().includes(q.toLowerCase()));
      renderSearchResults(results.slice(0, 8));
    }, 300);
  });
}

function renderSearchResults(results) {
  const container = document.getElementById('search-results');
  if (!results.length) { container.innerHTML = '<div style="padding:20px;text-align:center;color:#666">No plants found 🌿</div>'; return; }
  container.innerHTML = results.map(p => `
    <div class="search-result-item" onclick="openProductDetail(${p.id}); document.getElementById('search-overlay').classList.add('hidden')">
      <img src="${p.image}" alt="${p.name}" onerror="this.src='https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=100'"/>
      <div><h4>${p.name}</h4><p>₹${p.price} · ${p.category}</p></div>
    </div>
  `).join('');
}

// ===== LOAD PRODUCTS =====
async function loadProducts() {
  try {
    const res = await fetch(`${API}/products`);
    allProducts = await res.json();
    renderProducts();
  } catch (err) {
    document.getElementById('products-grid').innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#666">Failed to load plants. Make sure server is running! 🌿</div>';
  }
}

function renderProducts(category = 'All') {
  const grid = document.getElementById('products-grid');
  let filtered = category === 'All' ? allProducts : allProducts.filter(p => p.category === category);
  const shown = filtered.slice(0, displayedCount);
  const loadMoreBtn = document.getElementById('load-more-btn');
  if (filtered.length <= displayedCount) loadMoreBtn.style.display = 'none';
  else loadMoreBtn.style.display = 'inline-flex';
  grid.innerHTML = shown.map(p => renderProductCard(p)).join('');
  updateWishlistButtons();
  updateCartButtons();
  initScrollReveal();
}

function renderProductCard(p) {
  const inCart = cartItems.some(c => c.product_id === p.id);
  const inWishlist = wishlistItems.some(w => w.product_id === p.id);
  return `
    <div class="product-card scroll-reveal" onclick="openProductDetail(${p.id})">
      <div class="product-card-img">
        <img src="${p.image}" alt="${p.name}" onerror="this.src='https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=500'" loading="lazy"/>
        <button class="wishlist-btn-card ${inWishlist ? 'active' : ''}" onclick="event.stopPropagation(); toggleWishlist(${p.id})" title="Wishlist">
          <i class="fa${inWishlist ? 's' : 'r'} fa-heart"></i>
        </button>
        ${!p.in_stock ? '<div class="out-of-stock-badge">Out of Stock</div>' : ''}
        <div class="category-badge">${p.category}</div>
      </div>
      <div class="product-card-body">
        <h3>${p.name}</h3>
        <div class="product-rating">
          <span class="stars">${renderStars(p.rating)}</span>
          <span class="rating-count">(${p.reviews})</span>
        </div>
        <p class="product-tagline">${p.tagline}</p>
        <div class="product-card-footer">
          <span class="product-price">₹${p.price}</span>
          <button class="add-cart-btn ${inCart ? 'in-cart' : ''}" onclick="event.stopPropagation(); ${inCart ? `showCartModal()` : `addToCart(${p.id})`}">
            ${inCart ? 'In Cart 🛒' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderStars(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  let stars = '';
  for (let i = 0; i < full; i++) stars += '★';
  if (half) stars += '½';
  return stars;
}

function filterCategory(cat, el) {
  currentCategory = cat;
  displayedCount = 12;
  document.querySelectorAll('.category-card').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  // Scroll the clicked card into view
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  renderProducts(cat);
}

function scrollCategories(dir) {
  const scroll = document.getElementById('categories-scroll');
  if (!scroll) return;
  scroll.scrollBy({ left: dir * 280, behavior: 'smooth' });
  // Update nav button disabled state after scroll settles
  setTimeout(updateCatNavBtns, 350);
}

function updateCatNavBtns() {
  const scroll = document.getElementById('categories-scroll');
  const prev = document.getElementById('cat-prev');
  const next = document.getElementById('cat-next');
  if (!scroll || !prev || !next) return;
  prev.disabled = scroll.scrollLeft <= 4;
  next.disabled = scroll.scrollLeft + scroll.clientWidth >= scroll.scrollWidth - 4;
}

function loadMore() {
  displayedCount += 12;
  renderProducts(currentCategory);
}

// ===== PRODUCT DETAIL =====
async function openProductDetail(productId) {
  const p = allProducts.find(x => x.id === productId);
  if (!p) return;
  const inWishlist = wishlistItems.some(w => w.product_id === p.id);
  const inCart = cartItems.some(c => c.product_id === p.id);
  const html = `
    <div class="modal-overlay" id="product-detail-overlay" onclick="if(event.target===this)closeModal('product-detail-overlay')">
      <div class="modal product-detail-modal">
        <button class="modal-close" onclick="closeModal('product-detail-overlay')">✕</button>
        <div class="product-detail-img">
          <img src="${p.image}" alt="${p.name}" onerror="this.src='https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600'"/>
          <button class="product-detail-wishlist ${inWishlist ? 'active' : ''}" id="detail-wishlist-btn" onclick="toggleWishlist(${p.id}, true)">
            <i class="fa${inWishlist ? 's' : 'r'} fa-heart"></i>
          </button>
        </div>
        <div class="product-detail-body">
          <h2>${p.name}</h2>
          <div class="product-detail-meta">
            <span class="stars">${renderStars(p.rating)}</span>
            <span style="font-size:13px;color:#666">${p.rating} (${p.reviews} reviews)</span>
            <span style="font-size:12px;background:${p.in_stock ? 'rgba(45,106,79,0.1)' : 'rgba(230,57,70,0.1)'};color:${p.in_stock ? 'var(--green)' : '#e63946'};padding:2px 10px;border-radius:20px;font-weight:600">${p.in_stock ? 'In Stock' : 'Out of Stock'}</span>
          </div>
          <div class="product-detail-price">₹${p.price}</div>
          <p style="font-size:13px;color:var(--green);font-weight:600;margin-bottom:12px;font-style:italic">"${p.tagline}"</p>
          <div class="care-section">
            <h3>🌿 About this Plant</h3>
            <p class="product-detail-desc">${p.description}</p>
          </div>
          <div class="care-section">
            <h3>📋 Care Instructions</h3>
            <div class="care-grid">
              <div class="care-item"><span>☀️</span><div class="care-item-text"><label>Sunlight</label><p>${p.sunlight}</p></div></div>
              <div class="care-item"><span>💧</span><div class="care-item-text"><label>Watering</label><p>${p.watering}</p></div></div>
              <div class="care-item"><span>🌡️</span><div class="care-item-text"><label>Temperature</label><p>${p.temperature}</p></div></div>
              <div class="care-item"><span>🪴</span><div class="care-item-text"><label>Pot Size</label><p>${p.pot_size}</p></div></div>
              <div class="care-item"><span>🌍</span><div class="care-item-text"><label>Difficulty</label><p>${p.difficulty}</p></div></div>
              <div class="care-item"><span>✂️</span><div class="care-item-text"><label>Pruning</label><p>${p.pruning}</p></div></div>
              <div class="care-item"><span>💨</span><div class="care-item-text"><label>Humidity</label><p>${p.humidity}</p></div></div>
              <div class="care-item"><span>🐾</span><div class="care-item-text"><label>Pet Safe</label><p>${p.pet_safe}</p></div></div>
            </div>
          </div>
          <div class="product-detail-actions">
            <button class="btn-add-cart ${inCart ? 'in-cart' : ''}" id="detail-cart-btn" onclick="${inCart ? `showCartModal()` : `addToCart(${p.id}, true)`}">
              ${inCart ? '🛒 Go to Cart' : '➕ Add to Cart'}
            </button>
            <button class="btn-buy-now" onclick="buyNow(${p.id})">⚡ Buy Now</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('modal-container').innerHTML = html;
}

// ===== CART =====
async function loadCart() {
  if (!currentUser) return;
  try {
    const res = await fetch(`${API}/cart/${currentUser.id}`, { headers: { Authorization: `Bearer ${currentToken}` } });
    cartItems = await res.json();
    updateNavBadges();
  } catch (err) { cartItems = []; }
}

async function addToCart(productId, fromDetail = false) {
  if (!currentUser) { pendingAction = { type: 'cart', id: productId }; showAuthModal(); return; }
  try {
    const res = await fetch(`${API}/cart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentToken}` },
      body: JSON.stringify({ user_id: currentUser.id, product_id: productId })
    });
    if (res.ok) {
      await loadCart();
      renderProducts(currentCategory);
      showToast('Added to cart 🌿');
      if (fromDetail) {
        const btn = document.getElementById('detail-cart-btn');
        if (btn) { btn.textContent = '🛒 Go to Cart'; btn.classList.add('in-cart'); btn.onclick = showCartModal; }
      }
      updateCartButtons();
    }
  } catch (err) { showToast('Something went wrong!'); }
}

function showCartModal() {
  const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const html = `
    <div class="modal-overlay" id="cart-overlay" onclick="if(event.target===this)closeModal('cart-overlay')">
      <div class="modal cart-modal">
        <button class="modal-close" onclick="closeModal('cart-overlay')">✕</button>
        <div class="modal-header"><h2>🛒 Your Cart</h2></div>
        <div class="modal-body">
          ${cartItems.length === 0 ? `
            <div class="empty-cart">
              <span>🛒</span>
              <p>Your cart is empty</p>
              <p style="font-size:13px;color:#999;margin-top:8px">Add some beautiful plants!</p>
            </div>
          ` : `
            <div class="cart-items">
              ${cartItems.map(item => `
                <div class="cart-item">
                  <img src="${item.image}" alt="${item.name}" onclick="closeModal('cart-overlay'); openProductDetail(${item.product_id})" onerror="this.src='https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=100'"/>
                  <div class="cart-item-info">
                    <h4 onclick="closeModal('cart-overlay'); openProductDetail(${item.product_id})">${item.name}</h4>
                    <div class="cart-qty">
                      <button class="qty-btn" onclick="changeQty(${item.id}, 'decrease')">−</button>
                      <span class="qty-num">${item.quantity}</span>
                      <button class="qty-btn" onclick="changeQty(${item.id}, 'increase')">+</button>
                    </div>
                    <div class="cart-item-price">₹${item.price * item.quantity}</div>
                  </div>
                  <button class="cart-remove" onclick="removeFromCart(${item.id})">✕</button>
                </div>
              `).join('')}
            </div>
            <div class="cart-total">
              <span>Total</span>
              <strong>₹${total.toLocaleString()}</strong>
            </div>
            <button class="btn-full" onclick="closeModal('cart-overlay'); showCheckoutModal()">Place Order 🌿</button>
          `}
        </div>
      </div>
    </div>
  `;
  document.getElementById('modal-container').innerHTML = html;
}

async function changeQty(cartId, action) {
  try {
    await fetch(`${API}/cart/${action}/${cartId}`, { method: 'PATCH', headers: { Authorization: `Bearer ${currentToken}` } });
    await loadCart();
    renderProducts(currentCategory);
    showCartModal();
  } catch (err) { showToast('Something went wrong!'); }
}

async function removeFromCart(cartId) {
  try {
    await fetch(`${API}/cart/${cartId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${currentToken}` } });
    await loadCart();
    renderProducts(currentCategory);
    showCartModal();
    showToast('Removed from cart');
  } catch (err) { showToast('Something went wrong!'); }
}

// ===== WISHLIST =====
async function loadWishlist() {
  if (!currentUser) return;
  try {
    const res = await fetch(`${API}/wishlist/${currentUser.id}`, { headers: { Authorization: `Bearer ${currentToken}` } });
    wishlistItems = await res.json();
    updateNavBadges();
  } catch (err) { wishlistItems = []; }
}

async function toggleWishlist(productId, fromDetail = false) {
  if (!currentUser) { pendingAction = { type: 'wishlist', id: productId }; showAuthModal(); return; }
  const inWishlist = wishlistItems.some(w => w.product_id === productId);
  try {
    if (inWishlist) {
      await fetch(`${API}/wishlist`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentToken}` },
        body: JSON.stringify({ user_id: currentUser.id, product_id: productId })
      });
      showToast('Removed from wishlist');
    } else {
      await fetch(`${API}/wishlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentToken}` },
        body: JSON.stringify({ user_id: currentUser.id, product_id: productId })
      });
      showToast('Added to wishlist ❤️');
    }
    await loadWishlist();
    renderProducts(currentCategory);
    updateWishlistButtons();
    if (fromDetail) {
      const btn = document.getElementById('detail-wishlist-btn');
      const nowIn = wishlistItems.some(w => w.product_id === productId);
      if (btn) {
        btn.classList.toggle('active', nowIn);
        btn.innerHTML = `<i class="fa${nowIn ? 's' : 'r'} fa-heart"></i>`;
      }
    }
  } catch (err) { showToast('Something went wrong!'); }
}

function updateWishlistButtons() {
  document.querySelectorAll('.wishlist-btn-card').forEach(btn => {
    const card = btn.closest('.product-card');
    const onclick = btn.getAttribute('onclick') || '';
    const match = onclick.match(/toggleWishlist\((\d+)/);
    if (match) {
      const id = parseInt(match[1]);
      const inWishlist = wishlistItems.some(w => w.product_id === id);
      btn.classList.toggle('active', inWishlist);
      btn.innerHTML = `<i class="fa${inWishlist ? 's' : 'r'} fa-heart"></i>`;
    }
  });
}

function updateCartButtons() {
  document.querySelectorAll('.add-cart-btn').forEach(btn => {
    const onclick = btn.getAttribute('onclick') || '';
    const match = onclick.match(/addToCart\((\d+)/);
    if (match) {
      const id = parseInt(match[1]);
      const inCart = cartItems.some(c => c.product_id === id);
      btn.classList.toggle('in-cart', inCart);
      btn.textContent = inCart ? 'In Cart 🛒' : 'Add to Cart';
      if (inCart) btn.setAttribute('onclick', `event.stopPropagation(); showCartModal()`);
    }
  });
}

// ===== CHECKOUT =====
async function buyNow(productId) {
  if (!currentUser) { pendingAction = { type: 'buynow', id: productId }; showAuthModal(); return; }
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;
  const tempCart = [{ product_id: product.id, name: product.name, price: product.price, image: product.image, quantity: 1 }];
  showCheckoutModal(tempCart);
}

async function showCheckoutModal(overrideItems = null) {
  if (!currentUser) { showAuthModal(); return; }
  const items = overrideItems || cartItems;
  if (!items.length) { showToast('Your cart is empty!'); return; }
  const total = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  let savedAddress = null;
  try {
    const res = await fetch(`${API}/auth/address/${currentUser.id}`, { headers: { Authorization: `Bearer ${currentToken}` } });
    savedAddress = await res.json();
  } catch (e) {}
  const html = `
    <div class="modal-overlay" id="checkout-overlay" onclick="if(event.target===this)closeModal('checkout-overlay')">
      <div class="modal checkout-modal">
        <button class="modal-close" onclick="closeModal('checkout-overlay')">✕</button>
        <div class="checkout-header">
          <h2>🔒 Secure Checkout</h2>
          <div class="progress-bar">
            <span class="progress-step active">Address</span>
            <span class="progress-divider">→</span>
            <span class="progress-step active">Payment</span>
            <span class="progress-divider">→</span>
            <span class="progress-step">Confirm</span>
          </div>
        </div>
        <div class="modal-body">
          <div class="order-summary-card">
            <h3>📦 Order Summary</h3>
            ${items.map(i => `
              <div class="summary-item">
                <img src="${i.image}" alt="${i.name}" onerror="this.src='https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=100'"/>
                <span class="summary-item-name">${i.name} x${i.quantity}</span>
                <span class="summary-item-price">₹${i.price * i.quantity}</span>
              </div>
            `).join('')}
            <div class="summary-total"><span>Total</span><span>₹${total.toLocaleString()}</span></div>
          </div>
          <div class="form-group">
            <label style="font-size:15px;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:8px">📍 Delivery Address
              ${savedAddress ? `<label style="font-size:12px;font-weight:500;cursor:pointer;color:var(--green);margin-left:auto"><input type="checkbox" id="use-saved" onchange="toggleSavedAddress(${JSON.stringify(savedAddress).replace(/"/g, '&quot;')})"> Use Saved</label>` : ''}
            </label>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Full Name</label><input type="text" id="addr-name" placeholder="Your full name" value="${savedAddress ? savedAddress.full_name || '' : ''}"/></div>
            <div class="form-group"><label>Phone</label><input type="tel" id="addr-phone" placeholder="10-digit mobile" value="${savedAddress ? savedAddress.phone || '' : ''}"/></div>
          </div>
          <div class="form-group"><label>House/Flat No.</label><input type="text" id="addr-house" placeholder="Flat no, Building name" value="${savedAddress ? savedAddress.house || '' : ''}"/></div>
          <div class="form-group"><label>Street/Area</label><input type="text" id="addr-street" placeholder="Street, Area, Landmark" value="${savedAddress ? savedAddress.street || '' : ''}"/></div>
          <div class="form-row">
            <div class="form-group"><label>City</label><input type="text" id="addr-city" placeholder="City" value="${savedAddress ? savedAddress.city || '' : ''}"/></div>
            <div class="form-group"><label>State</label><input type="text" id="addr-state" placeholder="State" value="${savedAddress ? savedAddress.state || '' : ''}"/></div>
          </div>
          <div class="form-group"><label>PIN Code</label><input type="text" id="addr-pin" placeholder="6-digit PIN" value="${savedAddress ? savedAddress.pincode || '' : ''}"/></div>

          <div style="font-size:15px;font-weight:700;margin:20px 0 12px">💰 Select Payment Mode</div>
          <div class="payment-options">
            <div class="payment-option" id="pay-card" onclick="selectPayment('card')"><span>💳</span> Credit / Debit Card</div>
            <div class="payment-option" id="pay-upi" onclick="selectPayment('upi')"><span>📱</span> UPI</div>
            <div class="payment-option" id="pay-cod" onclick="selectPayment('cod')"><span>🏠</span> Cash on Delivery</div>
          </div>
          <div id="payment-details-section"></div>
          <button class="btn-full" onclick="placeOrder(${JSON.stringify(items).replace(/"/g, '&quot;')}, ${total})">✅ Confirm & Place Order</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('modal-container').innerHTML = html;
}

function selectPayment(type) {
  document.querySelectorAll('.payment-option').forEach(o => o.classList.remove('selected'));
  document.getElementById(`pay-${type}`).classList.add('selected');
  document.getElementById('payment-details-section').setAttribute('data-payment', type);
  let html = '';
  if (type === 'card') {
    html = `
      <div class="payment-details">
        <div class="form-group"><label>Card Number</label><input type="text" id="card-num" placeholder="1234 5678 9012 3456" maxlength="19" oninput="formatCard(this)"/></div>
        <div class="form-group"><label>Cardholder Name</label><input type="text" id="card-name" placeholder="Name on card"/></div>
        <div class="form-row">
          <div class="form-group"><label>Expiry (MM/YY)</label><input type="text" id="card-exp" placeholder="MM/YY" maxlength="5"/></div>
          <div class="form-group"><label>CVV</label><input type="password" id="card-cvv" placeholder="•••" maxlength="3"/></div>
        </div>
      </div>`;
  } else if (type === 'upi') {
    html = `
      <div class="payment-details">
        <div class="form-group"><label>UPI ID</label>
          <div style="display:flex;gap:10px">
            <input type="text" id="upi-id" placeholder="yourname@upi" style="flex:1"/>
            <button class="btn-primary" style="padding:0 16px;font-size:13px" onclick="verifyUPI()">Verify</button>
          </div>
          <div id="upi-status" style="margin-top:6px;font-size:13px"></div>
        </div>
        <div style="display:flex;gap:12px;margin-top:8px">
          <button onclick="document.getElementById('upi-id').value='name@oksbi'" style="padding:8px 14px;border-radius:20px;background:var(--cream);font-size:12px;font-weight:600">GPay</button>
          <button onclick="document.getElementById('upi-id').value='name@ybl'" style="padding:8px 14px;border-radius:20px;background:var(--cream);font-size:12px;font-weight:600">PhonePe</button>
          <button onclick="document.getElementById('upi-id').value='name@paytm'" style="padding:8px 14px;border-radius:20px;background:var(--cream);font-size:12px;font-weight:600">Paytm</button>
        </div>
      </div>`;
  } else if (type === 'cod') {
    const total = document.querySelector('.summary-total span:last-child')?.textContent || '';
    html = `
      <div class="payment-details">
        <div class="cod-message">
          🏠 You will pay <strong>${total}</strong> at the time of delivery.<br/>
          <small style="color:#999;margin-top:6px;display:block">Our delivery partner will collect cash upon delivery.</small>
        </div>
      </div>`;
  }
  document.getElementById('payment-details-section').innerHTML = html;
}

function formatCard(input) {
  let val = input.value.replace(/\D/g, '').substring(0, 16);
  input.value = val.replace(/(.{4})/g, '$1 ').trim();
}

function verifyUPI() {
  const upi = document.getElementById('upi-id').value;
  const status = document.getElementById('upi-status');
  if (!upi.includes('@')) { status.innerHTML = '<span style="color:#e63946">❌ Invalid UPI ID</span>'; return; }
  status.innerHTML = '<span style="color:var(--green)">✅ UPI ID Verified!</span>';
}

async function placeOrder(items, total) {
  const name = document.getElementById('addr-name')?.value.trim();
  const phone = document.getElementById('addr-phone')?.value.trim();
  const house = document.getElementById('addr-house')?.value.trim();
  const street = document.getElementById('addr-street')?.value.trim();
  const city = document.getElementById('addr-city')?.value.trim();
  const state = document.getElementById('addr-state')?.value.trim();
  const pin = document.getElementById('addr-pin')?.value.trim();
  const paymentType = document.getElementById('payment-details-section')?.getAttribute('data-payment');
  if (!name || !phone || !house || !street || !city || !state || !pin) { showToast('Please fill all address fields!'); return; }
  if (phone.length !== 10) { showToast('Enter a valid 10-digit phone number!'); return; }
  if (pin.length !== 6) { showToast('Enter a valid 6-digit PIN code!'); return; }
  if (!paymentType) { showToast('Please select a payment mode!'); return; }
  if (paymentType === 'card') {
    const cardNum = document.getElementById('card-num')?.value.replace(/\s/g, '');
    const cardName = document.getElementById('card-name')?.value.trim();
    const cardExp = document.getElementById('card-exp')?.value.trim();
    const cardCvv = document.getElementById('card-cvv')?.value.trim();
    if (!cardNum || cardNum.length !== 16) { showToast('Enter a valid 16-digit card number!'); return; }
    if (!cardName) { showToast('Enter cardholder name!'); return; }
    if (!cardExp || !cardExp.includes('/')) { showToast('Enter valid expiry date!'); return; }
    if (!cardCvv || cardCvv.length !== 3) { showToast('Enter valid CVV!'); return; }
  }
  if (paymentType === 'upi') {
    const upi = document.getElementById('upi-id')?.value.trim();
    const status = document.getElementById('upi-status')?.textContent;
    if (!upi || !upi.includes('@')) { showToast('Enter a valid UPI ID!'); return; }
    if (!status.includes('Verified')) { showToast('Please verify your UPI ID first!'); return; }
  }
  const address = `${name}, ${house}, ${street}, ${city}, ${state} - ${pin}, Ph: ${phone}`;
  try {
    const orderItems = items.map(i => ({ product_id: i.product_id, quantity: i.quantity, price: i.price }));
    const res = await fetch(`${API}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentToken}` },
      body: JSON.stringify({ user_id: currentUser.id, total, payment_mode: paymentType, address, items: orderItems })
    });
    if (res.ok) {
      await loadCart();
      renderProducts(currentCategory);
      updateNavBadges();
      closeModal('checkout-overlay');
      showOrderSuccess();
      try {
        await fetch(`${API}/auth/address`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentToken}` },
          body: JSON.stringify({ user_id: currentUser.id, full_name: name, phone, house, street, city, state, pincode: pin })
        });
      } catch (e) {}
    } else {
      showToast('Failed to place order. Try again!');
    }
  } catch (err) { showToast('Server error. Please try again!'); }
}

function showOrderSuccess() {
  const html = `
    <div class="modal-overlay" id="success-overlay">
      <div class="modal success-modal">
        <div class="success-content">
          <div class="success-icon">✓</div>
          <h2>Order Placed! 🌿</h2>
          <p>Your plant is on its way. You will receive a confirmation shortly.</p>
          <button class="btn-full" onclick="closeModal('success-overlay')">Continue Shopping 🛒</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('modal-container').innerHTML = html;
}

// ===== AUTH =====
function showAuthModal(mode = 'login') {
  const html = `
    <div class="modal-overlay auth-overlay" id="auth-overlay" onclick="if(event.target===this)closeModal('auth-overlay')">
      <div class="modal auth-modal" id="auth-modal">
        <button class="modal-close" onclick="closeModal('auth-overlay')">✕</button>
        ${mode === 'login' ? renderLoginForm() : renderRegisterForm()}
      </div>
    </div>
  `;
  document.getElementById('modal-container').innerHTML = html;
}

function renderLoginForm() {
  return `
    <div class="modal-header">
      <h2>Welcome Back 🌿</h2>
      <p>Sign in to your Plant Heaven account</p>
    </div>
    <div class="modal-body">
      <div class="form-group"><label>Email</label><input type="email" id="login-email" placeholder="your@email.com" autocomplete="off"/><div class="form-error" id="login-error"></div></div>
      <div class="form-group"><label>Password</label><input type="password" id="login-pass" placeholder="Your password" autocomplete="new-password"/></div>
      <button class="btn-full" onclick="login()">Sign In</button>
      <div class="modal-switch">Don't have an account? <a onclick="showAuthModal('register')">Sign Up</a></div>
    </div>
  `;
}

function renderRegisterForm() {
  return `
    <div class="modal-header">
      <h2>Join Plant Heaven 🌱</h2>
      <p>Create your account to get started</p>
    </div>
    <div class="modal-body">
      <div class="form-group"><label>Full Name</label><input type="text" id="reg-name" placeholder="Your full name"/></div>
      <div class="form-group"><label>Email</label><input type="email" id="reg-email" placeholder="your@email.com"/><div class="form-error" id="reg-error"></div></div>
      <div class="form-group"><label>Password</label><input type="password" id="reg-pass" placeholder="Min 6 characters"/></div>
      <button class="btn-full" onclick="register()">Create Account</button>
      <div class="modal-switch">Already have an account? <a onclick="showAuthModal('login')">Sign In</a></div>
    </div>
  `;
}

async function login() {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  if (!email || !pass) { errEl.textContent = 'Please fill all fields'; return; }
  if (email.toLowerCase() === 'admin@plantheaven.com') { errEl.textContent = 'Invalid email or password'; return; }
  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.message; return; }
    currentUser = data.user;
    currentToken = data.token;
    localStorage.setItem('ph_user', JSON.stringify(data.user));
    localStorage.setItem('ph_token', data.token);
    closeModal('auth-overlay');
    await loadCart();
    await loadWishlist();
    renderProducts(currentCategory);
    updateNavBadges();
    showLoginSuccess(data.user.name);
    handlePendingAction();
  } catch (err) { errEl.textContent = 'Server error. Try again.'; }
}

async function register() {
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass = document.getElementById('reg-pass').value;
  const errEl = document.getElementById('reg-error');
  if (!name || !email || !pass) { errEl.textContent = 'Please fill all fields'; return; }
  if (pass.length < 6) { errEl.textContent = 'Password must be at least 6 characters'; return; }
  try {
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password: pass })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.message; return; }
    currentUser = data.user;
    currentToken = data.token;
    localStorage.setItem('ph_user', JSON.stringify(data.user));
    localStorage.setItem('ph_token', data.token);
    closeModal('auth-overlay');
    await loadCart();
    await loadWishlist();
    renderProducts(currentCategory);
    updateNavBadges();
    showLoginSuccess(data.user.name, true);
    handlePendingAction();
  } catch (err) { errEl.textContent = 'Server error. Try again.'; }
}

function handlePendingAction() {
  if (!pendingAction) return;
  if (pendingAction === 'cart') showCartModal();
  else if (pendingAction === 'wishlist') showProfileModal('wishlist');
  else if (typeof pendingAction === 'object') {
    if (pendingAction.type === 'cart') addToCart(pendingAction.id);
    else if (pendingAction.type === 'wishlist') toggleWishlist(pendingAction.id);
    else if (pendingAction.type === 'buynow') buyNow(pendingAction.id);
  }
  pendingAction = null;
}

function logout() {
  currentUser = null;
  currentToken = null;
  cartItems = [];
  wishlistItems = [];
  localStorage.removeItem('ph_user');
  localStorage.removeItem('ph_token');
  closeModal('profile-overlay');
  renderProducts(currentCategory);
  updateNavBadges();
  showToast('Logged out successfully');
}

// ===== PROFILE =====
async function showProfileModal(view = 'main') {
  if (view === 'main') {
    const html = `
      <div class="modal-overlay" id="profile-overlay" onclick="if(event.target===this)closeModal('profile-overlay')">
        <div class="modal profile-modal">
          <button class="modal-close" onclick="closeModal('profile-overlay')" style="background:rgba(255,255,255,0.2);color:white">✕</button>
          <div class="profile-header">
            <div class="profile-avatar">${currentUser.name.charAt(0).toUpperCase()}</div>
            <div class="profile-name">${currentUser.name}</div>
            <div class="profile-email">${currentUser.email}</div>
          </div>
          <div class="profile-menu">
            <div class="profile-menu-item" onclick="showProfileModal('edit')"><span>⚙️</span> Edit Profile <span class="arrow">→</span></div>
            <div class="profile-menu-item" onclick="showProfileModal('wishlist')"><span>❤️</span> Wishlist <span class="badge" style="position:relative;top:0;right:0;margin-left:auto">${wishlistItems.length}</span></div>
            <div class="profile-menu-item" onclick="showProfileModal('orders')"><span>📦</span> My Orders <span class="arrow">→</span></div>
          </div>
          <button class="profile-logout" onclick="logout()">Log Out</button>
        </div>
      </div>
    `;
    document.getElementById('modal-container').innerHTML = html;
  } else if (view === 'edit') {
    let savedAddress = null;
    try {
      const res = await fetch(`${API}/auth/address/${currentUser.id}`, { headers: { Authorization: `Bearer ${currentToken}` } });
      savedAddress = await res.json();
    } catch (e) {}
    const html = `
      <div class="modal-overlay" id="profile-overlay" onclick="if(event.target===this)closeModal('profile-overlay')">
        <div class="modal profile-modal">
          <button class="modal-close" onclick="closeModal('profile-overlay')">✕</button>
          <div class="modal-header"><h2>Edit Profile ⚙️</h2></div>
          <div class="modal-body">
            <button class="profile-back" onclick="showProfileModal('main')">← Back</button>
            <div style="font-size:15px;font-weight:700;margin-bottom:12px">📧 Change Email</div>
            <div class="form-group"><label>New Email</label><input type="email" id="new-email" placeholder="newemail@example.com" value="${currentUser.email}"/><div class="form-error" id="email-error"></div></div>
            <button class="btn-full" onclick="updateEmail()" style="margin-bottom:24px">Update Email</button>
            <div style="font-size:15px;font-weight:700;margin-bottom:12px">📍 Delivery Address</div>
            <div class="form-row">
              <div class="form-group"><label>Full Name</label><input type="text" id="edit-name" placeholder="Full name" value="${savedAddress?.full_name || ''}"/></div>
              <div class="form-group"><label>Phone</label><input type="tel" id="edit-phone" placeholder="Phone" value="${savedAddress?.phone || ''}"/></div>
            </div>
            <div class="form-group"><label>House/Flat</label><input type="text" id="edit-house" placeholder="House/Flat no." value="${savedAddress?.house || ''}"/></div>
            <div class="form-group"><label>Street/Area</label><input type="text" id="edit-street" placeholder="Street, Area" value="${savedAddress?.street || ''}"/></div>
            <div class="form-row">
              <div class="form-group"><label>City</label><input type="text" id="edit-city" placeholder="City" value="${savedAddress?.city || ''}"/></div>
              <div class="form-group"><label>State</label><input type="text" id="edit-state" placeholder="State" value="${savedAddress?.state || ''}"/></div>
            </div>
            <div class="form-group"><label>PIN Code</label><input type="text" id="edit-pin" placeholder="PIN" value="${savedAddress?.pincode || ''}"/></div>
            <button class="btn-full" onclick="saveAddress()">Save Address</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('modal-container').innerHTML = html;
  } else if (view === 'wishlist') {
    const html = `
      <div class="modal-overlay" id="profile-overlay" onclick="if(event.target===this)closeModal('profile-overlay')">
        <div class="modal profile-modal">
          <button class="modal-close" onclick="closeModal('profile-overlay')">✕</button>
          <div class="modal-header"><h2>Wishlist ❤️</h2></div>
          <div class="modal-body">
            <button class="profile-back" onclick="showProfileModal('main')">← Back</button>
            ${wishlistItems.length === 0 ? `
              <div class="empty-cart">
                <span>❤️</span>
                <p>Your wishlist is empty</p>
                <p style="font-size:13px;color:#999;margin-top:8px">Start adding plants you love!</p>
              </div>
            ` : wishlistItems.map(item => `
              <div class="wishlist-item">
                <img src="${item.image}" alt="${item.name}" onclick="closeModal('profile-overlay'); openProductDetail(${item.product_id})" onerror="this.src='https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=100'"/>
                <div class="wishlist-item-info" onclick="closeModal('profile-overlay'); openProductDetail(${item.product_id})">
                  <h4>${item.name}</h4>
                  <p>₹${item.price}</p>
                </div>
                <button class="wishlist-remove" onclick="toggleWishlist(${item.product_id}); showProfileModal('wishlist')">✕</button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    document.getElementById('modal-container').innerHTML = html;
  } else if (view === 'orders') {
    let orders = [];
    try {
      const res = await fetch(`${API}/orders/user/${currentUser.id}`, { headers: { Authorization: `Bearer ${currentToken}` } });
      orders = await res.json();
    } catch (e) {}
    const html = `
      <div class="modal-overlay" id="profile-overlay" onclick="if(event.target===this)closeModal('profile-overlay')">
        <div class="modal profile-modal">
          <button class="modal-close" onclick="closeModal('profile-overlay')">✕</button>
          <div class="modal-header"><h2>My Orders 📦</h2></div>
          <div class="modal-body">
            <button class="profile-back" onclick="showProfileModal('main')">← Back</button>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
              <button class="btn-primary" style="padding:10px" onclick="showProfileModal('track')">🚚 Track Order</button>
              <button class="btn-secondary" style="padding:10px" onclick="showProfileModal('history')">📋 Order History</button>
            </div>
            ${orders.length === 0 ? `
              <div class="empty-cart"><span>📦</span><p>No orders yet</p></div>
            ` : orders.slice(0, 3).map(o => `
              <div class="order-item-card">
                <div class="order-item-header">
                  <span class="order-id">Order #${o.id}</span>
                  <span class="order-status">${o.status}</span>
                </div>
                <div class="order-plants">${o.items.map(i => i.name).join(', ')}</div>
                <div class="order-total">₹${o.total.toLocaleString()} · ${new Date(o.created_at).toLocaleDateString('en-IN')}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    document.getElementById('modal-container').innerHTML = html;
  } else if (view === 'track') {
    let orders = [];
    try {
      const res = await fetch(`${API}/orders/user/${currentUser.id}`, { headers: { Authorization: `Bearer ${currentToken}` } });
      orders = await res.json();
    } catch (e) {}
    const latest = orders[0];
    const steps = ['Order Placed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered'];
    const currentStep = latest ? steps.indexOf(latest.status) : -1;
    const icons = ['📋', '📦', '🚚', '🏃', '✅'];
    const html = `
      <div class="modal-overlay" id="profile-overlay" onclick="if(event.target===this)closeModal('profile-overlay')">
        <div class="modal profile-modal">
          <button class="modal-close" onclick="closeModal('profile-overlay')">✕</button>
          <div class="modal-header"><h2>Track Order 🚚</h2></div>
          <div class="modal-body">
            <button class="profile-back" onclick="showProfileModal('orders')">← Back</button>
            ${!latest ? `<div class="empty-cart"><span>📦</span><p>No active orders</p></div>` : `
              <div style="background:var(--cream);border-radius:12px;padding:16px;margin-bottom:20px">
                <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                  <span style="font-size:13px;color:#666">Order #${latest.id}</span>
                  <span style="font-size:13px;font-weight:700;color:var(--green)">${latest.status}</span>
                </div>
                <div style="font-size:13px;color:#666">${latest.items.map(i => i.name).join(', ')}</div>
                <div style="font-size:15px;font-weight:700;color:var(--green-dark);margin-top:6px">₹${latest.total.toLocaleString()}</div>
              </div>
              <div class="track-progress">
                ${steps.map((step, i) => `
                  <div class="track-step ${i < currentStep ? 'done' : i === currentStep ? 'current' : ''}">
                    <div class="track-dot">${icons[i]}</div>
                    <div class="track-info">
                      <h4>${step}</h4>
                      <p>${i < currentStep ? 'Completed' : i === currentStep ? 'In Progress' : 'Pending'}</p>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>
      </div>
    `;
    document.getElementById('modal-container').innerHTML = html;
  } else if (view === 'history') {
    let orders = [];
    try {
      const res = await fetch(`${API}/orders/user/${currentUser.id}`, { headers: { Authorization: `Bearer ${currentToken}` } });
      orders = await res.json();
    } catch (e) {}
    const html = `
      <div class="modal-overlay" id="profile-overlay" onclick="if(event.target===this)closeModal('profile-overlay')">
        <div class="modal profile-modal">
          <button class="modal-close" onclick="closeModal('profile-overlay')">✕</button>
          <div class="modal-header"><h2>Order History 📋</h2></div>
          <div class="modal-body">
            <button class="profile-back" onclick="showProfileModal('orders')">← Back</button>
            ${orders.length === 0 ? `<div class="empty-cart"><span>📦</span><p>No previous orders</p></div>` :
              orders.map(o => `
                <div class="order-item-card">
                  <div class="order-item-header">
                    <span class="order-id">Order #${o.id} · ${new Date(o.created_at).toLocaleDateString('en-IN')}</span>
                    <span class="order-status">${o.status}</span>
                  </div>
                  <div class="order-plants">${o.items.map(i => `${i.name} x${i.quantity}`).join(', ')}</div>
                  <div style="display:flex;justify-content:space-between;margin-top:8px">
                    <span style="font-size:12px;color:#999">${o.payment_mode?.toUpperCase()}</span>
                    <span class="order-total">₹${o.total.toLocaleString()}</span>
                  </div>
                </div>
              `).join('')}
          </div>
        </div>
      </div>
    `;
    document.getElementById('modal-container').innerHTML = html;
  }
}

async function updateEmail() {
  const newEmail = document.getElementById('new-email').value.trim();
  const errEl = document.getElementById('email-error');
  if (!newEmail || !newEmail.includes('@')) { errEl.textContent = 'Enter a valid email'; return; }
  try {
    const res = await fetch(`${API}/auth/update-email`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentToken}` },
      body: JSON.stringify({ userId: currentUser.id, newEmail })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.message; return; }
    currentUser.email = newEmail;
    localStorage.setItem('ph_user', JSON.stringify(currentUser));
    showToast('Email updated successfully! ✅');
    showProfileModal('edit');
  } catch (err) { errEl.textContent = 'Server error. Try again.'; }
}

async function saveAddress() {
  const body = {
    user_id: currentUser.id,
    full_name: document.getElementById('edit-name').value.trim(),
    phone: document.getElementById('edit-phone').value.trim(),
    house: document.getElementById('edit-house').value.trim(),
    street: document.getElementById('edit-street').value.trim(),
    city: document.getElementById('edit-city').value.trim(),
    state: document.getElementById('edit-state').value.trim(),
    pincode: document.getElementById('edit-pin').value.trim()
  };
  try {
    await fetch(`${API}/auth/address`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentToken}` },
      body: JSON.stringify(body)
    });
    showToast('Address saved successfully! ✅');
  } catch (err) { showToast('Failed to save address!'); }
}

// ===== ANNOUNCEMENT =====
async function loadAnnouncement() {
  try {
    const res = await fetch(`${API}/admin/announcement`);
    const data = await res.json();
    if (data && data.active && data.message) {
      document.getElementById('announcement-text').textContent = data.message;
      document.getElementById('announcement-banner').classList.remove('hidden');
    }
  } catch (e) {}
}

// ===== UTILS =====
function updateNavBadges() {
  document.getElementById('cart-count').textContent = cartItems.reduce((sum, i) => sum + i.quantity, 0);
  document.getElementById('wishlist-count').textContent = wishlistItems.length;
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// ── Admin Dashboard Login (password only) ────────────────────────
function showAdminLoginModal() {
  if (document.getElementById('admin-login-overlay')) return;
  const container = document.getElementById('modal-container');
  container.insertAdjacentHTML('beforeend', `
    <div id="admin-login-overlay" style="
      position:fixed;inset:0;background:rgba(0,0,0,0.5);
      display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;">
      <div style="
        background:#fff;border-radius:24px;
        padding:36px 32px;width:100%;max-width:420px;text-align:center;
        box-shadow:0 24px 80px rgba(0,0,0,0.2);position:relative;">
        <div style="font-size:2rem;margin-bottom:8px;">🌿</div>
        <h2 style="color:#1a1a1a;margin:0 0 4px;font-size:1.5rem;font-weight:700;">Admin Dashboard</h2>
        <p style="color:#666;font-size:0.85rem;margin:0 0 24px;">Enter admin password to continue</p>
        <input type="password" id="admin-modal-pass" placeholder="Enter admin password"
          autocomplete="new-password"
          onkeydown="if(event.key==='Enter')submitAdminLogin()"
          style="width:100%;padding:12px 16px;border-radius:10px;border:2px solid #e8e8e8;
            background:#fff;color:#1a1a1a;font-size:1rem;box-sizing:border-box;margin-bottom:10px;
            font-family:inherit;transition:border-color 0.3s;outline:none;"
          onfocus="this.style.borderColor='#2d6a4f'" onblur="this.style.borderColor='#e8e8e8'" />
        <div id="admin-modal-error" style="color:#e63946;font-size:0.82rem;min-height:18px;margin-bottom:10px;"></div>
        <button onclick="submitAdminLogin()" style="
          width:100%;padding:14px;background:#2d6a4f;color:#fff;border:none;
          border-radius:50px;font-size:1rem;font-weight:600;cursor:pointer;margin-bottom:10px;
          transition:background 0.2s;">
          Enter Dashboard
        </button>
        <button onclick="closeModal('admin-login-overlay')" style="
          background:none;border:none;color:#666;font-size:0.85rem;cursor:pointer;">
          Cancel
        </button>
      </div>
    </div>
  `);
  setTimeout(() => { const f = document.getElementById('admin-modal-pass'); if(f){f.focus();f.value='';} }, 100);
}

async function submitAdminLogin() {
  const pass = document.getElementById('admin-modal-pass').value;
  const errEl = document.getElementById('admin-modal-error');
  if (!pass) { errEl.textContent = 'Please enter the password'; return; }
  if (pass !== 'admin123') { errEl.textContent = 'Incorrect password. Try again.'; return; }
  try {
    const res = await fetch(`${API}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pass })
    });
    const data = await res.json();
    const token = (res.ok && data.token) ? data.token : btoa(JSON.stringify({ isAdmin: true }));
    localStorage.setItem('adminToken', token);
    window.location.href = '/admin.html';
  } catch (err) {
    localStorage.setItem('adminToken', btoa(JSON.stringify({ isAdmin: true })));
    window.location.href = '/admin.html';
  }
}
// ────────────────────────────────────────────────────────────────

function showLoginSuccess(name, isNew = false) {
  // Remove any existing notification
  const existing = document.getElementById('login-success-notif');
  if (existing) existing.remove();

  const notif = document.createElement('div');
  notif.id = 'login-success-notif';
  notif.innerHTML = `
    <div style="display:flex;align-items:center;gap:14px">
      <div style="width:44px;height:44px;background:rgba(255,255,255,0.2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">
        ${isNew ? '🌱' : '🌿'}
      </div>
      <div>
        <div style="font-weight:700;font-size:15px;margin-bottom:2px">
          ${isNew ? `Welcome to Plant Heaven, ${name}!` : `Welcome back, ${name}!`}
        </div>
        <div style="font-size:12px;opacity:0.85">
          ${isNew ? 'Your account has been created successfully.' : 'You have signed in successfully.'}
        </div>
      </div>
      <button onclick="document.getElementById('login-success-notif').remove()"
        style="margin-left:auto;background:rgba(255,255,255,0.2);border:none;color:#fff;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:14px;flex-shrink:0;display:flex;align-items:center;justify-content:center">
        ✕
      </button>
    </div>
  `;
  Object.assign(notif.style, {
    position: 'fixed',
    top: '80px',
    right: '20px',
    background: 'linear-gradient(135deg, #2d6a4f, #40916c)',
    color: '#fff',
    padding: '16px 18px',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(45,106,79,0.35)',
    zIndex: '99999',
    maxWidth: '360px',
    width: 'calc(100vw - 40px)',
    transform: 'translateX(120%)',
    transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)',
    fontFamily: 'inherit'
  });
  document.body.appendChild(notif);
  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { notif.style.transform = 'translateX(0)'; });
  });
  // Auto dismiss after 4 seconds
  setTimeout(() => {
    if (notif && notif.parentNode) {
      notif.style.transform = 'translateX(120%)';
      setTimeout(() => notif.remove(), 400);
    }
  }, 4000);
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  toast.classList.add('show');
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.classList.add('hidden'), 400); }, 3000);
}

function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('revealed'), i * 60);
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.scroll-reveal:not(.revealed)').forEach(el => observer.observe(el));
}

// ===== TYPING ANIMATION =====
(function initTyping() {
  const words = ['Living Luxury', 'Your Life', 'Your Oasis', 'Fresh Spaces'];
  let wi = 0, ci = 0, deleting = false;
  const el = document.getElementById('typed-word');
  if (!el) return;
  function type() {
    const word = words[wi];
    if (!deleting) {
      el.textContent = word.slice(0, ci + 1);
      ci++;
      if (ci === word.length) { setTimeout(() => { deleting = true; type(); }, 1800); return; }
      setTimeout(type, 90);
    } else {
      el.textContent = word.slice(0, ci - 1);
      ci--;
      if (ci === 0) {
        deleting = false;
        wi = (wi + 1) % words.length;
        setTimeout(type, 300);
        return;
      }
      setTimeout(type, 48);
    }
  }
  setTimeout(type, 1200);
})();


// ===== HERO IMAGE ROTATOR =====
(function initHeroImages() {
  const images = [
    'https://thetanee.com/wp-content/uploads/2025/04/nature_inspired_architectural_approach.jpg',
    'https://img.freepik.com/premium-photo/modern-productive-office-desk-setup-with-computer-monitor-wooden-desk_1160544-75025.jpg',
    'https://wallpaperaccess.com/full/7853219.jpg',
    'https://wallpapercave.com/wp/wp12606784.jpg',
  ];
  let idx = 0;
  const img = document.getElementById('hero-img');
  if (!img) return;
  setInterval(() => {
    img.classList.add('fading');
    setTimeout(() => {
      idx = (idx + 1) % images.length;
      img.src = images[idx];
      img.onload = () => img.classList.remove('fading');
    }, 600);
  }, 4000);
})();

// ===== COUNT-UP ANIMATION =====
function initCountUp() {
  const els = document.querySelectorAll('.count-up');
  els.forEach(el => {
    const target = parseFloat(el.dataset.target);
    const suffix = el.dataset.suffix || '';
    const isDecimal = el.dataset.decimal === 'true';
    const duration = 1800;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      current = Math.min(current + increment, target);
      el.textContent = (isDecimal ? current.toFixed(1) : Math.round(current)) + suffix;
      if (step >= steps) { clearInterval(timer); el.textContent = (isDecimal ? target.toFixed(1) : target) + suffix; }
    }, duration / steps);
  });
}

// ===== ENHANCED SCROLL REVEAL =====
function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal-up, .reveal-left, .reveal-right, .reveal-scale').forEach(el => {
    observer.observe(el);
  });

  // Section title underline
  const titleObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        titleObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });
  document.querySelectorAll('.section-title').forEach(el => titleObserver.observe(el));

  // Count up when hero stats come into view
  const statsEl = document.querySelector('.hero-stats');
  if (statsEl) {
    const statsObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) { initCountUp(); statsObserver.disconnect(); }
    }, { threshold: 0.5 });
    statsObserver.observe(statsEl);
  }

  // Product cards staggered entrance
  const cardObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('card-visible'), i * 60);
        cardObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.product-card').forEach(el => cardObserver.observe(el));
}

// ===== ACTIVE NAV HIGHLIGHT ON SCROLL =====
(function initActiveNav() {
  const sections = ['home', 'plants', 'categories', 'about'];
  const links = document.querySelectorAll('.nav-links a');
  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el && window.scrollY >= el.offsetTop - 120) current = id;
    });
    links.forEach(a => {
      a.classList.toggle('nav-active', a.getAttribute('href') === '#' + current);
    });
  }, { passive: true });
})();

// ===== SUBTLE HERO PARALLAX =====
(function initParallax() {
  const heroImg = document.querySelector('.hero-image');
  if (!heroImg) return;
  window.addEventListener('scroll', () => {
    const scrolled = window.scrollY;
    if (scrolled < window.innerHeight) {
      heroImg.style.transform = `translateY(${scrolled * 0.08}px)`;
    }
  }, { passive: true });
})();

// ===== CART BUTTON PULSE =====
const origAddToCart = typeof addToCart === 'function' ? addToCart : null;
// Patch cart button after click for pulse effect
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.add-cart-btn');
  if (btn && !btn.classList.contains('in-cart')) {
    btn.classList.add('pulse');
    btn.addEventListener('animationend', () => btn.classList.remove('pulse'), { once: true });
  }
  const wBtn = e.target.closest('.wishlist-btn-card');
  if (wBtn) {
    wBtn.classList.add('popping');
    wBtn.addEventListener('animationend', () => wBtn.classList.remove('popping'), { once: true });
  }
});

// Re-run scroll reveal after products render
const origRenderProducts = typeof renderProducts === 'function' ? renderProducts : null;
if (origRenderProducts) {
  window.renderProducts = function(...args) {
    origRenderProducts.apply(this, args);
    setTimeout(initScrollReveal, 50);
  };
}

// Run on load
window.addEventListener('load', () => {
  setTimeout(initScrollReveal, 100);
});
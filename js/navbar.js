/**
 * Glow Care - Navigation, Header, Cart Drawer, Favorites & Audio Chimes
 */

// Luxury Web Audio API Chime Generator
const SoundFx = {
  ctx: null,
  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  },
  playBeep(freq = 600, duration = 0.08, type = 'sine') {
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // Audio autoplay policy fallback
    }
  },
  scanChime() {
    this.playBeep(880, 0.1, 'triangle');
    setTimeout(() => this.playBeep(1320, 0.18, 'triangle'), 100);
  },
  successChime() {
    this.playBeep(523.25, 0.09);
    setTimeout(() => this.playBeep(659.25, 0.09), 80);
    setTimeout(() => this.playBeep(783.99, 0.15), 160);
  }
};

// Global Toast System
window.showToast = function(message, type = 'success') {
  SoundFx.playBeep(640, 0.08);
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  const icon = type === 'success' ? '✓' : type === 'warning' ? '⚠' : 'ℹ';
  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-message">${message}</div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
};

// Setup Header & Drawers on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  // Apply saved theme
  const savedTheme = window.store ? window.store.getTheme() : 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);

  initNavbar();
  renderDrawers();
  updateNavState();

  // Listen to store updates
  window.addEventListener('glowcare:cart_updated', () => {
    updateNavState();
    renderCartItems();
  });
  window.addEventListener('glowcare:favorites_updated', () => {
    updateNavState();
    renderFavoritesItems();
  });
});

function initNavbar() {
  // Mobile Nav Toggle
  const mobileToggle = document.querySelector('.mobile-nav-toggle');
  const navMenu = document.querySelector('.nav-menu');
  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', () => {
      navMenu.classList.toggle('mobile-open');
    });
  }

  // Theme Toggle Button
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      if (window.store) {
        const next = window.store.toggleTheme();
        themeBtn.innerHTML = next === 'dark' ? '☀️' : '🌙';
        window.showToast(`Switched to ${next} mode`, 'info');
      }
    });
  }

  // User Dropdown Menu
  const userBtn = document.getElementById('user-avatar-btn');
  const userDropdown = document.getElementById('user-dropdown-panel');
  if (userBtn && userDropdown) {
    userBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdown.classList.toggle('show');
    });
    document.addEventListener('click', () => {
      userDropdown.classList.remove('show');
    });
  }

  // Cart Drawer Trigger
  const cartBtn = document.getElementById('cart-toggle-btn');
  const cartDrawer = document.getElementById('cart-drawer-overlay');
  if (cartBtn && cartDrawer) {
    cartBtn.addEventListener('click', () => {
      cartDrawer.classList.add('active');
      renderCartItems();
    });
  }

  // Favorites Drawer Trigger
  const favBtn = document.getElementById('favorites-toggle-btn');
  const favDrawer = document.getElementById('favorites-drawer-overlay');
  if (favBtn && favDrawer) {
    favBtn.addEventListener('click', () => {
      favDrawer.classList.add('active');
      renderFavoritesItems();
    });
  }

  // Close Drawers
  document.querySelectorAll('.drawer-close-btn, .drawer-overlay').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target === el || el.classList.contains('drawer-close-btn')) {
        document.querySelectorAll('.drawer-overlay').forEach(d => d.classList.remove('active'));
      }
    });
  });
}

function updateNavState() {
  if (!window.store) return;

  // Cart Badge Count
  const cart = window.store.getCart();
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartBadge = document.getElementById('nav-cart-count');
  if (cartBadge) {
    cartBadge.textContent = cartCount;
    cartBadge.style.display = cartCount > 0 ? 'flex' : 'none';
  }

  // Favorites Badge Count
  const favs = window.store.getFavorites();
  const favBadge = document.getElementById('nav-fav-count');
  if (favBadge) {
    favBadge.textContent = favs.length;
    favBadge.style.display = favs.length > 0 ? 'flex' : 'none';
  }

  // User Name in Nav
  const currentUser = window.store.getCurrentUser();
  const userNameElem = document.getElementById('nav-user-name');
  const userInitialsElem = document.getElementById('nav-user-initials');
  const adminLink = document.getElementById('nav-admin-link');
  
  if (currentUser) {
    if (userNameElem) userNameElem.textContent = currentUser.name.split(' ')[0];
    if (userInitialsElem) {
      const parts = currentUser.name.split(' ');
      userInitialsElem.textContent = parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0][0].toUpperCase();
    }
    if (adminLink) {
      adminLink.style.display = 'inline-flex';
    }
  } else {
    if (userNameElem) userNameElem.textContent = 'Account';
    if (userInitialsElem) userInitialsElem.textContent = '👤';
  }
}

// Render Drawers HTML
function renderDrawers() {
  if (document.getElementById('cart-drawer-overlay')) return;

  const html = `
    <!-- Cart Drawer -->
    <div id="cart-drawer-overlay" class="drawer-overlay">
      <div class="drawer-content">
        <div class="drawer-header">
          <h3 class="drawer-title">🛍️ Your Skincare Cart</h3>
          <button class="drawer-close-btn btn-icon">✕</button>
        </div>
        <div id="cart-drawer-body" class="drawer-body">
          <!-- Injected via renderCartItems -->
        </div>
        <div class="drawer-footer">
          <div style="display:flex; justify-content:space-between; margin-bottom:1rem; font-weight:700;">
            <span>Estimated Total:</span>
            <span id="cart-total-price" style="color:var(--primary); font-size:1.2rem;">₹0</span>
          </div>
          <button id="cart-checkout-btn" class="btn btn-primary" style="width:100%;">Proceed to Checkout</button>
        </div>
      </div>
    </div>

    <!-- Favorites Drawer -->
    <div id="favorites-drawer-overlay" class="drawer-overlay">
      <div class="drawer-content">
        <div class="drawer-header">
          <h3 class="drawer-title">❤️ Saved Favorites</h3>
          <button class="drawer-close-btn btn-icon">✕</button>
        </div>
        <div id="favorites-drawer-body" class="drawer-body">
          <!-- Injected via renderFavoritesItems -->
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);

  // Bind Checkout Action
  const checkoutBtn = document.getElementById('cart-checkout-btn');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      const cart = window.store.getCart();
      if (cart.length === 0) {
        window.showToast('Your cart is currently empty.', 'warning');
        return;
      }
      SoundFx.successChime();
      window.showToast('Order confirmed! Thank you for choosing Glow Care.', 'success');
      window.store.clearCart();
      document.getElementById('cart-drawer-overlay').classList.remove('active');
    });
  }
}

function renderCartItems() {
  const container = document.getElementById('cart-drawer-body');
  const totalPriceElem = document.getElementById('cart-total-price');
  if (!container || !window.store) return;

  const cart = window.store.getCart();
  if (cart.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:3rem 1rem; color:var(--text-muted);">
        <div style="font-size:3rem; margin-bottom:1rem;">🛒</div>
        <h4>Your cart is empty</h4>
        <p style="font-size:0.9rem; margin-top:0.4rem;">Scan your skin or explore products to find your customized routine!</p>
        <a href="products.html" class="btn btn-outline-primary btn-sm" style="margin-top:1.2rem;">Browse Products</a>
      </div>
    `;
    if (totalPriceElem) totalPriceElem.textContent = window.formatCurrency(0);
    return;
  }

  let total = 0;
  let itemsHtml = '';

  cart.forEach(item => {
    const product = window.store.getProductById(item.productId);
    if (!product) return;
    const itemSubtotal = product.price * item.quantity;
    total += itemSubtotal;

    itemsHtml += `
      <div class="cart-item-card">
        <img src="${product.image}" alt="${product.name}" class="cart-item-thumb">
        <div class="cart-item-info">
          <h4 class="cart-item-title">${product.name}</h4>
          <div class="cart-item-price">${window.formatCurrency(product.price)}</div>
          <div class="cart-qty-ctrl">
            <button class="cart-qty-btn" onclick="modifyCartQty('${product.id}', -1)">-</button>
            <span style="font-size:0.85rem; font-weight:700; padding:0 0.4rem;">${item.quantity}</span>
            <button class="cart-qty-btn" onclick="modifyCartQty('${product.id}', 1)">+</button>
            <button onclick="deleteFromCart('${product.id}')" style="margin-left:auto; color:var(--text-muted); font-size:0.8rem; text-decoration:underline;">Remove</button>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = itemsHtml;
  if (totalPriceElem) totalPriceElem.textContent = window.formatCurrency(total);
}

function renderFavoritesItems() {
  const container = document.getElementById('favorites-drawer-body');
  if (!container || !window.store) return;

  const favs = window.store.getFavorites();
  if (favs.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:3rem 1rem; color:var(--text-muted);">
        <div style="font-size:3rem; margin-bottom:1rem;">✨</div>
        <h4>No favorites saved yet</h4>
        <p style="font-size:0.9rem; margin-top:0.4rem;">Tap the heart icon on any product or treatment to save for later.</p>
        <a href="products.html" class="btn btn-outline-primary btn-sm" style="margin-top:1.2rem;">Discover Products</a>
      </div>
    `;
    return;
  }

  let itemsHtml = '';
  favs.forEach(id => {
    const product = window.store.getProductById(id);
    if (!product) return;

    itemsHtml += `
      <div class="cart-item-card">
        <img src="${product.image}" alt="${product.name}" class="cart-item-thumb">
        <div class="cart-item-info">
          <h4 class="cart-item-title">${product.name}</h4>
          <div class="cart-item-price">${window.formatCurrency(product.price)}</div>
          <div style="display:flex; gap:0.5rem; margin-top:0.5rem;">
            <button class="btn btn-primary btn-sm" onclick="moveFavToCart('${product.id}')" style="padding:0.3rem 0.7rem; font-size:0.75rem;">Add to Cart</button>
            <button onclick="removeFavorite('${product.id}')" style="color:var(--text-muted); font-size:0.8rem;">Remove</button>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = itemsHtml;
}

// Global Cart Actions
window.modifyCartQty = function(productId, delta) {
  const cart = window.store.getCart();
  const item = cart.find(i => i.productId === productId);
  if (item) {
    const nextQty = item.quantity + delta;
    if (nextQty <= 0) {
      window.store.removeFromCart(productId);
    } else {
      window.store.updateCartQty(productId, nextQty);
    }
  }
};

window.deleteFromCart = function(productId) {
  window.store.removeFromCart(productId);
  window.showToast('Item removed from cart', 'info');
};

window.moveFavToCart = function(productId) {
  window.store.addToCart(productId, 1);
  window.showToast('Added to your cart!', 'success');
};

window.removeFavorite = function(productId) {
  window.store.toggleFavorite(productId);
  renderFavoritesItems();
};

window.handleLogout = function() {
  if (window.store) {
    window.store.logout();
    window.showToast('Logged out successfully', 'info');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 500);
  }
};

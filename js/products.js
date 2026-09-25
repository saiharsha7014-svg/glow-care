/**
 * Glow Care - Products Catalog Controller
 * Real-time Search, Category Filter, Concern Filter, Sorting, Details Modal & Cart Integration
 */

let activeCategory = 'All';
let activeConcern = 'All';
let activeSearchQuery = '';
let activeSortOrder = 'featured';

document.addEventListener('DOMContentLoaded', () => {
  initProductPage();
});

function initProductPage() {
  // Check URL query parameters for pre-selected concern / category / matched filter
  const urlParams = new URLSearchParams(window.location.search);
  const filterParam = urlParams.get('filter');
  const categoryParam = urlParams.get('category');
  const concernParam = urlParams.get('concern');

  if (categoryParam) activeCategory = categoryParam;
  if (concernParam) activeConcern = concernParam;

  setupFilterEventListeners();
  checkLastScanBanner(filterParam);
  renderFilteredProducts();
  createProductDetailModal();
}

function checkLastScanBanner(isFilterRequested) {
  const banner = document.getElementById('scan-filter-alert-banner');
  if (!banner || !window.store) return;

  const lastScan = window.store.getLastScan();
  if (lastScan && (isFilterRequested === 'matched' || isFilterRequested === 'scan')) {
    banner.style.display = 'flex';
    const primaryConcern = lastScan.concerns[0].name;
    const skinType = lastScan.skinType;
    document.getElementById('scan-filter-desc').innerHTML = `
      Filtering products matched for <strong>${skinType}</strong> and <strong>${primaryConcern}</strong> detected in your latest face scan.
    `;
    activeConcern = primaryConcern;
    const concernSelect = document.getElementById('filter-concern-select');
    if (concernSelect) concernSelect.value = primaryConcern;
  }
}

function setupFilterEventListeners() {
  // Search Input
  const searchInput = document.getElementById('product-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      activeSearchQuery = e.target.value.toLowerCase().trim();
      renderFilteredProducts();
    });
  }

  // Category Pills
  const pills = document.querySelectorAll('.filter-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activeCategory = pill.getAttribute('data-category');
      renderFilteredProducts();
    });
  });

  // Concern Select Dropdown
  const concernSelect = document.getElementById('filter-concern-select');
  if (concernSelect) {
    concernSelect.addEventListener('change', (e) => {
      activeConcern = e.target.value;
      renderFilteredProducts();
    });
  }

  // Sort Order Select
  const sortSelect = document.getElementById('filter-sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      activeSortOrder = e.target.value;
      renderFilteredProducts();
    });
  }

  // Clear Scan Filter Button
  const clearFilterBtn = document.getElementById('btn-clear-scan-filter');
  if (clearFilterBtn) {
    clearFilterBtn.addEventListener('click', () => {
      const banner = document.getElementById('scan-filter-alert-banner');
      if (banner) banner.style.display = 'none';
      activeConcern = 'All';
      if (concernSelect) concernSelect.value = 'All';
      renderFilteredProducts();
    });
  }
}

function renderFilteredProducts() {
  const container = document.getElementById('products-catalog-grid');
  const countBadge = document.getElementById('products-count-badge');
  if (!container || !window.store) return;

  let products = window.store.getProducts();

  // 1. Search Query Filter
  if (activeSearchQuery) {
    products = products.filter(p => 
      p.name.toLowerCase().includes(activeSearchQuery) ||
      p.shortDesc.toLowerCase().includes(activeSearchQuery) ||
      p.category.toLowerCase().includes(activeSearchQuery) ||
      p.concerns.some(c => c.toLowerCase().includes(activeSearchQuery)) ||
      p.ingredients.toLowerCase().includes(activeSearchQuery)
    );
  }

  // 2. Category Filter
  if (activeCategory !== 'All') {
    products = products.filter(p => p.category.toLowerCase() === activeCategory.toLowerCase());
  }

  // 3. Concern Filter
  if (activeConcern !== 'All') {
    products = products.filter(p => p.concerns.some(c => c.toLowerCase() === activeConcern.toLowerCase()));
  }

  // 4. Sort Order
  if (activeSortOrder === 'price-low') {
    products.sort((a, b) => a.price - b.price);
  } else if (activeSortOrder === 'price-high') {
    products.sort((a, b) => b.price - a.price);
  } else if (activeSortOrder === 'rating') {
    products.sort((a, b) => b.rating - a.rating);
  }

  if (countBadge) {
    countBadge.textContent = `${products.length} Products Found`;
  }

  if (products.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align:center; padding: 4rem 1rem; color:var(--text-secondary);">
        <div style="font-size:3rem; margin-bottom:1rem;">🔍</div>
        <h3>No products match your criteria</h3>
        <p style="margin-top:0.4rem;">Try resetting your filters or search for another skincare ingredient.</p>
        <button class="btn btn-outline-primary" onclick="resetAllProductFilters()" style="margin-top:1.2rem;">Reset All Filters</button>
      </div>
    `;
    return;
  }

  container.innerHTML = products.map(p => {
    const isFav = window.store.isFavorite(p.id);
    return `
      <div class="product-card">
        <div class="product-thumb-wrapper">
          <img src="${p.image}" alt="${p.name}" loading="lazy">
          <span class="product-badge-tag">${p.badge || p.category}</span>
          <button class="product-fav-btn ${isFav ? 'active' : ''}" onclick="toggleProductFavorite('${p.id}', this)" title="Add to Favorites">♥</button>
        </div>
        <div class="product-body">
          <div class="product-meta-row">
            <span class="product-category-name">${p.category}</span>
            <span class="product-rating">★ ${p.rating} (${p.reviewsCount})</span>
          </div>
          <h3 class="product-title">${p.name}</h3>
          <p class="product-desc">${p.shortDesc}</p>
          
          <div class="why-recommended-box">
            <strong>Targeted Skin Concern:</strong>
            ${p.concerns.join(', ')}
          </div>

          <div class="product-footer-row">
            <span class="product-price">$${p.price.toFixed(2)}</span>
            <div class="product-card-actions">
              <button class="btn btn-outline-primary btn-sm" onclick="openProductModal('${p.id}')">View Details</button>
              <button class="btn btn-primary btn-sm" onclick="addProductToCart('${p.id}')">Add to Cart</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.resetAllProductFilters = function() {
  activeCategory = 'All';
  activeConcern = 'All';
  activeSearchQuery = '';
  activeSortOrder = 'featured';

  const searchInput = document.getElementById('product-search-input');
  const concernSelect = document.getElementById('filter-concern-select');
  const sortSelect = document.getElementById('filter-sort-select');
  const pills = document.querySelectorAll('.filter-pill');

  if (searchInput) searchInput.value = '';
  if (concernSelect) concernSelect.value = 'All';
  if (sortSelect) sortSelect.value = 'featured';
  pills.forEach((p, idx) => {
    p.classList.toggle('active', idx === 0);
  });

  renderFilteredProducts();
};

// Product Details Modal
function createProductDetailModal() {
  if (document.getElementById('product-details-modal')) return;

  const modalHtml = `
    <div id="product-details-modal" class="modal-overlay">
      <div class="modal-card">
        <button class="modal-close-btn" onclick="closeProductModal()">✕</button>
        <div id="modal-product-content" style="display:grid; grid-template-columns: 1fr 1fr; gap:2rem; align-items:start;">
          <!-- Dynamically Injected -->
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // Close on outside click
  document.getElementById('product-details-modal').addEventListener('click', (e) => {
    if (e.target.id === 'product-details-modal') closeProductModal();
  });
}

window.openProductModal = function(productId) {
  const product = window.store.getProductById(productId);
  if (!product) return;

  const content = document.getElementById('modal-product-content');
  if (!content) return;

  content.innerHTML = `
    <div>
      <img src="${product.image}" alt="${product.name}" style="width:100%; border-radius:var(--radius-md); aspect-ratio:1/1; object-fit:cover;">
      <div style="margin-top:1rem; padding:0.8rem; background:var(--bg-main); border-radius:var(--radius-sm); font-size:0.82rem;">
        <strong>Suitable For:</strong> ${product.skinType.join(', ')}
      </div>
    </div>
    <div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
        <span class="product-category-name">${product.category}</span>
        <span class="product-rating">★ ${product.rating} / 5.0</span>
      </div>
      <h2 style="font-size:1.4rem; margin-bottom:0.8rem;">${product.name}</h2>
      <div style="font-size:1.5rem; font-weight:800; color:var(--primary); margin-bottom:1.2rem;">$${product.price.toFixed(2)}</div>
      
      <p style="font-size:0.92rem; color:var(--text-secondary); line-height:1.6; margin-bottom:1.2rem;">${product.shortDesc}</p>
      
      <div class="why-recommended-box" style="margin-bottom:1.2rem;">
        <strong>Clinical Dermatologist Notes:</strong>
        ${product.recommendationReason}
      </div>

      <div style="margin-bottom:1.2rem; font-size:0.85rem;">
        <h4 style="font-size:0.92rem; margin-bottom:0.3rem;">Key Ingredients:</h4>
        <p style="color:var(--text-secondary); line-height:1.4;">${product.ingredients}</p>
      </div>

      <div style="margin-bottom:1.5rem; font-size:0.85rem;">
        <h4 style="font-size:0.92rem; margin-bottom:0.3rem;">Directions for Use:</h4>
        <p style="color:var(--text-secondary); line-height:1.4;">${product.usage}</p>
      </div>

      <div style="display:flex; gap:0.8rem;">
        <button class="btn btn-primary" onclick="addProductToCart('${product.id}'); closeProductModal();" style="flex:1;">Add to Cart - $${product.price.toFixed(2)}</button>
        <button class="btn btn-secondary btn-icon" onclick="toggleProductFavorite('${product.id}', this)">♥</button>
      </div>
    </div>
  `;

  document.getElementById('product-details-modal').classList.add('active');
};

window.closeProductModal = function() {
  const modal = document.getElementById('product-details-modal');
  if (modal) modal.classList.remove('active');
};

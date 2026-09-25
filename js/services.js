/**
 * Glow Care - Beauty Services Controller
 * Renders Service Cards, Category Filtering, and Pre-booking Handlers
 */

let activeServiceCategory = 'All';

document.addEventListener('DOMContentLoaded', () => {
  initServicesPage();
});

function initServicesPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const catParam = urlParams.get('category');
  if (catParam) activeServiceCategory = catParam;

  setupServiceFilters();
  renderServicesGrid();
}

function setupServiceFilters() {
  const pills = document.querySelectorAll('.service-filter-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activeServiceCategory = pill.getAttribute('data-category');
      renderServicesGrid();
    });
  });
}

function renderServicesGrid() {
  const container = document.getElementById('services-list-grid');
  if (!container || !window.store) return;

  let services = window.store.getServices();

  if (activeServiceCategory !== 'All') {
    services = services.filter(s => s.category.toLowerCase() === activeServiceCategory.toLowerCase());
  }

  container.innerHTML = services.map(s => `
    <div class="service-card">
      <div class="service-image-box">
        <img src="${s.image}" alt="${s.name}" loading="lazy">
        <span class="service-duration-badge">⏱ ${s.duration}</span>
      </div>
      <div class="service-body">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
          <span style="font-size:0.75rem; font-weight:700; color:var(--primary); text-transform:uppercase;">${s.category}</span>
          <span style="font-size:0.82rem; color:var(--accent-gold); font-weight:600;">★ ${s.rating} (${s.reviewsCount} reviews)</span>
        </div>
        <h3 class="service-title">${s.name}</h3>
        <p class="service-desc">${s.description}</p>
        
        <div class="service-suited-box">
          <strong>Best For:</strong> ${s.suitedFor}
        </div>

        <ul style="margin-bottom:1.2rem; font-size:0.82rem; color:var(--text-secondary); display:flex; flex-direction:column; gap:4px;">
          ${s.benefits.map(b => `<li style="display:flex; align-items:center; gap:6px;"><span style="color:var(--status-success); font-weight:700;">✓</span> ${b}</li>`).join('')}
        </ul>

        <div class="service-footer">
          <div>
            <div style="font-size:0.75rem; color:var(--text-muted);">Session Price</div>
            <div class="service-price">$${s.price.toFixed(2)}</div>
          </div>
          <a href="book.html?service=${s.id}" class="btn btn-primary">Book Now</a>
        </div>
      </div>
    </div>
  `).join('');
}

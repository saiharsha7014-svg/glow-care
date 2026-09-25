/**
 * Glow Care - Admin Dashboard Controller
 * Full CRUD, KPI Analytics, Appointments Status Changer, CSV Export & Modal Forms
 */

let activeAdminTab = 'appointments';
let activeApptStatusFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
  initAdminDashboard();
});

function initAdminDashboard() {
  setupAdminTabs();
  renderKPIs();
  renderAppointmentsTable();
  renderProductsTable();
  renderServicesTable();
  renderCustomersTable();
  setupAddProductModal();
  setupCSVExport();
}

function setupAdminTabs() {
  const tabs = document.querySelectorAll('.admin-tab-btn');
  const panels = document.querySelectorAll('.admin-tab-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const targetId = tab.getAttribute('data-target');
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) targetPanel.classList.add('active');
    });
  });
}

function renderKPIs() {
  if (!window.store) return;

  const users = window.store.getUsers();
  const appointments = window.store.getAppointments();
  const products = window.store.getProducts();
  const services = window.store.getServices();

  const todayStr = new Date().toISOString().split('T')[0];
  const todayAppts = appointments.filter(a => a.date === todayStr);

  const totalRevenue = appointments.reduce((sum, a) => sum + (Number(a.price) || 0), 0);

  document.getElementById('kpi-customers').textContent = users.length;
  document.getElementById('kpi-appointments').textContent = appointments.length;
  document.getElementById('kpi-today-appts').textContent = todayAppts.length;
  document.getElementById('kpi-products').textContent = products.length;
  document.getElementById('kpi-services').textContent = services.length;
  document.getElementById('kpi-revenue').textContent = window.formatCurrency(totalRevenue);
}

// 1. Appointments Table
function renderAppointmentsTable() {
  const tbody = document.getElementById('admin-appointments-tbody');
  if (!tbody || !window.store) return;

  let appointments = window.store.getAppointments();

  if (activeApptStatusFilter !== 'all') {
    appointments = appointments.filter(a => a.status.toLowerCase() === activeApptStatusFilter);
  }

  if (appointments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">No appointments found.</td></tr>`;
    return;
  }

  tbody.innerHTML = appointments.map(a => `
    <tr>
      <td><strong>${a.id}</strong></td>
      <td>
        <div style="font-weight:600;">${a.customerName}</div>
        <div style="font-size:0.8rem; color:var(--text-muted);">${a.customerEmail}</div>
      </td>
      <td>${a.serviceName}</td>
      <td>${a.date} <span style="color:var(--text-muted); font-size:0.82rem;">(${a.time})</span></td>
      <td>${window.formatCurrency(a.price)}</td>
      <td>
        <select class="status-select" onchange="changeAppointmentStatus('${a.id}', this.value)">
          <option value="Pending" ${a.status === 'Pending' ? 'selected' : ''}>Pending</option>
          <option value="Confirmed" ${a.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
          <option value="Completed" ${a.status === 'Completed' ? 'selected' : ''}>Completed</option>
          <option value="Cancelled" ${a.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
        </select>
      </td>
      <td>
        <button class="btn-action-icon btn-action-delete" onclick="adminDeleteAppointment('${a.id}')" title="Delete Appointment">🗑</button>
      </td>
    </tr>
  `).join('');
}

window.changeAppointmentStatus = function(id, newStatus) {
  window.store.updateAppointmentStatus(id, newStatus);
  window.showToast(`Appointment ${id} status updated to ${newStatus}`, 'success');
  renderKPIs();
  renderAppointmentsTable();
};

window.adminDeleteAppointment = function(id) {
  if (confirm(`Are you sure you want to permanently delete appointment ${id}?`)) {
    window.store.deleteAppointment(id);
    window.showToast('Appointment deleted.', 'info');
    renderKPIs();
    renderAppointmentsTable();
  }
};

window.filterAdminAppointments = function(status) {
  activeApptStatusFilter = status.toLowerCase();
  renderAppointmentsTable();
};

// 2. Products Table
function renderProductsTable() {
  const tbody = document.getElementById('admin-products-tbody');
  if (!tbody || !window.store) return;

  const products = window.store.getProducts();

  tbody.innerHTML = products.map(p => `
    <tr>
      <td>
        <img src="${p.image}" alt="${p.name}" style="width:44px; height:44px; border-radius:8px; object-fit:cover;">
      </td>
      <td>
        <div style="font-weight:600;">${p.name}</div>
        <div style="font-size:0.8rem; color:var(--text-muted);">${p.shortDesc.slice(0, 50)}...</div>
      </td>
      <td><span class="section-tag" style="margin:0; font-size:0.75rem;">${p.category}</span></td>
      <td><strong>${window.formatCurrency(p.price)}</strong></td>
      <td>★ ${p.rating}</td>
      <td>
        <button class="btn-action-icon btn-action-delete" onclick="adminDeleteProduct('${p.id}')" title="Delete Product">🗑</button>
      </td>
    </tr>
  `).join('');
}

window.adminDeleteProduct = function(id) {
  if (confirm('Delete this product from catalog?')) {
    window.store.deleteProduct(id);
    window.showToast('Product removed.', 'info');
    renderKPIs();
    renderProductsTable();
  }
};

// 3. Services Table
function renderServicesTable() {
  const tbody = document.getElementById('admin-services-tbody');
  if (!tbody || !window.store) return;

  const services = window.store.getServices();

  tbody.innerHTML = services.map(s => `
    <tr>
      <td>
        <img src="${s.image}" alt="${s.name}" style="width:50px; height:36px; border-radius:6px; object-fit:cover;">
      </td>
      <td>
        <div style="font-weight:600;">${s.name}</div>
        <div style="font-size:0.8rem; color:var(--text-muted);">${s.suitedFor}</div>
      </td>
      <td>${s.category}</td>
      <td>⏱ ${s.duration}</td>
      <td><strong>${window.formatCurrency(s.price)}</strong></td>
    </tr>
  `).join('');
}

// 4. Customers Table
function renderCustomersTable() {
  const tbody = document.getElementById('admin-customers-tbody');
  if (!tbody || !window.store) return;

  const users = window.store.getUsers();

  tbody.innerHTML = users.map(u => `
    <tr>
      <td>
        <div style="font-weight:600;">${u.name}</div>
        <div style="font-size:0.8rem; color:var(--text-muted);">${u.phone || 'No phone'}</div>
      </td>
      <td>${u.email}</td>
      <td><span class="status-pill status-completed">${u.role.toUpperCase()}</span></td>
      <td>${u.skinType || 'Unknown'}</td>
      <td>${u.joinedDate || '2026-01-01'}</td>
    </tr>
  `).join('');
}

// 5. Add Product Modal & Form
function setupAddProductModal() {
  const openBtn = document.getElementById('btn-admin-add-product');
  const modal = document.getElementById('admin-product-modal');
  const closeBtn = document.getElementById('btn-close-product-modal');
  const form = document.getElementById('admin-new-product-form');

  if (openBtn && modal) {
    openBtn.addEventListener('click', () => modal.classList.add('active'));
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  }

  if (form && modal) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('new-prod-name').value.trim();
      const category = document.getElementById('new-prod-category').value;
      const price = parseFloat(document.getElementById('new-prod-price').value) || 25.00;
      const image = document.getElementById('new-prod-image').value.trim() || 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=700&q=80';
      const desc = document.getElementById('new-prod-desc').value.trim();
      const concerns = document.getElementById('new-prod-concerns').value.split(',').map(c => c.trim()).filter(Boolean);

      window.store.saveProduct({
        name,
        category,
        price,
        rating: 4.8,
        reviewsCount: 1,
        image,
        concerns: concerns.length ? concerns : ['Pimples / Acne', 'Visible Pores'],
        skinType: ['All Skin Types'],
        shortDesc: desc,
        recommendationReason: 'Formulated with clinically-active ingredients to restore natural skin balance.',
        badge: 'New Arrival',
        ingredients: 'Water, Glycerin, Niacinamide, Botanical extracts.',
        usage: 'Apply gently onto cleansed face.'
      });

      SoundFx.successChime();
      window.showToast('New product added to catalog successfully!', 'success');
      form.reset();
      modal.classList.remove('active');
      renderKPIs();
      renderProductsTable();
    });
  }
}

// 6. CSV Export of Appointments
function setupCSVExport() {
  const exportBtn = document.getElementById('btn-export-csv');
  if (!exportBtn) return;

  exportBtn.addEventListener('click', () => {
    const appointments = window.store.getAppointments();
    if (appointments.length === 0) {
      window.showToast('No appointments to export.', 'warning');
      return;
    }

    let csv = 'Appointment ID,Customer Name,Email,Phone,Service,Date,Time,Price,Status\n';
    appointments.forEach(a => {
      csv += `"${a.id}","${a.customerName}","${a.customerEmail}","${a.customerPhone || ''}","${a.serviceName}","${a.date}","${a.time}","${a.price}","${a.status}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `glowcare_appointments_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    window.showToast('Appointments CSV exported successfully!', 'success');
  });
}

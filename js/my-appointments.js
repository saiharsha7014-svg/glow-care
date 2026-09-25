/**
 * Glow Care - My Appointments Controller
 * List, Filter, and Cancel User Appointments with LocalStorage Persistence
 */

let activeAppointmentFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
  initMyAppointments();
});

function initMyAppointments() {
  setupFilterTabs();
  renderAppointmentsList();
}

function setupFilterTabs() {
  const tabs = document.querySelectorAll('.app-filter-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeAppointmentFilter = tab.getAttribute('data-status').toLowerCase();
      renderAppointmentsList();
    });
  });
}

function renderAppointmentsList() {
  const container = document.getElementById('user-appointments-container');
  if (!container || !window.store) return;

  const currentUser = window.store.getCurrentUser();
  const userEmail = currentUser ? currentUser.email : 'demo@glowcare.com';

  let appointments = window.store.getUserAppointments(userEmail);

  // If user has no specific appointments, fallback to demo appointments list
  if (appointments.length === 0) {
    appointments = window.store.getAppointments();
  }

  if (activeAppointmentFilter !== 'all') {
    appointments = appointments.filter(a => a.status.toLowerCase() === activeAppointmentFilter);
  }

  if (appointments.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:4rem 1rem; background:var(--bg-surface); border:1px solid var(--border-light); border-radius:var(--radius-md);">
        <div style="font-size:3rem; margin-bottom:1rem;">📅</div>
        <h3>No appointments found</h3>
        <p style="color:var(--text-secondary); margin-top:0.4rem;">You do not have any ${activeAppointmentFilter !== 'all' ? activeAppointmentFilter : ''} bookings scheduled.</p>
        <a href="book.html" class="btn btn-primary" style="margin-top:1.5rem;">Book a Beauty Service</a>
      </div>
    `;
    return;
  }

  container.innerHTML = appointments.map(a => {
    const statusClass = a.status === 'Confirmed' ? 'status-confirmed' :
                        a.status === 'Pending' ? 'status-pending' :
                        a.status === 'Completed' ? 'status-completed' : 'status-cancelled';

    const canCancel = a.status === 'Pending' || a.status === 'Confirmed';

    return `
      <div class="user-appointment-card" style="background:var(--bg-surface); border:1px solid var(--border-light); border-radius:var(--radius-md); padding:1.8rem; margin-bottom:1.2rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1.2rem;">
        <div style="display:flex; gap:1.5rem; align-items:center;">
          <div style="width:56px; height:56px; border-radius:14px; background:var(--primary-light); color:var(--primary); display:flex; align-items:center; justify-content:center; font-size:1.6rem; flex-shrink:0;">
            💆‍♀️
          </div>
          <div>
            <div style="display:flex; align-items:center; gap:0.8rem; margin-bottom:0.3rem;">
              <span style="font-size:0.82rem; font-weight:700; color:var(--text-muted);">${a.id}</span>
              <span class="status-pill ${statusClass}">${a.status}</span>
            </div>
            <h3 style="font-size:1.25rem; font-weight:700; margin-bottom:0.4rem;">${a.serviceName}</h3>
            <div style="display:flex; flex-wrap:wrap; gap:1.2rem; font-size:0.88rem; color:var(--text-secondary);">
              <span>📅 <strong>Date:</strong> ${a.date}</span>
              <span>⏰ <strong>Time:</strong> ${a.time}</span>
              <span>💵 <strong>Amount:</strong> ${window.formatCurrency(a.price)}</span>
            </div>
            ${a.notes ? `<div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.4rem;">Note: ${a.notes}</div>` : ''}
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:0.8rem;">
          ${canCancel ? `
            <button class="btn btn-secondary btn-sm" onclick="confirmCancelAppointment('${a.id}')" style="color:#E63946; border-color:#E63946;">
              Cancel Booking
            </button>
          ` : ''}
          <a href="book.html?service=${a.serviceId || ''}" class="btn btn-outline-primary btn-sm">Book Again</a>
        </div>
      </div>
    `;
  }).join('');
}

window.confirmCancelAppointment = function(id) {
  if (confirm(`Are you sure you want to cancel appointment ${id}?`)) {
    window.store.cancelAppointment(id);
    window.showToast('Appointment cancelled successfully.', 'info');
    renderAppointmentsList();
  }
};

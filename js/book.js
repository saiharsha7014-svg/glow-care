/**
 * Glow Care - Appointment Booking Controller
 * Interactive Booking Wizard, Time Slot Selection, Validation & Confirmation
 */

let selectedService = null;
let selectedDate = '';
let selectedTime = '11:00 AM';

document.addEventListener('DOMContentLoaded', () => {
  initBookingPage();
});

function initBookingPage() {
  populateServiceSelect();
  setupDatePicker();
  setupTimeSlotChips();
  prefillCurrentUser();
  setupFormSubmission();
  updateBookingSummary();
}

function populateServiceSelect() {
  const select = document.getElementById('booking-service-select');
  if (!select || !window.store) return;

  const services = window.store.getServices();
  const urlParams = new URLSearchParams(window.location.search);
  const preselectedId = urlParams.get('service');

  select.innerHTML = '<option value="">-- Choose a Beauty Treatment --</option>' + 
    services.map(s => `
      <option value="${s.id}" ${s.id === preselectedId ? 'selected' : ''}>
        ${s.name} (${s.duration}) - $${s.price.toFixed(2)}
      </option>
    `).join('');

  if (preselectedId) {
    selectedService = window.store.getServiceById(preselectedId);
  } else if (services.length > 0) {
    selectedService = services[0];
    select.value = services[0].id;
  }

  select.addEventListener('change', (e) => {
    selectedService = window.store.getServiceById(e.target.value);
    updateBookingSummary();
  });
}

function setupDatePicker() {
  const dateInput = document.getElementById('booking-date');
  if (!dateInput) return;

  // Set min date to today
  const today = new Date().toISOString().split('T')[0];
  dateInput.min = today;

  // Default to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  dateInput.value = tomorrowStr;
  selectedDate = tomorrowStr;

  dateInput.addEventListener('change', (e) => {
    selectedDate = e.target.value;
    updateBookingSummary();
  });
}

function setupTimeSlotChips() {
  const chips = document.querySelectorAll('.time-slot-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedTime = chip.getAttribute('data-time') || chip.textContent.trim();
      updateBookingSummary();
    });
  });
}

function prefillCurrentUser() {
  if (!window.store) return;
  const user = window.store.getCurrentUser();
  if (user) {
    const nameInput = document.getElementById('booking-name');
    const emailInput = document.getElementById('booking-email');
    const phoneInput = document.getElementById('booking-phone');

    if (nameInput && !nameInput.value) nameInput.value = user.name;
    if (emailInput && !emailInput.value) emailInput.value = user.email;
    if (phoneInput && !phoneInput.value && user.phone) phoneInput.value = user.phone;
  }
}

function updateBookingSummary() {
  const nameElem = document.getElementById('summary-service-name');
  const durElem = document.getElementById('summary-service-dur');
  const dateElem = document.getElementById('summary-booking-date');
  const timeElem = document.getElementById('summary-booking-time');
  const priceElem = document.getElementById('summary-total-price');

  if (selectedService) {
    if (nameElem) nameElem.textContent = selectedService.name;
    if (durElem) durElem.textContent = selectedService.duration;
    if (priceElem) priceElem.textContent = `$${selectedService.price.toFixed(2)}`;
  }

  if (dateElem) {
    if (selectedDate) {
      const d = new Date(selectedDate + 'T00:00:00');
      dateElem.textContent = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    } else {
      dateElem.textContent = 'Please choose date';
    }
  }

  if (timeElem) timeElem.textContent = selectedTime;
}

function setupFormSubmission() {
  const form = document.getElementById('appointment-booking-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    if (!selectedService) {
      window.showToast('Please select a beauty service treatment.', 'warning');
      return;
    }

    const name = document.getElementById('booking-name').value.trim();
    const email = document.getElementById('booking-email').value.trim();
    const phone = document.getElementById('booking-phone').value.trim();
    const notes = document.getElementById('booking-notes') ? document.getElementById('booking-notes').value.trim() : '';

    if (!name || !email || !phone) {
      window.showToast('Please complete all contact details.', 'warning');
      return;
    }

    const appointment = window.store.bookAppointment({
      serviceId: selectedService.id,
      serviceName: selectedService.name,
      date: selectedDate,
      time: selectedTime,
      customerName: name,
      customerEmail: email,
      customerPhone: phone,
      notes: notes,
      price: selectedService.price
    });

    SoundFx.successChime();
    showBookingConfirmationModal(appointment);
  });
}

function showBookingConfirmationModal(appointment) {
  const modal = document.getElementById('booking-success-modal');
  if (!modal) {
    alert(`Appointment Confirmed! Reference ID: ${appointment.id}`);
    window.location.href = 'my-appointments.html';
    return;
  }

  document.getElementById('modal-ref-code').textContent = appointment.id;
  document.getElementById('modal-conf-service').textContent = appointment.serviceName;
  document.getElementById('modal-conf-datetime').textContent = `${appointment.date} at ${appointment.time}`;
  document.getElementById('modal-conf-name').textContent = appointment.customerName;

  modal.classList.add('active');
}

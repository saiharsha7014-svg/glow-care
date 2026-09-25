/**
 * Glow Care - Contact Form Controller & FAQ Accordions
 */

document.addEventListener('DOMContentLoaded', () => {
  initContactPage();
});

function initContactPage() {
  setupContactForm();
  setupFAQAccordion();
}

function setupContactForm() {
  const form = document.getElementById('glow-contact-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('contact-name').value.trim();
    const email = document.getElementById('contact-email').value.trim();
    const phone = document.getElementById('contact-phone').value.trim();
    const subject = document.getElementById('contact-subject').value.trim();
    const message = document.getElementById('contact-message').value.trim();

    if (!name || !email || !message) {
      window.showToast('Please fill in your name, email and message.', 'warning');
      return;
    }

    if (window.store) {
      window.store.saveContactMessage({ name, email, phone, subject, message });
    }

    SoundFx.successChime();
    window.showToast('Thank you! Your message has been received. Our team will contact you shortly.', 'success');
    form.reset();
  });
}

function setupFAQAccordion() {
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    if (question) {
      question.addEventListener('click', () => {
        const isOpen = item.classList.contains('open');
        faqItems.forEach(f => f.classList.remove('open'));
        if (!isOpen) item.classList.add('open');
      });
    }
  });
}

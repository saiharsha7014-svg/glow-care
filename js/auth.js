/**
 * Glow Care - Authentication & User Profile Controller
 * Handles Login, Registration, Demo Credentials, and Profile Management
 */

document.addEventListener('DOMContentLoaded', () => {
  initAuthPage();
});

function initAuthPage() {
  setupAuthTabs();
  setupLoginForm();
  setupSignupForm();
  setupDemoLoginButtons();
  checkLoggedInState();
}

function setupAuthTabs() {
  const loginTab = document.getElementById('tab-login-btn');
  const signupTab = document.getElementById('tab-signup-btn');
  const loginPanel = document.getElementById('panel-login');
  const signupPanel = document.getElementById('panel-signup');

  if (loginTab && signupTab && loginPanel && signupPanel) {
    loginTab.addEventListener('click', () => {
      loginTab.classList.add('active');
      signupTab.classList.remove('active');
      loginPanel.style.display = 'block';
      signupPanel.style.display = 'none';
    });

    signupTab.addEventListener('click', () => {
      signupTab.classList.add('active');
      loginTab.classList.remove('active');
      signupPanel.style.display = 'block';
      loginPanel.style.display = 'none';
    });
  }
}

function setupLoginForm() {
  const form = document.getElementById('form-login');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-password').value;

    const res = window.store.login(email, pass);
    if (res.success) {
      SoundFx.successChime();
      window.showToast(`Welcome back, ${res.user.name}!`, 'success');
      setTimeout(() => {
        if (res.user.role === 'admin') {
          window.location.href = 'admin.html';
        } else {
          window.location.href = 'index.html';
        }
      }, 700);
    } else {
      window.showToast(res.message, 'warning');
    }
  });
}

function setupSignupForm() {
  const form = document.getElementById('form-signup');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const phone = document.getElementById('signup-phone').value.trim();
    const pass = document.getElementById('signup-password').value;
    const skinType = document.getElementById('signup-skintype').value;

    if (!name || !email || !pass) {
      window.showToast('Please fill in all required fields.', 'warning');
      return;
    }

    const res = window.store.signup({ name, email, phone, password: pass, skinType });
    if (res.success) {
      SoundFx.successChime();
      window.showToast('Account created successfully! Welcome to Glow Care.', 'success');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 700);
    } else {
      window.showToast(res.message, 'warning');
    }
  });
}

function setupDemoLoginButtons() {
  const demoUserBtn = document.getElementById('btn-fill-demo-user');
  const demoAdminBtn = document.getElementById('btn-fill-demo-admin');

  if (demoUserBtn) {
    demoUserBtn.addEventListener('click', () => {
      document.getElementById('login-email').value = 'demo@glowcare.com';
      document.getElementById('login-password').value = 'password123';
      window.showToast('Demo User credentials filled. Click Sign In!', 'info');
    });
  }

  if (demoAdminBtn) {
    demoAdminBtn.addEventListener('click', () => {
      document.getElementById('login-email').value = 'admin@glowcare.com';
      document.getElementById('login-password').value = 'admin123';
      window.showToast('Demo Admin credentials filled. Click Sign In!', 'info');
    });
  }
}

function checkLoggedInState() {
  const currentUser = window.store.getCurrentUser();
  const profileCard = document.getElementById('auth-profile-card');
  const formContainer = document.getElementById('auth-forms-container');

  if (currentUser && profileCard && formContainer) {
    formContainer.style.display = 'none';
    profileCard.style.display = 'block';

    document.getElementById('profile-name').textContent = currentUser.name;
    document.getElementById('profile-email').textContent = currentUser.email;
    document.getElementById('profile-role').textContent = currentUser.role.toUpperCase();
    document.getElementById('profile-phone').textContent = currentUser.phone || 'Not provided';
    document.getElementById('profile-skintype').textContent = currentUser.skinType || 'Not set';

    const scans = window.store.getScanHistory();
    const appointments = window.store.getUserAppointments(currentUser.email);
    const favs = window.store.getFavorites();

    document.getElementById('profile-stat-scans').textContent = scans.length;
    document.getElementById('profile-stat-appts').textContent = appointments.length;
    document.getElementById('profile-stat-favs').textContent = favs.length;

    const logoutBtn = document.getElementById('btn-profile-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        window.store.logout();
        window.showToast('Logged out successfully', 'info');
        setTimeout(() => window.location.reload(), 400);
      });
    }
  }
}

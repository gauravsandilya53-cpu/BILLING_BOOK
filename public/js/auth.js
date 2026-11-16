// ========================================================
// BILLING BOOK - Authentication & User State
// ========================================================

const Auth = {
  init() {
    this.bindEvents();
    this.checkSession();
  },

  bindEvents() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const btnShowRegister = document.getElementById('btn-show-register');
    const btnShowLogin = document.getElementById('btn-show-login');
    const btnQuickDemo = document.getElementById('btn-quick-demo');
    const btnLogout = document.getElementById('btn-logout');

    if (loginForm) {
      loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }

    if (registerForm) {
      registerForm.addEventListener('submit', (e) => this.handleRegister(e));
    }

    if (btnShowRegister) {
      btnShowRegister.addEventListener('click', () => {
        document.getElementById('login-card').style.display = 'none';
        document.getElementById('register-card').style.display = 'block';
      });
    }

    if (btnShowLogin) {
      btnShowLogin.addEventListener('click', () => {
        document.getElementById('register-card').style.display = 'none';
        document.getElementById('login-card').style.display = 'block';
      });
    }

    if (btnQuickDemo) {
      btnQuickDemo.addEventListener('click', () => {
        const emailInput = document.getElementById('login-email');
        const passInput = document.getElementById('login-password');
        if (emailInput && passInput) {
          emailInput.value = 'admin@billingbook.com';
          passInput.value = 'admin123';
          loginForm.dispatchEvent(new Event('submit'));
        }
      });
    }

    if (btnLogout) {
      btnLogout.addEventListener('click', () => this.logout());
    }

    window.addEventListener('auth-expired', () => {
      this.showLoginModal();
      showToast('Session expired. Please log in again.', 'warning');
    });
  },

  checkSession() {
    const token = API.getToken();
    const user = API.getCurrentUser();

    if (token && user) {
      this.renderUserProfile(user);
      this.hideLoginModal();
      // Trigger app data load
      window.dispatchEvent(new CustomEvent('user-authenticated'));
    } else {
      this.showLoginModal();
    }
  },

  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const submitBtn = document.getElementById('btn-login-submit');

    try {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Signing in...';

      const data = await API.post('/auth/login', { email, password });
      API.setToken(data.token);
      API.setCurrentUser(data.user);

      this.renderUserProfile(data.user);
      this.hideLoginModal();
      showToast('Welcome back, ' + data.user.name + '!', 'success');

      window.dispatchEvent(new CustomEvent('user-authenticated'));
    } catch (err) {
      showToast(err.message || 'Login failed. Please verify credentials.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Sign In to Billing Book';
    }
  },

  async handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const submitBtn = document.getElementById('btn-reg-submit');

    try {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Creating account...';

      const data = await API.post('/auth/register', { name, email, password });
      API.setToken(data.token);
      API.setCurrentUser(data.user);

      this.renderUserProfile(data.user);
      this.hideLoginModal();
      showToast('Account created successfully!', 'success');

      window.dispatchEvent(new CustomEvent('user-authenticated'));
    } catch (err) {
      showToast(err.message || 'Registration failed.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Register & Start Invoicing';
    }
  },

  renderUserProfile(user) {
    const userNameEl = document.getElementById('header-user-name');
    const userRoleEl = document.getElementById('header-user-role');
    const avatarEl = document.getElementById('header-user-avatar');

    if (userNameEl) userNameEl.textContent = user.name || 'User';
    if (userRoleEl) userRoleEl.textContent = user.email || 'Admin';
    if (avatarEl) {
      const initial = (user.name || 'A').charAt(0).toUpperCase();
      avatarEl.textContent = initial;
    }
  },

  showLoginModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.add('active');
  },

  hideLoginModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.remove('active');
  },

  logout() {
    API.setToken(null);
    API.setCurrentUser(null);
    showToast('Logged out successfully.', 'info');
    this.showLoginModal();
  }
};


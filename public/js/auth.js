APP.auth = {
  login: async function (email, password) {
    try {
      var data = await APP.api.post('/api/auth/login', { email: email, password: password });
      APP.state.user = data.user;
      APP.updateNavigation();
      APP.hideModal('modal-login');
      APP.notify('Добро пожаловать, ' + data.user.username + '!', 'success');

      // Clear login form
      var loginEmail = document.getElementById('login-email');
      var loginPassword = document.getElementById('login-password');
      if (loginEmail) loginEmail.value = '';
      if (loginPassword) loginPassword.value = '';

      // Reload current page
      APP.navigate(APP.state.currentPage);
    } catch (err) {
      APP.notify(err.message, 'error');
      throw err;
    }
  },

  register: async function (username, email, password, inviteCode) {
    try {
      var data = await APP.api.post('/api/auth/register', {
        username: username,
        email: email,
        password: password,
        invite_code: inviteCode,
      });

      APP.notify('Регистрация успешна! Ваш UID: ' + data.user.uid + '. Выполняется вход...', 'success');

      // Clear register form
      var regUsername = document.getElementById('register-username');
      var regEmail = document.getElementById('register-email');
      var regPassword = document.getElementById('register-password');
      var regInvite = document.getElementById('register-invite');
      if (regUsername) regUsername.value = '';
      if (regEmail) regEmail.value = '';
      if (regPassword) regPassword.value = '';
      if (regInvite) regInvite.value = '';

      // Auto login after registration
      await APP.auth.login(email, password);
    } catch (err) {
      APP.notify(err.message, 'error');
      throw err;
    }
  },

  logout: async function () {
    try {
      await APP.api.post('/api/auth/logout', {});
    } catch (err) {
      // Even if logout fails on server, clear local state
    }

    APP.state.user = null;
    APP.updateNavigation();

    // Stop chat polling
    if (APP.chat) APP.chat.stopPolling();

    APP.notify('Вы вышли из аккаунта', 'info');
    APP.navigate('home');
  },

  changePassword: async function (oldPassword, newPassword) {
    try {
      if (!APP.state.user) {
        APP.notify('Необходимо авторизоваться', 'warning');
        return;
      }

      await APP.api.post('/api/auth/change-password', {
        old_password: oldPassword,
        new_password: newPassword,
      });

      APP.notify('Пароль успешно изменён', 'success');

      // Clear form
      var oldPassInput = document.getElementById('change-old-password');
      var newPassInput = document.getElementById('change-new-password');
      var confirmPassInput = document.getElementById('change-confirm-password');
      if (oldPassInput) oldPassInput.value = '';
      if (newPassInput) newPassInput.value = '';
      if (confirmPassInput) confirmPassInput.value = '';
    } catch (err) {
      APP.notify(err.message, 'error');
      throw err;
    }
  },

  checkAuth: async function () {
    try {
      var data = await APP.api.get('/api/auth/me');
      if (data.user) {
        APP.state.user = data.user;
        APP.updateNavigation();
      }
    } catch (err) {
      // Not logged in, user remains null
    }
  }
};

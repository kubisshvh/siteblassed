const APP = {
  state: {
    user: null,
    currentPage: 'home',
    forumState: {
      categories: [],
      currentCategory: null,
      currentTopic: null,
      topics: [],
      posts: [],
      topicPage: 1,
      postPage: 1,
      totalTopics: 0,
      totalPosts: 0,
    },
    chatMessages: [],
    supportTickets: [],
    currentTicket: null,
    lastChatId: 0,
  },

  api: {
    async request(method, url, body) {
      var opts = { method: method, headers: {} };
      if (body) {
        if (body instanceof FormData) {
          opts.body = body;
        } else {
          opts.headers['Content-Type'] = 'application/json';
          opts.body = JSON.stringify(body);
        }
      }
      var res = await fetch(url, opts);
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка сервера');
      return data;
    },
    get: function (url) { return this.request('GET', url); },
    post: function (url, body) { return this.request('POST', url, body); },
    patch: function (url, body) { return this.request('PATCH', url, body); },
    delete: function (url) { return this.request('DELETE', url); },
  },

  navigate: function (page, data) {
    var sections = document.querySelectorAll('.page-section');
    for (var i = 0; i < sections.length; i++) {
      sections[i].classList.remove('active');
    }
    var section = document.getElementById('page-' + page);
    if (section) section.classList.add('active');

    var navLinks = document.querySelectorAll('.nav-link');
    for (var j = 0; j < navLinks.length; j++) {
      navLinks[j].classList.remove('active');
    }
    var activeLink = document.querySelector('[data-page="' + page + '"]');
    if (activeLink) activeLink.classList.add('active');

    APP.state.currentPage = page;

    if (page === 'chat' && APP.chat) {
      APP.chat.stopPolling();
    }

    switch (page) {
      case 'home': APP.loadHomePage(); break;
      case 'forum': APP.loadForumPage(); break;
      case 'chat': APP.loadChatPage(); break;
      case 'support': APP.loadSupportPage(); break;
      case 'download': APP.loadDownloadPage(); break;
      case 'profile': APP.loadProfilePage(); break;
      case 'admin': APP.loadAdminPage(); break;
    }
  },

  notify: function (message, type) {
    if (APP.ui) APP.ui.showToast(message, type);
  },

  showModal: function (id) {
    var overlay = document.getElementById('modal-overlay');
    var modal = document.getElementById(id);
    if (overlay) overlay.style.display = 'block';
    if (modal) modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
  },

  hideModal: function (id) {
    var overlay = document.getElementById('modal-overlay');
    if (id) {
      var modal = document.getElementById(id);
      if (modal) modal.style.display = 'none';
    }
    var anyOpen = false;
    var modals = document.querySelectorAll('.modal');
    for (var i = 0; i < modals.length; i++) {
      if (modals[i].style.display === 'block') {
        anyOpen = true;
        break;
      }
    }
    if (!anyOpen && overlay) {
      overlay.style.display = 'none';
      document.body.style.overflow = '';
    }
  },

  loadHomePage: async function () {
    try {
      try {
        var statsData = await APP.api.get('/api/admin/stats');
        if (statsData && statsData.stats) {
          var s = statsData.stats;
          var statUsers = document.getElementById('stat-users');
          var statTopics = document.getElementById('stat-topics');
          var statMessages = document.getElementById('stat-messages');
          var statOnline = document.getElementById('stat-online');
          if (statUsers) statUsers.textContent = s.users || 0;
          if (statTopics) statTopics.textContent = s.topics || 0;
          if (statMessages) statMessages.textContent = s.chat_messages || 0;
          if (statOnline) statOnline.textContent = s.users || 0;
        }
      } catch (e) {
        var su = document.getElementById('stat-users');
        var st = document.getElementById('stat-topics');
        var sm = document.getElementById('stat-messages');
        var so = document.getElementById('stat-online');
        if (su) su.textContent = '—';
        if (st) st.textContent = '—';
        if (sm) sm.textContent = '—';
        if (so) so.textContent = '—';
      }

      var catData = await APP.api.get('/api/forum/categories');
      var categories = catData.categories || [];

      var latestTopicsContainer = document.getElementById('latest-topics');
      if (!latestTopicsContainer) return;

      var latestTopics = [];
      for (var i = 0; i < categories.length; i++) {
        if (categories[i].latest_topic) {
          latestTopics.push({
            id: categories[i].latest_topic.id,
            title: categories[i].latest_topic.title,
            created_at: categories[i].latest_topic.created_at,
            category_name: categories[i].name,
            category_slug: categories[i].slug,
          });
        }
      }
      latestTopics.sort(function (a, b) {
        return new Date(b.created_at) - new Date(a.created_at);
      });

      if (latestTopics.length === 0) {
        latestTopicsContainer.innerHTML = '<div class="empty-state">Нет тем для отображения</div>';
      } else {
        var html = '';
        for (var k = 0; k < latestTopics.length; k++) {
          var t = latestTopics[k];
          var date = APP.ui.timeAgo(t.created_at);
          html += '<div class="topic-item" style="cursor:pointer;">' +
            '<div class="topic-main">' +
            '<a class="topic-title home-topic-link" href="#" data-topic-id="' + t.id + '">' + APP.ui.escapeHtml(t.title) + '</a>' +
            '<span class="topic-meta">' + date + ' &middot; ' + APP.ui.escapeHtml(t.category_name) + '</span>' +
            '</div></div>';
        }
        latestTopicsContainer.innerHTML = html;

        var links = latestTopicsContainer.querySelectorAll('.home-topic-link');
        for (var m = 0; m < links.length; m++) {
          (function (topicId) {
            links[m].addEventListener('click', function (e) {
              e.preventDefault();
              APP.navigate('forum');
              setTimeout(function () {
                APP.forum.loadTopic(topicId);
              }, 50);
            });
          })(latestTopics[m].id);
        }
      }
    } catch (err) {
      APP.notify(err.message, 'error');
    }
  },

  loadForumPage: async function () {
    await APP.forum.loadCategories();
  },

  loadChatPage: async function () {
    await APP.chat.loadMessages();
    await APP.chat.loadOnlineUsers();
    APP.chat.startPolling();
  },

  loadSupportPage: async function () {
    await APP.support.loadTickets();
  },

  loadDownloadPage: async function () {
    try {
      var data = await APP.api.get('/api/download/loader/latest');
      var versionBadge = document.getElementById('loader-version');
      var changelogDiv = document.getElementById('loader-changelog');
      var downloadBtn = document.getElementById('btn-download-loader');

      if (versionBadge) {
        versionBadge.innerHTML = '<span class="badge badge-primary">v' + APP.ui.escapeHtml(data.version) + '</span>';
      }
      if (changelogDiv) {
        var changelogText = data.changelog || 'Нет описания изменений.';
        changelogDiv.innerHTML = '<h3>&#128214; Чейнджлог</h3><pre style="white-space:pre-wrap;font-family:inherit;">' + APP.ui.escapeHtml(changelogText) + '</pre>';
      }
      if (downloadBtn) {
        downloadBtn.href = data.downloadUrl || '#';
      }
    } catch (err) {
      var cd = document.getElementById('loader-changelog');
      if (cd) {
        cd.innerHTML = '<h3>&#128214; Чейнджлог</h3><div class="empty-state">Не удалось загрузить информацию о лоадере</div>';
      }
      var vb = document.getElementById('loader-version');
      if (vb) {
        vb.innerHTML = '<span class="badge badge-primary">—</span>';
      }
      APP.notify(err.message, 'error');
    }
  },

  loadProfilePage: async function () {
    if (!APP.state.user) {
      APP.notify('Необходимо авторизоваться', 'warning');
      return;
    }
    var u = APP.state.user;
    var profileUid = document.getElementById('profile-uid');
    var profileUsername = document.getElementById('profile-username');
    var profileEmail = document.getElementById('profile-email');
    var profileRole = document.getElementById('profile-role');
    var profileCreated = document.getElementById('profile-created');
    var profileAvatar = document.getElementById('profile-avatar-letter');

    if (profileUid) profileUid.textContent = u.uid || '—';
    if (profileUsername) profileUsername.textContent = u.username || '—';
    if (profileEmail) profileEmail.textContent = u.email || '—';
    if (profileRole) profileRole.textContent = u.role || '—';
    if (profileCreated) profileCreated.textContent = APP.ui.formatDate(u.created_at) || '—';
    if (profileAvatar) profileAvatar.textContent = (u.username || '?').charAt(0).toUpperCase();
  },

  loadAdminPage: async function () {
    if (!APP.state.user || APP.state.user.role !== 'admin') {
      APP.notify('Доступ запрещён', 'error');
      APP.navigate('home');
      return;
    }
    await APP.admin.loadDashboard();
  },

  updateNavigation: function () {
    var userStatus = document.getElementById('user-status');
    var userLoggedIn = document.getElementById('user-logged-in');
    var adminItems = document.querySelectorAll('.admin-only');

    if (APP.state.user) {
      if (userStatus) userStatus.style.display = 'none';
      if (userLoggedIn) userLoggedIn.style.display = 'flex';
      var usernameDisplay = document.getElementById('username-display');
      var userBadge = document.getElementById('user-badge-display');
      if (usernameDisplay) usernameDisplay.textContent = APP.state.user.username;
      if (userBadge) {
        userBadge.textContent = APP.state.user.role === 'admin' ? 'ADMIN' : APP.state.user.uid;
      }
      for (var i = 0; i < adminItems.length; i++) {
        adminItems[i].style.display = APP.state.user.role === 'admin' ? '' : 'none';
      }
    } else {
      if (userStatus) userStatus.style.display = '';
      if (userLoggedIn) userLoggedIn.style.display = 'none';
      for (var j = 0; j < adminItems.length; j++) {
        adminItems[j].style.display = 'none';
      }
    }
  },

  init: async function () {
    try {
      var data = await APP.api.get('/api/auth/me');
      if (data.user) {
        APP.state.user = data.user;
      }
    } catch (e) {
      // Not logged in
    }

    APP.updateNavigation();
    APP.navigate('home');

    // Navigation clicks
    var navLinks = document.querySelectorAll('[data-page]');
    for (var i = 0; i < navLinks.length; i++) {
      (function () {
        var el = navLinks[i];
        el.addEventListener('click', function (e) {
          e.preventDefault();
          var page = el.dataset.page;
          if (page) APP.navigate(page);
        });
      })();
    }

    // Modal toggles
    var btnLoginShow = document.getElementById('btn-login-show');
    var btnRegisterShow = document.getElementById('btn-register-show');
    var switchToRegister = document.getElementById('switch-to-register');
    var switchToLogin = document.getElementById('switch-to-login');
    var modalOverlay = document.getElementById('modal-overlay');

    if (btnLoginShow) btnLoginShow.addEventListener('click', function () { APP.showModal('modal-login'); });
    if (btnRegisterShow) btnRegisterShow.addEventListener('click', function () { APP.showModal('modal-register'); });
    if (switchToRegister) switchToRegister.addEventListener('click', function (e) {
      e.preventDefault();
      APP.hideModal('modal-login');
      APP.showModal('modal-register');
    });
    if (switchToLogin) switchToLogin.addEventListener('click', function (e) {
      e.preventDefault();
      APP.hideModal('modal-register');
      APP.showModal('modal-login');
    });

    // Close modals via overlay
    if (modalOverlay) modalOverlay.addEventListener('click', function () {
      var modals = document.querySelectorAll('.modal');
      for (var k = 0; k < modals.length; k++) {
        modals[k].style.display = 'none';
      }
      modalOverlay.style.display = 'none';
      document.body.style.overflow = '';
    });

    // Close buttons
    var closeButtons = document.querySelectorAll('.modal-close');
    for (var c = 0; c < closeButtons.length; c++) {
      (function () {
        var btn = closeButtons[c];
        btn.addEventListener('click', function () {
          var modalId = btn.dataset.close;
          if (modalId) APP.hideModal(modalId);
        });
      })();
    }

    // Login form
    var formLogin = document.getElementById('form-login');
    if (formLogin) formLogin.addEventListener('submit', async function (e) {
      e.preventDefault();
      var email = document.getElementById('login-email').value.trim();
      var password = document.getElementById('login-password').value;
      await APP.auth.login(email, password);
    });

    // Register form
    var formRegister = document.getElementById('form-register');
    if (formRegister) formRegister.addEventListener('submit', async function (e) {
      e.preventDefault();
      var username = document.getElementById('register-username').value.trim();
      var email = document.getElementById('register-email').value.trim();
      var password = document.getElementById('register-password').value;
      var inviteCode = document.getElementById('register-invite').value.trim();
      await APP.auth.register(username, email, password, inviteCode);
    });

    // Create topic form
    var formCreateTopic = document.getElementById('form-create-topic');
    if (formCreateTopic) formCreateTopic.addEventListener('submit', async function (e) {
      e.preventDefault();
      var categoryId = parseInt(document.getElementById('topic-category').value);
      var title = document.getElementById('topic-title').value.trim();
      var content = document.getElementById('topic-content').value.trim();
      await APP.forum.createTopic(categoryId, title, content);
    });

    // Create ticket form
    var formCreateTicket = document.getElementById('form-create-ticket');
    if (formCreateTicket) formCreateTicket.addEventListener('submit', async function (e) {
      e.preventDefault();
      var subject = document.getElementById('ticket-subject').value.trim();
      var message = document.getElementById('ticket-message').value.trim();
      await APP.support.createTicket(subject, message);
    });

    // Chat form
    var chatForm = document.getElementById('chat-form');
    if (chatForm) chatForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var input = document.getElementById('chat-input-field');
      var message = input.value.trim();
      if (!message) return;
      input.value = '';
      await APP.chat.sendMessage(message);
    });

    // Change password form
    var formChangePassword = document.getElementById('form-change-password');
    if (formChangePassword) formChangePassword.addEventListener('submit', async function (e) {
      e.preventDefault();
      var oldPassword = document.getElementById('change-old-password').value;
      var newPassword = document.getElementById('change-new-password').value;
      var confirmPassword = document.getElementById('change-confirm-password').value;
      if (newPassword !== confirmPassword) {
        APP.notify('Пароли не совпадают', 'error');
        return;
      }
      await APP.auth.changePassword(oldPassword, newPassword);
    });

    // Logout button
    var btnLogout = document.getElementById('btn-logout');
    if (btnLogout) btnLogout.addEventListener('click', function () { APP.auth.logout(); });

    // Create topic button
    var btnCreateTopic = document.getElementById('btn-create-topic');
    if (btnCreateTopic) btnCreateTopic.addEventListener('click', function () {
      if (!APP.state.user) {
        APP.notify('Необходимо авторизоваться', 'warning');
        APP.showModal('modal-login');
        return;
      }
      var select = document.getElementById('topic-category');
      select.innerHTML = '<option value="">Выберите категорию...</option>';
      var cats = APP.state.forumState.categories;
      for (var i = 0; i < cats.length; i++) {
        var opt = document.createElement('option');
        opt.value = cats[i].id;
        opt.textContent = cats[i].name;
        select.appendChild(opt);
      }
      APP.showModal('modal-create-topic');
    });

    // Create ticket button
    var btnCreateTicket = document.getElementById('btn-create-ticket');
    if (btnCreateTicket) btnCreateTicket.addEventListener('click', function () {
      if (!APP.state.user) {
        APP.notify('Необходимо авторизоваться', 'warning');
        APP.showModal('modal-login');
        return;
      }
      APP.showModal('modal-create-ticket');
    });

    // Admin tab switching
    var adminTabs = document.querySelectorAll('.admin-tab');
    for (var t = 0; t < adminTabs.length; t++) {
      (function () {
        var tab = adminTabs[t];
        tab.addEventListener('click', function () {
          var allTabs = document.querySelectorAll('.admin-tab');
          for (var a = 0; a < allTabs.length; a++) allTabs[a].classList.remove('active');
          tab.classList.add('active');

          var allPanels = document.querySelectorAll('.admin-panel');
          for (var p = 0; p < allPanels.length; p++) allPanels[p].classList.remove('active');
          var panelId = 'admin-panel-' + tab.dataset.adminTab;
          var panel = document.getElementById(panelId);
          if (panel) panel.classList.add('active');

          switch (tab.dataset.adminTab) {
            case 'dashboard': APP.admin.loadDashboard(); break;
            case 'invites': APP.admin.loadInviteCodes(); break;
            case 'users': APP.admin.loadUsers(); break;
            case 'admin-tickets': APP.admin.loadAllTickets(); break;
          }
        });
      })();
    }

    // Generate invite codes button
    var btnGenerateInvites = document.getElementById('btn-generate-invites');
    if (btnGenerateInvites) btnGenerateInvites.addEventListener('click', async function () {
      var countInput = document.getElementById('invite-count');
      var count = parseInt(countInput.value) || 5;
      await APP.admin.generateInviteCodes(count);
    });

    // Set admin UID button
    var btnSetAdmin = document.getElementById('btn-set-admin');
    if (btnSetAdmin) btnSetAdmin.addEventListener('click', async function () {
      var uidInput = document.getElementById('set-admin-uid');
      var uid = uidInput.value.trim();
      if (!uid) {
        APP.notify('Введите UID', 'warning');
        return;
      }
      await APP.admin.setAdminUid(uid);
    });

    // Upload loader form
    var formUploadLoader = document.getElementById('form-upload-loader');
    if (formUploadLoader) formUploadLoader.addEventListener('submit', async function (e) {
      e.preventDefault();
      var version = document.getElementById('loader-version-input').value.trim();
      var changelog = document.getElementById('loader-changelog-input').value.trim();
      var fileInput = document.getElementById('loader-file');
      var file = fileInput.files[0];
      if (!file) {
        APP.notify('Выберите файл', 'warning');
        return;
      }
      await APP.admin.uploadLoader(version, changelog, file);
      formUploadLoader.reset();
    });

    // Mobile menu toggle
    var mobileToggle = document.getElementById('mobile-menu-toggle');
    if (mobileToggle) mobileToggle.addEventListener('click', function () {
      var nav = document.getElementById('main-nav');
      if (nav) nav.classList.toggle('open');
    });

    // Page visibility change
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (APP.chat) APP.chat.stopPolling();
      } else if (APP.state.currentPage === 'chat') {
        if (APP.chat) {
          APP.chat.startPolling();
          APP.chat.loadMessages();
          APP.chat.loadOnlineUsers();
        }
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', function () {
  APP.init();
});

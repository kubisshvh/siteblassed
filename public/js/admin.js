APP.admin = {
  loadDashboard: async function () {
    try {
      var data = await APP.api.get('/api/admin/stats');
      var s = data.stats;

      var adminStatUsers = document.getElementById('admin-stat-users');
      var adminStatTopics = document.getElementById('admin-stat-topics');
      var adminStatMsgs = document.getElementById('admin-stat-msgs');
      var adminStatInvites = document.getElementById('admin-stat-invites');

      if (adminStatUsers) adminStatUsers.textContent = s.users || 0;
      if (adminStatTopics) adminStatTopics.textContent = s.topics || 0;
      if (adminStatMsgs) adminStatMsgs.textContent = s.chat_messages || 0;
      if (adminStatInvites) adminStatInvites.textContent = s.invite_codes || 0;
    } catch (err) {
      APP.notify(err.message, 'error');
    }
  },

  loadInviteCodes: async function () {
    try {
      var data = await APP.api.get('/api/admin/invite-codes');
      APP.admin.renderInviteCodes(data.codes || []);
    } catch (err) {
      APP.notify(err.message, 'error');
      var tbody = document.querySelector('#invites-table tbody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">Ошибка загрузки</td></tr>';
    }
  },

  generateInviteCodes: async function (count) {
    try {
      var data = await APP.api.post('/api/admin/invite-codes', { count: count });
      APP.notify('Сгенерировано кодов: ' + (data.codes ? data.codes.length : 0), 'success');
      await APP.admin.loadInviteCodes();
    } catch (err) {
      APP.notify(err.message, 'error');
    }
  },

  addSpecificInviteCodes: async function (codes) {
    try {
      var data = await APP.api.post('/api/admin/invite-codes', { codes: codes });
      APP.notify('Добавлено кодов: ' + (data.codes ? data.codes.length : 0), 'success');
      await APP.admin.loadInviteCodes();
    } catch (err) {
      APP.notify(err.message, 'error');
    }
  },

  loadUsers: async function () {
    try {
      var data = await APP.api.get('/api/admin/users');
      APP.admin.renderUsers(data.users || []);
    } catch (err) {
      APP.notify(err.message, 'error');
      var tbody = document.querySelector('#users-table tbody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">Ошибка загрузки</td></tr>';
    }
  },

  changeUserRole: async function (uid, role) {
    try {
      await APP.api.patch('/api/admin/users/' + uid + '/role', { role: role });
      APP.notify('Роль пользователя ' + uid + ' изменена на ' + role, 'success');
      await APP.admin.loadUsers();
    } catch (err) {
      APP.notify(err.message, 'error');
    }
  },

  banUser: async function (uid) {
    try {
      await APP.api.patch('/api/admin/users/' + uid + '/ban', { banned: 1 });
      APP.notify('Пользователь ' + uid + ' забанен', 'success');
      await APP.admin.loadUsers();
    } catch (err) {
      APP.notify(err.message, 'error');
    }
  },

  unbanUser: async function (uid) {
    try {
      await APP.api.patch('/api/admin/users/' + uid + '/ban', { banned: 0 });
      APP.notify('Пользователь ' + uid + ' разбанен', 'success');
      await APP.admin.loadUsers();
    } catch (err) {
      APP.notify(err.message, 'error');
    }
  },

  setAdminUid: async function (uid) {
    try {
      await APP.api.post('/api/admin/set-uid', { uid: uid });
      APP.notify('UID администратора установлен: ' + uid, 'success');
    } catch (err) {
      APP.notify(err.message, 'error');
    }
  },

  uploadLoader: async function (version, changelog, file) {
    try {
      var formData = new FormData();
      formData.append('version', version);
      formData.append('changelog', changelog);
      formData.append('file', file);

      var res = await fetch('/api/admin/loader', {
        method: 'POST',
        body: formData,
      });
      var data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Ошибка загрузки');
      APP.notify('Лоадер v' + version + ' загружен!', 'success');
    } catch (err) {
      APP.notify(err.message, 'error');
    }
  },

  loadLoaderVersions: async function () {
    // The current API doesn't have a GET /api/admin/loader endpoint
    // Load latest info from download endpoint as fallback
    try {
      var data = await APP.api.get('/api/download/loader/latest');
      APP.notify('Текущая версия: ' + data.version, 'info');
    } catch (err) {
      APP.notify('Не удалось загрузить версии лоадера', 'error');
    }
  },

  loadAllTickets: async function () {
    try {
      var data = await APP.api.get('/api/support/tickets');
      APP.admin.renderAdminTickets(data.tickets || []);
    } catch (err) {
      APP.notify(err.message, 'error');
      var tbody = document.querySelector('#admin-tickets-table tbody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">Ошибка загрузки</td></tr>';
    }
  },

  renderStats: function (stats) {
    var table = document.getElementById('admin-stats-table');
    if (!table) return;

    var html = '';
    for (var key in stats) {
      if (stats.hasOwnProperty(key)) {
        html += '<tr><td>' + APP.ui.escapeHtml(key) + '</td><td>' + stats[key] + '</td></tr>';
      }
    }
    table.querySelector('tbody').innerHTML = html;
  },

  renderInviteCodes: function (codes) {
    var tbody = document.querySelector('#invites-table tbody');
    if (!tbody) return;

    if (codes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">Нет инвайт-кодов</td></tr>';
      return;
    }

    var html = '';
    for (var i = 0; i < codes.length; i++) {
      var c = codes[i];
      var statusHtml = '';
      if (c.is_used) {
        statusHtml = '<span class="badge badge-danger">Использован</span> ' +
          (c.used_by_username ? '<span class="text-muted">(' + APP.ui.escapeHtml(c.used_by_username) + ')</span>' : '');
      } else {
        statusHtml = '<span class="badge badge-success">Свободен</span>';
      }

      html += '<tr>' +
        '<td><code>' + APP.ui.escapeHtml(c.code) + '</code></td>' +
        '<td>' + APP.ui.formatDate(c.created_at) + '</td>' +
        '<td>' + statusHtml + '</td>' +
        '<td>' +
        (c.is_used ? APP.ui.formatDate(c.used_at) : '') +
        '</td>' +
        '</tr>';
    }

    tbody.innerHTML = html;
  },

  renderUsers: function (users) {
    var tbody = document.querySelector('#users-table tbody');
    if (!tbody) return;

    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">Нет пользователей</td></tr>';
      return;
    }

    var html = '';
    for (var i = 0; i < users.length; i++) {
      var u = users[i];
      var roleBadge = '';
      if (u.role === 'admin') {
        roleBadge = ' <span class="badge badge-admin">Admin</span>';
      } else if (u.role === 'moderator') {
        roleBadge = ' <span class="badge badge-mod">Mod</span>';
      }
      var bannedLabel = u.banned ? ' <span class="badge badge-danger">Banned</span>' : '';

      html += '<tr>' +
        '<td>' + APP.ui.escapeHtml(u.uid) + bannedLabel + '</td>' +
        '<td>' + APP.ui.escapeHtml(u.username) + roleBadge + '</td>' +
        '<td>' + APP.ui.escapeHtml(u.email) + '</td>' +
        '<td>' + APP.ui.escapeHtml(u.role) + '</td>' +
        '<td class="action-cell">' +
        '<select class="role-select" data-uid="' + APP.ui.escapeHtml(u.uid) + '">' +
        '<option value="user" ' + (u.role === 'user' ? 'selected' : '') + '>User</option>' +
        '<option value="moderator" ' + (u.role === 'moderator' ? 'selected' : '') + '>Moderator</option>' +
        '<option value="admin" ' + (u.role === 'admin' ? 'selected' : '') + '>Admin</option>' +
        '</select>' +
        (u.banned
          ? '<button class="btn btn-success btn-xs unban-btn" data-uid="' + APP.ui.escapeHtml(u.uid) + '">Разбанить</button>'
          : '<button class="btn btn-danger btn-xs ban-btn" data-uid="' + APP.ui.escapeHtml(u.uid) + '">Забанить</button>'
        ) +
        '</td>' +
        '</tr>';
    }

    tbody.innerHTML = html;

    // Role select handlers
    var roleSelects = tbody.querySelectorAll('.role-select');
    for (var s = 0; s < roleSelects.length; s++) {
      (function () {
        var sel = roleSelects[s];
        sel.addEventListener('change', function () {
          var uid = sel.dataset.uid;
          var role = sel.value;
          APP.admin.changeUserRole(uid, role);
        });
      })();
    }

    // Ban button handlers
    var banBtns = tbody.querySelectorAll('.ban-btn');
    for (var b = 0; b < banBtns.length; b++) {
      (function () {
        var btn = banBtns[b];
        btn.addEventListener('click', function () {
          if (confirm('Забанить пользователя ' + btn.dataset.uid + '?')) {
            APP.admin.banUser(btn.dataset.uid);
          }
        });
      })();
    }

    // Unban button handlers
    var unbanBtns = tbody.querySelectorAll('.unban-btn');
    for (var u = 0; u < unbanBtns.length; u++) {
      (function () {
        var btn = unbanBtns[u];
        btn.addEventListener('click', function () {
          if (confirm('Разбанить пользователя ' + btn.dataset.uid + '?')) {
            APP.admin.unbanUser(btn.dataset.uid);
          }
        });
      })();
    }
  },

  renderAdminTickets: function (tickets) {
    var tbody = document.querySelector('#admin-tickets-table tbody');
    if (!tbody) return;

    if (tickets.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">Нет тикетов</td></tr>';
      return;
    }

    var html = '';
    for (var i = 0; i < tickets.length; i++) {
      var t = tickets[i];
      var statusClass = '';
      var statusLabel = '';
      if (t.status === 'open') {
        statusClass = 'badge-success';
        statusLabel = 'Открыт';
      } else if (t.status === 'closed') {
        statusClass = 'badge-danger';
        statusLabel = 'Закрыт';
      } else {
        statusClass = 'badge-secondary';
        statusLabel = APP.ui.escapeHtml(t.status);
      }

      html += '<tr>' +
        '<td>' + t.id + '</td>' +
        '<td>' + APP.ui.escapeHtml(t.username) + '</td>' +
        '<td>' + APP.ui.escapeHtml(t.subject) + '</td>' +
        '<td><span class="badge ' + statusClass + '">' + statusLabel + '</span></td>' +
        '<td class="action-cell">' +
        '<button class="btn btn-primary btn-xs view-ticket-btn" data-ticket-id="' + t.id + '">Просмотр</button>' +
        (t.status === 'open'
          ? '<button class="btn btn-warning btn-xs close-admin-ticket-btn" data-ticket-id="' + t.id + '">Закрыть</button>'
          : '<button class="btn btn-success btn-xs open-admin-ticket-btn" data-ticket-id="' + t.id + '">Открыть</button>'
        ) +
        '</td>' +
        '</tr>';
    }

    tbody.innerHTML = html;

    // View ticket handlers
    var viewBtns = tbody.querySelectorAll('.view-ticket-btn');
    for (var v = 0; v < viewBtns.length; v++) {
      (function () {
        var btn = viewBtns[v];
        btn.addEventListener('click', function () {
          APP.navigate('support');
          setTimeout(function () {
            APP.support.loadTicket(parseInt(btn.dataset.ticketId));
          }, 50);
        });
      })();
    }

    // Close ticket handlers
    var closeBtns = tbody.querySelectorAll('.close-admin-ticket-btn');
    for (var c = 0; c < closeBtns.length; c++) {
      (function () {
        var btn = closeBtns[c];
        btn.addEventListener('click', async function () {
          try {
            await APP.api.patch('/api/support/tickets/' + btn.dataset.ticketId + '/status', { status: 'closed' });
            APP.notify('Тикет закрыт', 'success');
            APP.admin.loadAllTickets();
          } catch (err) {
            APP.notify(err.message, 'error');
          }
        });
      })();
    }

    // Open ticket handlers
    var openBtns = tbody.querySelectorAll('.open-admin-ticket-btn');
    for (var o = 0; o < openBtns.length; o++) {
      (function () {
        var btn = openBtns[o];
        btn.addEventListener('click', async function () {
          try {
            await APP.api.patch('/api/support/tickets/' + btn.dataset.ticketId + '/status', { status: 'open' });
            APP.notify('Тикет открыт', 'success');
            APP.admin.loadAllTickets();
          } catch (err) {
            APP.notify(err.message, 'error');
          }
        });
      })();
    }
  }
};

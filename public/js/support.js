APP.support = {
  loadTickets: async function () {
    try {
      if (!APP.state.user) {
        var list = document.getElementById('tickets-list');
        if (list) list.innerHTML = '<div class="empty-state">Необходимо авторизоваться для просмотра тикетов</div>';
        return;
      }

      var data = await APP.api.get('/api/support/tickets');
      APP.state.supportTickets = data.tickets || [];

      // Hide ticket detail view
      var ticketView = document.getElementById('ticket-view');
      if (ticketView) ticketView.style.display = 'none';

      // Show tickets list
      var ticketsList = document.getElementById('tickets-list');
      if (ticketsList) {
        ticketsList.style.display = '';
        APP.support.renderTickets(data.tickets || []);
      }
    } catch (err) {
      APP.notify(err.message, 'error');
      var list = document.getElementById('tickets-list');
      if (list) list.innerHTML = '<div class="empty-state">Ошибка загрузки тикетов</div>';
    }
  },

  loadTicket: async function (id) {
    try {
      if (!APP.state.user) {
        APP.notify('Необходимо авторизоваться', 'warning');
        return;
      }

      var data = await APP.api.get('/api/support/tickets/' + id);
      APP.state.currentTicket = data.ticket;

      var ticketsList = document.getElementById('tickets-list');
      if (ticketsList) ticketsList.style.display = 'none';

      var ticketView = document.getElementById('ticket-view');
      if (ticketView) {
        ticketView.style.display = '';
        APP.support.renderTicketDetail(data.ticket, data.replies || []);
      }
    } catch (err) {
      APP.notify(err.message, 'error');
    }
  },

  createTicket: async function (subject, message) {
    try {
      if (!APP.state.user) {
        APP.notify('Необходимо авторизоваться', 'warning');
        APP.showModal('modal-login');
        return;
      }

      await APP.api.post('/api/support/tickets', {
        subject: subject,
        message: message,
      });

      APP.notify('Тикет создан!', 'success');
      APP.hideModal('modal-create-ticket');

      // Clear form
      var ticketSubject = document.getElementById('ticket-subject');
      var ticketMessage = document.getElementById('ticket-message');
      if (ticketSubject) ticketSubject.value = '';
      if (ticketMessage) ticketMessage.value = '';

      // Reload tickets
      await APP.support.loadTickets();
    } catch (err) {
      APP.notify(err.message, 'error');
    }
  },

  replyTicket: async function (ticketId, message) {
    try {
      if (!APP.state.user) {
        APP.notify('Необходимо авторизоваться', 'warning');
        return;
      }

      await APP.api.post('/api/support/tickets/' + ticketId + '/reply', {
        message: message,
      });

      APP.notify('Ответ отправлен', 'success');

      // Reload ticket
      await APP.support.loadTicket(ticketId);
    } catch (err) {
      APP.notify(err.message, 'error');
    }
  },

  closeTicket: async function (ticketId) {
    try {
      if (!APP.state.user || APP.state.user.role !== 'admin') {
        APP.notify('Только администратор может закрыть тикет', 'warning');
        return;
      }

      await APP.api.patch('/api/support/tickets/' + ticketId + '/status', { status: 'closed' });
      APP.notify('Тикет закрыт', 'success');
      await APP.support.loadTicket(ticketId);
    } catch (err) {
      APP.notify(err.message, 'error');
    }
  },

  openTicket: async function (ticketId) {
    try {
      if (!APP.state.user || APP.state.user.role !== 'admin') {
        APP.notify('Только администратор может открыть тикет', 'warning');
        return;
      }

      await APP.api.patch('/api/support/tickets/' + ticketId + '/status', { status: 'open' });
      APP.notify('Тикет открыт', 'success');
      await APP.support.loadTicket(ticketId);
    } catch (err) {
      APP.notify(err.message, 'error');
    }
  },

  renderTickets: function (tickets) {
    var ticketsList = document.getElementById('tickets-list');
    if (!ticketsList) return;

    if (tickets.length === 0) {
      ticketsList.innerHTML = '<div class="empty-state">Нет тикетов</div>';
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

      html += '<div class="ticket-item" data-ticket-id="' + t.id + '" style="cursor:pointer;">' +
        '<div class="ticket-main">' +
        '<span class="ticket-subject">' + APP.ui.escapeHtml(t.subject) + '</span>' +
        '<span class="ticket-meta">' +
        APP.ui.escapeHtml(t.username) + ' &middot; ' + APP.ui.timeAgo(t.created_at) +
        ' &middot; ' + (t.reply_count || 0) + ' ответов' +
        '</span>' +
        '</div>' +
        '<span class="badge ' + statusClass + '">' + statusLabel + '</span>' +
        '</div>';
    }

    ticketsList.innerHTML = html;

    // Add click handlers
    var items = ticketsList.querySelectorAll('.ticket-item');
    for (var k = 0; k < items.length; k++) {
      (function () {
        var item = items[k];
        item.addEventListener('click', function () {
          var ticketId = parseInt(item.dataset.ticketId);
          if (ticketId) APP.support.loadTicket(ticketId);
        });
      })();
    }
  },

  renderTicketDetail: function (ticket, replies) {
    var ticketView = document.getElementById('ticket-view');
    if (!ticketView) return;

    var isAdmin = APP.state.user && APP.state.user.role === 'admin';

    var statusClass = '';
    var statusLabel = '';
    if (ticket.status === 'open') {
      statusClass = 'badge-success';
      statusLabel = 'Открыт';
    } else if (ticket.status === 'closed') {
      statusClass = 'badge-danger';
      statusLabel = 'Закрыт';
    } else {
      statusClass = 'badge-secondary';
      statusLabel = APP.ui.escapeHtml(ticket.status);
    }

    var html = '';

    // Back button
    html += '<div class="ticket-back">' +
      '<button class="btn btn-secondary btn-sm" id="btn-back-tickets">&larr; Назад к списку</button>' +
      '</div>';

    // Ticket header
    html += '<div class="ticket-header">' +
      '<h3 class="ticket-detail-subject">' + APP.ui.escapeHtml(ticket.subject) + '</h3>' +
      '<div class="ticket-detail-meta">' +
      '<span><strong>' + APP.ui.escapeHtml(ticket.username) + '</strong></span>' +
      '<span>' + APP.ui.formatDate(ticket.created_at) + '</span>' +
      '<span class="badge ' + statusClass + '">' + statusLabel + '</span>' +
      '</div>';

    // Admin actions
    if (isAdmin) {
      html += '<div class="ticket-admin-actions">';
      if (ticket.status === 'open') {
        html += '<button class="btn btn-warning btn-sm close-ticket-btn" data-ticket-id="' + ticket.id + '">Закрыть тикет</button>';
      } else {
        html += '<button class="btn btn-success btn-sm open-ticket-btn" data-ticket-id="' + ticket.id + '">Открыть тикет</button>';
      }
      html += '</div>';
    }

    html += '</div>';

    // Replies
    html += '<div class="ticket-replies">';
    for (var i = 0; i < replies.length; i++) {
      var r = replies[i];
      var isAdminReply = r.is_admin === 1;
      var replyClass = isAdminReply ? ' ticket-reply-admin' : '';

      html += '<div class="ticket-reply' + replyClass + '">' +
        '<div class="ticket-reply-header">' +
        '<span class="ticket-reply-author">' +
        APP.ui.escapeHtml(r.username || '?') +
        (isAdminReply ? ' <span class="badge badge-admin badge-sm">Admin</span>' : '') +
        '</span>' +
        '<span class="ticket-reply-date">' + APP.ui.formatDate(r.created_at) + '</span>' +
        '</div>' +
        '<div class="ticket-reply-content">' + APP.ui.escapeHtml(r.message) + '</div>' +
        '</div>';
    }

    if (replies.length === 0) {
      html += '<div class="empty-state">Нет ответов</div>';
    }
    html += '</div>';

    // Reply form (if ticket is open)
    if (ticket.status === 'open') {
      html += '<div class="ticket-reply-form">' +
        '<h4>Ответить</h4>' +
        '<div class="form-group">' +
        '<textarea id="ticket-reply-input" rows="4" placeholder="Ваш ответ..." maxlength="5000"></textarea>' +
        '</div>' +
        '<button class="btn btn-primary" id="btn-submit-ticket-reply">Отправить</button>' +
        '</div>';
    } else {
      html += '<div class="empty-state">Тикет закрыт</div>';
    }

    ticketView.innerHTML = html;

    // Back button handler
    var btnBack = document.getElementById('btn-back-tickets');
    if (btnBack) btnBack.addEventListener('click', function () {
      APP.support.loadTickets();
    });

    // Reply button handler
    var btnSubmitReply = document.getElementById('btn-submit-ticket-reply');
    if (btnSubmitReply) btnSubmitReply.addEventListener('click', function () {
      var replyInput = document.getElementById('ticket-reply-input');
      var message = replyInput.value.trim();
      if (!message) {
        APP.notify('Введите текст ответа', 'warning');
        return;
      }
      APP.support.replyTicket(ticket.id, message);
    });

    // Close ticket button handler
    var closeBtn = ticketView.querySelector('.close-ticket-btn');
    if (closeBtn) closeBtn.addEventListener('click', function () {
      APP.support.closeTicket(parseInt(closeBtn.dataset.ticketId));
    });

    // Open ticket button handler
    var openBtn = ticketView.querySelector('.open-ticket-btn');
    if (openBtn) openBtn.addEventListener('click', function () {
      APP.support.openTicket(parseInt(openBtn.dataset.ticketId));
    });
  }
};

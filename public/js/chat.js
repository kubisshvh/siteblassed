APP.chat = {
  pollInterval: null,
  scrollAtBottom: true,

  loadMessages: async function () {
    try {
      var data = await APP.api.get('/api/chat/messages?limit=50');
      var messages = data.messages || [];
      APP.state.chatMessages = messages;

      // Update lastChatId
      if (messages.length > 0) {
        var lastMsg = messages[messages.length - 1];
        if (lastMsg.id > APP.state.lastChatId) {
          APP.state.lastChatId = lastMsg.id;
        }
      }

      APP.chat.renderMessages(messages);
    } catch (err) {
      APP.notify(err.message, 'error');
      var chatMsgs = document.getElementById('chat-messages');
      if (chatMsgs) {
        chatMsgs.innerHTML = '<div class="empty-state">Ошибка загрузки сообщений</div>';
      }
    }
  },

  sendMessage: async function (message) {
    try {
      if (!APP.state.user) {
        APP.notify('Необходимо авторизоваться', 'warning');
        return;
      }

      var data = await APP.api.post('/api/chat/messages', { message: message });

      // Optimistic: add message immediately
      if (data.message) {
        APP.state.chatMessages.push(data.message);
        if (data.message.id > APP.state.lastChatId) {
          APP.state.lastChatId = data.message.id;
        }
        APP.chat.renderMessages(APP.state.chatMessages);
      }

      // Refresh online users
      APP.chat.loadOnlineUsers();
    } catch (err) {
      APP.notify(err.message, 'error');
    }
  },

  loadOnlineUsers: async function () {
    try {
      var data = await APP.api.get('/api/chat/online');
      var users = data.online || [];
      APP.chat.renderOnlineUsers(users);
    } catch (err) {
      // Silently fail for online users
      var onlineList = document.getElementById('online-users-list');
      if (onlineList) {
        onlineList.innerHTML = '<li class="empty-state">Нет данных</li>';
      }
    }
  },

  startPolling: function () {
    APP.chat.stopPolling();

    APP.chat.pollInterval = setInterval(async function () {
      try {
        var url = '/api/chat/messages?limit=50';
        var data = await APP.api.get(url);
        var messages = data.messages || [];
        var newMessages = [];
        for (var i = 0; i < messages.length; i++) {
          if (messages[i].id > APP.state.lastChatId) {
            newMessages.push(messages[i]);
            APP.state.lastChatId = messages[i].id;
          }
        }

        if (newMessages.length > 0) {
          for (var j = 0; j < newMessages.length; j++) {
            APP.state.chatMessages.push(newMessages[j]);
          }
          APP.chat.renderMessages(APP.state.chatMessages);
        }

        APP.chat.loadOnlineUsers();
      } catch (err) {
        // Silently fail for polling
      }
    }, 3000);
  },

  stopPolling: function () {
    if (APP.chat.pollInterval) {
      clearInterval(APP.chat.pollInterval);
      APP.chat.pollInterval = null;
    }
  },

  renderMessages: function (messages) {
    var chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;

    // Check if user was scrolled near bottom
    var wasAtBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 100;

    var currentUserUid = APP.state.user ? APP.state.user.uid : '';

    if (messages.length === 0) {
      chatMessages.innerHTML = '<div class="empty-state">Сообщений пока нет. Будь первым!</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < messages.length; i++) {
      var msg = messages[i];
      var isOwn = currentUserUid && msg.user_uid === currentUserUid;
      var cls = isOwn ? 'chat-message chat-message-own' : 'chat-message';
      var roleBadge = '';

      if (msg.role === 'admin') {
        roleBadge = ' <span class="badge badge-admin badge-sm">Admin</span>';
      }

      html += '<div class="' + cls + '">' +
        '<div class="chat-message-header">' +
        '<span class="chat-username">' + APP.ui.escapeHtml(msg.username || '?') + roleBadge + '</span>' +
        '<span class="chat-time">' + APP.ui.timeAgo(msg.created_at) + '</span>' +
        '</div>' +
        '<div class="chat-message-body">' + APP.ui.escapeHtml(msg.message) + '</div>' +
        '</div>';
    }

    chatMessages.innerHTML = html;

    // Auto-scroll to bottom if user was already at bottom
    if (wasAtBottom || APP.chat.scrollAtBottom) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Track scroll position
    APP.chat.scrollAtBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 100;

    // Add scroll listener to track position
    if (!chatMessages._scrollBound) {
      chatMessages._scrollBound = true;
      chatMessages.addEventListener('scroll', function () {
        APP.chat.scrollAtBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 100;
      });
    }
  },

  renderOnlineUsers: function (users) {
    var onlineList = document.getElementById('online-users-list');
    var onlineCount = document.getElementById('chat-online-count');
    if (!onlineList) return;

    if (onlineCount) {
      onlineCount.textContent = users.length + ' онлайн';
    }

    if (users.length === 0) {
      onlineList.innerHTML = '<li class="empty-state">Пусто</li>';
      return;
    }

    var html = '';
    for (var i = 0; i < users.length; i++) {
      var u = users[i];
      var roleBadge = '';
      if (u.role === 'admin') {
        roleBadge = ' <span class="badge badge-admin badge-sm">Admin</span>';
      }
      html += '<li class="online-user-item">' +
        '<span class="online-dot"></span>' +
        '<span class="online-username">' + APP.ui.escapeHtml(u.username || '?') + roleBadge + '</span>' +
        '</li>';
    }

    onlineList.innerHTML = html;
  }
};

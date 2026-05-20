APP.forum = {
  loadCategories: async function () {
    try {
      var data = await APP.api.get('/api/forum/categories');
      APP.state.forumState.categories = data.categories || [];
      APP.forum.renderCategories(APP.state.forumState.categories);
    } catch (err) {
      APP.notify(err.message, 'error');
    }
  },

  loadCategory: async function (slug, page) {
    try {
      page = page || 1;
      var url = '/api/forum/categories/' + encodeURIComponent(slug) + '?page=' + page + '&limit=20';
      var data = await APP.api.get(url);

      APP.state.forumState.currentCategory = data.category;
      APP.state.forumState.topics = data.topics || [];
      APP.state.forumState.topicPage = data.pagination ? data.pagination.page : page;
      APP.state.forumState.totalTopics = data.pagination ? data.pagination.total : 0;

      var cat = data.category;
      var pagination = data.pagination;

      APP.forum.renderBreadcrumbs([
        { label: 'Категории', action: 'categories' },
        { label: cat.name, action: null, active: true },
      ]);

      var categoriesDiv = document.getElementById('forum-categories');
      var topicsDiv = document.getElementById('forum-topics');
      var topicView = document.getElementById('forum-topic-view');
      var paginationDiv = document.getElementById('forum-pagination');

      if (categoriesDiv) categoriesDiv.style.display = 'none';
      if (topicsDiv) topicsDiv.style.display = '';
      if (topicView) topicView.style.display = 'none';

      APP.forum.renderTopics(data.topics, pagination.totalPages || 1, pagination.page || 1, slug);
    } catch (err) {
      APP.notify(err.message, 'error');
    }
  },

  loadTopic: async function (id, page) {
    try {
      page = page || 1;
      var url = '/api/forum/topics/' + id + '?page=' + page + '&limit=20';
      var data = await APP.api.get(url);

      APP.state.forumState.currentTopic = data.topic;
      APP.state.forumState.posts = data.posts || [];
      APP.state.forumState.postPage = data.pagination ? data.pagination.page : page;
      APP.state.forumState.totalPosts = data.pagination ? data.pagination.total : 0;

      var topic = data.topic;
      var pagination = data.pagination;

      var categoryName = '';
      var categorySlug = '';
      var cats = APP.state.forumState.categories;
      for (var i = 0; i < cats.length; i++) {
        if (cats[i].id === topic.category_id) {
          categoryName = cats[i].name;
          categorySlug = cats[i].slug;
          break;
        }
      }

      APP.forum.renderBreadcrumbs([
        { label: 'Категории', action: 'categories' },
        { label: categoryName || 'Категория', action: categorySlug ? function () { APP.forum.loadCategory(categorySlug); } : null },
        { label: APP.ui.truncate(topic.title, 30), action: null, active: true },
      ]);

      var categoriesDiv = document.getElementById('forum-categories');
      var topicsDiv = document.getElementById('forum-topics');
      var topicView = document.getElementById('forum-topic-view');
      var paginationDiv = document.getElementById('forum-pagination');

      if (categoriesDiv) categoriesDiv.style.display = 'none';
      if (topicsDiv) topicsDiv.style.display = 'none';
      if (topicView) topicView.style.display = '';

      APP.forum.renderPosts(data.posts, pagination.totalPages || 1, pagination.page || 1, topic);
    } catch (err) {
      APP.notify(err.message, 'error');
    }
  },

  createTopic: async function (categoryId, title, content) {
    try {
      if (!APP.state.user) {
        APP.notify('Необходимо авторизоваться', 'warning');
        APP.showModal('modal-login');
        return;
      }

      await APP.api.post('/api/forum/topics', {
        category_id: categoryId,
        title: title,
        content: content,
      });

      APP.notify('Тема создана!', 'success');
      APP.hideModal('modal-create-topic');

      // Clear form
      var topicTitle = document.getElementById('topic-title');
      var topicContent = document.getElementById('topic-content');
      if (topicTitle) topicTitle.value = '';
      if (topicContent) topicContent.value = '';

      // Reload current category or categories
      if (APP.state.forumState.currentCategory) {
        await APP.forum.loadCategory(APP.state.forumState.currentCategory.slug);
      } else {
        await APP.forum.loadCategories();
      }
    } catch (err) {
      APP.notify(err.message, 'error');
    }
  },

  createPost: async function (topicId, content) {
    try {
      if (!APP.state.user) {
        APP.notify('Необходимо авторизоваться', 'warning');
        APP.showModal('modal-login');
        return;
      }

      var url = '/api/forum/topics/' + topicId + '/posts';
      await APP.api.post(url, { content: content });

      APP.notify('Ответ добавлен!', 'success');

      // Clear post reply form
      var replyInput = document.getElementById('forum-reply-input');
      if (replyInput) replyInput.value = '';

      // Reload topic - go to last page
      var totalPages = APP.state.forumState.totalPosts > 0
        ? Math.ceil((APP.state.forumState.totalPosts + 1) / 20)
        : 1;
      await APP.forum.loadTopic(topicId, totalPages);
    } catch (err) {
      APP.notify(err.message, 'error');
    }
  },

  deleteTopic: async function (id) {
    try {
      if (!APP.state.user) {
        APP.notify('Необходимо авторизоваться', 'warning');
        return;
      }

      if (!confirm('Вы уверены, что хотите удалить эту тему?')) return;

      await APP.api.delete('/api/forum/topics/' + id);
      APP.notify('Тема удалена', 'success');

      // Go back to category or categories
      if (APP.state.forumState.currentCategory) {
        await APP.forum.loadCategory(APP.state.forumState.currentCategory.slug);
      } else {
        await APP.forum.loadCategories();
      }
    } catch (err) {
      APP.notify(err.message, 'error');
    }
  },

  deletePost: async function (topicId, postId) {
    try {
      if (!APP.state.user) {
        APP.notify('Необходимо авторизоваться', 'warning');
        return;
      }

      if (!confirm('Вы уверены, что хотите удалить это сообщение?')) return;

      await APP.api.delete('/api/forum/posts/' + postId);
      APP.notify('Сообщение удалено', 'success');

      await APP.forum.loadTopic(topicId);
    } catch (err) {
      APP.notify(err.message, 'error');
    }
  },

  renderCategories: function (categories) {
    var categoriesDiv = document.getElementById('forum-categories');
    var topicsDiv = document.getElementById('forum-topics');
    var topicView = document.getElementById('forum-topic-view');
    var paginationDiv = document.getElementById('forum-pagination');

    if (categoriesDiv) categoriesDiv.style.display = '';
    if (topicsDiv) topicsDiv.style.display = 'none';
    if (topicView) topicView.style.display = 'none';
    if (paginationDiv) paginationDiv.style.display = 'none';

    APP.forum.renderBreadcrumbs([
      { label: 'Категории', action: null, active: true },
    ]);

    if (!categoriesDiv) return;

    var html = '';
    for (var i = 0; i < categories.length; i++) {
      var cat = categories[i];
      var topicCount = cat.topic_count || 0;
      var latestInfo = '';
      if (cat.latest_topic) {
        latestInfo = '<span class="category-latest">Последнее: ' +
          '<span class="category-latest-title">' + APP.ui.escapeHtml(APP.ui.truncate(cat.latest_topic.title, 40)) + '</span>' +
          '<span class="category-latest-date">' + APP.ui.timeAgo(cat.latest_topic.created_at) + '</span></span>';
      } else {
        latestInfo = '<span class="category-latest">Нет тем</span>';
      }

      html += '<div class="category-card">' +
        '<div class="category-card-inner">' +
        '<div class="category-info">' +
        '<h3 class="category-name">' +
        '<a class="category-link" href="#" data-category-slug="' + APP.ui.escapeHtml(cat.slug) + '">' + APP.ui.escapeHtml(cat.name) + '</a>' +
        '</h3>' +
        '<p class="category-desc">' + APP.ui.escapeHtml(cat.description || '') + '</p>' +
        '</div>' +
        '<div class="category-stats">' +
        '<span class="category-topic-count">' + topicCount + ' ' + APP.forum._pluralize(topicCount, ['тема', 'темы', 'тем']) + '</span>' +
        latestInfo +
        '</div>' +
        '</div>' +
        '</div>';
    }

    if (categories.length === 0) {
      html = '<div class="empty-state">Нет категорий</div>';
    }

    categoriesDiv.innerHTML = html;

    // Add click handlers
    var links = categoriesDiv.querySelectorAll('.category-link');
    for (var k = 0; k < links.length; k++) {
      (function () {
        var link = links[k];
        link.addEventListener('click', function (e) {
          e.preventDefault();
          APP.forum.loadCategory(link.dataset.categorySlug);
        });
      })();
    }
  },

  renderTopics: function (topics, totalPages, currentPage, slug) {
    var topicsDiv = document.getElementById('forum-topics');
    if (!topicsDiv) return;

    var html = '';
    for (var i = 0; i < topics.length; i++) {
      var t = topics[i];
      var pinnedClass = t.is_pinned ? ' topic-pinned' : '';
      var pinnedBadge = t.is_pinned ? ' <span class="badge badge-pinned">Закреплено</span>' : '';
      var postCount = t.post_count || 0;
      var lastPostInfo = '';
      if (t.last_post) {
        lastPostInfo = '<span class="topic-last-post">' +
          '<span class="topic-last-author">' + APP.ui.escapeHtml(t.last_post.username || '?') + '</span>' +
          '<span class="topic-last-date">' + APP.ui.timeAgo(t.last_post.created_at) + '</span>' +
          '</span>';
      }

      html += '<div class="topic-item' + pinnedClass + '">' +
        '<div class="topic-main">' +
        '<a class="topic-title" href="#" data-topic-id="' + t.id + '">' +
        APP.ui.escapeHtml(t.title) + pinnedBadge +
        '</a>' +
        '<span class="topic-meta">' +
        'Автор: <strong>' + APP.ui.escapeHtml(t.username || '?') + '</strong>' +
        ' &middot; ' + APP.ui.timeAgo(t.created_at) +
        '</span>' +
        '</div>' +
        '<div class="topic-stats">' +
        '<span class="topic-replies">' + postCount + ' ' + APP.forum._pluralize(postCount, ['ответ', 'ответа', 'ответов']) + '</span>' +
        '<span class="topic-views">' + (t.views || 0) + ' ' + APP.forum._pluralize(t.views || 0, ['просмотр', 'просмотра', 'просмотров']) + '</span>' +
        lastPostInfo +
        '</div>' +
        '</div>';
    }

    if (topics.length === 0) {
      html = '<div class="empty-state">В этой категории пока нет тем. Будьте первым!</div>';
    }

    topicsDiv.innerHTML = html;

    // Add click handlers
    var links = topicsDiv.querySelectorAll('.topic-title');
    for (var k = 0; k < links.length; k++) {
      (function (topicId) {
        links[k].addEventListener('click', function (e) {
          e.preventDefault();
          APP.forum.loadTopic(topicId);
        });
      })(topics[k].id);
    }

    // Pagination
    APP.forum.renderPagination('forum-pagination', currentPage, totalPages, function (p) {
      APP.forum.loadCategory(slug, p);
    });
  },

  renderPosts: function (posts, totalPages, currentPage, topic) {
    var topicView = document.getElementById('forum-topic-view');
    if (!topicView) return;

    var isAdmin = APP.state.user && APP.state.user.role === 'admin';
    var currentUserUid = APP.state.user ? APP.state.user.uid : '';

    var html = '';

    // Topic header
    html += '<div class="topic-header">' +
      '<h2 class="topic-view-title">' + APP.ui.escapeHtml(topic.title) + '</h2>' +
      '<div class="topic-view-meta">' +
      '<span>Автор: <strong>' + APP.ui.escapeHtml(topic.username || '?') + '</strong></span>' +
      '<span>' + APP.ui.formatDate(topic.created_at) + '</span>' +
      '<span>' + (topic.views || 0) + ' ' + APP.forum._pluralize(topic.views || 0, ['просмотр', 'просмотра', 'просмотров']) + '</span>' +
      (topic.is_locked ? '<span class="badge badge-locked">Закрыто</span>' : '') +
      (topic.is_pinned ? '<span class="badge badge-pinned">Закреплено</span>' : '') +
      '</div>';

    // Delete topic button for admin or author
    if (isAdmin || currentUserUid === topic.user_uid) {
      html += '<div class="topic-actions">' +
        '<button class="btn btn-danger btn-sm delete-topic-btn" data-topic-id="' + topic.id + '">Удалить тему</button>' +
        '</div>';
    }

    html += '</div>';

    // Posts
    html += '<div class="posts-list">';
    for (var i = 0; i < posts.length; i++) {
      var post = posts[i];
      var isFirstPost = (i === 0 && currentPage === 1);
      var canDelete = isAdmin || currentUserUid === post.user_uid;

      html += '<div class="post-item' + (isFirstPost ? ' post-first' : '') + '" data-post-id="' + post.id + '">' +
        '<div class="post-sidebar">' +
        '<div class="post-avatar">' + (post.username || '?').charAt(0).toUpperCase() + '</div>' +
        '<div class="post-username">' + APP.ui.escapeHtml(post.username || '?') + '</div>' +
        (post.role === 'admin' ? '<span class="badge badge-admin">Admin</span>' : '') +
        '</div>' +
        '<div class="post-body">' +
        '<div class="post-header">' +
        '<span class="post-date">' + APP.ui.formatDate(post.created_at) + '</span>' +
        (isFirstPost ? '<span class="badge badge-op">Автор темы</span>' : '') +
        '</div>' +
        '<div class="post-content">' + APP.ui.escapeHtml(post.content) + '</div>' +
        (canDelete ? '<div class="post-footer"><button class="btn btn-danger btn-sm delete-post-btn" data-topic-id="' + topic.id + '" data-post-id="' + post.id + '">Удалить</button></div>' : '') +
        '</div>' +
        '</div>';
    }
    html += '</div>';

    // Reply form
    if (APP.state.user && !topic.is_locked) {
      html += '<div class="post-reply-form">' +
        '<h3>Ответить</h3>' +
        '<div class="form-group">' +
        '<textarea id="forum-reply-input" rows="4" placeholder="Ваш ответ..." maxlength="10000"></textarea>' +
        '</div>' +
        '<button class="btn btn-primary" id="btn-submit-reply">Отправить</button>' +
        '</div>';
    } else if (topic.is_locked) {
      html += '<div class="empty-state">Тема закрыта. Ответы невозможны.</div>';
    } else {
      html += '<div class="empty-state"><a href="#" class="link-neon" data-page="login">Войдите</a>, чтобы ответить.</div>';
    }

    topicView.innerHTML = html;

    // Pagination
    APP.forum.renderPagination('forum-pagination', currentPage, totalPages, function (p) {
      APP.forum.loadTopic(topic.id, p);
    });

    // Reply button handler
    var btnReply = document.getElementById('btn-submit-reply');
    if (btnReply) btnReply.addEventListener('click', function () {
      var replyInput = document.getElementById('forum-reply-input');
      var content = replyInput.value.trim();
      if (!content) {
        APP.notify('Введите текст ответа', 'warning');
        return;
      }
      APP.forum.createPost(topic.id, content);
    });

    // Delete topic button handler
    var deleteTopicBtns = topicView.querySelectorAll('.delete-topic-btn');
    for (var d = 0; d < deleteTopicBtns.length; d++) {
      (function (topicId) {
        deleteTopicBtns[d].addEventListener('click', function () {
          APP.forum.deleteTopic(topicId);
        });
      })(topic.id);
    }

    // Delete post button handlers
    var deletePostBtns = topicView.querySelectorAll('.delete-post-btn');
    for (var p = 0; p < deletePostBtns.length; p++) {
      (function () {
        var btn = deletePostBtns[p];
        btn.addEventListener('click', function () {
          APP.forum.deletePost(parseInt(btn.dataset.topicId), parseInt(btn.dataset.postId));
        });
      })();
    }
  },

  renderBreadcrumbs: function (items) {
    var breadcrumbsDiv = document.getElementById('forum-breadcrumbs');
    if (!breadcrumbsDiv) return;

    var html = '';
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (i > 0) html += ' <span class="breadcrumb-separator">&rsaquo;</span> ';
      if (item.active) {
        html += '<span class="breadcrumb-item active">' + APP.ui.escapeHtml(item.label) + '</span>';
      } else {
        html += '<a class="breadcrumb-item" href="#" data-breadcrumb-action="' + i + '">' + APP.ui.escapeHtml(item.label) + '</a>';
      }
    }

    breadcrumbsDiv.innerHTML = html;

    // Add click handlers
    var links = breadcrumbsDiv.querySelectorAll('[data-breadcrumb-action]');
    for (var k = 0; k < links.length; k++) {
      (function () {
        var link = links[k];
        link.addEventListener('click', function (e) {
          e.preventDefault();
          var idx = parseInt(link.dataset.breadcrumbAction);
          var action = items[idx].action;
          if (typeof action === 'function') {
            action();
          } else if (action === 'categories') {
            APP.forum.loadCategories();
          }
        });
      })();
    }
  },

  renderPagination: function (containerId, currentPage, totalPages, onPageClick) {
    var container = document.getElementById(containerId);
    if (!container) return;

    if (totalPages <= 1) {
      container.style.display = 'none';
      return;
    }

    container.style.display = '';

    var html = '';

    // Previous button
    if (currentPage > 1) {
      html += '<button class="pagination-btn" data-page="' + (currentPage - 1) + '">&laquo; Назад</button>';
    } else {
      html += '<button class="pagination-btn disabled" disabled>&laquo; Назад</button>';
    }

    // Page numbers
    var startPage = Math.max(1, currentPage - 2);
    var endPage = Math.min(totalPages, currentPage + 2);

    if (startPage > 1) {
      html += '<button class="pagination-btn" data-page="1">1</button>';
      if (startPage > 2) html += '<span class="pagination-ellipsis">...</span>';
    }

    for (var p = startPage; p <= endPage; p++) {
      if (p === currentPage) {
        html += '<button class="pagination-btn active" disabled>' + p + '</button>';
      } else {
        html += '<button class="pagination-btn" data-page="' + p + '">' + p + '</button>';
      }
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) html += '<span class="pagination-ellipsis">...</span>';
      html += '<button class="pagination-btn" data-page="' + totalPages + '">' + totalPages + '</button>';
    }

    // Next button
    if (currentPage < totalPages) {
      html += '<button class="pagination-btn" data-page="' + (currentPage + 1) + '">Вперёд &raquo;</button>';
    } else {
      html += '<button class="pagination-btn disabled" disabled>Вперёд &raquo;</button>';
    }

    container.innerHTML = html;

    // Add click handlers
    var buttons = container.querySelectorAll('.pagination-btn:not(.disabled)');
    for (var i = 0; i < buttons.length; i++) {
      (function () {
        var btn = buttons[i];
        btn.addEventListener('click', function () {
          var page = parseInt(btn.dataset.page);
          if (page && onPageClick) onPageClick(page);
        });
      })();
    }
  },

  _pluralize: function (count, forms) {
    var n = Math.abs(count);
    var mod10 = n % 10;
    var mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 19) return forms[2];
    if (mod10 === 1) return forms[0];
    if (mod10 >= 2 && mod10 <= 4) return forms[1];
    return forms[2];
  }
};

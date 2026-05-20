const express = require('express');
const router = express.Router();
const db = require('../database');

// Middleware: require authentication
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Требуется авторизация' });
  next();
}

// GET /api/forum/categories - all categories
router.get('/categories', (req, res) => {
  try {
    const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order ASC').all();

    // Count topics per category
    const topicCounts = db.prepare(
      'SELECT category_id, COUNT(*) as count FROM topics GROUP BY category_id'
    ).all();
    const countsMap = {};
    for (const row of topicCounts) {
      countsMap[row.category_id] = row.count;
    }

    // Get latest topic per category
    const latestTopics = db.prepare(`
      SELECT t.id, t.category_id, t.title, t.created_at
      FROM topics t
      INNER JOIN (
        SELECT category_id, MAX(created_at) as max_created
        FROM topics
        GROUP BY category_id
      ) latest ON t.category_id = latest.category_id AND t.created_at = latest.max_created
    `).all();
    const latestMap = {};
    for (const row of latestTopics) {
      latestMap[row.category_id] = { id: row.id, title: row.title, created_at: row.created_at };
    }

    const result = categories.map(cat => ({
      ...cat,
      topic_count: countsMap[cat.id] || 0,
      latest_topic: latestMap[cat.id] || null
    }));

    res.json({ categories: result });
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/forum/categories/:slug - category by slug + topics
router.get('/categories/:slug', (req, res) => {
  try {
    const { slug } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const category = db.prepare('SELECT * FROM categories WHERE slug = ?').get(slug);
    if (!category) {
      return res.status(404).json({ error: 'Категория не найдена' });
    }

    const totalTopics = db.prepare('SELECT COUNT(*) as count FROM topics WHERE category_id = ?').get(category.id);
    const totalPages = Math.ceil(totalTopics.count / limit);

    const topics = db.prepare(`
      SELECT t.*, u.username, u.avatar,
        (SELECT COUNT(*) FROM posts WHERE topic_id = t.id) as post_count
      FROM topics t
      LEFT JOIN users u ON t.user_uid = u.uid
      WHERE t.category_id = ?
      ORDER BY t.is_pinned DESC, t.updated_at DESC
      LIMIT ? OFFSET ?
    `).all(category.id, limit, offset);

    // Get last post info for each topic
    for (const topic of topics) {
      const lastPost = db.prepare(`
        SELECT p.id, p.user_uid, p.created_at, u.username
        FROM posts p
        LEFT JOIN users u ON p.user_uid = u.uid
        WHERE p.topic_id = ?
        ORDER BY p.created_at DESC
        LIMIT 1
      `).get(topic.id);
      topic.last_post = lastPost || null;
    }

    res.json({
      category,
      topics,
      pagination: {
        page,
        limit,
        total: totalTopics.count,
        totalPages
      }
    });
  } catch (err) {
    console.error('Get category error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/forum/topics - create topic (requires auth)
router.post('/topics', requireAuth, (req, res) => {
  try {
    const { category_id, title, content } = req.body;

    if (!category_id || !title || !content) {
      return res.status(400).json({ error: 'Все поля обязательны: category_id, title, content' });
    }

    if (title.length < 3) {
      return res.status(400).json({ error: 'Заголовок должен быть минимум 3 символа' });
    }

    // Check category exists
    const category = db.prepare('SELECT id FROM categories WHERE id = ?').get(category_id);
    if (!category) {
      return res.status(404).json({ error: 'Категория не найдена' });
    }

    // Get user info from session
    const user = db.prepare('SELECT uid FROM users WHERE id = ?').get(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }

    const result = db.prepare(
      'INSERT INTO topics (category_id, user_uid, title, content) VALUES (?, ?, ?, ?)'
    ).run(category_id, user.uid, title, content);

    const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(result.lastInsertRowid);

    res.json({ success: true, topic });
  } catch (err) {
    console.error('Create topic error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/forum/topics/:id - topic with posts (paginated)
router.get('/topics/:id', (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const topic = db.prepare(`
      SELECT t.*, u.username, u.avatar
      FROM topics t
      LEFT JOIN users u ON t.user_uid = u.uid
      WHERE t.id = ?
    `).get(id);

    if (!topic) {
      return res.status(404).json({ error: 'Топик не найден' });
    }

    // Increment views
    db.prepare('UPDATE topics SET views = views + 1 WHERE id = ?').run(id);

    const totalPosts = db.prepare('SELECT COUNT(*) as count FROM posts WHERE topic_id = ?').get(id);
    const totalPages = Math.ceil(totalPosts.count / limit);

    const posts = db.prepare(`
      SELECT p.*, u.username, u.avatar, u.role
      FROM posts p
      LEFT JOIN users u ON p.user_uid = u.uid
      WHERE p.topic_id = ?
      ORDER BY p.created_at ASC
      LIMIT ? OFFSET ?
    `).all(id, limit, offset);

    topic.views = topic.views + 1;

    res.json({
      topic,
      posts,
      pagination: {
        page,
        limit,
        total: totalPosts.count,
        totalPages
      }
    });
  } catch (err) {
    console.error('Get topic error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/forum/topics/:id/posts - create post in topic (requires auth)
router.post('/topics/:id/posts', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Контент не может быть пустым' });
    }

    // Check topic exists
    const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(id);
    if (!topic) {
      return res.status(404).json({ error: 'Топик не найден' });
    }

    if (topic.is_locked === 1) {
      return res.status(403).json({ error: 'Топик закрыт' });
    }

    // Get user
    const user = db.prepare('SELECT uid FROM users WHERE id = ?').get(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }

    const result = db.prepare(
      'INSERT INTO posts (topic_id, user_uid, content) VALUES (?, ?, ?)'
    ).run(id, user.uid, content);

    // Update topic updated_at
    db.prepare('UPDATE topics SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);

    const post = db.prepare(`
      SELECT p.*, u.username, u.avatar, u.role
      FROM posts p
      LEFT JOIN users u ON p.user_uid = u.uid
      WHERE p.id = ?
    `).get(result.lastInsertRowid);

    res.json({ success: true, post });
  } catch (err) {
    console.error('Create post error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/forum/topics/:id - delete topic (admin or author)
router.delete('/topics/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;

    const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(id);
    if (!topic) {
      return res.status(404).json({ error: 'Топик не найден' });
    }

    const user = db.prepare('SELECT uid, role FROM users WHERE id = ?').get(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }

    // Check if user is admin or author
    if (user.role !== 'admin' && user.uid !== topic.user_uid) {
      return res.status(403).json({ error: 'Нет прав на удаление этого топика' });
    }

    // Delete posts first, then topic
    db.prepare('DELETE FROM posts WHERE topic_id = ?').run(id);
    db.prepare('DELETE FROM topics WHERE id = ?').run(id);

    res.json({ success: true });
  } catch (err) {
    console.error('Delete topic error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/forum/posts/:id - delete post (admin or author)
router.delete('/posts/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;

    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
    if (!post) {
      return res.status(404).json({ error: 'Пост не найден' });
    }

    const user = db.prepare('SELECT uid, role FROM users WHERE id = ?').get(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }

    // Check if user is admin or author
    if (user.role !== 'admin' && user.uid !== post.user_uid) {
      return res.status(403).json({ error: 'Нет прав на удаление этого поста' });
    }

    db.prepare('DELETE FROM posts WHERE id = ?').run(id);

    res.json({ success: true });
  } catch (err) {
    console.error('Delete post error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../database');

// Middleware: require authentication
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Требуется авторизация' });
  next();
}

// GET /api/chat/messages?limit=50&before=id - get chat messages (paginated backwards)
router.get('/messages', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const before = parseInt(req.query.before) || 0;

    let messages;
    if (before > 0) {
      messages = db.prepare(`
        SELECT m.*, u.avatar, u.role
        FROM chat_messages m
        LEFT JOIN users u ON m.user_uid = u.uid
        WHERE m.id < ?
        ORDER BY m.id DESC
        LIMIT ?
      `).all(before, limit);
    } else {
      messages = db.prepare(`
        SELECT m.*, u.avatar, u.role
        FROM chat_messages m
        LEFT JOIN users u ON m.user_uid = u.uid
        ORDER BY m.id DESC
        LIMIT ?
      `).all(limit);
    }

    // Reverse to get chronological order
    messages.reverse();

    // Determine if there are more messages
    const hasMore = messages.length === limit;

    res.json({
      messages,
      hasMore,
      oldestId: messages.length > 0 ? messages[0].id : null
    });
  } catch (err) {
    console.error('Get chat messages error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/chat/messages - send message (requires auth)
router.post('/messages', requireAuth, (req, res) => {
  try {
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Сообщение не может быть пустым' });
    }

    if (message.length > 1000) {
      return res.status(400).json({ error: 'Сообщение слишком длинное (макс. 1000 символов)' });
    }

    const user = db.prepare('SELECT uid, username FROM users WHERE id = ?').get(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }

    const result = db.prepare(
      'INSERT INTO chat_messages (user_uid, username, message) VALUES (?, ?, ?)'
    ).run(user.uid, user.username, message.trim());

    const newMessage = db.prepare(`
      SELECT m.*, u.avatar, u.role
      FROM chat_messages m
      LEFT JOIN users u ON m.user_uid = u.uid
      WHERE m.id = ?
    `).get(result.lastInsertRowid);

    res.json({ success: true, message: newMessage });
  } catch (err) {
    console.error('Send chat message error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/chat/online - online users (active in last 5 minutes)
router.get('/online', (req, res) => {
  try {
    const onlineUsers = db.prepare(`
      SELECT DISTINCT m.user_uid, m.username, u.avatar, u.role
      FROM chat_messages m
      LEFT JOIN users u ON m.user_uid = u.uid
      WHERE m.created_at >= datetime('now', '-5 minutes')
      ORDER BY m.username ASC
    `).all();

    res.json({ online: onlineUsers });
  } catch (err) {
    console.error('Get online users error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;

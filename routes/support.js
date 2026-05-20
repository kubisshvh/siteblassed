const express = require('express');
const router = express.Router();
const db = require('../database');

// Middleware: require authentication
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Требуется авторизация' });
  next();
}

// POST /api/support/tickets - create ticket (requires auth)
router.post('/tickets', requireAuth, (req, res) => {
  try {
    const { subject, message } = req.body;

    if (!subject || subject.trim().length === 0) {
      return res.status(400).json({ error: 'Тема не может быть пустой' });
    }

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Сообщение не может быть пустым' });
    }

    const user = db.prepare('SELECT uid, username FROM users WHERE id = ?').get(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }

    const result = db.prepare(
      'INSERT INTO support_tickets (user_uid, username, subject) VALUES (?, ?, ?)'
    ).run(user.uid, user.username, subject.trim());

    // Add the initial message as a reply
    db.prepare(
      'INSERT INTO support_replies (ticket_id, user_uid, username, is_admin, message) VALUES (?, ?, ?, ?, ?)'
    ).run(result.lastInsertRowid, user.uid, user.username, 0, message.trim());

    const ticket = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(result.lastInsertRowid);

    res.json({ success: true, ticket });
  } catch (err) {
    console.error('Create ticket error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/support/tickets - get tickets (own tickets or all if admin)
router.get('/tickets', requireAuth, (req, res) => {
  try {
    const user = db.prepare('SELECT uid, role FROM users WHERE id = ?').get(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }

    let tickets;
    if (user.role === 'admin') {
      tickets = db.prepare(`
        SELECT t.*,
          (SELECT COUNT(*) FROM support_replies WHERE ticket_id = t.id) as reply_count
        FROM support_tickets t
        ORDER BY t.status ASC, t.created_at DESC
      `).all();
    } else {
      tickets = db.prepare(`
        SELECT t.*,
          (SELECT COUNT(*) FROM support_replies WHERE ticket_id = t.id) as reply_count
        FROM support_tickets t
        WHERE t.user_uid = ?
        ORDER BY t.status ASC, t.created_at DESC
      `).all(user.uid);
    }

    res.json({ tickets });
  } catch (err) {
    console.error('Get tickets error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/support/tickets/:id - get ticket with replies
router.get('/tickets/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;

    const ticket = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(id);
    if (!ticket) {
      return res.status(404).json({ error: 'Тикет не найден' });
    }

    const user = db.prepare('SELECT uid, role FROM users WHERE id = ?').get(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }

    // Check access: admin or ticket owner
    if (user.role !== 'admin' && ticket.user_uid !== user.uid) {
      return res.status(403).json({ error: 'Нет доступа к этому тикету' });
    }

    const replies = db.prepare(`
      SELECT * FROM support_replies
      WHERE ticket_id = ?
      ORDER BY created_at ASC
    `).all(id);

    res.json({ ticket, replies });
  } catch (err) {
    console.error('Get ticket error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/support/tickets/:id/reply - reply to ticket (owner or admin)
router.post('/tickets/:id/reply', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Сообщение не может быть пустым' });
    }

    const ticket = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(id);
    if (!ticket) {
      return res.status(404).json({ error: 'Тикет не найден' });
    }

    if (ticket.status === 'closed') {
      return res.status(400).json({ error: 'Тикет закрыт' });
    }

    const user = db.prepare('SELECT uid, username, role FROM users WHERE id = ?').get(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }

    // Check access: admin or ticket owner
    if (user.role !== 'admin' && ticket.user_uid !== user.uid) {
      return res.status(403).json({ error: 'Нет доступа к этому тикету' });
    }

    const isAdmin = user.role === 'admin' ? 1 : 0;

    const result = db.prepare(
      'INSERT INTO support_replies (ticket_id, user_uid, username, is_admin, message) VALUES (?, ?, ?, ?, ?)'
    ).run(id, user.uid, user.username, isAdmin, message.trim());

    const reply = db.prepare('SELECT * FROM support_replies WHERE id = ?').get(result.lastInsertRowid);

    res.json({ success: true, reply });
  } catch (err) {
    console.error('Reply to ticket error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PATCH /api/support/tickets/:id/status - change ticket status (admin only)
router.patch('/tickets/:id/status', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['open', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'Статус должен быть "open" или "closed"' });
    }

    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Только администратор может изменить статус тикета' });
    }

    const ticket = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(id);
    if (!ticket) {
      return res.status(404).json({ error: 'Тикет не найден' });
    }

    db.prepare('UPDATE support_tickets SET status = ? WHERE id = ?').run(status, id);

    res.json({ success: true, status });
  } catch (err) {
    console.error('Change ticket status error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;

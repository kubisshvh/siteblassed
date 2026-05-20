const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

// Middleware: require authentication
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Требуется авторизация' });
  next();
}

// Middleware: require admin
function requireAdmin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Требуется авторизация' });

  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.session.userId);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Требуются права администратора' });
  }
  next();
}

// Configure multer for loader uploads
const loaderStorage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads', 'loader'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = `${uuidv4()}${ext}`;
    cb(null, safeName);
  }
});

const uploadLoader = multer({
  storage: loaderStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (req, file, cb) => {
    // Accept any file type for loader
    cb(null, true);
  }
});

// GET /api/admin/invite-codes - get all invite codes (admin only)
router.get('/invite-codes', requireAdmin, (req, res) => {
  try {
    const codes = db.prepare(`
      SELECT ic.*,
        CASE WHEN ic.used_by IS NOT NULL THEN (SELECT username FROM users WHERE uid = ic.used_by) ELSE NULL END as used_by_username
      FROM invite_codes ic
      ORDER BY ic.created_at DESC
    `).all();

    res.json({ codes });
  } catch (err) {
    console.error('Get invite codes error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/admin/invite-codes - generate invite codes (admin only)
router.post('/invite-codes', requireAdmin, (req, res) => {
  try {
    const { codes, count } = req.body;

    const user = db.prepare('SELECT uid FROM users WHERE id = ?').get(req.session.userId);

    let generatedCodes = [];

    if (codes && Array.isArray(codes) && codes.length > 0) {
      // Use provided codes
      const insertCode = db.prepare('INSERT OR IGNORE INTO invite_codes (code, created_by) VALUES (?, ?)');
      for (const code of codes) {
        if (typeof code === 'string' && code.trim().length > 0) {
          const result = insertCode.run(code.trim().toUpperCase(), user.uid);
          if (result.changes > 0) {
            generatedCodes.push(code.trim().toUpperCase());
          }
        }
      }
    } else if (count && typeof count === 'number' && count > 0) {
      // Auto-generate codes
      const numToGenerate = Math.min(count, 100); // Max 100 at once
      const insertCode = db.prepare('INSERT OR IGNORE INTO invite_codes (code, created_by) VALUES (?, ?)');

      for (let i = 0; i < numToGenerate; i++) {
        const code = uuidv4().substring(0, 8).toUpperCase();
        const result = insertCode.run(code, user.uid);
        if (result.changes > 0) {
          generatedCodes.push(code);
        }
      }
    } else {
      return res.status(400).json({ error: 'Укажите codes (массив) или count (число)' });
    }

    const newCodes = db.prepare(`
      SELECT * FROM invite_codes WHERE code IN (${generatedCodes.map(() => '?').join(',')})
    `).all(...generatedCodes);

    res.json({ success: true, codes: newCodes });
  } catch (err) {
    console.error('Generate invite codes error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/admin/users - list all users (admin only)
router.get('/users', requireAdmin, (req, res) => {
  try {
    const users = db.prepare(`
      SELECT uid, username, email, role, avatar, banned, created_at, invite_code_used,
        (SELECT COUNT(*) FROM topics WHERE user_uid = u.uid) as topics_count,
        (SELECT COUNT(*) FROM posts WHERE user_uid = u.uid) as posts_count
      FROM users u
      ORDER BY created_at DESC
    `).all();

    res.json({ users });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PATCH /api/admin/users/:uid/role - change user role (admin only)
router.patch('/users/:uid/role', requireAdmin, (req, res) => {
  try {
    const { uid } = req.params;
    const { role } = req.body;

    if (!role || !['user', 'admin', 'moderator'].includes(role)) {
      return res.status(400).json({ error: 'Роль должна быть: user, admin, moderator' });
    }

    const user = db.prepare('SELECT * FROM users WHERE uid = ?').get(uid);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Prevent changing own role
    const currentUser = db.prepare('SELECT uid FROM users WHERE id = ?').get(req.session.userId);
    if (uid === currentUser.uid) {
      return res.status(400).json({ error: 'Нельзя изменить свою собственную роль' });
    }

    db.prepare('UPDATE users SET role = ? WHERE uid = ?').run(role, uid);

    res.json({ success: true, uid, role });
  } catch (err) {
    console.error('Change role error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PATCH /api/admin/users/:uid/ban - ban/unban user (admin only)
router.patch('/users/:uid/ban', requireAdmin, (req, res) => {
  try {
    const { uid } = req.params;
    const { banned } = req.body;

    if (typeof banned !== 'number' || ![0, 1].includes(banned)) {
      return res.status(400).json({ error: 'banned должен быть 0 или 1' });
    }

    const user = db.prepare('SELECT * FROM users WHERE uid = ?').get(uid);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Prevent banning self
    const currentUser = db.prepare('SELECT uid FROM users WHERE id = ?').get(req.session.userId);
    if (uid === currentUser.uid) {
      return res.status(400).json({ error: 'Нельзя забанить самого себя' });
    }

    // Prevent banning other admins
    if (user.role === 'admin' && banned === 1) {
      return res.status(400).json({ error: 'Нельзя забанить администратора' });
    }

    db.prepare('UPDATE users SET banned = ? WHERE uid = ?').run(banned, uid);

    res.json({ success: true, uid, banned: banned === 1 });
  } catch (err) {
    console.error('Ban user error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/admin/set-uid - set admin UID in settings (admin only)
router.post('/set-uid', requireAdmin, (req, res) => {
  try {
    const { uid } = req.body;

    if (!uid || typeof uid !== 'string') {
      return res.status(400).json({ error: 'UID обязателен' });
    }

    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('admin_uid', uid);

    res.json({ success: true, admin_uid: uid });
  } catch (err) {
    console.error('Set admin UID error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/admin/settings - get all settings (admin only)
router.get('/settings', requireAdmin, (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM settings').all();

    const settingsMap = {};
    for (const row of settings) {
      settingsMap[row.key] = row.value;
    }

    res.json({ settings: settingsMap });
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/admin/loader - upload new loader version (admin only)
router.post('/loader', requireAdmin, uploadLoader.single('file'), (req, res) => {
  try {
    const { version, changelog } = req.body;

    if (!version) {
      return res.status(400).json({ error: 'Версия обязательна' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Файл обязателен' });
    }

    const filename = req.file.filename;

    db.prepare(
      'INSERT INTO loader_versions (version, filename, changelog) VALUES (?, ?, ?)'
    ).run(version, filename, changelog || '');

    const loaderVersion = db.prepare('SELECT * FROM loader_versions ORDER BY id DESC LIMIT 1').get();

    res.json({ success: true, loader: loaderVersion });
  } catch (err) {
    console.error('Upload loader error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/admin/stats - statistics (admin only)
router.get('/stats', requireAdmin, (req, res) => {
  try {
    const usersCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    const topicsCount = db.prepare('SELECT COUNT(*) as count FROM topics').get();
    const postsCount = db.prepare('SELECT COUNT(*) as count FROM posts').get();
    const chatMessagesCount = db.prepare('SELECT COUNT(*) as count FROM chat_messages').get();
    const ticketsCount = db.prepare('SELECT COUNT(*) as count FROM support_tickets').get();
    const openTicketsCount = db.prepare("SELECT COUNT(*) as count FROM support_tickets WHERE status = 'open'").get();
    const bannedUsersCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE banned = 1').get();
    const inviteCodesCount = db.prepare('SELECT COUNT(*) as count FROM invite_codes').get();
    const unusedInviteCodesCount = db.prepare('SELECT COUNT(*) as count FROM invite_codes WHERE is_used = 0').get();

    res.json({
      stats: {
        users: usersCount.count,
        banned_users: bannedUsersCount.count,
        topics: topicsCount.count,
        posts: postsCount.count,
        chat_messages: chatMessagesCount.count,
        tickets: ticketsCount.count,
        open_tickets: openTicketsCount.count,
        invite_codes: inviteCodesCount.count,
        unused_invite_codes: unusedInviteCodesCount.count
      }
    });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;

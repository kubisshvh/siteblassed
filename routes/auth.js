const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database');

// Middleware: require authentication
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Требуется авторизация' });
  next();
}

// Generate unique UID
function generateUID() {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `UID-${num}`;
}

// POST /api/auth/register
router.post('/register', (req, res) => {
  try {
    const { email, username, password, invite_code } = req.body;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({ error: 'Некорректный формат email' });
    }

    // Validate username (3-20 characters)
    if (!username || username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: 'Имя пользователя должно быть от 3 до 20 символов' });
    }

    // Validate password (min 6 characters)
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть минимум 6 символов' });
    }

    // Check if email or username already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username);
    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким email или именем уже существует' });
    }

    // Validate invite code
    if (!invite_code) {
      return res.status(400).json({ error: 'Требуется инвайт-код' });
    }

    const inviteCode = db.prepare('SELECT * FROM invite_codes WHERE code = ?').get(invite_code);
    if (!inviteCode) {
      return res.status(400).json({ error: 'Неверный инвайт-код' });
    }
    if (inviteCode.is_used === 1) {
      return res.status(400).json({ error: 'Этот инвайт-код уже использован' });
    }

    // Hash password
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Generate UID
    let uid;
    let uidExists;
    do {
      uid = generateUID();
      uidExists = db.prepare('SELECT id FROM users WHERE uid = ?').get(uid);
    } while (uidExists);

    // Check if generated UID matches admin UID, regenerate if so
    const adminUid = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_uid');
    if (adminUid && uid === adminUid.value) {
      do {
        uid = generateUID();
      } while (uid === adminUid.value);
    }

    // Save user
    db.prepare(
      'INSERT INTO users (uid, username, email, password, role, invite_code_used) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(uid, username, email, hashedPassword, 'user', invite_code);

    // Mark invite code as used
    db.prepare(
      'UPDATE invite_codes SET is_used = 1, used_by = ?, used_at = CURRENT_TIMESTAMP WHERE code = ?'
    ).run(uid, invite_code);

    res.json({ success: true, user: { uid, username, email, role: 'user' } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(400).json({ error: 'Неверный email или пароль' });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Неверный email или пароль' });
    }

    if (user.banned === 1) {
      return res.status(403).json({ error: 'Ваш аккаунт заблокирован' });
    }

    req.session.userId = user.id;
    req.session.userUid = user.uid;

    res.json({
      success: true,
      user: {
        uid: user.uid,
        username: user.username,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        banned: user.banned,
        created_at: user.created_at
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка при выходе' });
    }
    res.json({ success: true });
  });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  try {
    if (!req.session.userId) {
      return res.json({ user: null });
    }

    const user = db.prepare('SELECT uid, username, email, role, avatar, banned, created_at FROM users WHERE id = ?').get(req.session.userId);
    if (!user) {
      return res.json({ user: null });
    }

    res.json({ user });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;

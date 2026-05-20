const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'forum.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent reads
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT UNIQUE,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'user',
    avatar TEXT DEFAULT '',
    banned INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    invite_code_used TEXT
  );

  CREATE TABLE IF NOT EXISTS invite_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE,
    created_by TEXT,
    is_used INTEGER DEFAULT 0,
    used_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    used_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    description TEXT,
    slug TEXT UNIQUE,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER,
    user_uid TEXT,
    title TEXT,
    content TEXT,
    is_pinned INTEGER DEFAULT 0,
    is_locked INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id INTEGER,
    user_uid TEXT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_uid TEXT,
    username TEXT,
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS support_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_uid TEXT,
    username TEXT,
    subject TEXT,
    status TEXT DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS support_replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER,
    user_uid TEXT,
    username TEXT,
    is_admin INTEGER DEFAULT 0,
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS loader_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version TEXT,
    filename TEXT,
    changelog TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Insert default data if not exists
function initDefaults() {
  // Default categories
  const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get();
  if (categoryCount.count === 0) {
    const insertCategory = db.prepare('INSERT INTO categories (name, description, slug, sort_order) VALUES (?, ?, ?, ?)');
    const categories = [
      ['Общие обсуждения', 'Обсуждение общих тем', 'general', 1],
      ['Гайды и туториалы', 'Полезные руководства и инструкции', 'guides', 2],
      ['Вопросы и ответы', 'Задавайте вопросы и получайте ответы', 'qa', 3],
      ['Релизы и обновления', 'Новости о релизах и обновлениях', 'releases', 4],
      ['Оффтоп', 'Свободное общение на любые темы', 'offtopic', 5]
    ];
    const insertMany = db.transaction((cats) => {
      for (const cat of cats) {
        insertCategory.run(...cat);
      }
    });
    insertMany(categories);
  }

  // Default invite codes
  const inviteCodeCount = db.prepare('SELECT COUNT(*) as count FROM invite_codes').get();
  if (inviteCodeCount.count === 0) {
    const insertCode = db.prepare('INSERT INTO invite_codes (code) VALUES (?)');
    const codes = ['BLASSED2026', 'FORUMINVITE', 'CRACKSCOMMUNITY'];
    const insertMany = db.transaction((c) => {
      for (const code of c) {
        insertCode.run(code);
      }
    });
    insertMany(codes);
  }

  // Default admin UID setting
  const adminSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_uid');
  if (!adminSetting) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('admin_uid', 'ADMIN-0001');
  }

  // Default loader version
  const loaderCount = db.prepare('SELECT COUNT(*) as count FROM loader_versions').get();
  if (loaderCount.count === 0) {
    db.prepare(
      'INSERT INTO loader_versions (version, filename, changelog) VALUES (?, ?, ?)'
    ).run('1.0.0', 'loader-1.0.0.exe', 'Initial test loader version.\nFeatures: basic functionality.');
  }
}

initDefaults();

module.exports = db;

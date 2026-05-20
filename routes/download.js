const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../database');

// GET /api/download/loader/latest - info about latest loader version
router.get('/loader/latest', (req, res) => {
  try {
    const latest = db.prepare('SELECT * FROM loader_versions ORDER BY id DESC LIMIT 1').get();

    if (!latest) {
      return res.status(404).json({ error: 'Нет доступных версий лоадера' });
    }

    const downloadUrl = `/api/download/loader/${latest.filename}`;

    res.json({
      version: latest.version,
      changelog: latest.changelog,
      downloadUrl,
      filename: latest.filename,
      created_at: latest.created_at
    });
  } catch (err) {
    console.error('Get latest loader error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/download/loader/:filename - download loader file
router.get('/loader/:filename', (req, res) => {
  try {
    const { filename } = req.params;

    // Verify this filename exists in database
    const loaderVersion = db.prepare('SELECT * FROM loader_versions WHERE filename = ?').get(filename);
    if (!loaderVersion) {
      return res.status(404).json({ error: 'Файл не найден' });
    }

    const filePath = path.join(__dirname, '..', 'uploads', 'loader', filename);

    // Check if file exists on disk
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Файл не найден на сервере' });
    }

    // Set appropriate headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (err) {
    console.error('Download loader error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;

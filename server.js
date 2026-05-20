const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'blassedcracks-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
    httpOnly: true
  }
}));

// Routes
const authRoutes = require('./routes/auth');
const forumRoutes = require('./routes/forum');
const chatRoutes = require('./routes/chat');
const supportRoutes = require('./routes/support');
const adminRoutes = require('./routes/admin');
const downloadRoutes = require('./routes/download');

app.use('/api/auth', authRoutes);
app.use('/api/forum', forumRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/download', downloadRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Database setup
const { query, initializeDatabase } = require('./database');

initializeDatabase().then(() => {
  console.log('✅ Database initialized successfully');
}).catch(err => {
  console.error('❌ Database initialization failed:', err);
});

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Auth
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await query('INSERT INTO users (email, password) VALUES ($1, $2)', [email, hashedPassword]);
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  try {
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { id: user.id, email: user.email, isAdmin: user.is_admin },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        isAdmin: user.is_admin,
        vipStatus: user.vip_status,
        vipExpiresAt: user.vip_expires_at
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Signals
app.get('/api/signals', async (req, res) => {
  try {
    const result = await query('SELECT * FROM signals WHERE status = $1 AND signal_type = $2 ORDER BY published_at DESC NULLS LAST', ['active', 'free']);
    res.json(result.rows || []);
  } catch (err) {
    console.error('Signals error:', err);
    return res.status(500).json({ error: 'Failed to fetch signals' });
  }
});

app.get('/api/signals/vip', authenticateToken, async (req, res) => {
  try {
    const userResult = await query('SELECT vip_status, vip_expires_at FROM users WHERE id = $1', [req.user.id]);
    const user = userResult.rows[0];
    if (!user || user.vip_status !== 'vip' || (user.vip_expires_at && moment(user.vip_expires_at).isBefore(moment()))) {
      return res.status(403).json({ error: 'VIP access required' });
    }
    const signalsResult = await query('SELECT * FROM signals WHERE signal_type = $1 AND status = $2 ORDER BY published_at DESC NULLS LAST', ['vip', 'active']);
    res.json(signalsResult.rows || []);
  } catch (err) {
    console.error('VIP signals error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Admin
app.get('/api/admin/signals', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await query('SELECT * FROM signals ORDER BY created_at DESC NULLS LAST', []);
    res.json(result.rows || []);
  } catch (err) {
    console.error('Admin signals error:', err);
    return res.status(500).json({ error: 'Failed to fetch signals' });
  }
});

app.post('/api/admin/signals', authenticateToken, requireAdmin, async (req, res) => {
  const { pair, entry_price, target_1, target_2, target_3, stop_loss, signal_type, description, scheduled_at } = req.body;
  if (!pair || !entry_price || !stop_loss) {
    return res.status(400).json({ error: 'Pair, entry price, and stop loss are required' });
  }
  const publishedAt = scheduled_at ? null : new Date().toISOString();
  try {
    await query(`INSERT INTO signals (pair, entry_price, target_1, target_2, target_3, stop_loss, signal_type, description, published_at, scheduled_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [pair, entry_price, target_1, target_2, target_3, stop_loss, signal_type || 'free', description, publishedAt, scheduled_at]);
    res.status(201).json({ message: 'Signal created successfully' });
  } catch (err) {
    console.error('Create signal error:', err);
    return res.status(500).json({ error: 'Failed to create signal' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Trading Signals Platform running on port ${PORT}`);
  console.log(`📊 Admin login: admin@tradingsignals.com / admin123`);
});

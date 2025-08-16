const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
// Database dependencies removed - using abstraction layer
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Database setup - use the abstraction layer
const { query, initializeDatabase, isProduction } = require('./database');

// Initialize database tables
initializeDatabase().then(() => {
  console.log('✅ Database initialized successfully');
}).catch(err => {
  console.error('❌ Database initialization failed:', err);
});

// Old SQLite initialization code removed - now handled by database.js

// Middleware
app.set('trust proxy', 1); // Trust Railway proxy
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Auth middleware
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

// Admin middleware
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

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    try {
      await query('INSERT INTO users (email, password) VALUES ($1, $2)', [email, hashedPassword]);
      res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
      return res.status(500).json({ error: 'Registration failed' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
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
    return res.status(500).json({ error: 'Server error' });
  }
});

// Signals routes
app.get('/api/signals', async (req, res) => {
  const { type = 'all' } = req.query;
  let queryText = 'SELECT * FROM signals WHERE status = $1';
  let params = ['active'];
  
  if (type === 'free') {
    queryText += ' AND signal_type = $2';
    params.push('free');
  }
  
  queryText += ' ORDER BY published_at DESC';
  
  try {
    const result = await query(queryText, params);
    const signals = result.rows;
    
    // Filter VIP signals for non-VIP users
    const filteredSignals = signals.filter(signal => {
      if (signal.signal_type === 'vip') {
        // Check if user has VIP access (implement this logic)
        return false; // For now, hide VIP signals from public endpoint
      }
      return true;
    });
    
    res.json(filteredSignals);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch signals' });
  }
});

app.get('/api/signals/vip', authenticateToken, async (req, res) => {
  try {
    // Check if user has VIP access
    const userResult = await query('SELECT vip_status, vip_expires_at FROM users WHERE id = $1', [req.user.id]);
    const user = userResult.rows[0];
    
    if (!user || user.vip_status !== 'vip' || (user.vip_expires_at && moment(user.vip_expires_at).isBefore(moment()))) {
      return res.status(403).json({ error: 'VIP access required' });
    }
    
    const signalsResult = await query('SELECT * FROM signals WHERE signal_type = $1 AND status = $2 ORDER BY published_at DESC', 
      ['vip', 'active']);
    res.json(signalsResult.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// VIP code redemption
app.post('/api/redeem-code', authenticateToken, async (req, res) => {
  const { code } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: 'Code required' });
  }
  
  try {
    const vipCodeResult = await query('SELECT * FROM vip_codes WHERE code = $1 AND is_used = false', [code]);
    const vipCode = vipCodeResult.rows[0];

    if (!vipCode) {
      return res.status(404).json({ error: 'Invalid or expired code' });
    }
    
    // Check if code has expired
    if (vipCode.expires_at && moment(vipCode.expires_at).isBefore(moment())) {
      return res.status(400).json({ error: 'Code has expired' });
    }
    
    // Get user's current VIP status
    const userResult = await query('SELECT vip_expires_at FROM users WHERE id = $1', [req.user.id]);
    const user = userResult.rows[0];
    
    let newExpiry;
    if (user.vip_expires_at && moment(user.vip_expires_at).isAfter(moment())) {
      // Extend existing VIP
      newExpiry = moment(user.vip_expires_at).add(vipCode.duration_days, 'days');
    } else {
      // New VIP or expired VIP
      newExpiry = moment().add(vipCode.duration_days, 'days');
    }
    
    // Update user VIP status
    await query('UPDATE users SET vip_status = $1, vip_expires_at = $2 WHERE id = $3', 
      ['vip', newExpiry.format('YYYY-MM-DD HH:mm:ss'), req.user.id]);
    
    // Mark code as used
    await query('UPDATE vip_codes SET is_used = true, used_by = $1, used_at = CURRENT_TIMESTAMP WHERE id = $2', 
      [req.user.id, vipCode.id]);
    
    res.json({ 
      message: 'VIP activated successfully',
      expiresAt: newExpiry.format('YYYY-MM-DD HH:mm:ss')
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// Admin routes
app.get('/api/admin/signals', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await query('SELECT * FROM signals ORDER BY created_at DESC', []);
    res.json(result.rows);
  } catch (err) {
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
    return res.status(500).json({ error: 'Failed to create signal' });
  }
});

app.put('/api/admin/signals/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { pair, entry_price, target_1, target_2, target_3, stop_loss, signal_type, status, description } = req.body;
  
  try {
    await query(`UPDATE signals SET pair = $1, entry_price = $2, target_1 = $3, target_2 = $4, target_3 = $5, 
            stop_loss = $6, signal_type = $7, status = $8, description = $9, updated_at = CURRENT_TIMESTAMP
            WHERE id = $10`,
      [pair, entry_price, target_1, target_2, target_3, stop_loss, signal_type, status, description, id]);
    res.json({ message: 'Signal updated successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update signal' });
  }
});

app.delete('/api/admin/signals/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  
  try {
    await query('DELETE FROM signals WHERE id = $1', [id]);
    res.json({ message: 'Signal deleted successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete signal' });
  }
});

// VIP codes management
app.get('/api/admin/vip-codes', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await query(`SELECT vc.*, u.email as used_by_email 
            FROM vip_codes vc 
            LEFT JOIN users u ON vc.used_by = u.id 
            ORDER BY vc.created_at DESC`, []);
    res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch VIP codes' });
  }
});

app.post('/api/admin/vip-codes', authenticateToken, requireAdmin, async (req, res) => {
  const { duration_days, quantity = 1 } = req.body;
  
  if (!duration_days || duration_days <= 0) {
    return res.status(400).json({ error: 'Valid duration in days required' });
  }
  
  const expires_at = moment().add(30, 'days').format('YYYY-MM-DD HH:mm:ss'); // Codes expire in 30 days
  const codes = [];
  
  try {
    for (let i = 0; i < quantity; i++) {
      const code = uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase();
      
      await query('INSERT INTO vip_codes (code, duration_days, expires_at) VALUES ($1, $2, $3)',
        [code, duration_days, expires_at]);
      codes.push(code);
    }
    
    res.status(201).json({ 
      message: `${quantity} VIP code(s) generated successfully`,
      codes: codes
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate VIP codes' });
  }
});

// Settings
app.get('/api/admin/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await query('SELECT * FROM settings', []);
    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });
    res.json(settings);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.put('/api/admin/settings', authenticateToken, requireAdmin, async (req, res) => {
  const { vip_price } = req.body;
  
  if (vip_price !== undefined) {
    try {
      await query('INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP',
        ['vip_price', vip_price]);
      res.json({ message: 'Settings updated successfully' });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update settings' });
    }
  } else {
    res.status(400).json({ error: 'No valid settings provided' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Trading Signals Platform running on port ${PORT}`);
  console.log(`📊 Admin login: admin@tradingsignals.com / admin123`);
});

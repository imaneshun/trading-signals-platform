const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Database setup
const isProduction = process.env.NODE_ENV === 'production';
const db = isProduction ? null : new sqlite3.Database('./trading_signals.db');
const pool = isProduction ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
}) : null;

// Initialize database tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT 0,
    vip_status TEXT DEFAULT 'free',
    vip_expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Signals table
  db.run(`CREATE TABLE IF NOT EXISTS signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pair TEXT NOT NULL,
    entry_price REAL NOT NULL,
    target_1 REAL,
    target_2 REAL,
    target_3 REAL,
    stop_loss REAL NOT NULL,
    signal_type TEXT DEFAULT 'free',
    status TEXT DEFAULT 'active',
    description TEXT,
    published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    scheduled_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // VIP codes table
  db.run(`CREATE TABLE IF NOT EXISTS vip_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    duration_days INTEGER NOT NULL,
    is_used BOOLEAN DEFAULT 0,
    used_by INTEGER,
    used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    FOREIGN KEY (used_by) REFERENCES users (id)
  )`);

  // Settings table for admin configurations
  db.run(`CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Insert default admin user (password: admin123)
  const adminPassword = bcrypt.hashSync('admin123', 10);
  db.run(`INSERT OR IGNORE INTO users (email, password, is_admin) VALUES (?, ?, ?)`, 
    ['admin@tradingsignals.com', adminPassword, 1]);

  // Insert default VIP price setting
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`, 
    ['vip_price', '29.99']);

  // Insert some sample signals
  const sampleSignals = [
    ['BTC/USDT', 45000, 46500, 48000, 50000, 43500, 'free', 'active', 'Strong bullish momentum expected'],
    ['ETH/USDT', 3200, 3350, 3500, 3700, 3050, 'free', 'active', 'Breaking resistance level'],
    ['ADA/USDT', 0.45, 0.48, 0.52, 0.56, 0.42, 'vip', 'active', 'VIP exclusive signal - High probability setup'],
  ];

  sampleSignals.forEach(signal => {
    db.run(`INSERT OR IGNORE INTO signals (pair, entry_price, target_1, target_2, target_3, stop_loss, signal_type, status, description) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, signal);
  });
});

// Middleware
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
app.use(limiter);

// JWT middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Admin middleware
const requireAdmin = (req, res, next) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Routes

// Authentication routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run('INSERT INTO users (email, password) VALUES (?, ?)', 
      [email, hashedPassword], 
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Email already exists' });
          }
          return res.status(500).json({ error: 'Registration failed' });
        }
        
        const token = jwt.sign(
          { id: this.lastID, email, is_admin: false }, 
          JWT_SECRET, 
          { expiresIn: '7d' }
        );
        
        res.json({ token, user: { id: this.lastID, email, is_admin: false } });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Server error' });
    }
    
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, is_admin: user.is_admin }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );
    
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        email: user.email, 
        is_admin: user.is_admin,
        vip_status: user.vip_status,
        vip_expires_at: user.vip_expires_at
      } 
    });
  });
});

// Signals routes
app.get('/api/signals', (req, res) => {
  const { type = 'all' } = req.query;
  let query = 'SELECT * FROM signals WHERE status = "active"';
  
  if (type === 'free') {
    query += ' AND signal_type = "free"';
  }
  
  query += ' ORDER BY published_at DESC';
  
  db.all(query, [], (err, signals) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch signals' });
    }
    
    // Filter VIP signals for non-VIP users
    const filteredSignals = signals.filter(signal => {
      if (signal.signal_type === 'vip') {
        // Check if user has VIP access (implement this logic)
        return false; // For now, hide VIP signals from public endpoint
      }
      return true;
    });
    
    res.json(filteredSignals);
  });
});

app.get('/api/signals/vip', authenticateToken, (req, res) => {
  // Check if user has VIP access
  db.get('SELECT vip_status, vip_expires_at FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Server error' });
    }
    
    if (user.vip_status !== 'vip' || (user.vip_expires_at && moment(user.vip_expires_at).isBefore(moment()))) {
      return res.status(403).json({ error: 'VIP access required' });
    }
    
    db.all('SELECT * FROM signals WHERE signal_type = "vip" AND status = "active" ORDER BY published_at DESC', 
      [], (err, signals) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to fetch VIP signals' });
        }
        res.json(signals);
      });
  });
});

// VIP code redemption
app.post('/api/redeem-code', authenticateToken, (req, res) => {
  const { code } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: 'Code required' });
  }
  
  db.get('SELECT * FROM vip_codes WHERE code = ? AND is_used = 0', [code], (err, vipCode) => {
    if (err) {
      return res.status(500).json({ error: 'Server error' });
    }
    
    if (!vipCode) {
      return res.status(400).json({ error: 'Invalid or already used code' });
    }
    
    // Check if code has expired
    if (vipCode.expires_at && moment(vipCode.expires_at).isBefore(moment())) {
      return res.status(400).json({ error: 'Code has expired' });
    }
    
    // Calculate new VIP expiry date
    const currentVipExpiry = moment();
    db.get('SELECT vip_expires_at FROM users WHERE id = ?', [req.user.id], (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Server error' });
      }
      
      let newExpiry;
      if (user.vip_expires_at && moment(user.vip_expires_at).isAfter(moment())) {
        // Extend existing VIP
        newExpiry = moment(user.vip_expires_at).add(vipCode.duration_days, 'days');
      } else {
        // New VIP subscription
        newExpiry = moment().add(vipCode.duration_days, 'days');
      }
      
      // Update user VIP status
      db.run('UPDATE users SET vip_status = "vip", vip_expires_at = ? WHERE id = ?', 
        [newExpiry.format('YYYY-MM-DD HH:mm:ss'), req.user.id], (err) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to activate VIP' });
          }
          
          // Mark code as used
          db.run('UPDATE vip_codes SET is_used = 1, used_by = ?, used_at = CURRENT_TIMESTAMP WHERE id = ?', 
            [req.user.id, vipCode.id], (err) => {
              if (err) {
                console.error('Failed to mark code as used:', err);
              }
              
              res.json({ 
                message: 'VIP access activated successfully',
                vip_expires_at: newExpiry.format('YYYY-MM-DD HH:mm:ss')
              });
            });
        });
    });
  });
});

// Admin routes
app.get('/api/admin/signals', authenticateToken, requireAdmin, (req, res) => {
  db.all('SELECT * FROM signals ORDER BY created_at DESC', [], (err, signals) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch signals' });
    }
    res.json(signals);
  });
});

app.post('/api/admin/signals', authenticateToken, requireAdmin, (req, res) => {
  const { pair, entry_price, target_1, target_2, target_3, stop_loss, signal_type, description, scheduled_at } = req.body;
  
  if (!pair || !entry_price || !stop_loss) {
    return res.status(400).json({ error: 'Pair, entry price, and stop loss are required' });
  }
  
  const publishedAt = scheduled_at ? null : new Date().toISOString();
  
  db.run(`INSERT INTO signals (pair, entry_price, target_1, target_2, target_3, stop_loss, signal_type, description, published_at, scheduled_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [pair, entry_price, target_1, target_2, target_3, stop_loss, signal_type || 'free', description, publishedAt, scheduled_at],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to create signal' });
      }
      res.json({ id: this.lastID, message: 'Signal created successfully' });
    });
});

app.put('/api/admin/signals/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { pair, entry_price, target_1, target_2, target_3, stop_loss, signal_type, status, description } = req.body;
  
  db.run(`UPDATE signals SET pair = ?, entry_price = ?, target_1 = ?, target_2 = ?, target_3 = ?, 
          stop_loss = ?, signal_type = ?, status = ?, description = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
    [pair, entry_price, target_1, target_2, target_3, stop_loss, signal_type, status, description, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update signal' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Signal not found' });
      }
      res.json({ message: 'Signal updated successfully' });
    });
});

app.delete('/api/admin/signals/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM signals WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete signal' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Signal not found' });
    }
    res.json({ message: 'Signal deleted successfully' });
  });
});

// VIP codes management
app.get('/api/admin/vip-codes', authenticateToken, requireAdmin, (req, res) => {
  db.all(`SELECT vc.*, u.email as used_by_email 
          FROM vip_codes vc 
          LEFT JOIN users u ON vc.used_by = u.id 
          ORDER BY vc.created_at DESC`, [], (err, codes) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch VIP codes' });
    }
    res.json(codes);
  });
});

app.post('/api/admin/vip-codes', authenticateToken, requireAdmin, (req, res) => {
  const { duration_days, quantity = 1, expires_at } = req.body;
  
  if (!duration_days) {
    return res.status(400).json({ error: 'Duration in days is required' });
  }
  
  const codes = [];
  let completed = 0;
  
  for (let i = 0; i < quantity; i++) {
    const code = uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase();
    
    db.run('INSERT INTO vip_codes (code, duration_days, expires_at) VALUES (?, ?, ?)',
      [code, duration_days, expires_at],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to generate VIP codes' });
        }
        
        codes.push({ id: this.lastID, code, duration_days, expires_at });
        completed++;
        
        if (completed === quantity) {
          res.json({ codes, message: `${quantity} VIP code(s) generated successfully` });
        }
      });
  }
});

// Settings
app.get('/api/admin/settings', authenticateToken, requireAdmin, (req, res) => {
  db.all('SELECT * FROM settings', [], (err, settings) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch settings' });
    }
    
    const settingsObj = {};
    settings.forEach(setting => {
      settingsObj[setting.key] = setting.value;
    });
    
    res.json(settingsObj);
  });
});

app.put('/api/admin/settings', authenticateToken, requireAdmin, (req, res) => {
  const { vip_price } = req.body;
  
  if (vip_price !== undefined) {
    db.run('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
      ['vip_price', vip_price],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to update settings' });
        }
        res.json({ message: 'Settings updated successfully' });
      });
  } else {
    res.status(400).json({ error: 'No valid settings provided' });
  }
});

// Serve static files and handle SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`🚀 Trading Signals Platform running on port ${PORT}`);
  console.log(`📊 Admin login: admin@tradingsignals.com / admin123`);
});

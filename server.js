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
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/vip', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'vip.html'));
});

app.get('/investment', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'investment.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

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

// VIP activation endpoint
app.post('/api/vip/activate', async (req, res) => {
  try {
    const { vipCode, email, password } = req.body;

    if (!vipCode || !email || !password) {
      return res.status(400).json({ error: 'VIP code, email, and password are required' });
    }

    // Check if VIP code exists and is not used
    const codeResult = await query('SELECT * FROM vip_codes WHERE code = $1 AND is_used = FALSE', [vipCode]);
    const codes = codeResult.rows || codeResult || [];
    
    if (codes.length === 0) {
      return res.status(400).json({ error: 'Invalid or already used VIP code' });
    }

    const vipCodeData = codes[0];

    // Check if user exists
    let userResult = await query('SELECT * FROM users WHERE email = $1', [email]);
    let users = userResult.rows || userResult || [];
    let user;

    if (users.length === 0) {
      // Create new user
      const hashedPassword = await bcrypt.hash(password, 12);
      const vipExpiresAt = moment().add(vipCodeData.duration_days, 'days').format('YYYY-MM-DD HH:mm:ss');
      
      const newUserResult = await query(`
        INSERT INTO users (email, password, user_type, vip_expires_at, created_at) 
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) 
        RETURNING *`,
        [email, hashedPassword, 'vip', vipExpiresAt]);
      
      const newUsers = newUserResult.rows || newUserResult || [];
      user = newUsers[0];
    } else {
      // Update existing user
      user = users[0];
      const isValidPassword = await bcrypt.compare(password, user.password);
      
      if (!isValidPassword) {
        return res.status(400).json({ error: 'Invalid password' });
      }

      const vipExpiresAt = moment().add(vipCodeData.duration_days, 'days').format('YYYY-MM-DD HH:mm:ss');
      
      await query(`
        UPDATE users SET user_type = $1, vip_expires_at = $2, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $3`,
        ['vip', vipExpiresAt, user.id]);
      
      user.user_type = 'vip';
      user.vip_expires_at = vipExpiresAt;
    }

    // Mark VIP code as used
    await query(`
      UPDATE vip_codes SET is_used = TRUE, used_by = $1, used_at = CURRENT_TIMESTAMP 
      WHERE code = $2`,
      [user.id, vipCode]);

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        isAdmin: user.isAdmin || false,
        userType: user.user_type 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'VIP access activated successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        user_type: user.user_type,
        vip_expires_at: user.vip_expires_at,
        isAdmin: user.isAdmin || false
      }
    });

  } catch (err) {
    console.error('VIP activation error:', err);
    return res.status(500).json({ error: 'Failed to activate VIP access' });
  }
});

// Investment creation endpoint
app.post('/api/investment/create', async (req, res) => {
  try {
    console.log('Investment creation request:', req.body);
    const { email, password, amount, paymentMethod } = req.body;

    if (!email || !password || !amount || !paymentMethod) {
      console.log('Missing required fields');
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (amount < 100) {
      console.log('Amount too low:', amount);
      return res.status(400).json({ error: 'Minimum investment amount is 100 USDT' });
    }

    // Check if user exists
    let userResult = await query('SELECT * FROM users WHERE email = $1', [email]);
    let users = userResult.rows || userResult || [];
    let user;

    if (users.length === 0) {
      // Create new user
      const hashedPassword = await bcrypt.hash(password, 12);
      
      const newUserResult = await query(`
        INSERT INTO users (email, password, user_type, created_at) 
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP) 
        RETURNING *`,
        [email, hashedPassword, 'investor']);
      
      const newUsers = newUserResult.rows || newUserResult || [];
      user = newUsers[0];
    } else {
      // Update existing user
      user = users[0];
      const isValidPassword = await bcrypt.compare(password, user.password);
      
      if (!isValidPassword) {
        return res.status(400).json({ error: 'Invalid password' });
      }

      await query(`
        UPDATE users SET user_type = $1, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $2`,
        ['investor', user.id]);
      
      user.user_type = 'investor';
    }

    // Get investment rate from settings
    const rateResult = await query('SELECT value FROM settings WHERE key = $1', ['investment_rate']);
    const rates = rateResult.rows || rateResult || [];
    const investmentRate = rates.length > 0 ? parseFloat(rates[0].value) : 5.0;

    // Create investment record
    await query(`
      INSERT INTO investments (user_id, amount, profit_rate, payment_method, status, start_date, created_at) 
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [user.id, amount, investmentRate, paymentMethod, 'pending']);

    // Get wallet address for the payment method
    const walletKey = `${paymentMethod.toLowerCase()}_address`;
    console.log('Looking for wallet key:', walletKey);
    const walletResult = await query('SELECT value FROM settings WHERE key = $1', [walletKey]);
    const walletRows = walletResult.rows || walletResult || [];
    console.log('Wallet query result:', walletRows);
    
    if (walletRows.length === 0 || !walletRows[0].value) {
      console.log(`Wallet address not found for ${paymentMethod}`);
      return res.status(400).json({ error: `${paymentMethod} wallet address not configured. Please contact admin.` });
    }

    const paymentInfo = {
      method: paymentMethod,
      address: walletRows[0].value,
      amount: amount
    };

    // Get contact info
    const contactResult = await query('SELECT key, value FROM settings WHERE key IN ($1, $2)', ['contact_method', 'contact_value']);
    const contactRows = contactResult.rows || contactResult || [];
    const contactSettings = {};
    contactRows.forEach(row => {
      contactSettings[row.key] = row.value;
    });

    const contactInfo = {
      method: contactSettings.contact_method || 'telegram',
      value: contactSettings.contact_value || '@tradingsignals'
    };

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        isAdmin: user.isAdmin || false,
        userType: user.user_type 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Investment account created successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        user_type: user.user_type,
        isAdmin: user.isAdmin || false
      },
      paymentInfo,
      contactInfo
    });

    console.log('Investment created successfully, returning response');
    console.log('Payment info:', paymentInfo);
    console.log('Contact info:', contactInfo);

  } catch (err) {
    console.error('Investment creation error:', err);
    return res.status(500).json({ error: 'Failed to create investment' });
  }
});

// Auth routes
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
    const user = result.rows ? result.rows[0] : result[0];
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

// Signals routes
app.get('/api/signals', async (req, res) => {
  try {
    console.log('Fetching signals...');
    const result = await query('SELECT * FROM signals WHERE status = $1 AND signal_type = $2 ORDER BY published_at DESC NULLS LAST', ['active', 'free']);
    const signals = result.rows || result || [];
    console.log('Signals fetched:', signals.length);
    res.json(signals);
  } catch (err) {
    console.error('Signals error:', err);
    return res.status(500).json({ error: 'Failed to fetch signals' });
  }
});

app.get('/api/signals/vip', authenticateToken, async (req, res) => {
  try {
    const userResult = await query('SELECT vip_status, vip_expires_at FROM users WHERE id = $1', [req.user.id]);
    const user = (userResult.rows || userResult)[0];
    if (!user || user.vip_status !== 'vip' || (user.vip_expires_at && moment(user.vip_expires_at).isBefore(moment()))) {
      return res.status(403).json({ error: 'VIP access required' });
    }
    const signalsResult = await query('SELECT * FROM signals WHERE signal_type = $1 AND status = $2 ORDER BY published_at DESC NULLS LAST', ['vip', 'active']);
    const signals = signalsResult.rows || signalsResult || [];
    res.json(signals);
  } catch (err) {
    console.error('VIP signals error:', err);
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
    const vipCode = (vipCodeResult.rows || vipCodeResult)[0];
    if (!vipCode) {
      return res.status(404).json({ error: 'Invalid or expired code' });
    }
    if (vipCode.expires_at && moment(vipCode.expires_at).isBefore(moment())) {
      return res.status(400).json({ error: 'Code has expired' });
    }
    const userResult = await query('SELECT vip_expires_at FROM users WHERE id = $1', [req.user.id]);
    const user = (userResult.rows || userResult)[0];
    let newExpiry;
    if (user.vip_expires_at && moment(user.vip_expires_at).isAfter(moment())) {
      newExpiry = moment(user.vip_expires_at).add(vipCode.duration_days, 'days');
    } else {
      newExpiry = moment().add(vipCode.duration_days, 'days');
    }
    await query('UPDATE users SET vip_status = $1, vip_expires_at = $2 WHERE id = $3', 
      ['vip', newExpiry.format('YYYY-MM-DD HH:mm:ss'), req.user.id]);
    await query('UPDATE vip_codes SET is_used = true, used_by = $1, used_at = CURRENT_TIMESTAMP WHERE id = $2', 
      [req.user.id, vipCode.id]);
    res.json({ 
      message: 'VIP activated successfully',
      expiresAt: newExpiry.format('YYYY-MM-DD HH:mm:ss')
    });
  } catch (err) {
    console.error('VIP redemption error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Admin routes
app.get('/api/admin/signals', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await query('SELECT * FROM signals ORDER BY created_at DESC NULLS LAST', []);
    const signals = result.rows || result || [];
    res.json(signals);
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
    console.error('Update signal error:', err);
    return res.status(500).json({ error: 'Failed to update signal' });
  }
});

app.delete('/api/admin/signals/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await query('DELETE FROM signals WHERE id = $1', [id]);
    res.json({ message: 'Signal deleted successfully' });
  } catch (err) {
    console.error('Delete signal error:', err);
    return res.status(500).json({ error: 'Failed to delete signal' });
  }
});

// VIP codes management
app.get('/api/admin/vip-codes', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await query(`SELECT vc.*, u.email as used_by_email 
            FROM vip_codes vc 
            LEFT JOIN users u ON vc.used_by = u.id 
            ORDER BY vc.created_at DESC NULLS LAST`, []);
    const codes = result.rows || result || [];
    res.json(codes);
  } catch (err) {
    console.error('VIP codes error:', err);
    return res.status(500).json({ error: 'Failed to fetch VIP codes' });
  }
});

app.post('/api/admin/vip-codes', authenticateToken, requireAdmin, async (req, res) => {
  const { duration_days, quantity = 1 } = req.body;
  if (!duration_days || duration_days <= 0) {
    return res.status(400).json({ error: 'Valid duration in days required' });
  }
  const expires_at = moment().add(30, 'days').format('YYYY-MM-DD HH:mm:ss');
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
    console.error('Generate VIP codes error:', err);
    return res.status(500).json({ error: 'Failed to generate VIP codes' });
  }
});

// Admin wallet addresses endpoint
app.put('/api/admin/wallets', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { btc_address, eth_address, usdt_address, bnb_address, ton_address } = req.body;
    console.log('Received wallet update:', req.body);
    
    const walletUpdates = {
      btc_address,
      eth_address, 
      usdt_address,
      bnb_address,
      ton_address
    };
    
    for (const [key, value] of Object.entries(walletUpdates)) {
      if (value !== undefined && value !== null && value !== '') {
        console.log(`Updating wallet: ${key} = ${value}`);
        await query(`
          INSERT INTO settings (key, value, updated_at) 
          VALUES ($1, $2, CURRENT_TIMESTAMP)
          ON CONFLICT (key) 
          DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
          [key, value.toString()]);
      }
    }
    
    res.json({ message: 'Wallet addresses updated successfully' });
  } catch (err) {
    console.error('Wallet update error:', err);
    return res.status(500).json({ error: 'Failed to update wallet addresses' });
  }
});

// Admin password change endpoint
app.put('/api/admin/change-password', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    
    // Get current user
    const userResult = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const users = userResult.rows || userResult || [];
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = users[0];
    
    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    
    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    
    // Update password
    await query('UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', 
      [hashedNewPassword, req.user.id]);
    
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Password change error:', err);
    return res.status(500).json({ error: 'Failed to change password' });
  }
});

// User password change endpoint
app.put('/api/user/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    
    // Get current user
    const userResult = await query('SELECT * FROM users WHERE id = $1', [req.user.userId || req.user.id]);
    const users = userResult.rows || userResult || [];
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = users[0];
    
    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    
    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    
    // Update password
    await query('UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', 
      [hashedNewPassword, req.user.userId || req.user.id]);
    
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('User password change error:', err);
    return res.status(500).json({ error: 'Failed to change password' });
  }
});

// Settings
app.get('/api/admin/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await query('SELECT * FROM settings', []);
    const settings = {};
    const rows = result.rows || result || [];
    rows.forEach(row => {
      settings[row.key] = row.value;
    });
    res.json(settings);
  } catch (err) {
    console.error('Settings error:', err);
    return res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.put('/api/admin/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const updates = req.body;
    console.log('Received settings update:', updates);
    
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && value !== null) {
        console.log(`Updating setting: ${key} = ${value}`);
        await query(`
          INSERT INTO settings (key, value, updated_at) 
          VALUES ($1, $2, CURRENT_TIMESTAMP)
          ON CONFLICT (key) 
          DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
          [key, value.toString()]);
      }
    }
    
    res.json({ message: 'Settings updated successfully' });
  } catch (err) {
    console.error('Settings update error:', err);
    return res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Get contact info for public display
app.get('/api/settings/contact', async (req, res) => {
  try {
    const result = await query('SELECT key, value FROM settings WHERE key IN ($1, $2)', ['contact_method', 'contact_value']);
    const settings = {};
    const rows = result.rows || result || [];
    rows.forEach(row => {
      settings[row.key] = row.value;
    });
    
    res.json({
      method: settings.contact_method || 'telegram',
      value: settings.contact_value || '@tradingsignals'
    });
  } catch (err) {
    console.error('Contact settings error:', err);
    return res.status(500).json({ error: 'Failed to fetch contact info' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Trading Signals Platform running on port ${PORT}`);
  console.log(`📊 Admin login: admin@tradingsignals.com / admin123`);
});

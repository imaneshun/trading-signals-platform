// Database abstraction layer for SQLite (development) and PostgreSQL (production)
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';

// Database connection
const db = isProduction ? null : new sqlite3.Database('./trading_signals.db');
const pool = isProduction ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
}) : null;

// Database query wrapper
const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    if (isProduction) {
      // PostgreSQL
      pool.query(sql, params, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result.rows);
        }
      });
    } else {
      // SQLite
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      } else {
        db.run(sql, params, function(err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes });
        });
      }
    }
  });
};

// Initialize database tables
const initializeDatabase = async () => {
  try {
    // Convert SQLite syntax to PostgreSQL for production
    const userTableSQL = isProduction ? `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        user_type VARCHAR(50) DEFAULT 'free',
        vip_status VARCHAR(50) DEFAULT 'free',
        vip_expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    ` : `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        is_admin BOOLEAN DEFAULT 0,
        user_type TEXT DEFAULT 'free',
        vip_status TEXT DEFAULT 'free',
        vip_expires_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const signalsTableSQL = isProduction ? `
      CREATE TABLE IF NOT EXISTS signals (
        id SERIAL PRIMARY KEY,
        pair VARCHAR(50) NOT NULL,
        entry_price DECIMAL(20,8) NOT NULL,
        target_1 DECIMAL(20,8),
        target_2 DECIMAL(20,8),
        target_3 DECIMAL(20,8),
        stop_loss DECIMAL(20,8) NOT NULL,
        signal_type VARCHAR(50) DEFAULT 'free',
        status VARCHAR(50) DEFAULT 'active',
        description TEXT,
        published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        scheduled_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    ` : `
      CREATE TABLE IF NOT EXISTS signals (
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
      )
    `;

    const vipCodesTableSQL = isProduction ? `
      CREATE TABLE IF NOT EXISTS vip_codes (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        duration_days INTEGER NOT NULL,
        is_used BOOLEAN DEFAULT FALSE,
        used_by INTEGER,
        used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        FOREIGN KEY (used_by) REFERENCES users (id)
      )
    ` : `
      CREATE TABLE IF NOT EXISTS vip_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        duration_days INTEGER NOT NULL,
        is_used BOOLEAN DEFAULT 0,
        used_by INTEGER,
        used_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        FOREIGN KEY (used_by) REFERENCES users (id)
      )
    `;

    const settingsTableSQL = isProduction ? `
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    ` : `
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create tables
    await query(userTableSQL);
    await query(signalsTableSQL);
    await query(vipCodesTableSQL);
    await query(settingsTableSQL);

    // Add investments table
    const investmentsTableSQL = isProduction ? `
      CREATE TABLE IF NOT EXISTS investments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        amount DECIMAL(20,2) NOT NULL,
        profit_rate DECIMAL(5,2) DEFAULT 5.0,
        payment_method VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    ` : `
      CREATE TABLE IF NOT EXISTS investments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        profit_rate REAL DEFAULT 5.0,
        payment_method TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        start_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `;
    
    await query(investmentsTableSQL);

    // Add missing user_type column to existing users table if it doesn't exist
    if (!isProduction) {
      try {
        await query('ALTER TABLE users ADD COLUMN user_type TEXT DEFAULT "free"');
      } catch (err) {
        // Column might already exist, ignore error
        console.log('user_type column already exists or error adding it:', err.message);
      }
    }

    // Insert default data only if tables are empty
    const bcrypt = require('bcryptjs');
    
    // Check if admin user exists
    const adminExists = await query('SELECT id FROM users WHERE email = $1', ['admin@tradingsignals.com']);
    if (adminExists.length === 0) {
      const adminPassword = bcrypt.hashSync('admin123', 10);
      await query(
        'INSERT INTO users (email, password, is_admin) VALUES ($1, $2, $3)',
        ['admin@tradingsignals.com', adminPassword, true]
      );
    }

    // Check if settings exist
    const settingsExist = await query('SELECT id FROM settings WHERE key = $1', ['vip_price']);
    if (settingsExist.length === 0) {
      await query(
        'INSERT INTO settings (key, value) VALUES ($1, $2)',
        ['vip_price', '29.99']
      );
    }

    // Insert sample signals if none exist
    const signalsExist = await query('SELECT id FROM signals LIMIT 1');
    if (signalsExist.length === 0) {
      const sampleSignals = [
        ['BTC/USDT', 45000, 46500, 48000, 50000, 43500, 'free', 'active', 'Strong bullish momentum expected'],
        ['ETH/USDT', 3200, 3350, 3500, 3700, 3050, 'free', 'active', 'Breaking resistance level'],
        ['ADA/USDT', 0.45, 0.48, 0.52, 0.56, 0.42, 'vip', 'active', 'VIP exclusive signal - High probability setup'],
      ];

      for (const signal of sampleSignals) {
        await query(
          'INSERT INTO signals (pair, entry_price, target_1, target_2, target_3, stop_loss, signal_type, status, description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
          signal
        );
      }
    }

    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
  }
};

module.exports = {
  query,
  initializeDatabase,
  isProduction
};

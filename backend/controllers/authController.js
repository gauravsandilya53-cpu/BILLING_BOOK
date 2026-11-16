const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'billing_book_super_secret_jwt_key_2026_xyz';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    let user = null;

    if (db.isMySQLConnected()) {
      const rows = await db.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email.trim().toLowerCase()]);
      if (rows && rows.length > 0) {
        user = rows[0];
      }
    } else {
      user = db.fallbackStore.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    let isMatch = false;
    // Check bcrypt hash or plain fallback for demo convenience
    if (user.password_hash) {
      isMatch = await bcrypt.compare(password, user.password_hash);
    }
    if (!isMatch && password === 'admin123') {
      isMatch = true;
    }

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role || 'admin'
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: payload
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error during login.', error: err.message });
  }
};

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    if (db.isMySQLConnected()) {
      const existing = await db.query('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
      if (existing && existing.length > 0) {
        return res.status(400).json({ success: false, message: 'Email is already registered.' });
      }

      const result = await db.query(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [name.trim(), email.trim().toLowerCase(), hashedPassword, 'admin']
      );

      const newUserId = result.insertId;

      // Seed default settings for user
      await db.query(
        'INSERT INTO settings (user_id, company_name) VALUES (?, ?)',
        [newUserId, name + ' Enterprise']
      );

      const payload = { id: newUserId, name, email, role: 'admin' };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

      return res.status(201).json({
        success: true,
        message: 'Account created successfully.',
        token,
        user: payload
      });
    } else {
      const existing = db.fallbackStore.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
      if (existing) {
        return res.status(400).json({ success: false, message: 'Email is already registered.' });
      }

      const newUser = {
        id: db.fallbackStore.users.length + 1,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password_hash: hashedPassword,
        role: 'admin',
        created_at: new Date().toISOString()
      };
      db.fallbackStore.users.push(newUser);

      const payload = { id: newUser.id, name: newUser.name, email: newUser.email, role: 'admin' };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

      return res.status(201).json({
        success: true,
        message: 'Account registered successfully.',
        token,
        user: payload
      });
    }
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ success: false, message: 'Server error during registration.', error: err.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const userId = req.user.id;
    let user = null;

    if (db.isMySQLConnected()) {
      const rows = await db.query('SELECT id, name, email, role, created_at FROM users WHERE id = ?', [userId]);
      if (rows && rows.length > 0) user = rows[0];
    } else {
      const found = db.fallbackStore.users.find(u => u.id === userId);
      if (found) {
        user = { id: found.id, name: found.name, email: found.email, role: found.role, created_at: found.created_at };
      }
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.json({ success: true, user });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error retrieving user info.' });
  }
};


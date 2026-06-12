const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

// REGISTER
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, hashedPassword]
    );
    const token = jwt.sign({ id: newUser.rows[0].id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: newUser.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    // Prevent admin credentials from being used as user login
    if (email && email.toLowerCase() === (process.env.ADMIN_EMAIL || '').toLowerCase()) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }
    const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (user.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }
    const isMatch = await bcrypt.compare(password, user.rows[0].password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }
    const token = jwt.sign({ id: user.rows[0].id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.rows[0].id, name: user.rows[0].name, email: user.rows[0].email } });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// UPDATE EMAIL
router.put('/update-email', async (req, res) => {
  const { userId, newEmail } = req.body;
  try {
    const emailExists = await pool.query('SELECT * FROM users WHERE email = $1', [newEmail]);
    if (emailExists.rows.length > 0) {
      return res.status(400).json({ message: 'Email already in use' });
    }
    await pool.query('UPDATE users SET email = $1 WHERE id = $2', [newEmail, userId]);
    res.json({ message: 'Email updated successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET PROFILE
router.get('/profile/:id', async (req, res) => {
  try {
    const user = await pool.query('SELECT id, name, email, created_at FROM users WHERE id = $1', [req.params.id]);
    if (user.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json(user.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// SAVE ADDRESS
router.post('/address', async (req, res) => {
  const { user_id, full_name, phone, house, street, city, state, pincode } = req.body;
  try {
    const existing = await pool.query('SELECT * FROM addresses WHERE user_id = $1', [user_id]);
    if (existing.rows.length > 0) {
      await pool.query(
        'UPDATE addresses SET full_name=$1, phone=$2, house=$3, street=$4, city=$5, state=$6, pincode=$7 WHERE user_id=$8',
        [full_name, phone, house, street, city, state, pincode, user_id]
      );
    } else {
      await pool.query(
        'INSERT INTO addresses (user_id, full_name, phone, house, street, city, state, pincode) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [user_id, full_name, phone, house, street, city, state, pincode]
      );
    }
    res.json({ message: 'Address saved successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET ADDRESS
router.get('/address/:userId', async (req, res) => {
  try {
    const address = await pool.query('SELECT * FROM addresses WHERE user_id = $1', [req.params.userId]);
    res.json(address.rows[0] || null);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// ── Auth middleware ─────────────────────────────────────────────
function verifyAdmin(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.isAdmin) return res.status(403).json({ message: 'Admin access required' });
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}
// ───────────────────────────────────────────────────────────────

// ADMIN LOGIN (public — no middleware, password only)
router.post('/login', async (req, res) => {
  const { password } = req.body;
  try {
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const jwtSecret = process.env.JWT_SECRET || 'plantheaven_secret_key_2024';
    if (password !== adminPassword) {
      return res.status(401).json({ message: 'Invalid admin password' });
    }
    const token = jwt.sign({ isAdmin: true }, jwtSecret, { expiresIn: '1d' });
    res.json({ token, message: 'Admin logged in successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET DASHBOARD STATS
router.get('/stats', verifyAdmin, async (req, res) => {
  try {
    const totalProducts = await pool.query('SELECT COUNT(*) FROM products');
    const totalOrders = await pool.query('SELECT COUNT(*) FROM orders');
    const totalCustomers = await pool.query('SELECT COUNT(*) FROM users');
    const totalRevenue = await pool.query('SELECT SUM(total) FROM orders');
    const pendingOrders = await pool.query(
      "SELECT COUNT(*) FROM orders WHERE status != 'Delivered'"
    );

    res.json({
      totalProducts: parseInt(totalProducts.rows[0].count),
      totalOrders: parseInt(totalOrders.rows[0].count),
      totalCustomers: parseInt(totalCustomers.rows[0].count),
      totalRevenue: parseInt(totalRevenue.rows[0].sum) || 0,
      pendingOrders: parseInt(pendingOrders.rows[0].count)
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET ALL PRODUCTS (Admin — includes out-of-stock)
router.get('/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET ALL CUSTOMERS
router.get('/customers', verifyAdmin, async (req, res) => {
  try {
    const customers = await pool.query(
      `SELECT users.id, users.name, users.email, users.created_at,
      COUNT(orders.id) as total_orders,
      COALESCE(SUM(orders.total), 0) as total_spent
      FROM users
      LEFT JOIN orders ON users.id = orders.user_id
      GROUP BY users.id
      ORDER BY users.created_at DESC`
    );
    res.json(customers.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE CUSTOMER
router.delete('/customers/:userId', verifyAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM wishlist WHERE user_id = $1', [req.params.userId]);
    await pool.query('DELETE FROM cart WHERE user_id = $1', [req.params.userId]);
    await pool.query('DELETE FROM addresses WHERE user_id = $1', [req.params.userId]);
    await pool.query('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = $1)', [req.params.userId]);
    await pool.query('DELETE FROM orders WHERE user_id = $1', [req.params.userId]);
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.userId]);
    res.json({ message: 'Customer deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET ANNOUNCEMENT
router.get('/announcement', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM announcements LIMIT 1');
    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// SAVE ANNOUNCEMENT
router.post('/announcement', verifyAdmin, async (req, res) => {
  const { message, active } = req.body;
  try {
    const existing = await pool.query('SELECT * FROM announcements LIMIT 1');
    if (existing.rows.length > 0) {
      await pool.query(
        'UPDATE announcements SET message = $1, active = $2 WHERE id = $3',
        [message, active, existing.rows[0].id]
      );
    } else {
      await pool.query(
        'INSERT INTO announcements (message, active) VALUES ($1, $2)',
        [message, active]
      );
    }
    res.json({ message: 'Announcement saved' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
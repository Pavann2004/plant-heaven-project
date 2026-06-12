const express = require('express');
const router = express.Router();
const pool = require('../db');

// PLACE ORDER
router.post('/', async (req, res) => {
  const { user_id, total, payment_mode, address, items } = req.body;
  try {
    // Create order
    const newOrder = await pool.query(
      `INSERT INTO orders (user_id, total, payment_mode, address)
      VALUES ($1, $2, $3, $4) RETURNING *`,
      [user_id, total, payment_mode, address]
    );
    const orderId = newOrder.rows[0].id;

    // Add order items
    for (const item of items) {
      await pool.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price)
        VALUES ($1, $2, $3, $4)`,
        [orderId, item.product_id, item.quantity, item.price]
      );
    }

    // Clear cart after order
    await pool.query('DELETE FROM cart WHERE user_id = $1', [user_id]);

    res.status(201).json({
      message: 'Order placed successfully! 🌿',
      order: newOrder.rows[0]
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET ALL ORDERS FOR USER
router.get('/user/:userId', async (req, res) => {
  try {
    const orders = await pool.query(
      `SELECT orders.*, 
      json_agg(json_build_object(
        'product_id', order_items.product_id,
        'quantity', order_items.quantity,
        'price', order_items.price,
        'name', products.name,
        'image', products.image
      )) as items
      FROM orders
      JOIN order_items ON orders.id = order_items.order_id
      JOIN products ON order_items.product_id = products.id
      WHERE orders.user_id = $1
      GROUP BY orders.id
      ORDER BY orders.created_at DESC`,
      [req.params.userId]
    );
    res.json(orders.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET SINGLE ORDER (for tracking)
router.get('/:orderId', async (req, res) => {
  try {
    const order = await pool.query(
      `SELECT orders.*,
      json_agg(json_build_object(
        'product_id', order_items.product_id,
        'quantity', order_items.quantity,
        'price', order_items.price,
        'name', products.name,
        'image', products.image
      )) as items
      FROM orders
      JOIN order_items ON orders.id = order_items.order_id
      JOIN products ON order_items.product_id = products.id
      WHERE orders.id = $1
      GROUP BY orders.id`,
      [req.params.orderId]
    );
    if (order.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json(order.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// UPDATE ORDER STATUS (Admin)
router.patch('/:orderId/status', async (req, res) => {
  const { status } = req.body;
  try {
    const updated = await pool.query(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.orderId]
    );
    res.json(updated.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET ALL ORDERS (Admin)
router.get('/', async (req, res) => {
  try {
    const orders = await pool.query(
      `SELECT orders.*, users.name as customer_name, users.email as customer_email,
      json_agg(json_build_object(
        'product_id', order_items.product_id,
        'quantity', order_items.quantity,
        'price', order_items.price,
        'name', products.name
      )) as items
      FROM orders
      JOIN users ON orders.user_id = users.id
      JOIN order_items ON orders.id = order_items.order_id
      JOIN products ON order_items.product_id = products.id
      GROUP BY orders.id, users.name, users.email
      ORDER BY orders.created_at DESC`
    );
    res.json(orders.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
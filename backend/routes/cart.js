const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET CART
router.get('/:userId', async (req, res) => {
  try {
    const cart = await pool.query(
      `SELECT cart.id, cart.quantity, products.id as product_id,
      products.name, products.price, products.image
      FROM cart
      JOIN products ON cart.product_id = products.id
      WHERE cart.user_id = $1`,
      [req.params.userId]
    );
    res.json(cart.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ADD TO CART
router.post('/', async (req, res) => {
  const { user_id, product_id } = req.body;
  try {
    const existing = await pool.query(
      'SELECT * FROM cart WHERE user_id = $1 AND product_id = $2',
      [user_id, product_id]
    );
    if (existing.rows.length > 0) {
      const updated = await pool.query(
        'UPDATE cart SET quantity = quantity + 1 WHERE user_id = $1 AND product_id = $2 RETURNING *',
        [user_id, product_id]
      );
      return res.json(updated.rows[0]);
    }
    const newItem = await pool.query(
      'INSERT INTO cart (user_id, product_id, quantity) VALUES ($1, $2, 1) RETURNING *',
      [user_id, product_id]
    );
    res.status(201).json(newItem.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// INCREASE QUANTITY
router.patch('/increase/:cartId', async (req, res) => {
  try {
    const updated = await pool.query(
      'UPDATE cart SET quantity = quantity + 1 WHERE id = $1 RETURNING *',
      [req.params.cartId]
    );
    res.json(updated.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DECREASE QUANTITY
router.patch('/decrease/:cartId', async (req, res) => {
  try {
    const item = await pool.query('SELECT quantity FROM cart WHERE id = $1', [req.params.cartId]);
    if (item.rows[0].quantity <= 1) {
      await pool.query('DELETE FROM cart WHERE id = $1', [req.params.cartId]);
      return res.json({ message: 'Item removed from cart' });
    }
    const updated = await pool.query(
      'UPDATE cart SET quantity = quantity - 1 WHERE id = $1 RETURNING *',
      [req.params.cartId]
    );
    res.json(updated.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// REMOVE FROM CART
router.delete('/:cartId', async (req, res) => {
  try {
    await pool.query('DELETE FROM cart WHERE id = $1', [req.params.cartId]);
    res.json({ message: 'Item removed from cart' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// CLEAR CART (after order placed)
router.delete('/clear/:userId', async (req, res) => {
  try {
    await pool.query('DELETE FROM cart WHERE user_id = $1', [req.params.userId]);
    res.json({ message: 'Cart cleared' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
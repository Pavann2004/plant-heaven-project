const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET WISHLIST
router.get('/:userId', async (req, res) => {
  try {
    const wishlist = await pool.query(
      `SELECT wishlist.id, products.id as product_id,
      products.name, products.price, products.image,
      products.rating, products.reviews, products.tagline
      FROM wishlist
      JOIN products ON wishlist.product_id = products.id
      WHERE wishlist.user_id = $1`,
      [req.params.userId]
    );
    res.json(wishlist.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ADD TO WISHLIST
router.post('/', async (req, res) => {
  const { user_id, product_id } = req.body;
  try {
    const existing = await pool.query(
      'SELECT * FROM wishlist WHERE user_id = $1 AND product_id = $2',
      [user_id, product_id]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Already in wishlist' });
    }
    const newItem = await pool.query(
      'INSERT INTO wishlist (user_id, product_id) VALUES ($1, $2) RETURNING *',
      [user_id, product_id]
    );
    res.status(201).json(newItem.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// REMOVE FROM WISHLIST
router.delete('/', async (req, res) => {
  const { user_id, product_id } = req.body;
  try {
    await pool.query(
      'DELETE FROM wishlist WHERE user_id = $1 AND product_id = $2',
      [user_id, product_id]
    );
    res.json({ message: 'Removed from wishlist' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// CHECK IF IN WISHLIST
router.get('/check/:userId/:productId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM wishlist WHERE user_id = $1 AND product_id = $2',
      [req.params.userId, req.params.productId]
    );
    res.json({ inWishlist: result.rows.length > 0 });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
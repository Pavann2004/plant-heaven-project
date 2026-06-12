const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'PlantHeaven',
  user: 'postgres',
  password: '7892',
});

// GET ALL PRODUCTS
router.get('/', async (req, res) => {
  try {
    const products = await pool.query('SELECT * FROM products WHERE in_stock = true ORDER BY id');
    res.json(products.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET SINGLE PRODUCT
router.get('/:id', async (req, res) => {
  try {
    const product = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (product.rows.length === 0) return res.status(404).json({ message: 'Product not found' });
    res.json(product.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET PRODUCTS BY CATEGORY
router.get('/category/:category', async (req, res) => {
  try {
    const products = await pool.query(
      'SELECT * FROM products WHERE category = $1 AND in_stock = true',
      [req.params.category]
    );
    res.json(products.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// SEARCH PRODUCTS
router.get('/search/:query', async (req, res) => {
  try {
    const products = await pool.query(
      'SELECT * FROM products WHERE LOWER(name) LIKE $1 AND in_stock = true',
      [`%${req.params.query.toLowerCase()}%`]
    );
    res.json(products.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ADD PRODUCT (Admin)
router.post('/', async (req, res) => {
  const { name, price, image, category, tagline, description, sunlight, watering,
    temperature, pot_size, difficulty, pruning, humidity, pet_safe, rating, reviews } = req.body;
  try {
    const newProduct = await pool.query(
      `INSERT INTO products (name, price, image, category, tagline, description, sunlight,
      watering, temperature, pot_size, difficulty, pruning, humidity, pet_safe, rating, reviews)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [name, price, image, category, tagline, description, sunlight, watering,
        temperature, pot_size, difficulty, pruning, humidity, pet_safe, rating, reviews]
    );
    res.status(201).json(newProduct.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// UPDATE PRODUCT (Admin)
router.put('/:id', async (req, res) => {
  const { name, price, image, category, tagline, description, sunlight, watering,
    temperature, pot_size, difficulty, pruning, humidity, pet_safe, rating, reviews, in_stock } = req.body;
  try {
    const updated = await pool.query(
      `UPDATE products SET name=$1, price=$2, image=$3, category=$4, tagline=$5,
      description=$6, sunlight=$7, watering=$8, temperature=$9, pot_size=$10,
      difficulty=$11, pruning=$12, humidity=$13, pet_safe=$14, rating=$15,
      reviews=$16, in_stock=$17 WHERE id=$18 RETURNING *`,
      [name, price, image, category, tagline, description, sunlight, watering,
        temperature, pot_size, difficulty, pruning, humidity, pet_safe, rating,
        reviews, in_stock, req.params.id]
    );
    res.json(updated.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE PRODUCT (Admin)
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// TOGGLE STOCK (Admin)
router.patch('/:id/stock', async (req, res) => {
  try {
    const product = await pool.query('SELECT in_stock FROM products WHERE id = $1', [req.params.id]);
    const newStock = !product.rows[0].in_stock;
    await pool.query('UPDATE products SET in_stock = $1 WHERE id = $2', [newStock, req.params.id]);
    res.json({ message: `Product ${newStock ? 'back in stock' : 'marked out of stock'}` });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
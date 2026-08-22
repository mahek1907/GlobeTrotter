const express = require('express');
const db = require('../db');
const router = express.Router();

// GET /api/cities?search=par&region=Europe
router.get('/', (req, res) => {
  const { search = '', region = '' } = req.query;
  let query = 'SELECT * FROM cities WHERE 1=1';
  const params = [];
  if (search) {
    query += ' AND (name LIKE ? OR country LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (region) {
    query += ' AND region = ?';
    params.push(region);
  }
  query += ' ORDER BY popularity DESC';
  const cities = db.prepare(query).all(...params);
  res.json({ cities });
});

router.get('/regions', (req, res) => {
  const regions = db.prepare('SELECT DISTINCT region FROM cities ORDER BY region').all().map(r => r.region);
  res.json({ regions });
});

router.get('/:id', (req, res) => {
  const city = db.prepare('SELECT * FROM cities WHERE id = ?').get(req.params.id);
  if (!city) return res.status(404).json({ error: 'City not found' });
  res.json({ city });
});

module.exports = router;

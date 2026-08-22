const express = require('express');
const db = require('../db');
const router = express.Router();

// GET /api/activities?city_id=..&type=food&maxCost=100&search=tour
router.get('/', (req, res) => {
  const { city_id = '', type = '', maxCost = '', search = '' } = req.query;
  let query = `SELECT a.*, c.name as city_name FROM activities a JOIN cities c ON a.city_id = c.id WHERE 1=1`;
  const params = [];
  if (city_id) { query += ' AND a.city_id = ?'; params.push(city_id); }
  if (type) { query += ' AND a.type = ?'; params.push(type); }
  if (maxCost) { query += ' AND a.cost <= ?'; params.push(Number(maxCost)); }
  if (search) { query += ' AND a.name LIKE ?'; params.push(`%${search}%`); }
  query += ' ORDER BY a.cost ASC';
  const activities = db.prepare(query).all(...params);
  res.json({ activities });
});

router.get('/types', (req, res) => {
  const types = db.prepare('SELECT DISTINCT type FROM activities ORDER BY type').all().map(r => r.type);
  res.json({ types });
});

module.exports = router;

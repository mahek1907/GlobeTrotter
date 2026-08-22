const express = require('express');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

function adminOnly(req, res, next) {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Admin access required' });
  next();
}

router.get('/stats', authRequired, adminOnly, (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  const totalTrips = db.prepare('SELECT COUNT(*) c FROM trips').get().c;
  const totalStops = db.prepare('SELECT COUNT(*) c FROM stops').get().c;
  const publicTrips = db.prepare('SELECT COUNT(*) c FROM trips WHERE is_public = 1').get().c;

  const topCities = db.prepare(`
    SELECT c.name, c.country, COUNT(s.id) as uses
    FROM stops s JOIN cities c ON s.city_id = c.id
    GROUP BY c.id ORDER BY uses DESC LIMIT 8
  `).all();

  const topActivityTypes = db.prepare(`
    SELECT a.type, COUNT(ta.id) as uses
    FROM trip_activities ta JOIN activities a ON ta.activity_id = a.id
    GROUP BY a.type ORDER BY uses DESC
  `).all();

  const tripsPerUser = db.prepare(`
    SELECT u.name, u.email, COUNT(t.id) as trip_count
    FROM users u LEFT JOIN trips t ON t.user_id = u.id
    GROUP BY u.id ORDER BY trip_count DESC LIMIT 10
  `).all();

  const recentTrips = db.prepare(`
    SELECT t.name, t.created_at, u.name as user_name
    FROM trips t JOIN users u ON t.user_id = u.id
    ORDER BY t.created_at DESC LIMIT 8
  `).all();

  res.json({ totalUsers, totalTrips, totalStops, publicTrips, topCities, topActivityTypes, tripsPerUser, recentTrips });
});

router.get('/users', authRequired, adminOnly, (req, res) => {
  const users = db.prepare('SELECT id, name, email, is_admin, created_at FROM users ORDER BY created_at DESC').all();
  res.json({ users });
});

module.exports = router;

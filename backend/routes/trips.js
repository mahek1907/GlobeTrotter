const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

function daysBetween(start, end) {
  if (!start || !end) return 1;
  const d = (new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24);
  return Math.max(1, Math.round(d) + 1);
}

// Build full nested trip object: trip -> stops -> city, activities
function getFullTrip(tripId) {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
  if (!trip) return null;
  const stops = db.prepare('SELECT * FROM stops WHERE trip_id = ? ORDER BY order_index ASC').all(tripId);

  const fullStops = stops.map(stop => {
    const city = db.prepare('SELECT * FROM cities WHERE id = ?').get(stop.city_id);
    const tripActivities = db.prepare(`
      SELECT ta.*, a.name, a.type, a.cost, a.duration_hours, a.description
      FROM trip_activities ta JOIN activities a ON ta.activity_id = a.id
      WHERE ta.stop_id = ? ORDER BY ta.day_number ASC, ta.time_slot ASC
    `).all(stop.id);
    return { ...stop, city, activities: tripActivities };
  });

  // Budget breakdown
  let activityCost = 0, stayCost = 0, transportCost = 300; // flat transport estimate per trip
  for (const s of fullStops) {
    const nights = daysBetween(s.start_date, s.end_date);
    stayCost += (s.city ? s.city.cost_index : 80) * nights;
    for (const a of s.activities) activityCost += a.cost;
  }
  transportCost = fullStops.length > 1 ? (fullStops.length - 1) * 150 + 200 : 200;
  const mealsCost = fullStops.reduce((sum, s) => sum + daysBetween(s.start_date, s.end_date) * 35, 0);
  const totalCost = Math.round((activityCost + stayCost + transportCost + mealsCost) * 100) / 100;

  const totalDays = fullStops.reduce((sum, s) => sum + daysBetween(s.start_date, s.end_date), 0) || 1;

  return {
    ...trip,
    stops: fullStops,
    budget: {
      activities: Math.round(activityCost * 100) / 100,
      stay: Math.round(stayCost * 100) / 100,
      transport: Math.round(transportCost * 100) / 100,
      meals: Math.round(mealsCost * 100) / 100,
      total: totalCost,
      avgPerDay: Math.round((totalCost / totalDays) * 100) / 100,
    },
  };
}

// ---------- Trip CRUD ----------

router.get('/', authRequired, (req, res) => {
  const trips = db.prepare('SELECT * FROM trips WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  const withCounts = trips.map(t => {
    const stopCount = db.prepare('SELECT COUNT(*) c FROM stops WHERE trip_id = ?').get(t.id).c;
    return { ...t, destination_count: stopCount };
  });
  res.json({ trips: withCounts });
});

router.post('/', authRequired, (req, res) => {
  const { name, start_date, end_date, description, cover_photo } = req.body;
  if (!name) return res.status(400).json({ error: 'Trip name is required' });
  const id = uuid();
  db.prepare(`INSERT INTO trips (id, user_id, name, start_date, end_date, description, cover_photo)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(id, req.user.id, name, start_date || null, end_date || null, description || '', cover_photo || '');
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(id);
  res.status(201).json({ trip });
});

router.get('/:id', authRequired, (req, res) => {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.id);
  if (!trip || trip.user_id !== req.user.id) return res.status(404).json({ error: 'Trip not found' });
  res.json({ trip: getFullTrip(trip.id) });
});

router.put('/:id', authRequired, (req, res) => {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.id);
  if (!trip || trip.user_id !== req.user.id) return res.status(404).json({ error: 'Trip not found' });
  const { name, start_date, end_date, description, cover_photo } = req.body;
  db.prepare(`UPDATE trips SET name=?, start_date=?, end_date=?, description=?, cover_photo=? WHERE id=?`)
    .run(name ?? trip.name, start_date ?? trip.start_date, end_date ?? trip.end_date,
         description ?? trip.description, cover_photo ?? trip.cover_photo, trip.id);
  res.json({ trip: getFullTrip(trip.id) });
});

router.delete('/:id', authRequired, (req, res) => {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.id);
  if (!trip || trip.user_id !== req.user.id) return res.status(404).json({ error: 'Trip not found' });
  db.prepare('DELETE FROM trips WHERE id = ?').run(trip.id);
  res.json({ message: 'Trip deleted' });
});

// ---------- Sharing ----------

router.post('/:id/share', authRequired, (req, res) => {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.id);
  if (!trip || trip.user_id !== req.user.id) return res.status(404).json({ error: 'Trip not found' });
  const slug = trip.public_slug || (trip.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '-' + trip.id.slice(0, 6));
  db.prepare('UPDATE trips SET is_public = 1, public_slug = ? WHERE id = ?').run(slug, trip.id);
  res.json({ public_slug: slug });
});

router.post('/:id/unshare', authRequired, (req, res) => {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.id);
  if (!trip || trip.user_id !== req.user.id) return res.status(404).json({ error: 'Trip not found' });
  db.prepare('UPDATE trips SET is_public = 0 WHERE id = ?').run(trip.id);
  res.json({ message: 'Trip is now private' });
});

// Public read-only view (no auth) — mounted separately in server.js at /api/public
router.publicTripBySlug = (slug) => {
  const trip = db.prepare('SELECT * FROM trips WHERE public_slug = ? AND is_public = 1').get(slug);
  if (!trip) return null;
  return getFullTrip(trip.id);
};

// Copy a public trip into the current user's account
router.post('/copy/:slug', authRequired, (req, res) => {
  const original = router.publicTripBySlug(req.params.slug);
  if (!original) return res.status(404).json({ error: 'Shared trip not found' });

  const newTripId = uuid();
  db.prepare(`INSERT INTO trips (id, user_id, name, start_date, end_date, description, cover_photo)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(newTripId, req.user.id, original.name + ' (Copy)', original.start_date, original.end_date, original.description, original.cover_photo);

  for (const stop of original.stops) {
    const newStopId = uuid();
    db.prepare(`INSERT INTO stops (id, trip_id, city_id, start_date, end_date, order_index) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(newStopId, newTripId, stop.city_id, stop.start_date, stop.end_date, stop.order_index);
    for (const act of stop.activities) {
      db.prepare(`INSERT INTO trip_activities (id, stop_id, activity_id, day_number, time_slot) VALUES (?, ?, ?, ?, ?)`)
        .run(uuid(), newStopId, act.activity_id, act.day_number, act.time_slot);
    }
  }
  res.status(201).json({ trip: getFullTrip(newTripId) });
});

// ---------- Stops ----------

router.post('/:id/stops', authRequired, (req, res) => {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.id);
  if (!trip || trip.user_id !== req.user.id) return res.status(404).json({ error: 'Trip not found' });
  const { city_id, start_date, end_date } = req.body;
  if (!city_id) return res.status(400).json({ error: 'city_id is required' });
  const maxOrder = db.prepare('SELECT MAX(order_index) m FROM stops WHERE trip_id = ?').get(trip.id).m;
  const id = uuid();
  db.prepare(`INSERT INTO stops (id, trip_id, city_id, start_date, end_date, order_index) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(id, trip.id, city_id, start_date || null, end_date || null, (maxOrder ?? -1) + 1);
  res.status(201).json({ trip: getFullTrip(trip.id) });
});

router.put('/:tripId/stops/:stopId', authRequired, (req, res) => {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.tripId);
  if (!trip || trip.user_id !== req.user.id) return res.status(404).json({ error: 'Trip not found' });
  const stop = db.prepare('SELECT * FROM stops WHERE id = ? AND trip_id = ?').get(req.params.stopId, trip.id);
  if (!stop) return res.status(404).json({ error: 'Stop not found' });
  const { start_date, end_date, order_index } = req.body;
  db.prepare('UPDATE stops SET start_date=?, end_date=?, order_index=? WHERE id=?')
    .run(start_date ?? stop.start_date, end_date ?? stop.end_date, order_index ?? stop.order_index, stop.id);
  res.json({ trip: getFullTrip(trip.id) });
});

router.delete('/:tripId/stops/:stopId', authRequired, (req, res) => {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.tripId);
  if (!trip || trip.user_id !== req.user.id) return res.status(404).json({ error: 'Trip not found' });
  db.prepare('DELETE FROM stops WHERE id = ? AND trip_id = ?').run(req.params.stopId, trip.id);
  res.json({ trip: getFullTrip(trip.id) });
});

router.put('/:tripId/stops-reorder', authRequired, (req, res) => {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.tripId);
  if (!trip || trip.user_id !== req.user.id) return res.status(404).json({ error: 'Trip not found' });
  const { order } = req.body; // array of stop ids in new order
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of stop ids' });
  const update = db.prepare('UPDATE stops SET order_index = ? WHERE id = ? AND trip_id = ?');
  order.forEach((stopId, idx) => update.run(idx, stopId, trip.id));
  res.json({ trip: getFullTrip(trip.id) });
});

// ---------- Trip Activities ----------

router.post('/:tripId/stops/:stopId/activities', authRequired, (req, res) => {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.tripId);
  if (!trip || trip.user_id !== req.user.id) return res.status(404).json({ error: 'Trip not found' });
  const stop = db.prepare('SELECT * FROM stops WHERE id = ? AND trip_id = ?').get(req.params.stopId, trip.id);
  if (!stop) return res.status(404).json({ error: 'Stop not found' });
  const { activity_id, day_number, time_slot } = req.body;
  if (!activity_id) return res.status(400).json({ error: 'activity_id is required' });
  const id = uuid();
  db.prepare(`INSERT INTO trip_activities (id, stop_id, activity_id, day_number, time_slot) VALUES (?, ?, ?, ?, ?)`)
    .run(id, stop.id, activity_id, day_number || 1, time_slot || '');
  res.status(201).json({ trip: getFullTrip(trip.id) });
});

router.delete('/:tripId/activities/:taId', authRequired, (req, res) => {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.tripId);
  if (!trip || trip.user_id !== req.user.id) return res.status(404).json({ error: 'Trip not found' });
  db.prepare('DELETE FROM trip_activities WHERE id = ?').run(req.params.taId);
  res.json({ trip: getFullTrip(trip.id) });
});

router.getFullTrip = getFullTrip;
module.exports = router;

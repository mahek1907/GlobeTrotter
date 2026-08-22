const express = require('express');
const router = express.Router();
const tripsRouter = require('./trips');

router.get('/trip/:slug', (req, res) => {
  const trip = tripsRouter.publicTripBySlug(req.params.slug);
  if (!trip) return res.status(404).json({ error: 'Shared trip not found or no longer public' });
  res.json({ trip });
});

module.exports = router;

const express = require('express');
const cors = require('cors');
const path = require('path');

require('./seed'); // ensure DB has seed data on boot

const authRoutes = require('./routes/auth');
const cityRoutes = require('./routes/cities');
const activityRoutes = require('./routes/activities');
const tripRoutes = require('./routes/trips');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/cities', cityRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'GlobeTrotter API' }));

// Serve frontend static files
const frontendPath = path.join(__dirname, '..', 'public');
app.use(express.static(frontendPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Central error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`GlobeTrotter API + frontend running at http://localhost:${PORT}`);
});

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

dotenv.config({ quiet: true });

const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 5000;
const API_MOUNT = (process.env.API_MOUNT || '/api').replace(/\/+$/, '') || '/';
const CLIENT_DIST =
  process.env.CLIENT_DIST || path.resolve(__dirname, '..', 'client', 'dist');
const CLIENT_BASE = (process.env.CLIENT_BASE || '/').replace(/\/+$/, '') || '/';

connectDB();

const app = express();

// CORS — restrict allowed browser origins if CLIENT_ORIGINS is set;
// otherwise the API stays open (typical for same-origin / dev setups)
const corsOptions = process.env.CLIENT_ORIGINS
  ? { origin: process.env.CLIENT_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean) }
  : {};
app.use(cors(corsOptions));

app.use(express.json({ limit: '2mb' }));

// Health check (independent of the client build)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', env: NODE_ENV, apiMount: API_MOUNT });
});

// API routes under a configurable mount (default /api)
app.use(`${API_MOUNT}/auth`, require('./routes/auth'));
app.use(`${API_MOUNT}/expenses`, require('./routes/expenses'));
app.use(`${API_MOUNT}/import`, require('./routes/import'));

// Serve the built frontend (production). CLIENT_DIST defaults to client/dist.
const clientExists = fs.existsSync(path.join(CLIENT_DIST, 'index.html'));
if (clientExists) {
  app.use(CLIENT_BASE, express.static(CLIENT_DIST));

  // SPA fallback: any non-API GET returns index.html so client-side routes work
  const spaRoute = CLIENT_BASE === '/' ? '*' : `${CLIENT_BASE}/*`;
  app.get(spaRoute, (req, res, next) => {
    if (
      req.path.startsWith(API_MOUNT) ||
      req.path.startsWith('/api') ||
      req.path === '/health'
    ) {
      return next();
    }
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

// Root info (shown only when no client build is being served)
app.get('/', (req, res) => {
  res.send('Expense Tracker API is running');
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Server error' });
});

app.listen(PORT, () => {
  console.log(`Server running in ${NODE_ENV} mode on port ${PORT}`);
  console.log(`API mounted at ${API_MOUNT}`);
  if (clientExists) {
    console.log(`Serving client from ${CLIENT_DIST} at ${CLIENT_BASE}`);
  } else {
    console.log(`Client build not found at ${CLIENT_DIST} — run "npm run build" in client/`);
  }
});
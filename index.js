const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Same rule as the client: load .env, then let .env.<mode> override it.
// override:true is what makes the mode-specific file win.
dotenv.config({ quiet: true });
dotenv.config({
  path: `.env.${process.env.NODE_ENV || 'development'}`,
  quiet: true,
  override: true,
});

// Fail fast with a clear message instead of an obscure jsonwebtoken error
// the first time someone tries to log in.
if (!process.env.JWT_SECRET) {
  console.error(
    'JWT_SECRET is not set. Put it in your .env file (local) or set it in the ' +
      'host dashboard (production).'
  );
  process.exit(1);
}

const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 5000;
const API_MOUNT = (process.env.API_MOUNT || '/api').replace(/\/+$/, '') || '/';
const CLIENT_DIST =
  process.env.CLIENT_DIST || path.resolve(__dirname, '..', 'client', 'dist');
const CLIENT_BASE = (process.env.CLIENT_BASE || '/').replace(/\/+$/, '') || '/';

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

// Connect + verify/initialize the expense_tracker database BEFORE any route is
// registered: requiring a route compiles its mongoose model, and mongoose then
// builds indexes — a write that materializes the database. Initialization has
// to win that race so a genuinely missing database is still detected as missing.
let readyPromise = null;

const ensureReady = () => {
  if (!readyPromise) {
    readyPromise = (async () => {
      await connectDB();
      registerRoutes();
    })().catch((error) => {
      // Drop the failed promise so the next request/server start can retry.
      readyPromise = null;
      throw error;
    });
  }
  // Memoized: on Vercel the connection is reused across warm invocations.
  return readyPromise;
};

const registerRoutes = () => {
  // API routes under a configurable mount (default /api)
  app.use(`${API_MOUNT}/auth`, require('./routes/auth'));
  app.use(`${API_MOUNT}/expenses`, require('./routes/expenses'));
  app.use(`${API_MOUNT}/import`, require('./routes/import'));
  app.use(`${API_MOUNT}/scheduled-payments`, require('./routes/scheduledPayments'));
  app.use(`${API_MOUNT}/auto-pays`, require('./routes/autoPays'));
  app.use(`${API_MOUNT}/scheduler`, require('./routes/scheduler'));

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
};

if (process.env.VERCEL) {
  // Serverless (Vercel): no app.listen(). Vercel invokes this exported
  // (req, res) function per request; we await DB connect/init first, then hand
  // off to Express. connectDB() already logs the underlying failure.
  module.exports = (req, res) =>
    ensureReady().then(
      () => app(req, res),
      (error) => {
        console.error(`Request aborted, MongoDB unavailable: ${error.message}`);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ message: 'Server error: database unavailable' }));
      }
    );
} else {
  // Local / long-running host: one-time init, then accept traffic only once
  // the database is connected and initialized.
  ensureReady()
    .then(() => {
      // Background loop for due scheduled/auto payments. Required lazily so
      // the mongoose models are only compiled after the DB is ready, and
      // skipped on serverless where an external cron calls /scheduler/run.
      if (process.env.SCHEDULER_ENABLED !== 'false') {
        require('./scheduler').startScheduler();
      }

      app.listen(PORT, () => {
        console.log(`Server running in ${NODE_ENV} mode on port ${PORT}`);
        console.log(`API mounted at ${API_MOUNT}`);
        if (fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
          console.log(`Serving client from ${CLIENT_DIST} at ${CLIENT_BASE}`);
        } else {
          console.log(
            `Client build not found at ${CLIENT_DIST} — run "npm run build" in client/`
          );
        }
      });
    })
    .catch(() => {
      console.error('Server startup aborted: MongoDB is unavailable (see error above).');
      process.exit(1);
    });
}
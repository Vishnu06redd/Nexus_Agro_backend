require('dotenv').config();

const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');
const path        = require('path');

const routes      = require('./routes');
const { pool }    = require('./config/db');

const app  = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 5000;

// ── Security & Parsing ───────────────────────────────────────
app.use(helmet());
const allowedOrigins = [
  process.env.CLIENT_URL,
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (curl, Postman) with no Origin header
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV !== 'production') {
      const ok = allowedOrigins.some((o) =>
        o instanceof RegExp ? o.test(origin) : o === origin
      );
      return callback(null, ok);
    }
    return callback(null, origin === process.env.CLIENT_URL);
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Rate Limiting ────────────────────────────────────────────
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'Too many requests. Please try again later.' },
}));
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
}));

// ── Static: uploaded product images ─────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Health check ─────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', time: new Date().toISOString() });
  } catch {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

// ── API routes ───────────────────────────────────────────────
app.use('/api', routes);

// ── 404 ──────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// ── Global error handler ─────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error.',
  });
});

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  Nexus Agro API running on http://localhost:${PORT}`);
  console.log(`🗄️   Database: ${process.env.DB_NAME || 'nexus_db'} @ ${process.env.DB_HOST || 'localhost'}`);
  console.log(`🔍  Health:   http://localhost:${PORT}/health\n`);
});

module.exports = app;
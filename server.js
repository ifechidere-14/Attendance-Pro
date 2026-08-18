/**
 * Attendance Pro — Web server entry point.
 */
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const pool = require('./db/pool');
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const courseRoutes = require('./routes/courses');
const attendanceRoutes = require('./routes/attendance');
const dashboardRoutes = require('./routes/dashboard');
const reportRoutes = require('./routes/reports');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

/* ------------------------------------------------------------------ */
/*  Middleware                                                         */
/* ------------------------------------------------------------------ */
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    name: 'attendance.sid',
    secret: process.env.SESSION_SECRET || 'attendance-pro-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 } // 8 hours
  })
);

// Small request logger
app.use((req, _res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`${new Date().toISOString()}  ${req.method} ${req.path}`);
  }
  next();
});

/* ------------------------------------------------------------------ */
/*  API routes                                                         */
/* ------------------------------------------------------------------ */

// Health check — verifies the CockroachDB connection
app.get('/api/health', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT version() AS v, now() AS t');
    res.json({ status: 'ok', database: 'connected', server_time: rows[0].t, version: rows[0].v });
  } catch (err) {
    res.status(500).json({ status: 'error', database: 'disconnected', message: err.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/students', requireAuth, studentRoutes);
app.use('/api/courses', requireAuth, courseRoutes);
app.use('/api/attendance', requireAuth, attendanceRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/reports', requireAuth, reportRoutes);

/* ------------------------------------------------------------------ */
/*  Front-end pages                                                    */
/* ------------------------------------------------------------------ */
app.get('/login', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/app', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'app.html')));

app.get('/', (_req, res) => res.redirect('/app'));

// Catch-all API 404
app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found' }));

/* ------------------------------------------------------------------ */
/*  Start                                                              */
/* ------------------------------------------------------------------ */
app.listen(PORT, async () => {
  console.log('──────────────────────────────────────────────────────');
  console.log('  Attendance Pro — high-class attendance system');
  console.log(`  Web UI      : http://localhost:${PORT}/app`);
  console.log(`  Health check: http://localhost:${PORT}/api/health`);
  console.log('──────────────────────────────────────────────────────');
  try {
    await pool.query('SELECT 1');
    console.log('  ✓ CockroachDB connection OK');
  } catch (err) {
    console.error('  ✖ CockroachDB connection FAILED:', err.message);
    console.error('    → Check DATABASE_URL in .env and run "npm run db:init" first.');
  }
  console.log('──────────────────────────────────────────────────────');
});

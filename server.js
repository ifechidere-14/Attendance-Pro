/**
 * Attendance Pro — Web server entry point.
 */
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const PGStore = require('connect-pg-simple')(session);
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

// Serve static files with cache-busting disabled for JS/CSS so the
// browser always picks up the latest code (prevents stale api.js).
app.use('/js', express.static(path.join(__dirname, 'public', 'js'), { maxAge: 0, etag: false }));
app.use('/css', express.static(path.join(__dirname, 'public', 'css'), { maxAge: 0, etag: false }));
app.use(express.static(path.join(__dirname, 'public')));

/* 
   Session storage backed by CockroachDB (via pg).
   replaces the default MemoryStore so sessions survive dyno restarts.
*/
const sessionMiddleware = session({
  store: new PGStore({
    pool,
    tableName: 'sessions',
    createTableIfMissing: false,
    ttl: 24 * 60 * 60 // 1 day session TTL
  }),
  name: 'attendance.sid',
  secret: process.env.SESSION_SECRET || 'attendance-pro-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 8,  // 8 hours
    secure: process.env.COOKIE_SECURE === 'true'  // HTTPS only when explicitly enabled
  }
});

app.use(sessionMiddleware);

/* Small request logger */
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
    const { rows } = await pool.query('SELECT version() AS version, now() AS t');
    res.json({ status: 'ok', database: 'connected', server_time: rows[0].t, version: rows[0].version });
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

/* ------------------------------------------------------------------ */
/*  Application download — bundles the project source into a ZIP       */
/* ------------------------------------------------------------------ */
const { ZipArchive } = require('archiver');
const fs = require('fs');
const pathLib = require('path');

function buildFileList(dir, base, out, ignore) {
  let entries;
  try { entries = fs.readdirSync(dir); } catch (_) { return; }
  for (const entry of entries) {
    const seg = entry.toLowerCase();
    if (ignore.includes(seg)) continue;                    // skip folder/file by name
    const abs = pathLib.join(dir, entry);
    const rel = base ? pathLib.join(base, entry) : entry;
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      buildFileList(abs, rel, out, ignore);
    } else if (stat.isFile()) {
      out.push(rel);
    }
  }
}

// Download the full Attendance Pro application as a ZIP bundle.
// The archive contains the complete source (backend, frontend, schema,
// seed, docs) so you can host the app anywhere. Secrets (.env, logs,
// node_modules, .git) are excluded.
app.get('/api/download/app', requireAuth, (req, res) => {
  const version = require('./package.json').version || '1.0.0';
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `AttendancePro-v${version}-${stamp}.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');

  const archive = new ZipArchive({ zlib: { level: 9 } });
  archive.on('error', (err) => {
    console.error('ZIP build error:', err.message);
    if (!res.headersSent) res.status(500).end('Could not build download archive.');
  });
  archive.pipe(res);

  try {
    // Add a small install note
    archive.append(Buffer.from(
      'ATTENDANCE PRO — APPLICATION PACKAGE\n' +
      '====================================\n' +
      'This ZIP is the full Attendance Pro application (source code).\n\n' +
      'To install / deploy:\n' +
      '  1. Unzip the folder.\n' +
      '  2. Create a .env file from .env.example and paste your CockroachDB connection string.\n' +
      '  3. Run:  npm install   then   npm start\n' +
      '  4. Open  http://localhost:3000/login   (admin / Admin@1234)\n\n' +
      `Generated: ${new Date().toUTCString()}\n`
    ), { name: 'INSTALL-NOTES.txt' });

    // Collect every project file to bundle (relative paths)
    const ignore = [
      'node_modules', '.git', '.env', 'server-out.log', 'server-err.log',
      'login.json', 'cookies.txt', 'test-download.zip', 'server-test.log',
      'server-test.err', 'attendance_pro.zip', 'server.js.new'
    ];
    const files = [];
    buildFileList(__dirname, '', files, ignore);

    for (const rel of files) {
      if (/\.log$/.test(rel) || /\.err$/.test(rel)) continue;
      archive.file(pathLib.join(__dirname, rel), { name: rel.replace(/\\/g, '/') });
    }

    archive.finalize();
  } catch (err) {
    console.error('ZIP build error:', err.message);
    if (!res.headersSent) res.status(500).end('Could not build download archive.');
  }
});

app.listen(PORT, () => {
  console.log(`──────────────────────────────────────────────────────`);
  console.log(`  Attendance Pro — high-class attendance system`);
  console.log(`  Web UI      : http://localhost:${PORT}/app`);
  console.log(`  Health check: http://localhost:${PORT}/api/health`);
  console.log('──────────────────────────────────────────────────────');
  pool.query('SELECT 1').then(() => {
    console.log('  ✓ CockroachDB connection OK');
  }).catch((err) => {
    console.error('  ✖ CockroachDB connection FAILED:', err.message);
  });
});
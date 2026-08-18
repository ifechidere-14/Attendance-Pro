/**
 * Reports & analytics routes.
 */
const express = require('express');
const pool = require('../db/pool');
const router = express.Router();

// GET /api/reports/overview?from=&to=&courseId=
// Per-course aggregation
router.get('/overview', async (req, res) => {
  const { from, to, courseId } = req.query;
  const conditions = [];
  const params = [];
  if (from) { params.push(from); conditions.push(`ar.date >= $${params.length}::date`); }
  if (to) { params.push(to); conditions.push(`ar.date <= $${params.length}::date`); }
  if (courseId) { params.push(courseId); conditions.push(`ar.course_id = $${params.length}`); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  try {
    const { rows } = await pool.query(
      `SELECT c.id AS course_id, c.course_code, c.course_name, u.full_name AS instructor_name,
              COUNT(*) AS total_records,
              COUNT(*) FILTER (WHERE ar.status = 'present') ::int AS present,
              COUNT(*) FILTER (WHERE ar.status = 'absent')  ::int AS absent,
              COUNT(*) FILTER (WHERE ar.status = 'late')    ::int AS late,
              COUNT(*) FILTER (WHERE ar.status = 'excused') ::int AS excused,
              (SELECT COUNT(*)::int FROM course_students cs WHERE cs.course_id = c.id) AS enrollment
       FROM attendance_records ar
       JOIN courses c ON c.id = ar.course_id
       LEFT JOIN users u ON u.id = c.instructor_id
       ${where}
       GROUP BY c.id, c.course_code, c.course_name, u.full_name
       ORDER BY c.course_code`,
      params
    );
    res.json({ courses: rows });
  } catch (err) {
    console.error('Overview report error:', err);
    res.status(500).json({ error: 'Failed to load overview report.' });
  }
});

// GET /api/reports/students?from=&to=&courseId=
// Per-student aggregation
router.get('/students', async (req, res) => {
  const { from, to, courseId } = req.query;
  const conditions = [];
  const params = [];
  if (from) { params.push(from); conditions.push(`ar.date >= $${params.length}::date`); }
  if (to) { params.push(to); conditions.push(`ar.date <= $${params.length}::date`); }
  if (courseId) { params.push(courseId); conditions.push(`ar.course_id = $${params.length}`); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  try {
    const { rows } = await pool.query(
      `SELECT s.id AS student_id, s.student_code, s.full_name, s.class_name,
              COUNT(*) AS total_records,
              COUNT(*) FILTER (WHERE ar.status = 'present') ::int AS present,
              COUNT(*) FILTER (WHERE ar.status = 'absent')  ::int AS absent,
              COUNT(*) FILTER (WHERE ar.status = 'late')    ::int AS late,
              COUNT(*) FILTER (WHERE ar.status = 'excused') ::int AS excused
       FROM attendance_records ar
       JOIN students s ON s.id = ar.student_id
       ${where}
       GROUP BY s.id, s.student_code, s.full_name, s.class_name
       ORDER BY s.full_name`,
      params
    );
    res.json({ students: rows });
  } catch (err) {
    console.error('Students report error:', err);
    res.status(500).json({ error: 'Failed to load student report.' });
  }
});

// GET /api/reports/trend?courseId=&from=&to=
// Daily trend of present vs total
router.get('/trend', async (req, res) => {
  const { courseId, from, to } = req.query;
  const conditions = [];
  const params = [];
  if (from) { params.push(from); conditions.push(`date >= $${params.length}::date`); }
  if (to) { params.push(to); conditions.push(`date <= $${params.length}::date`); }
  if (courseId) { params.push(courseId); conditions.push(`course_id = $${params.length}`); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  try {
    const { rows } = await pool.query(
      `SELECT date,
              COUNT(*) FILTER (WHERE status = 'present') ::int AS present,
              COUNT(*) FILTER (WHERE status = 'absent')  ::int AS absent,
              COUNT(*) FILTER (WHERE status = 'late')    ::int AS late,
              COUNT(*) FILTER (WHERE status = 'excused') ::int AS excused,
              COUNT(*) AS total
       FROM attendance_records
       ${where}
       GROUP BY date
       ORDER BY date`,
      params
    );
    res.json({ trend: rows });
  } catch (err) {
    console.error('Trend report error:', err);
    res.status(500).json({ error: 'Failed to load trend report.' });
  }
});

module.exports = router;
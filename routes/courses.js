/**
 * Course management routes (CRUD + enrollment).
 */
const express = require('express');
const pool = require('../db/pool');
const { isAdmin } = require('../middleware/auth');
const router = express.Router();

// GET /api/courses
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, u.full_name AS instructor_name,
              (SELECT COUNT(*)::int FROM course_students cs WHERE cs.course_id = c.id) AS student_count
       FROM courses c
       LEFT JOIN users u ON u.id = c.instructor_id
       ORDER BY c.course_code`
    );
    res.json({ courses: rows });
  } catch (err) {
    console.error('List courses error:', err);
    res.status(500).json({ error: 'Failed to fetch courses.' });
  }
});

// GET /api/courses/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, u.full_name AS instructor_name FROM courses c
       LEFT JOIN users u ON u.id = c.instructor_id WHERE c.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Course not found.' });
    res.json({ course: rows[0] });
  } catch (err) {
    console.error('Get course error:', err);
    res.status(500).json({ error: 'Failed to fetch course.' });
  }
});

// POST /api/courses
router.post('/', isAdmin, async (req, res) => {
  const { course_code, course_name, instructor_id, schedule, location } = req.body;
  if (!course_code || !course_name) {
    return res.status(400).json({ error: 'course_code and course_name are required.' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO courses (course_code, course_name, instructor_id, schedule, location)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [course_code.trim(), course_name.trim(), instructor_id || null, schedule || null, location || null]
    );
    res.status(201).json({ course: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That course code is already in use.' });
    console.error('Create course error:', err);
    res.status(500).json({ error: 'Failed to create course.' });
  }
});

// PUT /api/courses/:id
router.put('/:id', isAdmin, async (req, res) => {
  const { course_code, course_name, instructor_id, schedule, location } = req.body;
  if (!course_code || !course_name) {
    return res.status(400).json({ error: 'course_code and course_name are required.' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE courses
       SET course_code = $1, course_name = $2, instructor_id = $3, schedule = $4, location = $5
       WHERE id = $6 RETURNING *`,
      [course_code.trim(), course_name.trim(), instructor_id || null, schedule || null, location || null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Course not found.' });
    res.json({ course: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That course code is already in use.' });
    console.error('Update course error:', err);
    res.status(500).json({ error: 'Failed to update course.' });
  }
});

// DELETE /api/courses/:id
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM courses WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Course not found.' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete course error:', err);
    res.status(500).json({ error: 'Failed to delete course.' });
  }
});

// GET /api/courses/:id/students — enrolled students
router.get('/:id/students', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.student_code, s.full_name, s.email, s.phone, s.class_name
       FROM students s
       JOIN course_students cs ON cs.student_id = s.id
       WHERE cs.course_id = $1
       ORDER BY s.full_name`,
      [req.params.id]
    );
    res.json({ students: rows });
  } catch (err) {
    console.error('Course students error:', err);
    res.status(500).json({ error: 'Failed to fetch enrolled students.' });
  }
});

// POST /api/courses/:id/enroll  { studentIds: [...] }
router.post('/:id/enroll', isAdmin, async (req, res) => {
  const { studentIds } = req.body;
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return res.status(400).json({ error: 'studentIds array is required.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const sid of studentIds) {
      await client.query(
        `INSERT INTO course_students (course_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [req.params.id, sid]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true, enrolled: studentIds.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Enroll students error:', err);
    res.status(500).json({ error: 'Failed to enroll students.' });
  } finally {
    client.release();
  }
});

// POST /api/courses/:id/unenroll  { studentIds: [...] }
router.post('/:id/unenroll', isAdmin, async (req, res) => {
  const { studentIds } = req.body;
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return res.status(400).json({ error: 'studentIds array is required.' });
  }
  try {
    await pool.query(
      `DELETE FROM course_students WHERE course_id = $1 AND student_id = ANY($2::uuid[])`,
      [req.params.id, studentIds]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Unenroll students error:', err);
    res.status(500).json({ error: 'Failed to unenroll students.' });
  }
});

module.exports = router;

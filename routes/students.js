/**
 * Student management routes.
 */
const express = require('express');
const pool = require('../db/pool');
const { isAdmin } = require('../middleware/auth');
const router = express.Router();

// GET /api/students?search=&page=&limit=
router.get('/', async (req, res) => {
  const search = (req.query.search || '').trim();
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 200);
  const offset = (page - 1) * limit;

  const where = search
    ? `WHERE s.full_name ILIKE $1 OR s.student_code ILIKE $1 OR s.class_name ILIKE $1 OR s.email ILIKE $1`
    : '';
  const countParams = search ? [`%${search}%`] : [];
  const dataParams = search ? [`%${search}%`, limit, offset] : [limit, offset];

  try {
    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM students s ${where}`,
      countParams
    );
    const dataRes = await pool.query(
      `SELECT s.id, s.student_code, s.full_name, s.email, s.phone, s.class_name, s.enrollment_date,
              s.created_at, s.updated_at,
              (SELECT COUNT(*)::int FROM course_students cs WHERE cs.student_id = s.id) AS course_count
       FROM students s ${where}
       ORDER BY s.full_name
       LIMIT $${countParams.length + 1} OFFSET $${countParams.length + 2}`,
      dataParams
    );
    res.json({ students: dataRes.rows, total: countRes.rows[0].total, page, limit });
  } catch (err) {
    console.error('List students error:', err);
    res.status(500).json({ error: 'Failed to fetch students.' });
  }
});

// GET /api/students/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*,
              (SELECT COUNT(*)::int FROM course_students cs WHERE cs.student_id = s.id) AS course_count
       FROM students s WHERE s.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Student not found.' });
    res.json({ student: rows[0] });
  } catch (err) {
    console.error('Get student error:', err);
    res.status(500).json({ error: 'Failed to fetch student.' });
  }
});

// POST /api/students
router.post('/', isAdmin, async (req, res) => {
  const { student_code, full_name, email, phone, class_name, enrollment_date } = req.body;
  if (!student_code || !full_name) {
    return res.status(400).json({ error: 'student_code and full_name are required.' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO students (student_code, full_name, email, phone, class_name, enrollment_date)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        student_code.trim(),
        full_name.trim(),
        (email || '').trim() || null,
        (phone || '').trim() || null,
        (class_name || '').trim() || null,
        enrollment_date || new Date().toISOString().slice(0, 10)
      ]
    );
    res.status(201).json({ student: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That student code or email is already in use.' });
    }
    console.error('Create student error:', err);
    res.status(500).json({ error: 'Failed to create student.' });
  }
});

// PUT /api/students/:id
router.put('/:id', isAdmin, async (req, res) => {
  const { student_code, full_name, email, phone, class_name, enrollment_date } = req.body;
  if (!student_code || !full_name) {
    return res.status(400).json({ error: 'student_code and full_name are required.' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE students
       SET student_code = $1, full_name = $2, email = $3, phone = $4,
           class_name = $5, enrollment_date = $6, updated_at = now()
       WHERE id = $7 RETURNING *`,
      [
        student_code.trim(),
        full_name.trim(),
        (email || '').trim() || null,
        (phone || '').trim() || null,
        (class_name || '').trim() || null,
        enrollment_date || null,
        req.params.id
      ]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Student not found.' });
    res.json({ student: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That student code or email is already in use.' });
    }
    console.error('Update student error:', err);
    res.status(500).json({ error: 'Failed to update student.' });
  }
});

// DELETE /api/students/:id
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM students WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Student not found.' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete student error:', err);
    res.status(500).json({ error: 'Failed to delete student.' });
  }
});

module.exports = router;

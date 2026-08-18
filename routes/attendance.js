/**
 * Attendance routes — attendance sheet, bulk marking, records & history.
 */
const express = require('express');
const pool = require('../db/pool');
const router = express.Router();

const VALID_STATUS = ['present', 'absent', 'late', 'excused'];

// GET /api/attendance/course/:courseId?date=YYYY-MM-DD
// Returns the attendance sheet (enrolled students + any existing records for that date)
router.get('/course/:courseId', async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  try {
    const courseRes = await pool.query('SELECT * FROM courses WHERE id = $1', [req.params.courseId]);
    if (courseRes.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found.' });
    }
    const { rows } = await pool.query(
      `SELECT s.id AS student_id, s.student_code, s.full_name, s.class_name,
              ar.id AS record_id, ar.status, ar.notes
       FROM students s
       JOIN course_students cs ON cs.student_id = s.id
       LEFT JOIN attendance_records ar
              ON ar.student_id = s.id AND ar.course_id = $1 AND ar.date = $2::date
       WHERE cs.course_id = $1
       ORDER BY s.full_name`,
      [req.params.courseId, date]
    );
    res.json({ course: courseRes.rows[0], date, students: rows });
  } catch (err) {
    console.error('Attendance sheet error:', err);
    res.status(500).json({ error: 'Failed to load attendance sheet.' });
  }
});

// POST /api/attendance/mark  { courseId, date, records: [{studentId, status, notes}] }
router.post('/mark', async (req, res) => {
  const { courseId, date, records } = req.body;
  if (!courseId || !date || !Array.isArray(records)) {
    return res.status(400).json({ error: 'courseId, date and records[] are required.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userId = req.session.user.id;
    let saved = 0;
    for (const rec of records) {
      if (!rec.studentId || !rec.status) continue;
      if (!VALID_STATUS.includes(rec.status)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Invalid status "${rec.status}".` });
      }
      await client.query(
        `INSERT INTO attendance_records (course_id, student_id, marked_by, date, status, notes)
         VALUES ($1, $2, $3, $4::date, $5, $6)
         ON CONFLICT (course_id, student_id, date)
         DO UPDATE SET status = EXCLUDED.status,
                       notes = EXCLUDED.notes,
                       marked_by = EXCLUDED.marked_by,
                       updated_at = now()`,
        [courseId, rec.studentId, userId, date, rec.status, rec.notes || null]
      );
      saved++;
    }
    await client.query('COMMIT');
    res.json({ success: true, saved });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Mark attendance error:', err);
    res.status(500).json({ error: 'Failed to save attendance.' });
  } finally {
    client.release();
  }
});

// GET /api/attendance?courseId=&studentId=&status=&from=&to=
router.get('/', async (req, res) => {
  const { courseId, studentId, status, from, to } = req.query;
  const conditions = [];
  const params = [];
  if (courseId) { params.push(courseId); conditions.push(`ar.course_id = $${params.length}`); }
  if (studentId) { params.push(studentId); conditions.push(`ar.student_id = $${params.length}`); }
  if (status) { params.push(status); conditions.push(`ar.status = $${params.length}`); }
  if (from) { params.push(from); conditions.push(`ar.date >= $${params.length}::date`); }
  if (to) { params.push(to); conditions.push(`ar.date <= $${params.length}::date`); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  try {
    const { rows } = await pool.query(
      `SELECT ar.id, ar.course_id, ar.student_id, ar.date, ar.status, ar.notes, ar.marked_by,
              s.full_name AS student_name, s.student_code,
              c.course_code, c.course_name,
              u.full_name AS marked_by_name
       FROM attendance_records ar
       JOIN students s ON s.id = ar.student_id
       JOIN courses c ON c.id = ar.course_id
       LEFT JOIN users u ON u.id = ar.marked_by
       ${where}
       ORDER BY ar.date DESC, s.full_name
       LIMIT 1000`,
      params
    );
    res.json({ records: rows });
  } catch (err) {
    console.error('List attendance error:', err);
    res.status(500).json({ error: 'Failed to fetch attendance records.' });
  }
});

// GET /api/attendance/student/:id — full history for one student
router.get('/student/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ar.id, ar.course_id, ar.student_id, ar.date, ar.status, ar.notes,
              c.course_code, c.course_name
       FROM attendance_records ar
       JOIN courses c ON c.id = ar.course_id
       WHERE ar.student_id = $1
       ORDER BY ar.date DESC
       LIMIT 500`,
      [req.params.id]
    );
    res.json({ records: rows });
  } catch (err) {
    console.error('Student history error:', err);
    res.status(500).json({ error: 'Failed to fetch student attendance history.' });
  }
});

// PUT /api/attendance/:id  { status, notes }
router.put('/:id', async (req, res) => {
  const { status, notes } = req.body;
  if (!VALID_STATUS.includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE attendance_records
       SET status = $1, notes = $2, updated_at = now()
       WHERE id = $3 RETURNING *`,
      [status, notes || null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Record not found.' });
    res.json({ record: rows[0] });
  } catch (err) {
    console.error('Update attendance error:', err);
    res.status(500).json({ error: 'Failed to update record.' });
  }
});

module.exports = router;
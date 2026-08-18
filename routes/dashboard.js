/**
 * Dashboard stats routes.
 */
const express = require('express');
const pool = require('../db/pool');
const router = express.Router();

// GET /api/dashboard/summary
router.get('/summary', async (req, res) => {
  try {
    const [
      studentsRes,
      coursesRes,
      todayRes,
      recordsRes,
      weeklyRes,
      recentRes,
      topRes
    ] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS total FROM students'),
      pool.query('SELECT COUNT(*)::int AS total FROM courses'),
      pool.query(
        `SELECT status, COUNT(*)::int AS total
         FROM attendance_records
         WHERE date = current_date
         GROUP BY status`
      ),
      pool.query('SELECT COUNT(*)::int AS total FROM attendance_records'),
      pool.query(
        `SELECT date, COUNT(*)::int AS total
         FROM attendance_records
         WHERE date >= current_date - INTERVAL '6 days'
         GROUP BY date ORDER BY date`
      ),
      pool.query(
        `SELECT ar.id, ar.date, ar.status,
                s.full_name AS student_name, c.course_name
         FROM attendance_records ar
         JOIN students s ON s.id = ar.student_id
         JOIN courses c ON c.id = ar.course_id
         ORDER BY ar.created_at DESC
         LIMIT 8`
      ),
      pool.query(
        `SELECT s.id, s.full_name, s.student_code,
                COUNT(*) FILTER (WHERE ar.status = 'present') AS present,
                COUNT(*) FILTER (WHERE ar.status = 'absent')  AS absent,
                COUNT(*) FILTER (WHERE ar.status = 'late')    AS late,
                COUNT(*) FILTER (WHERE ar.status = 'excused') AS excused,
                COUNT(*) AS total
         FROM attendance_records ar
         JOIN students s ON s.id = ar.student_id
         GROUP BY s.id, s.full_name, s.student_code
         HAVING COUNT(*) > 0
         ORDER BY (COUNT(*) FILTER (WHERE ar.status = 'present'))::float / NULLIF(COUNT(*), 0) DESC
         LIMIT 6`
      )
    ]);

    const statusMap = { present: 0, absent: 0, late: 0, excused: 0 };
    todayRes.rows.forEach((r) => { statusMap[r.status] = r.total; });

    res.json({
      totalStudents: studentsRes.rows[0].total || 0,
      totalCourses: coursesRes.rows[0].total || 0,
      totalRecords: recordsRes.rows[0].total || 0,
      today: statusMap,
      weeklyTrend: weeklyRes.rows,
      recent: recentRes.rows,
      topStudents: topRes.rows
    });
  } catch (err) {
    console.error('Dashboard summary error:', err);
    res.status(500).json({ error: 'Failed to load dashboard summary.' });
  }
});

module.exports = router;
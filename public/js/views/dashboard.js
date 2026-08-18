/* ============================================================
   Dashboard view
   ============================================================ */

async function renderDashboard(el) {
  el.innerHTML = '<p class="muted">Loading dashboard…</p>';
  let data;
  try {
    data = await API.get('/api/dashboard/summary');
  } catch (err) {
    el.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
    return;
  }

  const t = data.today || {};
  const presentRate = data.totalRecords
    ? Math.round(((t.present || 0) / Math.max(data.totalRecords, 1)) * 100) : 0;

  el.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card stat-purple">
        <div class="stat-icon">🧑‍🎓</div>
        <div><div class="stat-value">${data.totalStudents}</div><div class="stat-label">Registered Students</div></div>
      </div>
      <div class="stat-card stat-blue">
        <div class="stat-icon">📚</div>
        <div><div class="stat-value">${data.totalCourses}</div><div class="stat-label">Active Courses</div></div>
      </div>
      <div class="stat-card stat-green">
        <div class="stat-icon">✅</div>
        <div><div class="stat-value">${t.present || 0}</div><div class="stat-label">Present Today</div></div>
      </div>
      <div class="stat-card stat-red">
        <div class="stat-icon">❌</div>
        <div><div class="stat-value">${t.absent || 0}</div><div class="stat-label">Absent Today</div></div>
      </div>
    </div>

    <div class="dash-grid">
      <div class="dash-col">
        <div class="card">
          <div class="card-head">
            <h3>Attendance — last 7 days</h3>
            <button class="btn btn-secondary btn-sm" data-goto="attendance">Mark attendance</button>
          </div>
          <div class="chart-box" style="height:280px"><canvas id="dash-trend"></canvas></div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Recently recorded</h3></div>
          ${renderRecent(data.recent)}
        </div>
      </div>
      <div class="dash-col">
        <div class="card">
          <div class="card-head"><h3>Today's status</h3></div>
          <div class="chart-box" style="height:200px"><canvas id="dash-today"></canvas></div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Top attendance rates</h3></div>
          ${renderTop(data.topStudents)}
        </div>
        <div class="card">
          <div class="card-head"><h3>Snapshot</h3></div>
          <div><div style="display:flex;justify-content:space-between"><span class="muted">Overall present rate</span><strong>${presentRate}%</strong></div>
          <div class="progress-track" style="margin-top:8px"><div class="progress-fill" style="width:${presentRate}%"></div></div></div>
          <p class="muted small" style="margin-top:12px">${data.totalRecords} attendance records stored securely in CockroachDB.</p>
        </div>
      </div>
    </div>
  `;

  el.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => navigate(b.dataset.goto)));

  drawTrend();
  drawToday();

  function drawTrend() {
    const canvas = document.getElementById('dash-trend');
    if (!canvas) return;
    if (!chartAvailable()) { canvas.parentElement.innerHTML = '<p class="muted small">Charts require internet access (Chart.js CDN).</p>'; return; }
    const labels = [];
    const records = [];
    let last = new Date();
    last.setDate(last.getDate() - 6);
    const map = {};
    data.weeklyTrend.forEach((r) => (map[String(r.date).slice(0, 10)] = r));
    for (let i = 0; i < 7; i++) {
      const key = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
      labels.push(last.toLocaleDateString('en-US', { weekday: 'short' }));
      records.push(map[key] ? Number(map[key].total) : 0);
      last.setDate(last.getDate() + 1);
    }
    new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Records', data: records, borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139,92,246,.12)', fill: true, tension: .4, pointRadius: 4, borderWidth: 2.5
        }]
      },
      options: baseChartOpts()
    });
  }

  function drawToday() {
    const canvas = document.getElementById('dash-today');
    if (!canvas) return;
    if (!chartAvailable()) { canvas.parentElement.innerHTML = '<p class="muted small">Charts require internet access.</p>'; return; }
    const total = (t.present || 0) + (t.absent || 0) + (t.late || 0) + (t.excused || 0);
    if (total === 0) {
      canvas.parentElement.innerHTML = '<div class="empty-state"><div class="big">🗓️</div>No attendance marked today.</div>';
      return;
    }
    new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Present', 'Absent', 'Late', 'Excused'],
        datasets: [{
          data: [t.present || 0, t.absent || 0, t.late || 0, t.excused || 0],
          backgroundColor: ['#16a34a', '#dc2626', '#d97706', '#0284c7'],
          borderWidth: 0
        }]
      },
      options: {
        cutout: '68%',
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { family: 'Inter', size: 12 } } } }
      }
    });
  }
}

function baseChartOpts() {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: '#0f172a', padding: 10, cornerRadius: 8 }
    },
    scales: {
      y: { beginAtZero: true, grid: { color: 'rgba(15,23,42,.06)' }, ticks: { precision: 0 } },
      x: { grid: { display: false } }
    }
  };
}

function renderRecent(rows) {
  if (!rows || !rows.length) {
    return '<div class="empty-state"><div class="big">🗒️</div>No attendance recorded yet.<br><span class="small">Head to the Attendance page to mark your first session.</span></div>';
  }
  return `
    <div class="table-wrap"><table class="data">
      <thead><tr><th>Date</th><th>Student</th><th>Course</th><th>Status</th></tr></thead>
      <tbody>
        ${rows.map((r) => `
          <tr><td>${fmtDate(r.date)}</td><td>${esc(r.student_name)}</td><td>${esc(r.course_name)}</td>
          <td>${badge(r.status)}</td></tr>`).join('')}
      </tbody>
    </table></div>`;
}

function renderTop(rows) {
  if (!rows || !rows.length) {
    return '<div class="empty-state"><div class="big">🏆</div>No data yet — mark some attendance first.</div>';
  }
  return `
    <div style="display:grid;gap:12px">
      ${rows.map((r) => {
        const rate = Number(r.total) ? Math.round((Number(r.present) / Number(r.total)) * 100) : 0;
        return `
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <div><strong>${esc(r.full_name)}</strong> <span class="muted small">${esc(r.student_code)}</span></div>
              <span class="badge badge-${rate >= 90 ? 'present' : rate >= 75 ? 'late' : 'absent'}">${rate}%</span>
            </div>
            <div class="progress-track"><div class="progress-fill" style="width:${rate}%"></div></div>
          </div>`;
      }).join('')}
    </div>`;
}

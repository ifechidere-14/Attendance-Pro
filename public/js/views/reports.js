/* ============================================================
   Reports view
   ============================================================ */

let repState = { from: '', to: '', courseId: '' };

async function renderReports(el) {
  el.innerHTML = `
    <div class="card" style="margin-bottom:20px">
      <div class="sheet-toolbar" style="margin:0;align-items:flex-end">
        <div class="field" style="margin:0"><label>From</label>
          <input type="date" id="rep-from" value="${repState.from}"></div>
        <div class="field" style="margin:0"><label>To</label>
          <input type="date" id="rep-to" value="${repState.to}"></div>
        <div class="field" style="margin:0;min-width:220px"><label>Course</label>
          <select id="rep-course"><option value="">All courses</option></select></div>
        <button class="btn btn-primary" id="rep-run">Generate Report</button>
        <button class="btn btn-secondary" id="rep-csv">⬇ Export CSV</button>
      </div>
    </div>
    <div class="dash-grid">
      <div class="dash-col">
        <div class="card">
          <div class="card-head"><h3>Per-course summary</h3></div>
          <div id="rep-overview"></div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Attendance trend</h3></div>
          <div class="chart-box" style="height:280px"><canvas id="rep-trend"></canvas></div>
        </div>
      </div>
      <div class="dash-col">
        <div class="card">
          <div class="card-head"><h3>Per-student summary</h3></div>
          <div id="rep-students"></div>
        </div>
      </div>
    </div>
  `;

  el.querySelector('#rep-from').addEventListener('change', (e) => { repState.from = e.target.value; });
  el.querySelector('#rep-to').addEventListener('change', (e) => { repState.to = e.target.value; });
  el.querySelector('#rep-course').addEventListener('change', (e) => { repState.courseId = e.target.value; });
  el.querySelector('#rep-run').addEventListener('click', () => loadReports(el));
  el.querySelector('#rep-csv').addEventListener('click', () => exportCsv(el));

  try {
    const { courses } = await API.get('/api/courses');
    el.querySelector('#rep-course').innerHTML =
      '<option value="">All courses</option>' +
      courses.map((c) => `<option value="${c.id}">${esc(c.course_code)} — ${esc(c.course_name)}</option>`).join('');
  } catch (_) { /* course filter optional */ }

  loadReports(el);
}

async function loadReports(el) {
  const qs = new URLSearchParams();
  if (repState.from) qs.set('from', repState.from);
  if (repState.to) qs.set('to', repState.to);
  if (repState.courseId) qs.set('courseId', repState.courseId);
  const suffix = qs.toString() ? '?' + qs.toString() : '';

  el.querySelector('#rep-overview').innerHTML = '<p class="muted">Loading…</p>';
  el.querySelector('#rep-students').innerHTML = '<p class="muted">Loading…</p>';

  try {
    const [overview, students, trend] = await Promise.all([
      API.get('/api/reports/overview' + suffix),
      API.get('/api/reports/students' + suffix),
      API.get('/api/reports/trend' + suffix)
    ]);

    renderOverviewTable(el, overview.courses || []);
    renderStudentsTable(el, students.students || []);
    renderTrendChart(el, trend.trend || []);
  } catch (err) {
    el.querySelector('#rep-overview').innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
    el.querySelector('#rep-students').innerHTML = '';
  }
}

function pct(part, total) {
  return total ? Math.round((part / total) * 100) : 0;
}

function renderOverviewTable(el, rows) {
  const box = el.querySelector('#rep-overview');
  if (!rows.length) {
    box.innerHTML = '<div class="empty-state"><div class="big">📊</div>No attendance data for this filter.</div>';
    return;
  }
  box.innerHTML = `
    <div class="table-wrap"><table class="data">
      <thead><tr><th>Course</th><th>Instructor</th><th style="text-align:center">Present</th>
        <th style="text-align:center">Absent</th><th style="text-align:center">Late</th>
        <th style="text-align:center">Rate</th></tr></thead>
      <tbody>
        ${rows.map((r) => {
          const rate = pct(Number(r.present), Number(r.total_records));
          return `<tr>
            <td><strong>${esc(r.course_code)}</strong><br><span class="muted small">${esc(r.course_name)}</span></td>
            <td>${esc(r.instructor_name) || '—'}</td>
            <td style="text-align:center">${r.present}</td>
            <td style="text-align:center">${r.absent}</td>
            <td style="text-align:center">${r.late}</td>
            <td style="text-align:center"><span class="badge badge-${rate >= 90 ? 'present' : rate >= 75 ? 'late' : 'absent'}">${rate}%</span></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>`;
}

function renderStudentsTable(el, rows) {
  const box = el.querySelector('#rep-students');
  if (!rows.length) {
    box.innerHTML = '<div class="empty-state"><div class="big">🧑‍🎓</div>No data for this filter.</div>';
    return;
  }
  const sorted = [...rows].sort((a, b) => pct(b.present, b.total_records) - pct(a.present, a.total_records));
  box.innerHTML = `
    <div class="table-wrap"><table class="data">
      <thead><tr><th>Student</th><th style="text-align:center">Present</th>
        <th style="text-align:center">Absent</th><th style="text-align:center">Rate</th></tr></thead>
      <tbody>
        ${sorted.map((r) => {
          const rate = pct(Number(r.present), Number(r.total_records));
          return `<tr>
            <td>${esc(r.full_name)}<br><span class="muted small">${esc(r.student_code)}</span></td>
            <td style="text-align:center">${r.present}</td>
            <td style="text-align:center">${r.absent}</td>
            <td style="text-align:center">
              <div style="display:flex;align-items:center;gap:8px">
                <div class="progress-track" style="flex:1"><div class="progress-fill" style="width:${rate}%"></div></div>
                <strong class="small">${rate}%</strong>
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>`;
}

function renderTrendChart(el, rows) {
  const canvas = el.querySelector('#rep-trend');
  if (!canvas) return;
  if (!chartAvailable()) { canvas.parentElement.innerHTML = '<p class="muted small">Charts require internet access (Chart.js CDN).</p>'; return; }
  if (!rows.length) {
    canvas.parentElement.innerHTML = '<div class="empty-state"><div class="big">📈</div>No trend data for this filter.</div>';
    return;
  }
  new Chart(canvas, {
    type: 'line',
    data: {
      labels: rows.map((r) => fmtDate(r.date)),
      datasets: [
        { label: 'Present', data: rows.map((r) => r.present), borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,.1)', fill: true, tension: .35, pointRadius: 3 },
        { label: 'Absent', data: rows.map((r) => r.absent), borderColor: '#dc2626', backgroundColor: 'rgba(220,38,38,.08)', fill: true, tension: .35, pointRadius: 3 },
        { label: 'Late', data: rows.map((r) => r.late), borderColor: '#d97706', tension: .35, pointRadius: 3, borderDash: [4, 3] }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { family: 'Inter', size: 12 } } },
        tooltip: { backgroundColor: '#0f172a', padding: 10, cornerRadius: 8 }
      },
      scales: { y: { beginAtZero: true, grid: { color: 'rgba(15,23,42,.06)' } }, x: { grid: { display: false } } }
    }
  });
}

function exportCsv(el) {
  const tables = el.querySelectorAll('table.data');
  if (!tables.length) return toast('Generate a report first.', 'info');
  const rows = [];
  tables.forEach((t, ti) => {
    if (ti > 0) rows.push([]);
    t.querySelectorAll('tr').forEach((tr) => {
      const cells = [...tr.children].map((c) => {
        let txt = (c.textContent || '').replace(/\s+/g, ' ').trim();
        txt = txt.replace(/"/g, '""');
        return `"${txt}"`;
      });
      rows.push(cells.join(','));
    });
  });
  const csv = rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `attendance-report-${todayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Report exported.');
}
/* ============================================================
   Students view
   ============================================================ */

let studentState = { page: 1, search: '' };

async function renderStudents(el) {
  const user = (await API.get('/api/auth/me').catch(() => null)) || {};
  const isAdmin = user?.user?.role === 'admin';

  el.innerHTML = `
    <div class="toolbar">
      <div class="search-wrap">
        <input class="search-input" id="stu-search" placeholder="Search name, code or class…" value="${esc(studentState.search)}">
      </div>
      <span class="muted small" id="stu-count"></span>
      <div style="flex:1"></div>
      ${isAdmin ? '<button class="btn btn-primary" id="stu-add">＋ Add Student</button>' : ''}
    </div>
    <div class="card">
      <div class="table-wrap"><table class="data" id="stu-table">
        <thead><tr>
          <th>Code</th><th>Full Name</th><th>Class</th><th>Email</th>
          <th style="text-align:center">Enrolled</th><th style="text-align:right">Actions</th>
        </tr></thead>
        <tbody id="stu-tbody"><tr><td colspan="6" class="empty-state">Loading…</td></tr></tbody>
      </table></div>
      <div class="pager" id="stu-pager" hidden>
        <span id="stu-page-info"></span>
        <button class="icon-btn" id="stu-prev">‹</button>
        <button class="icon-btn" id="stu-next">›</button>
      </div>
    </div>
  `;

  const search = el.querySelector('#stu-search');
  search.addEventListener('input', debounce(() => {
    studentState.search = search.value.trim();
    studentState.page = 1;
    loadStudents(el);
  }, 350));

  el.querySelector('#stu-prev')?.addEventListener('click', () => {
    if (studentState.page > 1) { studentState.page--; loadStudents(el); }
  });
  el.querySelector('#stu-next')?.addEventListener('click', () => {
    studentState.page++; loadStudents(el);
  });

  const addBtn = el.querySelector('#stu-add');
  if (addBtn) addBtn.addEventListener('click', () => openStudentModal(el, null));

  loadStudents(el);
}

async function loadStudents(el) {
  const tbody = el.querySelector('#stu-tbody');
  const pager = el.querySelector('#stu-pager');
  const info = el.querySelector('#stu-page-info');
  const count = el.querySelector('#stu-count');
  try {
    const url = `/api/students?page=${studentState.page}&limit=15&search=${encodeURIComponent(studentState.search)}`;
    const data = await API.get(url);
    const rows = data.students || [];
    const totalPages = Math.max(Math.ceil(data.total / 15), 1);
    count.textContent = `${data.total} student${data.total === 1 ? '' : 's'} found`;
    pager.hidden = totalPages <= 1;
    info.textContent = `Page ${data.page} of ${totalPages}`;
    el.querySelector('#stu-prev').disabled = data.page <= 1;
    el.querySelector('#stu-next').disabled = data.page >= totalPages;

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><div class="big">🔍</div>No students found.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map((s) => `
      <tr>
        <td><span class="badge badge-neutral">${esc(s.student_code)}</span></td>
        <td><strong>${esc(s.full_name)}</strong></td>
        <td>${esc(s.class_name) || '—'}</td>
        <td>${esc(s.email) || '—'}</td>
        <td style="text-align:center"><span class="badge badge-admin">${s.course_count ?? 0} course${s.course_count === 1 ? '' : 's'}</span></td>
        <td>
          <div class="row-actions" style="justify-content:flex-end">
            <button class="icon-btn" data-act="view" data-id="${s.id}" title="Attendance history">📒</button>
            <button class="icon-btn" data-act="edit" data-id="${s.id}" title="Edit">✏️</button>
            <button class="icon-btn" data-act="del" data-id="${s.id}" title="Delete" style="color:var(--absent)">🗑️</button>
          </div>
        </td>
      </tr>`).join('');

    tbody.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.act;
        const id = btn.dataset.id;
        if (act === 'view') openStudentHistory(id);
        else if (act === 'edit') editStudent(id, el);
        else if (act === 'del') delStudent(id, el);
      });
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">${esc(err.message)}</td></tr>`;
  }
}

/* ---------- add / edit student modal ---------- */
function openStudentModal(el, student) {
  openModal(`
    <div class="modal">
      <div class="modal-head"><h3>${student ? 'Edit Student' : 'Add Student'}</h3>
        <button class="icon-btn" onclick="closeModal()">✕</button></div>
      <div class="modal-body">
        <form id="student-form" class="form-grid">
          <div class="field"><label>Student Code *</label>
            <input name="student_code" required value="${esc(student?.student_code || '')}" placeholder="e.g. STU-2024-001"></div>
          <div class="field"><label>Full Name *</label>
            <input name="full_name" required value="${esc(student?.full_name || '')}" placeholder="Jane Doe"></div>
          <div class="field"><label>Class / Group</label>
            <input name="class_name" value="${esc(student?.class_name || '')}" placeholder="e.g. Grade 10A"></div>
          <div class="field"><label>Enrollment Date</label>
            <input name="enrollment_date" type="date" value="${student?.enrollment_date ? String(student.enrollment_date).slice(0, 10) : todayISO()}"></div>
          <div class="field full"><label>Email</label>
            <input name="email" type="email" value="${esc(student?.email || '')}" placeholder="jane@school.edu"></div>
          <div class="field full"><label>Phone</label>
            <input name="phone" value="${esc(student?.phone || '')}" placeholder="+1 555 0100"></div>
          <div class="field full" id="student-form-error"></div>
        </form>
      </div>
      <div class="modal-foot">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="student-save">${student ? 'Save Changes' : 'Add Student'}</button>
      </div>
    </div>`);

  document.getElementById('student-save').addEventListener('click', async () => {
    const form = document.getElementById('student-form');
    const payload = {
      student_code: form.student_code.value.trim(),
      full_name: form.full_name.value.trim(),
      class_name: form.class_name.value.trim() || null,
      email: form.email.value.trim() || null,
      phone: form.phone.value.trim() || null,
      enrollment_date: form.enrollment_date.value || null
    };
    const errBox = document.getElementById('student-form-error');
    try {
      if (student) await API.put('/api/students/' + student.id, payload);
      else await API.post('/api/students', payload);
      closeModal();
      toast(student ? 'Student updated.' : 'Student added.');
      loadStudents(el);
    } catch (err) {
      errBox.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
    }
  });
}

async function editStudent(id, el) {
  try {
    const { student } = await API.get('/api/students/' + id);
    openStudentModal(el, student);
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function delStudent(id, el) {
  openModal(`
    <div class="modal" style="max-width:420px">
      <div class="modal-head"><h3>Delete student?</h3>
        <button class="icon-btn" onclick="closeModal()">✕</button></div>
      <div class="modal-body">
        <p>This permanently removes the student and all their attendance records. This cannot be undone.</p>
      </div>
      <div class="modal-foot">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-danger" id="del-confirm">Delete</button>
      </div>
    </div>`);
  document.getElementById('del-confirm').addEventListener('click', async () => {
    try {
      await API.del('/api/students/' + id);
      closeModal();
      toast('Student deleted.', 'info');
      loadStudents(el);
    } catch (err) {
      toast(err.message, 'error');
      closeModal();
    }
  });
}

/* ---------- student attendance history ---------- */
async function openStudentHistory(id) {
  try {
    const [{ student }, { records }] = await Promise.all([
      API.get('/api/students/' + id),
      API.get('/api/attendance/student/' + id)
    ]);

    const stats = { present: 0, absent: 0, late: 0, excused: 0 };
    records.forEach((r) => { stats[r.status] = (stats[r.status] || 0) + 1; });
    const total = records.length;
    const rate = total ? Math.round((stats.present / total) * 100) : 0;

    openModal(`
      <div class="modal" style="max-width:680px">
        <div class="modal-head"><h3>${esc(student.full_name)} — Attendance</h3>
          <button class="icon-btn" onclick="closeModal()">✕</button></div>
        <div class="modal-body">
          <div class="stat-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
            <div class="stat-card stat-green" style="padding:12px"><div class="stat-value" style="font-size:20px">${stats.present}</div><div class="stat-label">Present</div></div>
            <div class="stat-card stat-red" style="padding:12px"><div class="stat-value" style="font-size:20px">${stats.absent}</div><div class="stat-label">Absent</div></div>
            <div class="stat-card stat-amber" style="padding:12px"><div class="stat-value" style="font-size:20px">${stats.late}</div><div class="stat-label">Late</div></div>
            <div class="stat-card stat-cyan" style="padding:12px"><div class="stat-value" style="font-size:20px">${stats.excused}</div><div class="stat-label">Excused</div></div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <span class="muted">Overall presence rate</span>
            <strong>${rate}%</strong>
          </div>
          <div class="progress-track" style="margin-bottom:16px"><div class="progress-fill" style="width:${rate}%"></div></div>
          ${total === 0
            ? '<div class="empty-state"><div class="big">📭</div>No attendance recorded yet.</div>'
            : `<div class="table-wrap" style="max-height:360px;overflow-y:auto"><table class="data">
                <thead><tr><th>Date</th><th>Course</th><th>Status</th><th>Notes</th></tr></thead>
                <tbody>${records.map((r) => `
                  <tr><td>${fmtDate(r.date)}</td><td>${esc(r.course_code)} — ${esc(r.course_name)}</td>
                  <td>${badge(r.status)}</td><td>${esc(r.notes) || '—'}</td></tr>`).join('')}
                </tbody></table></div>`}
        </div>
      </div>`);
  } catch (err) {
    toast(err.message, 'error');
  }
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
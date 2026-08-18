/* ============================================================
   Attendance view
   ============================================================ */

let attState = { courseId: '', date: todayISO(), courseCache: [] };

async function renderAttendance(el, params) {
  if (params && params.courseId) attState.courseId = params.courseId;

  el.innerHTML = `
    <div class="card">
      <div class="card-head"><h3>Mark attendance</h3></div>
      <div class="sheet-toolbar">
        <div class="field" style="margin:0;min-width:240px">
          <label>Course</label>
          <select id="att-course"><option value="">Loading courses…</option></select>
        </div>
        <div class="field" style="margin:0">
          <label>Date</label>
          <input type="date" id="att-date" value="${attState.date}">
        </div>
        <button class="btn btn-primary" id="att-load">Load Sheet</button>
        <div style="flex:1"></div>
        <div class="status-pills">
          <button class="btn btn-sm btn-secondary status-pill" data-all="present">All Present</button>
          <button class="btn btn-sm btn-secondary status-pill" data-all="absent">All Absent</button>
          <button class="btn btn-sm btn-secondary status-pill" data-all="late">All Late</button>
        </div>
      </div>
      <div id="att-sheet"></div>
      <div class="modal-foot" style="padding:14px 0 0;border-top:none;justify-content:flex-start">
        <button class="btn btn-primary" id="att-save" disabled>💾 Save Attendance</button>
        <span class="muted small" id="att-status-hint"></span>
      </div>
    </div>
  `;

  const courseSel = el.querySelector('#att-course');
  const dateInput = el.querySelector('#att-date');
  dateInput.addEventListener('change', () => { attState.date = dateInput.value; });

  el.querySelector('#att-load').addEventListener('click', () => {
    attState.courseId = courseSel.value;
    attState.date = dateInput.value;
    loadSheet(el);
  });

  el.querySelectorAll('.status-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      const status = btn.dataset.all;
      el.querySelectorAll('.att-status').forEach((sel) => { sel.value = status; });
      toast(`All marked as ${status}.`, 'info');
      updateSaveState(el);
    });
  });

  el.querySelector('#att-save').addEventListener('click', () => saveSheet(el));

  try {
    const { courses } = await API.get('/api/courses');
    attState.courseCache = courses;
    courseSel.innerHTML = '<option value="">— Select a course —</option>' +
      courses.map((c) => `<option value="${c.id}" ${c.id === attState.courseId ? 'selected' : ''}>${esc(c.course_code)} — ${esc(c.course_name)}</option>`).join('');
    if (attState.courseId) loadSheet(el);
  } catch (err) {
    courseSel.innerHTML = `<option value="">${esc(err.message)}</option>`;
  }
}

async function loadSheet(el) {
  const sheet = el.querySelector('#att-sheet');
  const saveBtn = el.querySelector('#att-save');
  if (!attState.courseId) {
    sheet.innerHTML = '<div class="empty-state"><div class="big">👆</div>Select a course and date to load the attendance sheet.</div>';
    return;
  }
  saveBtn.disabled = true;
  sheet.innerHTML = '<p class="muted">Loading sheet…</p>';
  try {
    const data = await API.get(`/api/attendance/course/${attState.courseId}?date=${attState.date}`);
    const students = data.students || [];
    if (!students.length) {
      sheet.innerHTML = '<div class="empty-state"><div class="big">🧑‍🎓</div>No students enrolled in this course yet.<br><span class="small">Add students via the Courses → Roster.</span></div>';
      return;
    }
    sheet.innerHTML = `
      <div class="table-wrap"><table class="data" id="att-table">
        <thead><tr>
          <th style="width:90px">Code</th><th>Student</th><th style="width:170px">Status</th>
          <th>Notes</th>
        </tr></thead>
        <tbody>
          ${students.map((s) => `
            <tr>
              <td><span class="badge badge-neutral">${esc(s.student_code)}</span></td>
              <td><strong>${esc(s.full_name)}</strong></td>
              <td>
                <select class="att-status" data-sid="${s.student_id}" data-rid="${s.record_id || ''}">
                  ${['present', 'absent', 'late', 'excused'].map((st) =>
                    `<option value="${st}" ${(s.status || 'present') === st ? 'selected' : ''}>${st[0].toUpperCase() + st.slice(1)}</option>`).join('')}
                </select>
              </td>
              <td><input class="att-notes" style="width:100%;border:1px solid var(--border);border-radius:8px;padding:7px 10px;font-family:var(--font);font-size:13px" data-sid="${s.student_id}" value="${esc(s.notes || '')}" placeholder="Optional note…"></td>
            </tr>`).join('')}
        </tbody>
      </table></div>`;

    el.querySelectorAll('.att-status, .att-notes').forEach((ctrl) => {
      ctrl.addEventListener('change', updateSaveState);
    });
    updateSaveState(el);
  } catch (err) {
    sheet.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
  }
}

function updateSaveState(el) {
  const saveBtn = el.querySelector('#att-save');
  if (!saveBtn) return;
  const selects = el.querySelectorAll('.att-status');
  saveBtn.disabled = selects.length === 0;
  const counts = {};
  selects.forEach((s) => { counts[s.value] = (counts[s.value] || 0) + 1; });
  el.querySelector('#att-status-hint').textContent = selects.length
    ? `Ready — ${selects.length} students: ` + Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')
    : '';
}

async function saveSheet(el) {
  const saveBtn = el.querySelector('#att-save');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';
  const records = [...el.querySelectorAll('.att-status')].map((sel) => ({
    studentId: sel.dataset.sid,
    status: sel.value,
    notes: (el.querySelector(`.att-notes[data-sid="${sel.dataset.sid}"]`) || {}).value || null
  }));
  try {
    const res = await API.post('/api/attendance/mark', {
      courseId: attState.courseId,
      date: attState.date,
      records
    });
    toast(`Attendance saved — ${res.saved} record${res.saved === 1 ? '' : 's'} for ${fmtDate(attState.date)}.`);
    loadSheet(el); // reload to reflect saved state
  } catch (err) {
    toast(err.message, 'error');
    saveBtn.disabled = false;
    saveBtn.textContent = '💾 Save Attendance';
  }
}